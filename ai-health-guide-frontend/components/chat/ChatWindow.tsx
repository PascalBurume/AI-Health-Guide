"use client";

import { useEffect, useRef } from "react";
import { Message } from "@/types/session";
import { cn } from "@/lib/utils";

interface MessageBubbleProps {
  message: Message;
}

const MessageBubble = ({ message }: MessageBubbleProps) => {
  const isPatient = message.role === "patient";

  return (
    <div
      className={cn(
        "flex",
        isPatient ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-2 text-sm",
          isPatient
            ? "rounded-br-sm bg-blue-600 text-white"
            : "rounded-bl-sm bg-white text-gray-900 shadow-sm ring-1 ring-gray-200"
        )}
      >
        {!isPatient && message.agent_name && (
          <p className="mb-0.5 text-xs font-semibold text-blue-600">
            {message.agent_name.replace(/Agent$/, "")}
          </p>
        )}
        <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
        <p
          className={cn(
            "mt-1 text-right text-[10px]",
            isPatient ? "text-blue-200" : "text-gray-400"
          )}
        >
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
};

interface ChatWindowProps {
  messages: Message[];
  isTyping?: boolean;
}

export const ChatWindow = ({ messages, isTyping = false }: ChatWindowProps) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
      {messages.map((msg, i) => (
        <MessageBubble key={i} message={msg} />
      ))}

      {isTyping && (
        <div className="flex justify-start">
          <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm bg-white px-4 py-2 shadow-sm ring-1 ring-gray-200">
            <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.3s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.15s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" />
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
};
