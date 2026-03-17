"""Agent 3: Clinical Questioning Agent — ABCDE-structured interview with defined question count."""

import json
import re

from ai_health_guide.agents.base import BaseAgent
from ai_health_guide.models.session import SessionState
from ai_health_guide.models.clinical import ABCDEAssessment, RedFlag
from ai_health_guide.tools.red_flag_screening import screen_red_flags

# ---------- configurable bounds ----------
MIN_QUESTIONS = 6
MAX_QUESTIONS = 10


class ClinicalQuestioningAgent(BaseAgent):
    """Conducts an ABCDE clinical interview with a fixed question budget."""

    stage = "questioning"

    SYSTEM_PROMPT = """You are a clinical interview assistant conducting an ABCDE assessment.
ABCDE = Airway, Breathing, Circulation, Disability, Exposure.

Chief complaint: {chief_complaint}
Patient language: {patient_language}
Question {current_q} of {total_q} — you MUST ask exactly one question per turn.

Progress so far:
{abcde_progress}

Rules:
- Ask ONE clear, focused question per turn.
- Use simple, non-clinical language the patient can understand.
- Respond entirely in {patient_language}.
- NEVER diagnose or name diseases.
- Cover ABCDE categories systematically before finishing.
- Include the question number in your response, e.g. "({current_q}/{total_q})".

Also extract from the patient's last answer:
- severity: integer 0-10 if the patient mentions pain / severity
- symptoms: a dict of symptom_name: description
- red_flags: any concerning symptoms detected

Return a JSON object:
{{
  "response": "<your next question to the patient, prefixed with ({current_q}/{total_q})>",
  "severity": <integer 0-10 or null if not mentioned>,
  "symptoms": {{"<symptom>": "<details>"}},
  "abcde_update": {{"airway": "<note or null>", "breathing": "<note or null>", "circulation": "<note or null>", "disability": "<note or null>", "exposure": "<note or null>"}},
  "questioning_complete": false
}}

When this is question {total_q}, set "questioning_complete": true and include a brief wrap-up
message telling the patient the interview is done and you are now preparing the assessment.
"""

    async def execute(self, session: SessionState, corrections: list[str] | None = None) -> dict:
        turn = session.questioning_turns + 1
        total = min(max(self.config.max_questioning_turns, MIN_QUESTIONS), MAX_QUESTIONS)

        # Build ABCDE progress summary
        abcde = session.abcde_assessment
        progress_lines = []
        if abcde:
            for cat in ("airway", "breathing", "circulation", "disability", "exposure"):
                val = getattr(abcde, cat, None)
                progress_lines.append(f"  {cat.title()}: {val or 'not yet assessed'}")
        abcde_progress = "\n".join(progress_lines) or "  (no data yet)"

        prompt = self.SYSTEM_PROMPT.format(
            chief_complaint=session.chief_complaint,
            patient_language=session.patient_language,
            current_q=turn,
            total_q=total,
            abcde_progress=abcde_progress,
        )
        if corrections:
            prompt += f"\n\nCorrections required: {'; '.join(corrections)}"

        messages = [
            self._system_message(prompt),
            *self._format_history(session),
        ]

        raw = await self.medgemma.generate(messages)
        parsed = self._parse_json(raw)

        # --- severity extraction (multilingual) ---
        severity = self._extract_severity(parsed, session)

        # --- ABCDE update ---
        abcde_update_raw = parsed.get("abcde_update", {})
        current_abcde = session.abcde_assessment or ABCDEAssessment()
        updated_abcde = self._merge_abcde(current_abcde, abcde_update_raw)

        # --- Symptoms ---
        new_symptoms = parsed.get("symptoms", {})
        merged_symptoms = {**session.structured_symptoms, **new_symptoms}

        # --- Red flag screening on entire conversation ---
        last_msg = session.conversation_history[-1].content if session.conversation_history else ""
        new_red_flags = screen_red_flags(last_msg)
        existing_symptoms = {rf.symptom for rf in session.red_flags}
        all_red_flags = list(session.red_flags) + [
            rf for rf in new_red_flags if rf.symptom not in existing_symptoms
        ]

        # --- completion check ---
        is_complete = turn >= total or parsed.get("questioning_complete", False)

        return {
            "questioning_turns": turn,
            "questioning_complete": is_complete,
            "severity": severity if severity > 0 else session.severity,
            "structured_symptoms": merged_symptoms,
            "abcde_assessment": updated_abcde,
            "red_flags": all_red_flags,
            "agent_response": parsed.get("response", raw),
        }

    # ------------------------------------------------------------------
    # helpers
    # ------------------------------------------------------------------

    def _extract_severity(self, parsed: dict, session: SessionState) -> int:
        """Extract severity from parsed JSON or from patient text (multilingual).

        Returns an integer 1-10 on success, or 0 if no severity can be found.
        """
        sev = parsed.get("severity")
        if isinstance(sev, (int, float)) and 1 <= sev <= 10:
            return int(sev)

        # Multilingual "X out of 10" patterns
        last_msg = session.conversation_history[-1].content if session.conversation_history else ""
        patterns = [
            r"(\d+)\s*(?:out of|/|sur|de|von|kati ya|من|点中|のうち)\s*10",
            r"(\d+)\s*/\s*10",
        ]
        for pat in patterns:
            m = re.search(pat, last_msg, re.IGNORECASE)
            if m:
                val = int(m.group(1))
                if 0 <= val <= 10:
                    return val
        return 0

    def _merge_abcde(self, current: ABCDEAssessment, update: dict) -> ABCDEAssessment:
        """Merge new ABCDE data into the existing assessment."""
        data = current.model_dump()
        for key in ("airway", "breathing", "circulation", "disability", "exposure"):
            new_val = update.get(key)
            if new_val and new_val.lower() not in ("null", "none", ""):
                data[key] = new_val
        return ABCDEAssessment.model_validate(data)

    def _parse_json(self, text: str) -> dict:
        """Parse JSON from model output, stripping code fences."""
        text = re.sub(r"```(?:json)?\s*", "", text)
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass
        return {"response": text}
