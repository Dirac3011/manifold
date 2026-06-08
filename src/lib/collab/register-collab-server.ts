import type { Server as SocketServer, Socket } from "socket.io";
import { resolveSocketUser } from "./socket-auth";
import * as awarenessProtocol from "y-protocols/awareness";
import { Awareness } from "y-protocols/awareness";
import * as Y from "yjs";
import { getProjectAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { colorForUser } from "./colors";
import {
  applyDocUpdate,
  encodeDocState,
  getDocEntry,
  getOrCreateDoc,
  persistDoc,
  trackSocket,
  untrackSocket,
} from "./doc-manager";
import {
  listPresence,
  removePresence,
  setPresence,
  updatePresence,
} from "./presence";
import type { PresenceState } from "./types";

type SocketData = {
  userId: string;
  projectRooms: Set<string>;
  fileRoom: { projectId: string; fileId: string } | null;
};

const awarenessByFile = new Map<string, Awareness>();

function fileAwarenessKey(projectId: string, fileId: string) {
  return `${projectId}:${fileId}`;
}

function getFileAwareness(projectId: string, fileId: string, doc: Y.Doc) {
  const key = fileAwarenessKey(projectId, fileId);
  let aw = awarenessByFile.get(key);
  if (!aw) {
    aw = new Awareness(doc);
    awarenessByFile.set(key, aw);
  }
  return aw;
}

function broadcastPresence(io: SocketServer, projectId: string) {
  io.to(`project:${projectId}`).emit("collab-presence", listPresence(projectId));
}

async function verifyView(projectId: string, userId: string) {
  const access = await getProjectAccess(projectId, userId);
  return access?.canView ? access : null;
}

export function registerCollabServer(io: SocketServer) {
  io.on("connection", (socket: Socket) => {
    const data = socket.data as SocketData;
    if (!data.projectRooms) data.projectRooms = new Set();
    if (!data.fileRoom) data.fileRoom = null;

    socket.on(
      "collab-join-project",
      async (
        payload: {
          projectId: string;
          name: string | null;
          username: string;
        },
        ack?: (result: { ok: boolean; error?: string }) => void
      ) => {
        const userId = await resolveSocketUser(socket, payload.projectId);
        if (!userId) {
          ack?.({ ok: false, error: "Unauthorized" });
          return;
        }

        const access = await verifyView(payload.projectId, userId);
        if (!access) {
          ack?.({ ok: false, error: "Forbidden" });
          return;
        }

        const data = socket.data as SocketData;
        data.userId = userId;
        data.projectRooms = data.projectRooms ?? new Set();
        data.fileRoom = data.fileRoom ?? null;

        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, name: true, username: true },
        });
        if (!user) {
          ack?.({ ok: false, error: "User not found" });
          return;
        }

        socket.join(`project:${payload.projectId}`);
        data.projectRooms.add(payload.projectId);

        const state: PresenceState = {
          socketId: socket.id,
          userId: user.id,
          name: payload.name ?? user.name,
          username: payload.username || user.username,
          color: colorForUser(user.id),
          canEdit: access.canEdit,
          fileId: null,
          line: null,
        };
        setPresence(payload.projectId, socket.id, state);
        broadcastPresence(io, payload.projectId);
        ack?.({ ok: true });
      }
    );

    socket.on(
      "collab-join-file",
      async (
        payload: { projectId: string; fileId: string },
        ack?: (result: { ok: boolean; error?: string }) => void
      ) => {
        const userId = await resolveSocketUser(socket, payload.projectId);
        if (!userId) {
          ack?.({ ok: false, error: "Unauthorized" });
          return;
        }

        const access = await verifyView(payload.projectId, userId);
        if (!access) {
          ack?.({ ok: false, error: "Forbidden" });
          return;
        }

        data.userId = userId;

        if (data.fileRoom) {
          const prev = data.fileRoom;
          socket.leave(`file:${prev.projectId}:${prev.fileId}`);
          untrackSocket(prev.projectId, prev.fileId, socket.id);
        }

        try {
          const doc = await getOrCreateDoc(payload.projectId, payload.fileId);
          trackSocket(payload.projectId, payload.fileId, socket.id);
          socket.join(`file:${payload.projectId}:${payload.fileId}`);
          data.fileRoom = {
            projectId: payload.projectId,
            fileId: payload.fileId,
          };

          updatePresence(payload.projectId, socket.id, {
            fileId: payload.fileId,
          });
          broadcastPresence(io, payload.projectId);

          const state = encodeDocState(doc);
          socket.emit("collab-sync", { update: Array.from(state) });

          const aw = getFileAwareness(payload.projectId, payload.fileId, doc);
          if (aw.getStates().size > 0) {
            const awarenessUpdate = awarenessProtocol.encodeAwarenessUpdate(
              aw,
              Array.from(aw.getStates().keys())
            );
            socket.emit("collab-awareness", {
              update: Array.from(awarenessUpdate),
            });
          }

          // Ask connected editors to broadcast cursor state to the new joiner
          socket
            .to(`file:${payload.projectId}:${payload.fileId}`)
            .emit("collab-awareness-refresh");

          ack?.({ ok: true });
        } catch {
          ack?.({ ok: false, error: "File not found" });
        }
      }
    );

    socket.on("collab-leave-file", (payload: { projectId: string; fileId: string }) => {
      socket.leave(`file:${payload.projectId}:${payload.fileId}`);
      untrackSocket(payload.projectId, payload.fileId, socket.id);
      if (
        data.fileRoom?.projectId === payload.projectId &&
        data.fileRoom?.fileId === payload.fileId
      ) {
        data.fileRoom = null;
      }
      updatePresence(payload.projectId, socket.id, { fileId: null, line: null });
      broadcastPresence(io, payload.projectId);
    });

    socket.on(
      "collab-update",
      (payload: { projectId: string; fileId: string; update: number[] }) => {
        const access = getDocEntry(payload.projectId, payload.fileId);
        if (!access) return;
        applyDocUpdate(
          payload.projectId,
          payload.fileId,
          new Uint8Array(payload.update),
          "remote"
        );
        socket
          .to(`file:${payload.projectId}:${payload.fileId}`)
          .emit("collab-update", { update: payload.update });
      }
    );

    socket.on(
      "collab-awareness",
      (payload: { projectId: string; fileId: string; update: number[] }) => {
        const entry = getDocEntry(payload.projectId, payload.fileId);
        if (!entry) return;
        const aw = awarenessByFile.get(
          fileAwarenessKey(payload.projectId, payload.fileId)
        );
        if (!aw) return;
        awarenessProtocol.applyAwarenessUpdate(
          aw,
          new Uint8Array(payload.update),
          "relay"
        );
        io.to(`file:${payload.projectId}:${payload.fileId}`).emit(
          "collab-awareness",
          { update: payload.update }
        );
      }
    );

    socket.on(
      "collab-cursor",
      (payload: { projectId: string; fileId: string; line: number | null }) => {
        updatePresence(payload.projectId, socket.id, {
          fileId: payload.fileId,
          line: payload.line,
        });
        socket
          .to(`project:${payload.projectId}`)
          .emit("collab-presence", listPresence(payload.projectId));
      }
    );

    socket.on(
      "collab-checkpoint",
      async (
        payload: { projectId: string; fileId: string },
        ack?: (result: { ok: boolean; version?: number; error?: string }) => void
      ) => {
        const userId = await resolveSocketUser(socket, payload.projectId);
        if (!userId) {
          ack?.({ ok: false, error: "Unauthorized" });
          return;
        }

        const access = await verifyView(payload.projectId, userId);
        if (!access?.canEdit) {
          ack?.({ ok: false, error: "Forbidden" });
          return;
        }
        const result = await persistDoc(payload.projectId, payload.fileId);
        if (!result) {
          ack?.({ ok: false, error: "No active document" });
          return;
        }
        io.to(`file:${payload.projectId}:${payload.fileId}`).emit(
          "collab-checkpoint",
          { version: result.version }
        );
        ack?.({ ok: true, version: result.version });
      }
    );

    socket.on("disconnect", () => {
      if (data.fileRoom) {
        untrackSocket(
          data.fileRoom.projectId,
          data.fileRoom.fileId,
          socket.id
        );
      }
      const projects = [...data.projectRooms];
      for (const projectId of projects) {
        removePresence(projectId, socket.id);
        broadcastPresence(io, projectId);
      }
    });
  });
}
