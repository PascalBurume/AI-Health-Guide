import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { TriageColor } from "@/types/session";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#1f2937",
  },
  title: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    color: "#6b7280",
    marginBottom: 20,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
    textTransform: "uppercase",
    color: "#374151",
    letterSpacing: 0.5,
  },
  text: {
    fontSize: 10,
    lineHeight: 1.6,
    color: "#374151",
  },
  disclaimer: {
    marginTop: 24,
    fontSize: 8,
    color: "#9ca3af",
    fontStyle: "italic",
  },
  badge: {
    padding: "3 8",
    borderRadius: 12,
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    marginBottom: 16,
    alignSelf: "flex-start",
  },
});

const TRIAGE_COLORS: Record<
  TriageColor,
  { bg: string; text: string; label: string }
> = {
  RED:    { bg: "#fee2e2", text: "#991b1b", label: "EMERGENCY" },
  YELLOW: { bg: "#fef3c7", text: "#92400e", label: "URGENT" },
  GREEN:  { bg: "#d1fae5", text: "#065f46", label: "NON-URGENT" },
};

const LANGUAGE_LABELS: Record<string, string> = {
  en: "English", fr: "French", es: "Spanish",
  ar: "Arabic", ja: "Japanese", sw: "Swahili",
};

export interface TranslatedReportData {
  summary: string;
  what_we_found: string;
  what_to_do_next: string;
  facility_recommendation: string;
  directions_summary: string;
  what_to_tell_doctor: string;
  disclaimer: string;
  language: string;
}

interface TranslatedReportDocumentProps {
  report: TranslatedReportData;
  triageColor: TriageColor | null;
}

export const TranslatedReportDocument = ({
  report,
  triageColor,
}: TranslatedReportDocumentProps) => {
  const tc = triageColor ? TRIAGE_COLORS[triageColor] : null;
  const langLabel = LANGUAGE_LABELS[report.language] ?? report.language.toUpperCase();

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>AI Health Guide — Consultation Report</Text>
        <Text style={styles.subtitle}>
          Generated on {new Date().toLocaleDateString()} — Translated to {langLabel}
        </Text>

        {tc && (
          <View style={[styles.badge, { backgroundColor: tc.bg }]}>
            <Text style={{ color: tc.text }}>{tc.label}</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Summary</Text>
          <Text style={styles.text}>{report.summary}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What we found</Text>
          <Text style={styles.text}>{report.what_we_found}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What to do next</Text>
          <Text style={styles.text}>{report.what_to_do_next}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Where to go</Text>
          <Text style={styles.text}>{report.facility_recommendation}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What to tell the doctor</Text>
          <Text style={styles.text}>{report.what_to_tell_doctor}</Text>
        </View>

        {report.disclaimer && (
          <Text style={styles.disclaimer}>{report.disclaimer}</Text>
        )}
      </Page>
    </Document>
  );
};
