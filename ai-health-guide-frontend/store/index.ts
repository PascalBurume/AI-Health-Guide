import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  SessionState,
  Stage,
  Message,
  PatientReport,
  SOAPNote,
  TriageResult,
} from "@/types/session";

// ---------------------------------------------------------------------------
// Session slice
// ---------------------------------------------------------------------------

interface SessionSlice {
  sessionId: string | null;
  session: SessionState | null;
  isLoading: boolean;
  error: string | null;

  setSession: (session: SessionState) => void;
  setSessionId: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearSession: () => void;
}

export const useSessionStore = create<SessionSlice>()(
  persist(
    (set) => ({
      sessionId: null,
      session: null,
      isLoading: false,
      error: null,

      setSession: (session) => set({ session }),
      setSessionId: (id) => set({ sessionId: id }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      clearSession: () =>
        set({ sessionId: null, session: null, isLoading: false, error: null }),
    }),
    {
      name: "ai-health-session",
      // Only persist the session ID so the UI reconnects on refresh
      partialize: (state) => ({ sessionId: state.sessionId }),
    }
  )
);

// ---------------------------------------------------------------------------
// UI / navigation slice
// ---------------------------------------------------------------------------

type UIPanel = "chat" | "report" | "triage";

interface UISlice {
  activePanel: UIPanel;
  isMicActive: boolean;
  isRtl: boolean;
  locale: string;
  viewStage: Stage | null;

  setActivePanel: (panel: UIPanel) => void;
  setMicActive: (active: boolean) => void;
  setLocale: (locale: string, isRtl: boolean) => void;
  setViewStage: (stage: Stage | null) => void;
}

export const useUIStore = create<UISlice>()((set) => ({
  activePanel: "chat",
  isMicActive: false,
  isRtl: false,
  locale: "en",
  viewStage: null,

  setActivePanel: (activePanel) => set({ activePanel }),
  setMicActive: (isMicActive) => set({ isMicActive }),
  setLocale: (locale, isRtl) => set({ locale, isRtl }),
  setViewStage: (viewStage) => set({ viewStage }),
}));
