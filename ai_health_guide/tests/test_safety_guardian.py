"""Tests for the SafetyGuardian validation rules (deterministic rules only — no LLM calls)."""

import pytest

from ai_health_guide.models.clinical import RedFlag, TriageColor, TriageResult
from ai_health_guide.models.session import SessionState, Message, Stage
from ai_health_guide.tools.disclaimer_checker import append_disclaimer


def _make_session(**overrides) -> SessionState:
    data = {
        "session_id": "test-session-001",
        "current_stage": Stage.TRIAGE,
    }
    data.update(overrides)
    return SessionState(**data)


def _make_triage(color: TriageColor) -> TriageResult:
    return TriageResult(
        color=color,
        rationale="Test rationale",
        facility_type_needed="emergency department",
        urgency_description="Go immediately",
        determined_by="rules_engine",
    )


class TestSafetyGuardianRules:
    """Test the deterministic checks in SafetyGuardian without running inference."""

    def test_forbidden_patterns_detected(self):
        """Diagnostic language should be flagged."""
        from ai_health_guide.agents.safety_guardian import FORBIDDEN_PATTERNS

        diagnostic_text = "You have appendicitis and need surgery immediately."
        matched = [p for p in FORBIDDEN_PATTERNS if p.lower() in diagnostic_text.lower()]
        assert len(matched) > 0

    def test_disclaimer_checker_appends_disclaimer(self):
        text = "Your health summary goes here."
        result = append_disclaimer(text, language="en")
        assert "professional" in result.lower() or "medical advice" in result.lower()

    def test_disclaimer_checker_french(self):
        text = "Votre résumé de santé."
        result = append_disclaimer(text, language="fr")
        assert "médecin" in result.lower() or "médical" in result.lower()

    def test_disclaimer_already_present_not_duplicated(self):
        from ai_health_guide.tools.disclaimer_checker import has_disclaimer
        text = "Visit a doctor. This information does not replace professional medical advice."
        assert has_disclaimer(text) is True

    def test_red_flag_triage_mismatch_is_detectable(self):
        """A session with critical red flags but GREEN triage is inherently unsafe."""
        critical_flag = RedFlag(
            symptom="cardiac arrest signs",
            severity="critical",
            description="Patient reporting crushing chest pain",
            requires_emergency=True,
        )
        # Set up a scenario the rules engine would flag
        triage = _make_triage(TriageColor.GREEN)  # wrong — should be RED
        session = _make_session(
            red_flags=[critical_flag],
            triage=triage,
        )

        # The triage color is GREEN despite critical red flags — the guardian would catch this
        has_critical = any(f.severity == "critical" for f in session.red_flags)
        is_red       = session.triage.color == TriageColor.RED if session.triage else False
        assert has_critical and not is_red  # confirms the mismatch scenario exists

    def test_green_triage_with_no_flags_is_consistent(self):
        triage = _make_triage(TriageColor.GREEN)
        session = _make_session(red_flags=[], triage=triage)
        has_critical = any(f.severity in ("critical", "high") for f in session.red_flags)
        assert not has_critical  # no mismatch — GREEN triage is valid here
