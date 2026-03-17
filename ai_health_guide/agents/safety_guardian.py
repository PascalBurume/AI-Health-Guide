"""Agent 9: Safety Guardian — cross-cutting validator at every stage boundary."""

import re
from ai_health_guide.agents.base import BaseAgent
from ai_health_guide.models.session import SessionState
from ai_health_guide.models.safety import SafetyCheckResult
from ai_health_guide.models.clinical import TriageColor
from ai_health_guide.tools.red_flag_screening import is_crisis
from ai_health_guide.tools.disclaimer_checker import has_disclaimer


class SafetyGuardian(BaseAgent):
    """Validates agent outputs for safety compliance at every pipeline stage boundary."""

    stage = "safety"

    # Patterns that must NEVER appear in patient-facing output.
    # Only checked on report-stage text and agent_response fields — NOT on
    # internal data like symptoms / red_flags / ABCDE notes.
    FORBIDDEN_PATTERNS = [
        r"you have \w+ (?:disease|syndrome|disorder|infection|condition)",
        r"this is \w+ disease",
        r"you are suffering from",
        r"diagnosis:\s*\w+",
        r"you definitely have",
        r"you probably have",
        r"i diagnose",
    ]

    async def execute(self, session: SessionState, corrections: list[str] | None = None) -> dict:
        # Safety Guardian does not generate text — it validates. Use validate() instead.
        return {}

    async def validate(self, session: SessionState, stage_output: dict) -> SafetyCheckResult:
        """Validate a stage output against all safety rules.

        Returns a SafetyCheckResult. If approved=False, the orchestrator
        will re-run the agent with the listed corrections.
        """
        issues: list[str] = []

        # Check 1: Diagnostic language prohibition — only on patient-facing text
        for field_value in self._extract_patient_facing_text(session, stage_output):
            for pattern in self.FORBIDDEN_PATTERNS:
                if re.search(pattern, field_value, re.IGNORECASE):
                    issues.append(f"Diagnostic language detected (pattern: '{pattern}'). Remove and use observational language only.")

        # Check 2: Red flag escalation guarantee — any red flag must result in RED triage
        if session.red_flags and session.current_stage == "triage":
            triage = stage_output.get("triage")
            if triage and triage.color != TriageColor.RED:
                critical_or_high = [f for f in session.red_flags if f.severity in ("critical", "high")]
                if critical_or_high:
                    issues.append("Critical/high red flags detected but triage is not RED. Escalation is mandatory.")

        # Check 3: Disclaimer enforcement in patient-facing reports
        if session.current_stage == "report":
            patient_report = stage_output.get("patient_report")
            if patient_report:
                report_text = patient_report.summary if hasattr(patient_report, "summary") else str(patient_report)
                if not has_disclaimer(report_text):
                    issues.append("Patient report is missing the mandatory disclaimer.")

        # Check 4: Crisis detection — check all new patient messages
        last_patient_msg = self._last_patient_message(session)
        if last_patient_msg and is_crisis(last_patient_msg):
            issues.append("CRISIS_DETECTED: Patient may be expressing suicidal ideation. Immediate crisis referral required.")

        corrective = self._suggest_corrections(issues) if issues else ""

        result = SafetyCheckResult(
            stage=session.current_stage,
            approved=len(issues) == 0,
            issues=issues,
            corrective_action=corrective,
        )

        return result

    def _extract_patient_facing_text(self, session: SessionState, output: dict) -> list[str]:
        """Extract only patient-facing text fields for diagnostic-language checks.

        During questioning/intake we only check 'agent_response'.
        During report stage we check all report text fields.
        """
        texts: list[str] = []
        # Always check agent_response (the text shown to the patient)
        resp = output.get("agent_response")
        if isinstance(resp, str):
            texts.append(resp)
        # In report stage, check full report objects
        if session.current_stage in ("report", "complete"):
            for key in ("patient_report", "clinician_report"):
                val = output.get(key)
                if val is not None:
                    if hasattr(val, "__dict__"):
                        for v in vars(val).values():
                            if isinstance(v, str):
                                texts.append(v)
                    elif isinstance(val, str):
                        texts.append(val)
        return texts

    def _extract_text_fields(self, output: dict) -> list[str]:
        """Recursively extract all string values from an output dict."""
        texts = []
        for value in output.values():
            if isinstance(value, str):
                texts.append(value)
            elif hasattr(value, "__dict__"):
                for v in vars(value).values():
                    if isinstance(v, str):
                        texts.append(v)
        return texts

    def _last_patient_message(self, session: SessionState) -> str:
        for msg in reversed(session.conversation_history):
            if msg.role == "patient":
                return msg.content
        return ""

    def _suggest_corrections(self, issues: list[str]) -> str:
        if not issues:
            return ""
        return "Please revise the output to address: " + "; ".join(issues)
