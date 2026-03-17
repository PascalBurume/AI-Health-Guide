/* TypeScript types mirroring the backend SessionState model. */

export type Stage =
  | "intake"
  | "questioning"
  | "visual"
  | "triage"
  | "report"
  | "complete";

export type TriageColor = "RED" | "YELLOW" | "GREEN";

export interface Message {
  role: "patient" | "agent" | "system";
  content: string;
  language: string;
  timestamp: string;
  agent_name?: string | null;
  image_id?: string | null;
}

export interface RedFlag {
  symptom: string;
  severity: "critical" | "high" | "moderate";
  description: string;
  requires_emergency: boolean;
}

export interface ABCDEAssessment {
  airway?: string | null;
  breathing?: string | null;
  circulation?: string | null;
  disability?: string | null;
  exposure?: string | null;
  notes: string;
}

export interface TriageResult {
  color: TriageColor;
  rationale: string;
  facility_type_needed: string;
  urgency_description: string;
  determined_by: "rule_matrix" | "llm_override";
}

export interface PatientReport {
  summary: string;
  what_we_found: string;
  what_to_do_next: string;
  facility_recommendation: string;
  directions_summary: string;
  what_to_tell_doctor: string;
  disclaimer: string;
  language: string;
}

export interface SOAPNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  triage_color: TriageColor;
  red_flags_summary: string[];
  language: string;
  patient_language: string;
}

export interface SafetyCheckResult {
  stage: string;
  approved: boolean;
  issues: string[];
  corrective_action: string;
  timestamp: string;
}

export interface SessionState {
  session_id: string;
  created_at: string;
  current_stage: Stage;
  patient_language: string;
  clinical_language: string;
  conversation_history: Message[];

  // Intake
  chief_complaint: string;
  chief_complaint_english: string;

  // Questioning
  structured_symptoms: Record<string, string>;
  abcde_assessment: ABCDEAssessment | null;
  red_flags: RedFlag[];
  severity: number;
  questioning_turns: number;
  questioning_complete: boolean;

  // Visual
  image_data: string | null;
  visual_observations: string[];
  image_analyzed: boolean;

  // Triage
  triage: TriageResult | null;

  // Reports
  patient_report: PatientReport | null;
  clinician_report: SOAPNote | null;

  // Cross-cutting
  safety_checks: SafetyCheckResult[];
  disclaimers_verified: boolean;
}

export interface CreateSessionResponse {
  session_id: string;
}
