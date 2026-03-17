"use client";

import { useState } from "react";
import { useSessionStore, useUIStore } from "@/store";
import { CreateSessionResponse } from "@/types/session";

export function useCreateSession() {
  const setSessionId = useSessionStore((s) => s.setSessionId);
  const setSession   = useSessionStore((s) => s.setSession);
  const setLoading   = useSessionStore((s) => s.setLoading);
  const setError     = useSessionStore((s) => s.setError);
  const locale       = useUIStore((s) => s.locale);

  const [isCreating, setIsCreating] = useState(false);

  const createSession = async () => {
    setIsCreating(true);
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: locale }),
      });
      if (!res.ok) throw new Error("Failed to create session");
      const data: CreateSessionResponse = await res.json();
      setSessionId(data.session_id);

      // Immediately fetch the full session state
      const stateRes = await fetch(`/api/sessions/${data.session_id}`);
      if (stateRes.ok) setSession(await stateRes.json());

      return data.session_id;
    } catch (err) {
      setError("Could not start a new session. Please try again.");
      return null;
    } finally {
      setIsCreating(false);
      setLoading(false);
    }
  };

  return { createSession, isCreating };
}
