"""Agent 8: Clinician Report Agent — structured SOAP note via OpenAI GPT-4o."""

import json
import re

from ai_health_guide.agents.base import BaseAgent
from ai_health_guide.models.session import SessionState
from ai_health_guide.models.report import SOAPNote
from ai_health_guide.tools.soap_formatter import validate_soap
from ai_health_guide.clients.openai_client import OpenAIReportClient


class ClinicianReportAgent(BaseAgent):
    """Generates a structured SOAP note for the receiving clinician using GPT-4o."""

    stage = "report"

    SYSTEM_PROMPT = """Generate a structured SOAP note in {clinical_language} for the receiving clinician.
Use the FULL conversation transcript below along with the extracted clinical data.

=== CLINICAL DATA ===
- Chief complaint (patient's words): {chief_complaint}
- Language spoken: {patient_language}
- Severity (self-rated): {severity}/10
- Structured symptoms: {symptoms}
- ABCDE assessment: {abcde}
- Red flags: {red_flags}
- Visual findings: {visual_observations}
- Triage level: {triage_color} — {triage_rationale}
- Recommended facility type: {facility_type}
- Urgency: {urgency_description}

=== FULL CONVERSATION TRANSCRIPT ===
{conversation_transcript}

=== INSTRUCTIONS ===
Based on ALL the above, return a JSON object:
{{
  "subjective": "<Chief complaint in patient's own words, HPI derived from the conversation, symptom timeline, severity. Reference specific patient statements.>",
  "objective": "<Visual findings from uploaded images (if any), structured interview observations, ABCDE assessment details>",
  "assessment": "<Triage classification with full rationale, ALL red flags detected, differential considerations based on the conversation>",
  "plan": "<Recommended facility, urgency level, suggested next steps for the clinician, interpreter needs>"
}}

Rules:
- Write in clinical language ({clinical_language}).
- Display the triage color prominently in the Assessment section.
- List ALL detected red flags, even if they appear benign.
- Reference specific details from the conversation transcript.
- Note the patient's preferred language ({patient_language}) for interpreter needs.
- Do not include patient identifiers beyond what was provided.
- Be thorough — this SOAP note should give the receiving clinician a complete picture.
"""

    def __init__(self, medgemma, config):
        super().__init__(medgemma, config)
        self.openai_client = OpenAIReportClient(config)

    async def execute(self, session: SessionState, corrections: list[str] | None = None) -> dict:
        red_flags_text  = "\n".join(f"- [{rf.severity.upper()}] {rf.symptom}: {rf.description}" for rf in session.red_flags) or "None detected"
        visual_text     = "; ".join(session.visual_observations) or "No image provided"
        symptoms_text   = str(session.structured_symptoms) if session.structured_symptoms else "Not collected"
        abcde_text      = str(session.abcde_assessment.model_dump()) if session.abcde_assessment else "Not assessed"

        triage_color    = session.triage.color.value       if session.triage else "NOT CLASSIFIED"
        triage_rationale = session.triage.rationale        if session.triage else ""
        facility_type   = session.triage.facility_type_needed if session.triage else ""
        urgency_desc    = session.triage.urgency_description  if session.triage else ""

        # Build full conversation transcript
        transcript_lines = []
        for msg in session.conversation_history:
            role_label = "Patient" if msg.role == "patient" else "Clinician Assistant"
            transcript_lines.append(f"{role_label}: {msg.content}")
        conversation_transcript = "\n".join(transcript_lines) or "(no conversation recorded)"

        system_prompt = self.SYSTEM_PROMPT.format(
            clinical_language=session.clinical_language,
            chief_complaint=session.chief_complaint_english or session.chief_complaint,
            patient_language=session.patient_language,
            severity=session.severity,
            symptoms=symptoms_text,
            abcde=abcde_text,
            red_flags=red_flags_text,
            visual_observations=visual_text,
            triage_color=triage_color,
            triage_rationale=triage_rationale,
            facility_type=facility_type,
            urgency_description=urgency_desc,
            conversation_transcript=conversation_transcript,
        )
        if corrections:
            system_prompt += f"\n\nCorrections required: {'; '.join(corrections)}"

        messages = [{"role": "system", "content": system_prompt}]
        raw    = await self.openai_client.generate(messages)
        parsed = self._parse_json(raw)

        soap = SOAPNote(
            subjective=parsed.get("subjective", ""),
            objective=parsed.get("objective", ""),
            assessment=parsed.get("assessment", ""),
            plan=parsed.get("plan", ""),
            triage_color=session.triage.color if session.triage else "GREEN",
            red_flags_summary=[rf.symptom for rf in session.red_flags],
            language=session.clinical_language,
            patient_language=session.patient_language,
        )

        # Log validation issues but do not block
        issues = validate_soap(soap)
        if issues:
            print(f"[ClinicianReportAgent] SOAP validation issues: {issues}")

        return {"clinician_report": soap}

    def _parse_json(self, text: str) -> dict:
        text = re.sub(r"```(?:json)?\s*", "", text)
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass
        return {"subjective": text}
