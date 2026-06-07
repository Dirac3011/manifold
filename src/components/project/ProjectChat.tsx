"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { MathContent } from "../MathContent";

type Message = {
  id: string;
  content: string;
  mentions: string[];
  createdAt: string;
  author: { id: string; name: string | null; username: string };
};

type Props = {
  projectId: string;
  canEdit: boolean;
  objectLabels: Array<{ label: string | null; id: string; type: string }>;
  onMentionClick: (label: string) => void;
};

export function ProjectChat({
  projectId,
  canEdit,
  objectLabels,
  onMentionClick,
}: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<typeof objectLabels>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/chat`)
      .then((r) => r.json())
      .then(setMessages);

    const socket = io({ path: "/socket.io" });
    socketRef.current = socket;
    socket.emit("join-project", projectId);
    socket.on("chat-message", (msg: Message) => {
      setMessages((prev) => [...prev, msg]);
    });

    return () => {
      socket.disconnect();
    };
  }, [projectId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleInputChange(value: string) {
    setInput(value);
    const atMatch = value.match(/@([\w:-]*)$/);
    if (atMatch) {
      const q = atMatch[1].toLowerCase();
      setSuggestions(
        objectLabels.filter(
          (o) => o.label && o.label.toLowerCase().includes(q)
        ).slice(0, 5)
      );
    } else {
      setSuggestions([]);
    }
  }

  function insertMention(label: string) {
    setInput((prev) => prev.replace(/@[\w:-]*$/, `@${label} `));
    setSuggestions([]);
  }

  async function send() {
    if (!input.trim()) return;
    const res = await fetch(`/api/projects/${projectId}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: input }),
    });
    const msg = await res.json();
    socketRef.current?.emit("chat-message", { projectId, message: msg });
    setMessages((prev) => [...prev, msg]);
    setInput("");
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto p-3">
        {messages.map((m) => (
          <div key={m.id} className="mb-3">
            <div className="mb-0.5 flex items-baseline gap-2">
              <span className="text-xs font-medium">
                {m.author.name || m.author.username}
              </span>
              <span className="text-xs text-[var(--muted)]">
                {new Date(m.createdAt).toLocaleTimeString()}
              </span>
            </div>
            <MathContent content={m.content} />
            {m.mentions.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {m.mentions.map((label) => (
                  <button
                    key={label}
                    onClick={() => onMentionClick(label)}
                    className="rounded bg-[var(--surface-hover)] px-1.5 py-0.5 text-xs text-[var(--accent)] hover:underline"
                  >
                    @{label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {canEdit && (
        <div className="relative border-t border-[var(--border)] p-3">
          {suggestions.length > 0 && (
            <div className="absolute bottom-full left-3 right-3 mb-1 rounded border border-[var(--border)] bg-[var(--surface)] shadow-lg">
              {suggestions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => insertMention(s.label!)}
                  className="block w-full px-3 py-1.5 text-left text-xs hover:bg-[var(--surface-hover)]"
                >
                  <span className="text-[var(--accent)]">@{s.label}</span>
                  <span className="ml-2 text-[var(--muted)]">{s.type}</span>
                </button>
              ))}
            </div>
          )}
          <textarea
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Message... Use @thm:main to mention objects, $$math$$ for inline"
            className="w-full resize-none rounded border border-[var(--border)] bg-[var(--surface)] p-2 text-sm"
            rows={2}
          />
          <button
            onClick={send}
            className="mt-1 rounded bg-[var(--accent)] px-3 py-1 text-xs font-medium text-[#0f1117]"
          >
            Send
          </button>
        </div>
      )}
    </div>
  );
}
