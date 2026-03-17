"use client";

import { useCallback, useEffect, useRef } from "react";
import { useSessionStore } from "@/store";

const POLL_INTERVAL_MS = 2000;

/**
 * Long-polls the session state from the BFF while the pipeline is active.
 * Stops polling once the session reaches the "complete" stage.
 */
export function useSessionPolling(sessionId: string | null) {
  const setSession = useSessionStore((s) => s.setSession);
  const setError   = useSessionStore((s) => s.setError);
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  const poll = useCallback(async () => {
    if (!sessionId) return;

    try {
      const res = await fetch(`/api/sessions/${sessionId}`);
      if (!res.ok) throw new Error("Session fetch failed");
      const session = await res.json();
      setSession(session);

      // Stop polling only when complete
      if (session.current_stage !== "complete") {
        timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
      }
    } catch (err) {
      setError("Lost connection to session. Please refresh.");
    }
  }, [sessionId, setSession, setError]);

  useEffect(() => {
    if (!sessionId) return;
    poll();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [sessionId, poll]);
}
