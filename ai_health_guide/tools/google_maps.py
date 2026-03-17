"""Google Maps Places and Directions API wrapper."""

from typing import Optional
import googlemaps

from ai_health_guide.models.session import Location, Facility
from ai_health_guide.models.clinical import TriageColor

SEARCH_CONFIG: dict[TriageColor, dict] = {
    TriageColor.RED:    {"types": ["hospital"], "keyword": "emergency",    "radius": 5_000},
    TriageColor.YELLOW: {"types": ["hospital", "doctor"], "keyword": "urgent care", "radius": 10_000},
    TriageColor.GREEN:  {"types": ["doctor", "pharmacy"], "keyword": "clinic",      "radius": 15_000},
}


class GoogleMapsClient:
    def __init__(self, api_key: str) -> None:
        self._client = googlemaps.Client(key=api_key) if api_key else None

    def places_nearby(
        self,
        location: Location,
        triage_color: TriageColor,
    ) -> list[Facility]:
        """Search for nearby healthcare facilities appropriate for the triage level."""
        if self._client is None:
            return []  # Google Maps not configured — care navigation disabled
        config = SEARCH_CONFIG[triage_color]
        results = self._client.places_nearby(
            location=(location.latitude, location.longitude),
            radius=config["radius"],
            type=config["types"][0],
            keyword=config["keyword"],
            open_now=True,
        )

        facilities = []
        for place in results.get("results", [])[:5]:
            place_loc = place["geometry"]["location"]
            distance_m, duration_min = 0.0, 0.0
            try:
                dist_result = self._client.distance_matrix(
                    origins=[(location.latitude, location.longitude)],
                    destinations=[(place_loc["lat"], place_loc["lng"])],
                    mode="driving",
                )
                element = dist_result["rows"][0]["elements"][0]
                if element["status"] == "OK":
                    distance_m   = float(element["distance"]["value"])
                    duration_min = float(element["duration"]["value"]) / 60
            except Exception as exc:  # noqa: BLE001
                print(f"[GoogleMaps] distance_matrix error for {place.get('name')}: {exc}")

            facilities.append(
                Facility(
                    name=place.get("name", ""),
                    place_id=place.get("place_id", ""),
                    address=place.get("vicinity", ""),
                    location=Location(
                        latitude=place_loc["lat"],
                        longitude=place_loc["lng"],
                    ),
                    facility_type=config["types"][0],
                    distance_meters=float(distance_m),
                    duration_minutes=float(duration_min),
                    is_open=place.get("opening_hours", {}).get("open_now", False),
                    rating=place.get("rating"),
                    phone=place.get("formatted_phone_number"),
                )
            )

        return self._rank_facilities(facilities, location)

    def _rank_facilities(self, facilities: list[Facility], origin: Location) -> list[Facility]:
        """Rank by composite score: 0.6 * proximity + 0.3 * rating + 0.1 * open status."""
        max_dist = max((f.distance_meters for f in facilities), default=1)

        def score(f: Facility) -> float:
            proximity = 1 - (f.distance_meters / max_dist) if max_dist else 1
            rating    = (f.rating or 0) / 5.0
            is_open   = 1.0 if f.is_open else 0.0
            return 0.6 * proximity + 0.3 * rating + 0.1 * is_open

        return sorted(facilities, key=score, reverse=True)

    def get_directions(self, origin: Location, destination: Facility) -> Optional[dict]:
        """Get driving directions from patient location to facility."""
        result = self._client.directions(
            origin=(origin.latitude, origin.longitude),
            destination=(destination.location.latitude, destination.location.longitude),
            mode="driving",
        )
        if result:
            leg = result[0]["legs"][0]
            return {
                "distance":    leg["distance"]["text"],
                "duration":    leg["duration"]["text"],
                "steps":       [s["html_instructions"] for s in leg["steps"]],
                "polyline":    result[0]["overview_polyline"]["points"],
                "map_url": (
                    f"https://www.google.com/maps/dir/?api=1"
                    f"&origin={origin.latitude},{origin.longitude}"
                    f"&destination_place_id={destination.place_id}"
                ),
            }
        return None
