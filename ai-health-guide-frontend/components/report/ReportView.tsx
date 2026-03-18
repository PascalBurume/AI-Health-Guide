"use client";

import { useState } from "react";
import { PatientReport, SOAPNote, TriageColor, Facility, Location, Directions } from "@/types/session";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TriageBadge } from "@/components/ui/TriageBadge";
import { NearbyFacilities } from "@/components/report/NearbyFacilities";

const TRANSLATE_LANGUAGES: { code: string; label: string }[] = [
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "es", label: "Español" },
  { code: "ar", label: "العربية" },
  { code: "ja", label: "日本語" },
  { code: "sw", label: "Kiswahili" },
];

interface TranslatedReport {
  summary: string;
  what_we_found: string;
  what_to_do_next: string;
  facility_recommendation: string;
  directions_summary: string;
  what_to_tell_doctor: string;
  disclaimer: string;
  language: string;
}

interface ReportViewProps {
  sessionId: string;
  patientReport: PatientReport;
  clinicianReport: SOAPNote | null;
  triageColor: TriageColor | null;
  facilities: Facility[];
  directions: Directions | null;
  patientLocation: Location | null;
  onUpdated: () => void;
}

export const ReportView = ({
  sessionId,
  patientReport,
  clinicianReport,
  triageColor,
  facilities,
  directions,
  patientLocation,
  onUpdated,
}: ReportViewProps) => {
  const [tab, setTab]             = useState<"patient" | "clinician">("patient");
  const [playingTts, setPlayingTts] = useState(false);
  const [playingTranslatedTts, setPlayingTranslatedTts] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [translated, setTranslated] = useState<TranslatedReport | null>(null);
  const [translateError, setTranslateError] = useState<string | null>(null);

  const playTts = async () => {
    setPlayingTts(true);
    // Create Audio synchronously inside the click handler so the browser
    // considers the later .play() as user-initiated.
    const audio = new Audio();
    try {
      const res = await fetch(`/api/sessions/${sessionId}/report/tts`);
      if (!res.ok) throw new Error("TTS unavailable");
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      audio.src = url;
      audio.onended = () => {
        setPlayingTts(false);
        URL.revokeObjectURL(url);
      };
      audio.onerror = () => {
        setPlayingTts(false);
        URL.revokeObjectURL(url);
      };
      await audio.play();
    } catch {
      setPlayingTts(false);
    }
  };

  const downloadPdf = async () => {
    // Dynamic import to avoid server-side rendering issues with @react-pdf/renderer
    const { pdf } = await import("@react-pdf/renderer");
    const { PatientReportDocument } = await import("@/components/report/PatientReportDocument");
    const blob = await pdf(
      <PatientReportDocument report={patientReport} triageColor={triageColor} />
    ).toBlob();
    const url = URL.createObjectURL(blob);
    const a   = document.createElement("a");
    a.href     = url;
    a.download = "health-report.pdf";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleTranslate = async (langCode: string) => {
    // If clicking the same language or the original, clear translation
    if (translated?.language === langCode || langCode === patientReport.language) {
      setTranslated(null);
      setTranslateError(null);
      return;
    }
    setTranslating(true);
    setTranslateError(null);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/report/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: langCode }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        if (res.status === 404) {
          throw new Error("Session expired. Please start a new consultation.");
        }
        throw new Error(err?.detail ?? "Translation failed");
      }
      const data: TranslatedReport = await res.json();
      setTranslated(data);
    } catch (e) {
      setTranslateError(e instanceof Error ? e.message : "Translation unavailable. Please try again.");
    } finally {
      setTranslating(false);
    }
  };

  const playTranslatedTts = async () => {
    if (!translated) return;
    setPlayingTranslatedTts(true);
    const audio = new Audio();
    try {
      const text = [
        translated.summary,
        translated.what_we_found,
        translated.what_to_do_next,
        translated.what_to_tell_doctor,
      ].filter(Boolean).join("\n\n");
      const res = await fetch(`/api/sessions/${sessionId}/report/translate/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error("TTS unavailable");
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      audio.src = url;
      audio.onended = () => {
        setPlayingTranslatedTts(false);
        URL.revokeObjectURL(url);
      };
      audio.onerror = () => {
        setPlayingTranslatedTts(false);
        URL.revokeObjectURL(url);
      };
      await audio.play();
    } catch {
      setPlayingTranslatedTts(false);
    }
  };

  const downloadTranslatedPdf = async () => {
    if (!translated) return;
    const { pdf } = await import("@react-pdf/renderer");
    const { TranslatedReportDocument } = await import("@/components/report/TranslatedReportDocument");
    const blob = await pdf(
      <TranslatedReportDocument report={translated} triageColor={triageColor} />
    ).toBlob();
    const url = URL.createObjectURL(blob);
    const a   = document.createElement("a");
    a.href     = url;
    a.download = `health-report-${translated.language}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header with triage badge */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Consultation Report</h2>
        {triageColor && <TriageBadge color={triageColor} />}
      </div>

      {/* Tab selector */}
      <div className="flex rounded-xl bg-gray-100 p-1">
        {(["patient", "clinician"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg py-1.5 text-sm font-medium transition-colors ${
              tab === t
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "patient" ? "Your Summary" : "Clinical Note"}
          </button>
        ))}
      </div>

      {/* Patient report */}
      {tab === "patient" && (
        <div className="flex flex-col gap-3">
          <Card>
            <CardHeader><p className="font-semibold text-gray-700">Summary</p></CardHeader>
            <CardBody><p className="text-sm leading-relaxed text-gray-700">{patientReport.summary}</p></CardBody>
          </Card>
          <Card>
            <CardHeader><p className="font-semibold text-gray-700">What we found</p></CardHeader>
            <CardBody><p className="text-sm leading-relaxed text-gray-700">{patientReport.what_we_found}</p></CardBody>
          </Card>
          <Card>
            <CardHeader><p className="font-semibold text-gray-700">What to do next</p></CardHeader>
            <CardBody><p className="text-sm leading-relaxed text-gray-700 whitespace-pre-wrap">{patientReport.what_to_do_next}</p></CardBody>
          </Card>
          <Card>
            <CardHeader><p className="font-semibold text-gray-700">What to tell the doctor</p></CardHeader>
            <CardBody><p className="text-sm leading-relaxed text-gray-700">{patientReport.what_to_tell_doctor}</p></CardBody>
          </Card>

          {/* Nearby facilities */}
          <NearbyFacilities
            sessionId={sessionId}
            facilities={facilities}
            directions={directions}
            patientLocation={patientLocation}
            onUpdated={onUpdated}
          />

          <p className="text-xs text-gray-400 italic">{patientReport.disclaimer}</p>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" size="sm" onClick={playTts} isLoading={playingTts}>
              🔊 Listen
            </Button>
            <Button variant="secondary" size="sm" onClick={downloadPdf}>
              ⬇️ Download PDF
            </Button>
          </div>

          {/* ── Translate Section ── */}
          <div className="mt-4 border-t border-gray-200 pt-4">
            <p className="text-sm font-semibold text-gray-700 mb-2">🌐 Translate report</p>
            <div className="flex flex-wrap gap-2">
              {TRANSLATE_LANGUAGES.filter((l) => l.code !== patientReport.language).map((lang) => (
                <button
                  key={lang.code}
                  disabled={translating}
                  onClick={() => handleTranslate(lang.code)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    translated?.language === lang.code
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  } disabled:opacity-50`}
                >
                  {lang.label}
                </button>
              ))}
            </div>

            {translating && (
              <p className="mt-3 text-xs text-blue-500 animate-pulse">Translating…</p>
            )}
            {translateError && (
              <p className="mt-3 text-xs text-red-500">{translateError}</p>
            )}

            {translated && !translating && (
              <div className="mt-4 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-blue-600 uppercase tracking-wide">
                    Translated version
                  </span>
                  <button
                    onClick={() => setTranslated(null)}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    ✕ Close
                  </button>
                </div>
                <Card>
                  <CardHeader><p className="font-semibold text-gray-700">Summary</p></CardHeader>
                  <CardBody><p className="text-sm leading-relaxed text-gray-700">{translated.summary}</p></CardBody>
                </Card>
                <Card>
                  <CardHeader><p className="font-semibold text-gray-700">What we found</p></CardHeader>
                  <CardBody><p className="text-sm leading-relaxed text-gray-700">{translated.what_we_found}</p></CardBody>
                </Card>
                <Card>
                  <CardHeader><p className="font-semibold text-gray-700">What to do next</p></CardHeader>
                  <CardBody><p className="text-sm leading-relaxed text-gray-700 whitespace-pre-wrap">{translated.what_to_do_next}</p></CardBody>
                </Card>
                <Card>
                  <CardHeader><p className="font-semibold text-gray-700">What to tell the doctor</p></CardHeader>
                  <CardBody><p className="text-sm leading-relaxed text-gray-700">{translated.what_to_tell_doctor}</p></CardBody>
                </Card>
                {translated.disclaimer && (
                  <p className="text-xs text-gray-400 italic">{translated.disclaimer}</p>
                )}

                {/* Translated report actions */}
                <div className="flex gap-3 pt-2">
                  <Button variant="secondary" size="sm" onClick={playTranslatedTts} isLoading={playingTranslatedTts}>
                    🔊 Listen
                  </Button>
                  <Button variant="secondary" size="sm" onClick={downloadTranslatedPdf}>
                    ⬇️ Download PDF
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Clinician SOAP note */}
      {tab === "clinician" && clinicianReport && (
        <div className="flex flex-col gap-3">
          {(["subjective", "objective", "assessment", "plan"] as const).map((section) => (
            <Card key={section}>
              <CardHeader>
                <p className="font-semibold uppercase tracking-wide text-gray-700 text-xs">
                  {section}
                </p>
              </CardHeader>
              <CardBody>
                <p className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-gray-700">
                  {clinicianReport[section]}
                </p>
              </CardBody>
            </Card>
          ))}
          {clinicianReport.red_flags_summary.length > 0 && (
            <Card>
              <CardHeader><p className="font-semibold text-red-700 text-xs uppercase tracking-wide">Red flags</p></CardHeader>
              <CardBody>
                <ul className="list-inside list-disc space-y-1 text-xs text-red-700">
                  {clinicianReport.red_flags_summary.map((flag, i) => (
                    <li key={i}>{flag}</li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};
