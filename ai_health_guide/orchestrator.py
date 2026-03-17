"""Session Orchestrator — drives the five-stage clinical pipeline."""

import asyncio
from datetime import datetime

from ai_health_guide.config import AppConfig
from ai_health_guide.clients.medgemma_client import MedGemmaClient
from ai_health_guide.models.session import SessionState, Message, Stage
from ai_health_guide.models.report import FinalReport
from ai_health_guide.models.safety import SafetyCheckResult
from ai_health_guide.agents.intake_agent import IntakeAgent
from ai_health_guide.agents.questioning_agent import ClinicalQuestioningAgent
from ai_health_guide.agents.visual_agent import VisualInterpretationAgent
from ai_health_guide.agents.triage_agent import TriageClassificationAgent
from ai_health_guide.agents.patient_report_agent import PatientReportAgent
from ai_health_guide.agents.clinician_report_agent import ClinicianReportAgent
from ai_health_guide.agents.safety_guardian import SafetyGuardian

# Maximum number of safety correction retries before hard-failing
MAX_SAFETY_RETRIES = 2


class SessionOrchestrator:
    """Central coordinator. Drives the pipeline and manages session state transitions."""

    def __init__(self, medgemma: MedGemmaClient, config: AppConfig) -> None:
        self.medgemma = medgemma
        self.config   = config

        self.safety_guardian = SafetyGuardian(medgemma, config)
        self.agents = {
            Stage.INTAKE:      IntakeAgent(medgemma, config),
            Stage.QUESTIONING: ClinicalQuestioningAgent(medgemma, config),
            Stage.VISUAL:      VisualInterpretationAgent(medgemma, config),
            Stage.TRIAGE:      TriageClassificationAgent(medgemma, config),
        }
        self.report_agents = {
            "patient":   PatientReportAgent(medgemma, config),
            "clinician": ClinicianReportAgent(medgemma, config),
        }

    async def process_message(self, session: SessionState, user_content: str) -> SessionState:
        """Process a new patient message and advance the pipeline as appropriate."""
        # Append patient message to history
        session = self._append_message(session, role="patient", content=user_content)

        # Safety check on all crisis signals immediately
        safety = await self.safety_guardian.validate(session, {})
        if any("CRISIS_DETECTED" in issue for issue in safety.issues):
            return self._flag_crisis(session, safety)

        # Run the current stage agent
        session = await self._run_stage_agent(session)

        # Advance stage if conditions are met
        session = await self._advance_stage_if_ready(session)

        return session

    async def _run_stage_agent(self, session: SessionState) -> SessionState:
        """Run the agent for the current stage with safety validation."""
        agent = self.agents.get(session.current_stage)
        if agent is None:
            return session

        corrections: list[str] | None = None
        for attempt in range(MAX_SAFETY_RETRIES + 1):
            stage_output = await agent.execute(session, corrections=corrections)

            safety_result = await self.safety_guardian.validate(session, stage_output)
            session = self._record_safety_check(session, safety_result)

            if safety_result.approved:
                # Merge stage output into session
                session = self._merge_state(session, stage_output)
                # Append agent response message to history
                agent_response = stage_output.get("agent_response", "")
                if agent_response:
                    session = self._append_message(
                        session, role="agent", content=agent_response,
                        agent_name=type(agent).__name__,
                    )
                break

            corrections = safety_result.issues
            if attempt == MAX_SAFETY_RETRIES:
                # Hard fail — log and continue without merging the unsafe output
                print(f"[Orchestrator] Safety Guardian blocked stage {session.current_stage} after {MAX_SAFETY_RETRIES} retries.")

        return session

    async def _advance_stage_if_ready(self, session: SessionState) -> SessionState:
        """Check stage completion conditions and advance to the next stage."""
        stage = session.current_stage

        if stage == Stage.INTAKE and session.chief_complaint:
            session.current_stage = Stage.QUESTIONING

        elif stage == Stage.QUESTIONING and session.questioning_complete:
            # Visual stage is conditional on image being uploaded
            if session.image_data:
                session.current_stage = Stage.VISUAL
            else:
                session = await self._run_triage_and_onward(session)

        elif stage == Stage.VISUAL and session.image_analyzed:
            session = await self._run_triage_and_onward(session)

        return session

    async def _run_triage_and_onward(self, session: SessionState) -> SessionState:
        """Run triage, then generate reports and complete."""
        # Triage
        session.current_stage = Stage.TRIAGE
        session = await self._run_stage_agent(session)

        # Generate both reports in parallel
        session.current_stage = Stage.REPORT
        session = await self._run_parallel_reports(session)

        session.current_stage = Stage.COMPLETE
        return session

    async def process_image_and_continue(self, session: SessionState) -> SessionState:
        """Run visual analysis then triage + reports (called after image upload)."""
        session.current_stage = Stage.VISUAL
        session = await self._run_stage_agent(session)
        session = await self._run_triage_and_onward(session)
        return session

    async def _run_parallel_reports(self, session: SessionState) -> SessionState:
        """Generate patient and clinician reports concurrently."""
        patient_task   = self.report_agents["patient"].execute(session)
        clinician_task = self.report_agents["clinician"].execute(session)

        patient_output, clinician_output = await asyncio.gather(patient_task, clinician_task)

        # Safety-check both reports
        for output in (patient_output, clinician_output):
            safety = await self.safety_guardian.validate(session, output)
            session = self._record_safety_check(session, safety)

        session = self._merge_state(session, patient_output)
        session = self._merge_state(session, clinician_output)
        session.disclaimers_verified = True
        return session

    def _merge_state(self, session: SessionState, update: dict) -> SessionState:
        """Merge a partial state update dict into the session."""
        data = session.model_dump()
        for key, value in update.items():
            if key in data and value is not None:
                if isinstance(value, list):
                    data[key] = [
                        v.model_dump() if hasattr(v, "model_dump") else v
                        for v in value
                    ]
                elif hasattr(value, "model_dump"):
                    data[key] = value.model_dump()
                else:
                    data[key] = value
        return SessionState.model_validate(data)

    def _append_message(
        self,
        session: SessionState,
        role: str,
        content: str,
        agent_name: str | None = None,
    ) -> SessionState:
        msg = Message(
            role=role,
            content=content,
            language=session.patient_language,
            agent_name=agent_name,
        )
        session.conversation_history.append(msg)
        return session

    def _record_safety_check(self, session: SessionState, result: SafetyCheckResult) -> SessionState:
        session.safety_checks.append(result)
        return session

    def _flag_crisis(self, session: SessionState, safety: SafetyCheckResult) -> SessionState:
        """Mark session as requiring immediate crisis intervention."""
        crisis_msg = Message(
            role="agent",
            content="CRISIS_INTERVENTION_REQUIRED",
            language=session.patient_language,
            agent_name="SafetyGuardian",
        )
        session.conversation_history.append(crisis_msg)
        session = self._record_safety_check(session, safety)
        return session
