"""Agent 6: Care Navigation Agent — finds appropriate nearby healthcare facilities."""

from ai_health_guide.agents.base import BaseAgent
from ai_health_guide.models.session import SessionState
from ai_health_guide.tools.google_maps import GoogleMapsClient


class CareNavigationAgent(BaseAgent):
    """Locates appropriate nearby healthcare facilities via Google Maps."""

    stage = "navigation"

    def __init__(self, medgemma, config) -> None:
        super().__init__(medgemma, config)
        self._maps = GoogleMapsClient(config.google_maps_api_key)

    async def execute(self, session: SessionState, corrections: list[str] | None = None) -> dict:
        if not session.patient_location:
            return {"facilities": [], "directions": None}

        if not session.triage:
            return {"facilities": [], "directions": None}

        try:
            # Search and rank facilities based on triage level
            facilities = self._maps.places_nearby(
                location=session.patient_location,
                triage_color=session.triage.color,
            )

            if not facilities:
                return {"facilities": [], "directions": None}

            # Get directions to the top-ranked facility
            directions = self._maps.get_directions(
                origin=session.patient_location,
                destination=facilities[0],
            )

            return {
                "facilities": facilities,
                "directions": directions,
            }
        except Exception as exc:  # noqa: BLE001
            print(f"[NavigationAgent] Google Maps error: {exc}")
            return {"facilities": [], "directions": None}
