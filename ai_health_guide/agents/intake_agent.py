"""Agent 2: Language Detection + Symptom Intake Agent."""

from ai_health_guide.agents.base import BaseAgent
from ai_health_guide.models.session import SessionState, Message
from ai_health_guide.tools.language_detection import detect_language


class IntakeAgent(BaseAgent):
    """Detects patient language and collects the chief complaint."""

    stage = "intake"

    SYSTEM_PROMPT = """You are a healthcare intake assistant. Your tasks:
1. Greet the patient warmly in their detected language ({patient_language}).
2. Ask them to describe their primary health concern.
3. Confirm you understood correctly by summarizing back to them.
4. Extract a concise chief complaint in both the patient's language and English.

Rules:
- Never use diagnostic language ("you have", "this is").
- Use simple, reassuring language appropriate for a non-medical audience.
- If language detection is uncertain, ask the patient to confirm their preferred language.
- Your entire response must be in {patient_language}.

Return a JSON object with:
{{
  "response": "<your message to the patient>",
  "chief_complaint": "<chief complaint in patient's language>",
  "chief_complaint_english": "<chief complaint translated to English>",
  "intake_complete": true or false
}}
"""

    async def execute(self, session: SessionState, corrections: list[str] | None = None) -> dict:
        # Use the explicit language set by the user; only auto-detect when it is
        # still the default AND we have enough text to detect reliably (>10 chars).
        last_message = session.conversation_history[-1].content if session.conversation_history else ""
        if session.patient_language == "en" and len(last_message) > 10:
            detected_lang = detect_language(last_message) or session.patient_language
        else:
            detected_lang = session.patient_language

        # Keep session in sync with whatever language we resolved
        session.patient_language = detected_lang

        prompt = self.SYSTEM_PROMPT.format(patient_language=detected_lang)
        if corrections:
            prompt += f"\n\nCorrections required: {'; '.join(corrections)}"

        messages = [
            self._system_message(prompt),
            *self._format_history(session),
        ]

        raw = await self.medgemma.generate(messages)
        parsed = self._parse_json(raw)

        cc       = parsed.get("chief_complaint", "")
        cc_en    = parsed.get("chief_complaint_english", "")
        # When patient language is English, ensure chief_complaint is English too
        if detected_lang == "en" and cc_en:
            cc = cc_en

        return {
            "patient_language":      detected_lang,
            "chief_complaint":       cc,
            "chief_complaint_english": cc_en or cc,
            "agent_response":        parsed.get("response", raw),
            "intake_complete":       parsed.get("intake_complete", False),
        }

    def _parse_json(self, text: str) -> dict:
        """Attempt to parse JSON from model output; fall back to raw text response."""
        import json, re
        # Strip markdown code fences that small models often add
        text = re.sub(r"```(?:json)?\s*", "", text)
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass
        return {"response": text}
