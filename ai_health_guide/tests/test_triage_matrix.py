"""Tests for the deterministic triage decision matrix."""

import pytest

from ai_health_guide.models.clinical import RedFlag, TriageColor
from ai_health_guide.tools.triage_matrix import (
    map_facility_type,
    triage_decision_matrix,
    urgency_description,
)


def _make_flag(severity: str, requires_emergency: bool = True) -> RedFlag:
    return RedFlag(
        symptom="chest pain",
        severity=severity,
        description="test",
        requires_emergency=requires_emergency,
    )


class TestTriageDecisionMatrix:
    def test_critical_flag_always_red(self):
        flags = [_make_flag("critical")]
        assert triage_decision_matrix(flags, severity=1) == TriageColor.RED

    def test_high_flag_always_red(self):
        flags = [_make_flag("high")]
        assert triage_decision_matrix(flags, severity=1) == TriageColor.RED

    def test_moderate_flag_yellow(self):
        flags = [_make_flag("moderate", requires_emergency=False)]
        assert triage_decision_matrix(flags, severity=3) == TriageColor.YELLOW

    def test_no_flags_high_severity_red(self):
        assert triage_decision_matrix([], severity=8) == TriageColor.RED

    def test_no_flags_medium_severity_yellow(self):
        assert triage_decision_matrix([], severity=6) == TriageColor.YELLOW

    def test_no_flags_low_severity_green(self):
        assert triage_decision_matrix([], severity=2) == TriageColor.GREEN

    def test_no_flags_boundary_severity_5_yellow(self):
        assert triage_decision_matrix([], severity=5) == TriageColor.YELLOW

    def test_no_flags_boundary_severity_7_red(self):
        assert triage_decision_matrix([], severity=7) == TriageColor.RED

    def test_visual_concern_bumps_to_yellow(self):
        # Green by severity but visual concern present → YELLOW
        assert triage_decision_matrix([], severity=2, visual_concerns=True) == TriageColor.YELLOW

    def test_visual_concern_does_not_downgrade_red(self):
        flags = [_make_flag("critical")]
        assert triage_decision_matrix(flags, severity=9, visual_concerns=True) == TriageColor.RED

    def test_empty_flags_zero_severity_green(self):
        assert triage_decision_matrix([], severity=0) == TriageColor.GREEN


class TestMapFacilityType:
    def test_red_maps_to_emergency(self):
        result = map_facility_type(TriageColor.RED)
        assert "emergency" in result.lower()

    def test_yellow_maps_to_urgent_care(self):
        result = map_facility_type(TriageColor.YELLOW)
        assert "urgent" in result.lower()

    def test_green_maps_to_clinic(self):
        result = map_facility_type(TriageColor.GREEN)
        assert "clinic" in result.lower() or "primary" in result.lower()


class TestUrgencyDescription:
    def test_all_colors_return_non_empty_string(self):
        for color in TriageColor:
            desc = urgency_description(color)
            assert isinstance(desc, str)
            assert len(desc) > 0
