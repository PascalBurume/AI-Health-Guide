"""Agent 4: Visual Interpretation Agent — describes symptom images, never diagnoses."""

import json
import re

from ai_health_guide.agents.base import BaseAgent
from ai_health_guide.models.session import SessionState


class VisualInterpretationAgent(BaseAgent):
    """Analyzes patient-uploaded symptom images using MedGemma 1.5 multimodal."""

    stage = "visual"

    SYSTEM_PROMPT = """You are a medical image description assistant.
You DESCRIBE what is visible in images. You NEVER diagnose.

Chief complaint context: {chief_complaint}
Described symptoms: {symptoms}

For the uploaded image, provide:
1. Description: color, size, shape, texture, location on body (if visible)
2. Consistency: does the visual appearance match the patient's described symptoms?
3. Additional observations: anything notable not mentioned by the patient
4. Quality note: is the image clear enough for useful observation?

Language rules:
- ALLOWED: "The image shows a raised, reddish area approximately 3cm in diameter on the forearm."
- ALLOWED: "This appearance is sometimes associated with conditions that should be evaluated by a professional."
- FORBIDDEN: "This is [condition]." / "You have [diagnosis]."
- FORBIDDEN: Any definitive diagnostic statement.

Return a JSON object:
{{
  "visual_observations": ["<observation 1>", "<observation 2>", ...],
  "consistency_with_symptoms": "<brief note on whether visual matches described symptoms>",
  "image_quality": "clear" | "adequate" | "poor",
  "response": "<message to show the patient about the image in {patient_language}>"
}}
"""

    async def execute(self, session: SessionState, corrections: list[str] | None = None) -> dict:
        if not session.image_data:
            return {"image_analyzed": False, "visual_observations": []}

        prompt = self.SYSTEM_PROMPT.format(
            chief_complaint=session.chief_complaint or "not specified",
            symptoms=", ".join(session.structured_symptoms.keys()) or "not yet collected",
            patient_language=session.patient_language,
        )
        if corrections:
            prompt += f"\n\nCorrections required: {'; '.join(corrections)}"

        messages = [self._system_message(prompt)]
        raw      = await self.medgemma.generate(messages, image_b64=session.image_data)
        parsed   = self._parse_json(raw)

        return {
            "image_analyzed":            True,
            "visual_observations":       parsed.get("visual_observations", []),
            "consistency_with_symptoms": parsed.get("consistency_with_symptoms", ""),
            "agent_response":            parsed.get("response", raw),
        }

    def _parse_json(self, text: str) -> dict:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass
        return {"response": text}
