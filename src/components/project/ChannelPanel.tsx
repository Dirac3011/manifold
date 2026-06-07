"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { MathContent } from "../MathContent";

type Channel = {
  id: string;
  name: string;
  description: string | null;
  _count?: { messages: number };
};

type Author = { id: string; name: string | null; username: string };

type Message = {
  id: string;
  content: string;
  mentions: string[];
  createdAt: string;
  author: Author;
  channelId?: string | null;
  forwardedFrom?: {
    id: string;
    content: string;
    author: Author;
    channel: { id: string; name: string } | null;
  } | null;
};

type ObjectRef = { label: string | null; id: string; type: string; title?: string | null };

type Props = {
  projectId: string;
  canEdit: boolean;
  isOwner: boolean;
  objectRefs: ObjectRef[];
  onMentionClick: (label: string) => void;
};

export function ChannelPanel({
  projectId,
  canEdit,
  isOwner,
  objectRefs,
  onMentionClick,
}: Props) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<ObjectRef[]>([]);
  const [newChannelName, setNewChannelName] = useState("");
  const [forwardingId, setForwardingId] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);

  function loadChannels() {
    fetch(`/api/projects/${projectId}/channels`)
      .then((r) => r.json())
      .then((data: Channel[]) => {
        setChannels(data);
        if (!activeChannelId && data.length) setActiveChannelId(data[0].id);
      });
  }

  useEffect(() => { loadChannels(); }, [projectId]);

  useEffect(() => {
    if (!activeChannelId) return;
    fetch(`/api/projects/${projectId}/channels/${activeChannelId}/messages`)
      .then((r) => r.json())
      .then(setMessages);

    const socket = socketRef.current ?? io({ path: "/socket.io" });
    socketRef.current = socket;
    socket.emit("join-channel", { projectId, channelId: activeChannelId });

    const handler = (msg: Message) => {
      if (msg.channelId === activeChannelId || !msg.channelId) {
        setMessages((prev) =>
          prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
        );
      }
    };
    socket.on("channel-message", handler);

    return () => {
      socket.off("channel-message", handler);
      socket.emit("leave-channel", { projectId, channelId: activeChannelId });
    };
  }, [projectId, activeChannelId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleInputChange(value: string) {
    setInput(value);
    const atMatch = value.match(/@([\w:-]*)$/);
    if (atMatch) {
      const q = atMatch[1].toLowerCase();
      setSuggestions(
        objectRefs
          .filter((o) => o.label && o.label.toLowerCase().includes(q))
          .slice(0, 8)
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
    if (!input.trim() || !activeChannelId) return;
    const res = await fetch(
      `/api/projects/${projectId}/channels/${activeChannelId}/messages`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: input,
          forwardedFromId: forwardingId || undefined,
        }),
      }
    );
    if (!res.ok) return;
    const msg = await res.json();
    socketRef.current?.emit("channel-message", {
      projectId,
      channelId: activeChannelId,
      message: { ...msg, channelId: activeChannelId },
    });
    setMessages((prev) => [...prev, msg]);
    setInput("");
    setForwardingId(null);
  }

  async function createChannel() {
    const name = newChannelName.trim().toLowerCase().replace(/\s+/g, "-");
    if (!name) return;
    const res = await fetch(`/api/projects/${projectId}/channels`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      setNewChannelName("");
      loadChannels();
    } else {
      const d = await res.json();
      setStatus(d.error || "Failed to create channel");
    }
  }

  async function deleteChannel(channelId: string) {
    if (!confirm("Delete this channel and all its messages?")) return;
    const res = await fetch(`/api/projects/${projectId}/channels/${channelId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      if (activeChannelId === channelId) setActiveChannelId(null);
      loadChannels();
    }
  }

  async function forwardToChannel(targetChannelId: string, messageId: string) {
    await fetch(`/api/projects/${projectId}/channels/${targetChannelId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "", forwardedFromId: messageId }),
    });
    setStatus("Message forwarded");
    setTimeout(() => setStatus(""), 2000);
  }

  const activeChannel = channels.find((c) => c.id === activeChannelId);

  return (
    <div className="flex h-full min-w-0">
      <div className="flex w-36 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--background)]">
        <div className="border-b border-[var(--border)] px-2 py-2 text-xs font-semibold text-[var(--muted)]">
          Channels
        </div>
        <div className="flex-1 overflow-y-auto">
          {channels.map((c) => (
            <div key={c.id} className="group flex items-center">
              <button
                onClick={() => setActiveChannelId(c.id)}
                className={`flex-1 px-2 py-1.5 text-left text-xs hover:bg-[var(--surface-hover)] ${
                  activeChannelId === c.id
                    ? "bg-[var(--surface-hover)] text-[var(--accent)]"
                    : "text-[var(--foreground)]"
                }`}
              >
                # {c.name}
              </button>
              {isOwner && c.name !== "general" && (
                <button
                  onClick={() => deleteChannel(c.id)}
                  className="px-1 text-xs text-[var(--muted)] opacity-0 hover:text-[var(--danger)] group-hover:opacity-100"
                  title="Delete channel"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
        {canEdit && (
          <div className="border-t border-[var(--border)] p-2">
            <input
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
              placeholder="new-channel"
              className="mb-1 w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs"
              onKeyDown={(e) => e.key === "Enter" && createChannel()}
            />
            <button
              onClick={createChannel}
              className="w-full rounded border border-[var(--border)] py-1 text-xs hover:bg-[var(--surface-hover)]"
            >
              + Create
            </button>
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-[var(--border)] px-3 py-2">
          <span className="text-sm font-medium">
            {activeChannel ? `# ${activeChannel.name}` : "Select a channel"}
          </span>
          {activeChannel?.description && (
            <p className="text-xs text-[var(--muted)]">{activeChannel.description}</p>
          )}
          {status && <p className="text-xs text-[var(--success)]">{status}</p>}
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {messages.map((m) => (
            <div key={m.id} className="group mb-3">
              <div className="mb-0.5 flex items-baseline gap-2">
                <span className="text-xs font-medium">
                  {m.author.name || m.author.username}
                </span>
                <span className="text-xs text-[var(--muted)]">
                  {new Date(m.createdAt).toLocaleString()}
                </span>
                {canEdit && (
                  <div className="ml-auto flex gap-1 opacity-0 group-hover:opacity-100">
                    <button
                      onClick={() => {
                        setForwardingId(m.id);
                        setInput(`↪ Forwarding: `);
                      }}
                      className="text-xs text-[var(--muted)] hover:text-[var(--accent)]"
                    >
                      Forward
                    </button>
                    {channels.length > 1 && (
                      <select
                        className="rounded border border-[var(--border)] bg-[var(--surface)] px-1 text-xs"
                        defaultValue=""
                        onChange={(e) => {
                          if (e.target.value) forwardToChannel(e.target.value, m.id);
                          e.target.value = "";
                        }}
                      >
                        <option value="">→ channel</option>
                        {channels
                          .filter((c) => c.id !== activeChannelId)
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              #{c.name}
                            </option>
                          ))}
                      </select>
                    )}
                  </div>
                )}
              </div>
              {m.forwardedFrom && (
                <div className="mb-1 rounded border border-[var(--border)] bg-[var(--background)] p-2 text-xs opacity-80">
                  <span className="text-[var(--muted)]">
                    Forwarded from #{m.forwardedFrom.channel?.name} ·{" "}
                    {m.forwardedFrom.author.name || m.forwardedFrom.author.username}
                  </span>
                  <MathContent content={m.forwardedFrom.content} />
                </div>
              )}
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

        {canEdit && activeChannelId && (
          <div className="relative border-t border-[var(--border)] p-3">
            {forwardingId && (
              <p className="mb-1 text-xs text-[var(--warning)]">
                Forwarding message — add a note or press Enter to send
                <button
                  onClick={() => { setForwardingId(null); setInput(""); }}
                  className="ml-2 text-[var(--muted)] hover:underline"
                >
                  Cancel
                </button>
              </p>
            )}
            {suggestions.length > 0 && (
              <div className="absolute bottom-full left-3 right-3 mb-1 max-h-40 overflow-y-auto rounded border border-[var(--border)] bg-[var(--surface)] shadow-lg">
                {suggestions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => insertMention(s.label!)}
                    className="block w-full px-3 py-1.5 text-left text-xs hover:bg-[var(--surface-hover)]"
                  >
                    <span className="text-[var(--accent)]">@{s.label}</span>
                    <span className="ml-2 text-[var(--muted)]">{s.type}</span>
                    {s.title && <span className="ml-1 text-[var(--muted)]">— {s.title}</span>}
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
              placeholder="Message… @thm:main for objects, $$math$$ for inline"
              className="w-full resize-none rounded border border-[var(--border)] bg-[var(--surface)] p-2 text-sm"
              rows={2}
            />
          </div>
        )}
      </div>
    </div>
  );
}
