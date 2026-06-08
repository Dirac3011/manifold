"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { MathContent } from "../MathContent";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";

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
      <div className="flex w-32 shrink-0 flex-col border-r border-[var(--border-subtle)] bg-[var(--background)]">
        <PanelHeader title="Channels" className="px-2 py-2" />
        <div className="flex-1 overflow-y-auto py-1">
          {channels.map((c) => (
            <div key={c.id} className="group/ch flex items-center">
              <button
                type="button"
                onClick={() => setActiveChannelId(c.id)}
                className={`flex-1 truncate px-2.5 py-1.5 text-left text-ui-xs transition-colors hover:bg-[var(--surface-hover)] ${
                  activeChannelId === c.id
                    ? "bg-[var(--surface-hover)] font-medium text-[var(--accent)]"
                    : "text-[var(--foreground)]"
                }`}
              >
                {c.name}
              </button>
              {isOwner && c.name !== "general" && (
                <button
                  type="button"
                  onClick={() => deleteChannel(c.id)}
                  className="px-1 text-ui-xs text-[var(--muted)] opacity-0 hover:text-[var(--danger)] group-hover/ch:opacity-100"
                  title="Delete channel"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
        {canEdit && (
          <div className="border-t border-[var(--border-subtle)] p-2">
            <Input
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
              placeholder="channel-name"
              className="mb-1.5 text-ui-xs"
              onKeyDown={(e) => e.key === "Enter" && createChannel()}
            />
            <Button variant="secondary" size="sm" onClick={createChannel} className="w-full">
              New channel
            </Button>
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <PanelHeader
          title={activeChannel?.name ?? "Select a channel"}
          subtitle={activeChannel?.description ?? undefined}
        />
        {status && (
          <p className="border-b border-[var(--border-subtle)] px-3 py-1 text-ui-xs text-[var(--muted)]">
            {status}
          </p>
        )}

        <div className="flex-1 overflow-y-auto px-4 py-2">
          {messages.map((m) => (
            <div key={m.id} className="channel-message group/msg">
              <div className="mb-1 flex items-baseline gap-2">
                <span className="text-ui-xs font-medium text-[var(--foreground)]">
                  {m.author.name || m.author.username}
                </span>
                <span className="text-ui-xs text-[var(--muted)]">
                  {new Date(m.createdAt).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                {canEdit && (
                  <div className="ml-auto flex gap-1 opacity-0 transition-opacity group-hover/msg:opacity-100">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setForwardingId(m.id);
                        setInput("↪ ");
                      }}
                    >
                      Forward
                    </Button>
                    {channels.length > 1 && (
                      <Select
                        className="w-auto py-0.5"
                        defaultValue=""
                        onChange={(e) => {
                          if (e.target.value) forwardToChannel(e.target.value, m.id);
                          e.target.value = "";
                        }}
                        aria-label="Forward to channel"
                      >
                        <option value="">→</option>
                        {channels
                          .filter((c) => c.id !== activeChannelId)
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                      </Select>
                    )}
                  </div>
                )}
              </div>
              {m.forwardedFrom && (
                <div className="mb-1.5 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--background)] px-2 py-1.5 text-ui-xs text-[var(--muted)]">
                  <span>
                    From {m.forwardedFrom.channel?.name} ·{" "}
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
                      type="button"
                      onClick={() => onMentionClick(label)}
                      className="font-mono text-ui-xs text-[var(--accent)] hover:underline"
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
          <div className="relative shrink-0 border-t border-[var(--border-subtle)] bg-[var(--surface-raised)] p-3">
            {forwardingId && (
              <p className="mb-1.5 text-ui-xs text-[var(--muted)]">
                Forwarding — add a note or press Enter
                <button
                  type="button"
                  onClick={() => {
                    setForwardingId(null);
                    setInput("");
                  }}
                  className="ml-2 text-[var(--accent)] hover:underline"
                >
                  Cancel
                </button>
              </p>
            )}
            {suggestions.length > 0 && (
              <div className="absolute bottom-full left-3 right-3 mb-1 max-h-36 overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-sm)]">
                {suggestions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => insertMention(s.label!)}
                    className="block w-full px-3 py-1.5 text-left text-ui-xs hover:bg-[var(--surface-hover)]"
                  >
                    <span className="font-mono text-[var(--accent)]">@{s.label}</span>
                    <span className="ml-2 text-[var(--muted)]">{s.type}</span>
                  </button>
                ))}
              </div>
            )}
            <Textarea
              value={input}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Message — @thm:main for objects, $$math$$ for equations"
              rows={2}
              className="text-ui-sm"
            />
          </div>
        )}
      </div>
    </div>
  );
}
