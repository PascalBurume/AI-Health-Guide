"""Tests for red flag screening and crisis detection."""

import pytest

from ai_health_guide.tools.red_flag_screening import is_crisis, screen_red_flags


class TestScreenRedFlags:
    def test_chest_pain_detected(self):
        flags = screen_red_flags("I have severe chest pain and it's spreading to my arm")
        names = [f.symptom for f in flags]
        assert any("chest" in n.lower() for n in names)

    def test_breathing_difficulty_detected(self):
        flags = screen_red_flags("I cannot breathe properly, I feel short of breath")
        names = [f.symptom for f in flags]
        assert any("breath" in n.lower() or "airway" in n.lower() for n in names)

    def test_stroke_symptoms_detected(self):
        text = "sudden severe headache, my face is drooping and my arm feels weak"
        flags = screen_red_flags(text)
        names = [f.symptom.lower() for f in flags]
        assert any("stroke" in n or "head" in n for n in names)

    def test_no_flags_for_normal_text(self):
        flags = screen_red_flags("I have a mild runny nose since yesterday")
        # May return zero or only moderate flags
        critical = [f for f in flags if f.severity == "critical"]
        assert len(critical) == 0

    def test_deduplication_same_symptom(self):
        # Mentioning chest pain twice should not produce duplicate entries
        flags = screen_red_flags("chest pain, chest tightness, chest pressure")
        names = [f.symptom for f in flags]
        assert len(names) == len(set(names))

    def test_returns_list(self):
        result = screen_red_flags("headache")
        assert isinstance(result, list)

    def test_empty_text_returns_empty_list(self):
        assert screen_red_flags("") == []


class TestIsCrisis:
    def test_suicidal_ideation_detected(self):
        assert is_crisis("I want to kill myself") is True

    def test_self_harm_detected(self):
        assert is_crisis("I've been cutting myself and don't want to stop") is True

    def test_normal_text_not_crisis(self):
        assert is_crisis("I have a headache") is False

    def test_indirect_suicidal_language(self):
        assert is_crisis("I don't want to live anymore") is True

    def test_empty_string_not_crisis(self):
        assert is_crisis("") is False
