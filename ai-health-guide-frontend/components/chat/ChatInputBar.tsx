"use client";

import { useCallback, useRef, useState } from "react";
import { useUIStore } from "@/store";

const LANGUAGES: { code: string; label: string }[] = [
  { code: "en", label: "EN" },
  { code: "fr", label: "FR" },
  { code: "es", label: "ES" },
  { code: "ar", label: "AR" },
  { code: "ja", label: "JA" },
  { code: "sw", label: "SW" },
];

interface ChatInputBarProps {
  sessionId: string;
  onMessageSent: () => void;
  disabled?: boolean;
}

export const ChatInputBar = ({
  sessionId,
  onMessageSent,
  disabled = false,
}: ChatInputBarProps) => {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const locale = useUIStore((s) => s.locale);
  const setLocale = useUIStore((s) => s.setLocale);

  const sendText = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || sending || disabled) return;

    setSending(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed, language: locale }),
      });
      if (!res.ok) throw new Error("Send failed");
      setText("");
      onMessageSent();
    } catch {
      // silently ignore — user will see the error via polling
    } finally {
      setSending(false);
    }
  }, [text, sending, disabled, sessionId, locale, onMessageSent]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendText();
    }
  };

  const toggleRecording = async () => {
    if (recording && mediaRecRef.current) {
      mediaRecRef.current.stop();
      setRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const form = new FormData();
        form.append("audio", blob, "recording.webm");
        try {
          const res = await fetch(`/api/sessions/${sessionId}/voice`, {
            method: "POST",
            body: form,
          });
          if (res.ok) onMessageSent();
        } catch {
          // ignore
        }
      };

      mr.start();
      mediaRecRef.current = mr;
      setRecording(true);
    } catch {
      // microphone not available
    }
  };

  const handleLanguageChange = async (code: string) => {
    const isRtl = code === "ar";
    setLocale(code, isRtl);
    // Sync to the backend session
    try {
      await fetch(`/api/sessions/${sessionId}/language`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: code }),
      });
    } catch {
      // best-effort — language will also be sent with the next message
    }
  };

  return (
    <div className="border-t border-gray-200 bg-white px-4 py-3">
      {/* Language selector */}
      <div className="mb-2 flex gap-1">
        {LANGUAGES.map((lang) => (
          <button
            key={lang.code}
            onClick={() => handleLanguageChange(lang.code)}
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
              locale === lang.code
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
          >
            {lang.label}
          </button>
        ))}
      </div>

      {/* Input row */}
      <div className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe your symptoms…"
          disabled={disabled || sending}
          rows={1}
          className="flex-1 resize-none rounded-xl border border-gray-300 bg-gray-50 px-4 py-2.5 text-sm outline-none placeholder:text-gray-400 focus:border-blue-400 focus:ring-1 focus:ring-blue-400 disabled:opacity-50"
        />

        {/* Voice button */}
        <button
          onClick={toggleRecording}
          disabled={disabled || sending}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${
            recording
              ? "bg-red-500 text-white animate-pulse"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          } disabled:opacity-50`}
          title={recording ? "Stop recording" : "Record voice"}
        >
          🎤
        </button>

        {/* Send button */}
        <button
          onClick={sendText}
          disabled={disabled || sending || !text.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          title="Send"
        >
          ➤
        </button>
      </div>
    </div>
  );
};
