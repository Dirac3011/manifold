"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import * as awarenessProtocol from "y-protocols/awareness";
import { Awareness } from "y-protocols/awareness";
import * as Y from "yjs";
import { colorForUser } from "./colors";
import type { PresenceState, SaveConflict } from "./types";
import { YTEXT_KEY } from "./types";

export type CollabConnectionStatus =
  | "disabled"
  | "connecting"
  | "live"
  | "error";

type UserInfo = {
  id: string;
  name: string | null;
  username: string;
};

type Options = {
  projectId: string;
  user: UserInfo | null;
  canEdit: boolean;
  activeFileId: string | null;
  enabled: boolean;
};

export function useCollabSession({
  projectId,
  user,
  canEdit,
  activeFileId,
  enabled,
}: Options) {
  const socketRef = useRef<Socket | null>(null);
  const docRef = useRef<Y.Doc | null>(null);
  const projectJoinedRef = useRef(false);

  const [connected, setConnected] = useState(false);
  const [projectJoined, setProjectJoined] = useState(false);
  const [connectionStatus, setConnectionStatus] =
    useState<CollabConnectionStatus>("disabled");
  const [fileSynced, setFileSynced] = useState(false);
  const [presence, setPresence] = useState<PresenceState[]>([]);
  const [fileVersion, setFileVersion] = useState(0);
  const [saveConflict, setSaveConflict] = useState<SaveConflict | null>(null);
  const [yText, setYText] = useState<Y.Text | null>(null);
  const [awareness, setAwareness] = useState<Awareness | null>(null);
  const [hasLocalEdits, setHasLocalEdits] = useState(false);
  const [collabError, setCollabError] = useState<string | null>(null);

  const activeFileIdRef = useRef(activeFileId);
  activeFileIdRef.current = activeFileId;
  const canEditRef = useRef(canEdit);
  canEditRef.current = canEdit;

  const getContent = useCallback(() => {
    return docRef.current?.getText(YTEXT_KEY).toString() ?? "";
  }, []);

  const reportCursor = useCallback(
    (line: number | null) => {
      const socket = socketRef.current;
      const fileId = activeFileIdRef.current;
      if (!socket?.connected || !fileId || !projectJoinedRef.current) return;
      socket.emit("collab-cursor", { projectId, fileId, line });
    },
    [projectId]
  );

  const checkpoint = useCallback((): Promise<number | null> => {
    const socket = socketRef.current;
    const fileId = activeFileIdRef.current;
    if (!socket?.connected || !fileId) return Promise.resolve(null);

    return new Promise((resolve) => {
      socket.emit(
        "collab-checkpoint",
        { projectId, fileId },
        (ack: { ok: boolean; version?: number }) => {
          if (ack.ok && ack.version != null) {
            setFileVersion(ack.version);
            setHasLocalEdits(false);
            resolve(ack.version);
          } else {
            resolve(null);
          }
        }
      );
    });
  }, [projectId]);

  const clearConflict = useCallback(() => setSaveConflict(null), []);

  const applyServerContent = useCallback((content: string) => {
    const doc = docRef.current;
    if (!doc) return;
    const text = doc.getText(YTEXT_KEY);
    doc.transact(() => {
      text.delete(0, text.length);
      text.insert(0, content);
    });
    setSaveConflict(null);
  }, []);

  // Socket lifecycle — fetch collab token then connect
  useEffect(() => {
    if (!enabled || !user) {
      setConnectionStatus("disabled");
      return;
    }

    let cancelled = false;
    setConnectionStatus("connecting");
    setCollabError(null);

    async function connect() {
      try {
        const res = await fetch(`/api/projects/${projectId}/collab-token`);
        if (!res.ok) {
          const msg =
            res.status === 401
              ? "Sign in to use live editing"
              : "Could not authenticate for live editing";
          if (!cancelled) {
            setCollabError(msg);
            setConnectionStatus("error");
          }
          return;
        }

        const { token } = (await res.json()) as { token: string };
        if (cancelled) return;

        const socket = io(window.location.origin, {
          path: "/socket.io",
          auth: { token },
          transports: ["websocket", "polling"],
        });
        socketRef.current = socket;

        const onConnect = () => {
          setConnected(true);
          setCollabError(null);
          projectJoinedRef.current = false;
          setProjectJoined(false);
          setConnectionStatus("connecting");

          socket.emit(
            "collab-join-project",
            {
              projectId,
              name: user!.name,
              username: user!.username,
            },
            (ack: { ok: boolean; error?: string }) => {
              if (cancelled) return;
              if (ack?.ok) {
                projectJoinedRef.current = true;
                setProjectJoined(true);
                setConnectionStatus("live");
              } else {
                const err = ack?.error ?? "Could not join collaboration session";
                setCollabError(err);
                setConnectionStatus("error");
              }
            }
          );
        };

        const onDisconnect = () => {
          setConnected(false);
          setProjectJoined(false);
          projectJoinedRef.current = false;
          if (!cancelled) setConnectionStatus("connecting");
        };

        const onConnectError = (err: Error) => {
          if (cancelled) return;
          setCollabError(
            err.message.includes("xhr poll")
              ? "Live server unreachable — run npm run dev"
              : `Connection failed: ${err.message}`
          );
          setConnectionStatus("error");
        };

        socket.on("connect", onConnect);
        socket.on("disconnect", onDisconnect);
        socket.on("connect_error", onConnectError);
        socket.on("collab-presence", (users: PresenceState[]) => {
          setPresence(users);
        });
        socket.on("collab-checkpoint", (payload: { version: number }) => {
          setFileVersion(payload.version);
          setHasLocalEdits(false);
        });

        if (socket.connected) onConnect();
      } catch {
        if (!cancelled) {
          setCollabError("Could not connect to live server");
          setConnectionStatus("error");
        }
      }
    }

    connect();

    return () => {
      cancelled = true;
      const socket = socketRef.current;
      if (socket) {
        socket.removeAllListeners();
        socket.disconnect();
      }
      socketRef.current = null;
      setConnected(false);
      setProjectJoined(false);
      projectJoinedRef.current = false;
      setPresence([]);
      setConnectionStatus("disabled");
    };
  }, [enabled, projectId, user?.id, user?.name, user?.username]);

  // Per-file Yjs session — waits for socket + project join
  useEffect(() => {
    const socket = socketRef.current;
    if (!enabled || !user || !socket || !activeFileId || !projectJoined) {
      setYText(null);
      setAwareness(null);
      setFileSynced(false);
      return;
    }

    setFileSynced(false);
    setHasLocalEdits(false);

    const doc = new Y.Doc();
    const aw = new Awareness(doc);
    docRef.current = doc;

    const text = doc.getText(YTEXT_KEY);
    setYText(text);
    setAwareness(aw);

    aw.setLocalStateField("user", {
      name: user.name || user.username,
      color: colorForUser(user.id),
    });

    let synced = false;

    const onSync = (payload: { update: number[] }) => {
      Y.applyUpdate(doc, new Uint8Array(payload.update), "remote");
      if (!synced) {
        synced = true;
        setFileSynced(true);
        pushAwareness();
      }
    };

    const onUpdate = (payload: { update: number[] }) => {
      Y.applyUpdate(doc, new Uint8Array(payload.update), "remote");
    };

    const onAwareness = (payload: { update: number[] }) => {
      awarenessProtocol.applyAwarenessUpdate(
        aw,
        new Uint8Array(payload.update),
        "relay"
      );
    };

    const onDocUpdate = (update: Uint8Array, origin: unknown) => {
      if (origin === "remote") return;
      if (!canEditRef.current) return;
      if (!synced) return;
      setHasLocalEdits(true);
      if (!socket.connected) return;
      socket.emit("collab-update", {
        projectId,
        fileId: activeFileId,
        update: Array.from(update),
      });
    };

    const pushAwareness = () => {
      if (!socket.connected || !synced) return;
      const localId = aw.clientID;
      const update = awarenessProtocol.encodeAwarenessUpdate(aw, [localId]);
      socket.emit("collab-awareness", {
        projectId,
        fileId: activeFileId,
        update: Array.from(update),
      });
    };

    const onAwarenessUpdate = (
      {
        added,
        updated,
        removed,
      }: { added: number[]; updated: number[]; removed: number[] },
      origin: unknown
    ) => {
      if (origin === "relay") return;
      pushAwareness();
    };

    const onAwarenessRefresh = () => {
      pushAwareness();
    };

    socket.on("collab-sync", onSync);
    socket.on("collab-update", onUpdate);
    socket.on("collab-awareness", onAwareness);
    socket.on("collab-awareness-refresh", onAwarenessRefresh);
    doc.on("update", onDocUpdate);
    aw.on("update", onAwarenessUpdate);

    socket.emit(
      "collab-join-file",
      { projectId, fileId: activeFileId },
      (ack: { ok: boolean; error?: string }) => {
        if (!ack?.ok) {
          setCollabError(ack?.error ?? "Could not open file for collaboration");
          setFileSynced(true);
        }
      }
    );

    return () => {
      socket.emit("collab-leave-file", { projectId, fileId: activeFileId });
      socket.off("collab-sync", onSync);
      socket.off("collab-update", onUpdate);
      socket.off("collab-awareness", onAwareness);
      socket.off("collab-awareness-refresh", onAwarenessRefresh);
      doc.off("update", onDocUpdate);
      aw.off("update", onAwarenessUpdate);
      aw.destroy();
      doc.destroy();
      docRef.current = null;
      setYText(null);
      setAwareness(null);
      setFileSynced(false);
    };
  }, [enabled, projectId, activeFileId, projectJoined, user?.id, user?.name, user?.username]);

  return {
    connected,
    projectJoined,
    connectionStatus,
    fileSynced,
    presence,
    yText,
    awareness,
    fileVersion,
    setFileVersion,
    saveConflict,
    setSaveConflict,
    collabError,
    getContent,
    reportCursor,
    checkpoint,
    clearConflict,
    applyServerContent,
    collabActive: enabled && projectJoined && fileSynced && !!yText,
    hasLocalEdits,
    readOnly: !canEdit,
  };
}
