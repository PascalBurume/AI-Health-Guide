"""Agent 5: Triage Classification Agent — deterministic matrix + LLM rationale."""

import json
import re

from ai_health_guide.agents.base import BaseAgent
from ai_health_guide.models.session import SessionState
from ai_health_guide.models.clinical import TriageResult
from ai_health_guide.tools.triage_matrix import triage_decision_matrix, map_facility_type, urgency_description


class TriageClassificationAgent(BaseAgent):
    """Synthesizes clinical data into a triage classification.

    The triage COLOR is assigned by the deterministic matrix — not the LLM.
    The LLM only generates the human-readable rationale.
    """

    stage = "triage"

    RATIONALE_PROMPT = """You are a clinical triage assistant.
Based on the clinical data below, write a brief, plain-language rationale
explaining why this patient has been classified as {triage_color} triage.

The triage level has already been determined — your job is only to explain it clearly.

Patient context:
- Chief complaint: {chief_complaint}
- Severity (self-rated): {severity}/10
- Red flags detected: {red_flags}
- Visual observations: {visual_observations}
- Structured symptoms: {symptoms}

Write the rationale in {clinical_language}. Keep it under 100 words.
Return only the rationale text, no JSON.
"""

    async def execute(self, session: SessionState, corrections: list[str] | None = None) -> dict:
        # Step 1: Deterministic triage (authoritative — cannot be overridden by LLM)
        triage_color = triage_decision_matrix(
            red_flags=session.red_flags,
            severity=session.severity,
            visual_concerns=session.visual_observations,
        )

        # Step 2: LLM generates human-readable rationale
        red_flags_text  = ", ".join(rf.symptom for rf in session.red_flags) or "none"
        visual_text     = "; ".join(session.visual_observations) or "none"
        symptoms_text   = str(session.structured_symptoms) if session.structured_symptoms else "none"

        prompt = self.RATIONALE_PROMPT.format(
            triage_color=triage_color.value,
            chief_complaint=session.chief_complaint,
            severity=session.severity,
            red_flags=red_flags_text,
            visual_observations=visual_text,
            symptoms=symptoms_text,
            clinical_language=session.clinical_language,
        )
        if corrections:
            prompt += f"\n\nCorrections: {'; '.join(corrections)}"

        rationale = await self.medgemma.generate([self._system_message(prompt)])

        facility_type = map_facility_type(triage_color)
        urgency_desc  = urgency_description(triage_color)

        triage_result = TriageResult(
            color=triage_color,
            rationale=rationale.strip(),
            facility_type_needed=facility_type,
            urgency_description=urgency_desc,
            determined_by="rule_matrix",
        )

        return {"triage": triage_result}
