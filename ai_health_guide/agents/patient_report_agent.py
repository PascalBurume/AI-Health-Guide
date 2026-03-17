"""Agent 7: Patient Report Agent — plain-language report via OpenAI GPT-4o."""

import json
import re

from ai_health_guide.agents.base import BaseAgent
from ai_health_guide.models.session import SessionState
from ai_health_guide.models.report import PatientReport
from ai_health_guide.tools.disclaimer_checker import append_disclaimer
from ai_health_guide.clients.openai_client import OpenAIReportClient


class PatientReportAgent(BaseAgent):
    """Generates a plain-language patient-facing health summary using GPT-4o."""

    stage = "report"

    SYSTEM_PROMPT = """You are a compassionate medical assistant generating a patient-facing health summary.
Write entirely in {patient_language}. Use simple, non-clinical language — no medical jargon.
Be reassuring but honest about the urgency level.

You have access to the FULL conversation between the patient and the clinical assistant below.
Use ALL the information from the conversation to create a thorough, detailed report.

=== CLINICAL DATA ===
- Chief complaint: {chief_complaint}
- Severity: {severity}/10
- Red flags detected: {red_flags}
- Visual findings: {visual_observations}
- Triage level: {triage_color}
- Recommended care type: {facility_type}
- Urgency: {urgency_description}
- Structured symptoms: {symptoms}

=== FULL CONVERSATION ===
{conversation_transcript}

=== INSTRUCTIONS ===
Based on ALL the above information, return a JSON object:
{{
  "summary": "<Comprehensive summary of what the patient described and what was observed — reference specific details from the conversation>",
  "what_we_found": "<Key findings from the interview and any images, citing specific symptoms and concerns mentioned>",
  "what_to_do_next": "<Clear numbered action steps including the recommended care type>",
  "facility_recommendation": "<Type of facility to visit based on triage level>",
  "directions_summary": "<General guidance on seeking appropriate care>",
  "what_to_tell_doctor": "<Prepared talking points the patient can say verbatim to the doctor, referencing ALL symptoms discussed>"
}}

Rules:
- Write entirely in {patient_language}.
- Reference specific details from the conversation — do NOT be generic.
- Keep each section thorough but clear (up to 200 words per section).
- Do NOT include a disclaimer — it will be appended automatically.
"""

    def __init__(self, medgemma, config):
        super().__init__(medgemma, config)
        self.openai_client = OpenAIReportClient(config)

    async def execute(self, session: SessionState, corrections: list[str] | None = None) -> dict:
        red_flags_text   = ", ".join(rf.symptom for rf in session.red_flags) or "none detected"
        visual_text      = "; ".join(session.visual_observations) or "none"
        symptoms_text    = str(session.structured_symptoms) if session.structured_symptoms else "as described"
        facility_type    = session.triage.facility_type_needed if session.triage else "healthcare provider"

        cc = session.chief_complaint
        if session.patient_language == "en" and session.chief_complaint_english:
            cc = session.chief_complaint_english

        # Build full conversation transcript
        transcript_lines = []
        for msg in session.conversation_history:
            role_label = "Patient" if msg.role == "patient" else "Assistant"
            transcript_lines.append(f"{role_label}: {msg.content}")
        conversation_transcript = "\n".join(transcript_lines) or "(no conversation recorded)"

        system_prompt = self.SYSTEM_PROMPT.format(
            patient_language=session.patient_language,
            chief_complaint=cc,
            severity=session.severity,
            symptoms=symptoms_text,
            red_flags=red_flags_text,
            visual_observations=visual_text,
            triage_color=session.triage.color.value if session.triage else "UNKNOWN",
            facility_type=facility_type,
            urgency_description=session.triage.urgency_description if session.triage else "",
            conversation_transcript=conversation_transcript,
        )
        if corrections:
            system_prompt += f"\n\nCorrections required: {'; '.join(corrections)}"

        messages = [{"role": "system", "content": system_prompt}]
        raw    = await self.openai_client.generate(messages)
        parsed = self._parse_json(raw)

        # Append mandatory disclaimer
        summary_with_disclaimer = append_disclaimer(
            parsed.get("summary", raw),
            language=session.patient_language,
        )

        report = PatientReport(
            summary=summary_with_disclaimer,
            what_we_found=parsed.get("what_we_found", ""),
            what_to_do_next=parsed.get("what_to_do_next", ""),
            facility_recommendation=parsed.get("facility_recommendation", facility_type),
            directions_summary=parsed.get("directions_summary", ""),
            what_to_tell_doctor=parsed.get("what_to_tell_doctor", ""),
            disclaimer=self._disclaimer(session.patient_language),
            language=session.patient_language,
        )

        return {"patient_report": report}

    def _parse_json(self, text: str) -> dict:
        text = re.sub(r"```(?:json)?\s*", "", text)
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass
        return {"summary": text}

    def _disclaimer(self, language: str) -> str:
        disclaimers = {
            "en": "This is NOT a medical diagnosis. Please consult a qualified healthcare professional.",
            "fr": "Ceci n'est PAS un diagnostic médical. Veuillez consulter un professionnel de santé qualifié.",
            "ja": "これは医学的診断ではありません。資格のある医療専門家に相談してください。",
            "ar": "هذا ليس تشخيصاً طبياً. يرجى استشارة متخصص رعاية صحية مؤهل.",
            "sw": "Hii si utambuzi wa kimatibabu. Tafadhali wasiliana na mtaalamu wa afya aliyehitimu.",
            "es": "Esto NO es un diagnóstico médico. Por favor consulte a un profesional de salud calificado.",
        }
        return disclaimers.get(language, disclaimers["en"])
