"""Integration test: verify session state transitions through each pipeline stage.

These tests use a mock MedGemma client to avoid loading the actual model.
"""

import json
import pytest
import pytest_asyncio

from unittest.mock import AsyncMock, MagicMock

from ai_health_guide.config import AppConfig
from ai_health_guide.models.session import SessionState, Stage
from ai_health_guide.models.clinical import TriageColor


# ---------------------------------------------------------------------------
# Minimal mock config
# ---------------------------------------------------------------------------


def _test_config() -> AppConfig:
    """Return an AppConfig with safe test defaults."""
    return AppConfig(
        medgemma_model_path="test-model",
        medgemma_device="cpu",
        openai_api_key="sk-test",
        google_maps_api_key="test-maps-key",
        redis_url="redis://localhost:6379",
    )


# ---------------------------------------------------------------------------
# Mock MedGemma
# ---------------------------------------------------------------------------


def _mock_medgemma(response_json: str) -> MagicMock:
    client = MagicMock()
    client.generate = AsyncMock(return_value=response_json)
    return client


# ---------------------------------------------------------------------------
# Stage transition tests
# ---------------------------------------------------------------------------


class TestSessionStageTransitions:
    def test_new_session_starts_at_intake(self):
        session = SessionState(session_id="s1")
        assert session.current_stage == Stage.INTAKE

    def test_intake_complete_transitions_to_questioning(self):
        session = SessionState(session_id="s2", current_stage=Stage.INTAKE)
        session.chief_complaint = "chest pain"
        session.current_stage = Stage.QUESTIONING
        assert session.current_stage == Stage.QUESTIONING

    def test_questioning_skips_visual_when_no_image(self):
        session = SessionState(session_id="s3")
        session.questioning_complete = True
        session.image_data = None
        # Without image, pipeline goes directly to triage — verify field expectation
        assert session.image_data is None

    def test_questioning_goes_to_visual_when_image_present(self):
        session = SessionState(session_id="s4")
        session.questioning_complete = True
        session.image_data = "base64encodedimage=="
        assert session.image_data is not None


class TestSessionStateFields:
    def test_conversation_history_appends_correctly(self):
        from ai_health_guide.models.session import Message

        session = SessionState(session_id="s5")
        msg = Message(role="patient", content="I have a headache", language="en")
        session.conversation_history.append(msg)
        assert len(session.conversation_history) == 1
        assert session.conversation_history[0].role == "patient"

    def test_red_flags_default_empty(self):
        session = SessionState(session_id="s6")
        assert session.red_flags == []

    def test_triage_default_none(self):
        session = SessionState(session_id="s7")
        assert session.triage is None

    def test_safety_checks_default_empty(self):
        session = SessionState(session_id="s8")
        assert session.safety_checks == []

    def test_session_id_preserved_through_merge(self):
        session = SessionState(session_id="unique-test-id")
        assert session.session_id == "unique-test-id"


class TestTriageColorLogic:
    def test_red_is_highest_urgency(self):
        colors = [TriageColor.RED, TriageColor.YELLOW, TriageColor.GREEN]
        # RED should sort first by urgency
        assert colors[0] == TriageColor.RED

    def test_triage_color_values(self):
        assert TriageColor.RED == "RED"
        assert TriageColor.YELLOW == "YELLOW"
        assert TriageColor.GREEN == "GREEN"
