"use client";

import { useState } from "react";
import type { Facility, Location, Directions } from "@/types/session";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface NearbyFacilitiesProps {
  sessionId: string;
  facilities: Facility[];
  directions: Directions | null;
  patientLocation: Location | null;
  onUpdated: () => void;
}

export const NearbyFacilities = ({
  sessionId,
  facilities,
  directions,
  patientLocation,
  onUpdated,
}: NearbyFacilitiesProps) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skipped, setSkipped] = useState(false);

  const shareLocation = async () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }
    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const res = await fetch(`/api/sessions/${sessionId}/location`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            }),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => null);
            throw new Error(err?.detail ?? "Failed to find nearby facilities");
          }
          onUpdated();
        } catch (e) {
          setError(e instanceof Error ? e.message : "Something went wrong");
        } finally {
          setLoading(false);
        }
      },
      (geoErr) => {
        setLoading(false);
        switch (geoErr.code) {
          case geoErr.PERMISSION_DENIED:
            setError(
              "Location permission denied. Please enable it in your browser settings."
            );
            break;
          case geoErr.POSITION_UNAVAILABLE:
            setError("Location unavailable. Please try again.");
            break;
          default:
            setError("Could not get your location. Please try again.");
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSkip = async () => {
    await fetch(`/api/sessions/${sessionId}/skip-location`, {
      method: "POST",
    });
    setSkipped(true);
  };

  // Already skipped
  if (skipped) return null;

  // No location shared yet — show prompt
  if (!patientLocation && facilities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <p className="font-semibold text-gray-700">
            📍 Find Nearby Hospitals
          </p>
        </CardHeader>
        <CardBody className="flex flex-col gap-3">
          <p className="text-sm text-gray-600">
            Share your location to find hospitals and clinics near you, matched
            to your triage level.
          </p>
          {error && (
            <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <div className="flex gap-3">
            <Button
              variant="primary"
              size="sm"
              onClick={shareLocation}
              isLoading={loading}
            >
              📍 Share Location
            </Button>
            <Button variant="secondary" size="sm" onClick={handleSkip}>
              Skip
            </Button>
          </div>
        </CardBody>
      </Card>
    );
  }

  // Location shared but no facilities found
  if (patientLocation && facilities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <p className="font-semibold text-gray-700">📍 Nearby Facilities</p>
        </CardHeader>
        <CardBody>
          <p className="text-sm text-gray-500">
            No nearby facilities found. Please search online or call emergency
            services if needed.
          </p>
        </CardBody>
      </Card>
    );
  }

  // Facilities list + map
  return (
    <div className="flex flex-col gap-3">
      <Card>
        <CardHeader>
          <p className="font-semibold text-gray-700">
            📍 Nearby Facilities ({facilities.length})
          </p>
        </CardHeader>
        <CardBody className="flex flex-col gap-3">
          {facilities.map((f, i) => (
            <div
              key={f.place_id}
              className={`flex items-start justify-between rounded-lg border p-3 ${
                i === 0
                  ? "border-blue-200 bg-blue-50"
                  : "border-gray-100"
              }`}
            >
              <div className="flex flex-col gap-1 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {i === 0 && (
                    <span className="shrink-0 rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white uppercase">
                      Recommended
                    </span>
                  )}
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    {f.name}
                  </p>
                </div>
                <p className="text-xs text-gray-500 truncate">{f.address}</p>
                <div className="flex flex-wrap items-center gap-3 mt-1">
                  <span className="text-xs text-gray-600">
                    📏 {(f.distance_meters / 1000).toFixed(1)} km
                  </span>
                  <span className="text-xs text-gray-600">
                    🚗 {Math.round(f.duration_minutes)} min
                  </span>
                  {f.rating && (
                    <span className="text-xs text-gray-600">
                      ⭐ {f.rating.toFixed(1)}
                    </span>
                  )}
                  <span
                    className={`text-xs font-medium ${
                      f.is_open ? "text-green-600" : "text-red-500"
                    }`}
                  >
                    {f.is_open ? "Open" : "Closed"}
                  </span>
                </div>
              </div>
              <a
                href={`https://www.google.com/maps/dir/?api=1&origin=${patientLocation!.latitude},${patientLocation!.longitude}&destination=${encodeURIComponent(f.name + ", " + f.address)}&destination_place_id=${f.place_id}&travelmode=driving`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
              >
                🗺️ Directions
              </a>
            </div>
          ))}

          {/* Top facility directions summary */}
          {directions && (
            <div className="mt-2 rounded-lg border border-green-100 bg-green-50 p-3">
              <p className="text-xs font-semibold text-green-800 uppercase tracking-wide mb-1">
                Directions to {facilities[0]?.name}
              </p>
              <p className="text-sm text-green-700">
                {directions.distance} — {directions.duration} by car
              </p>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
};
