import type { PresenceState } from "./types";

const projectPresence = new Map<string, Map<string, PresenceState>>();

export function setPresence(
  projectId: string,
  socketId: string,
  state: PresenceState
) {
  let room = projectPresence.get(projectId);
  if (!room) {
    room = new Map();
    projectPresence.set(projectId, room);
  }
  room.set(socketId, state);
}

export function updatePresence(
  projectId: string,
  socketId: string,
  patch: Partial<Pick<PresenceState, "fileId" | "line">>
) {
  const room = projectPresence.get(projectId);
  const current = room?.get(socketId);
  if (!current) return;
  room!.set(socketId, { ...current, ...patch });
}

export function removePresence(projectId: string, socketId: string) {
  projectPresence.get(projectId)?.delete(socketId);
}

export function removeSocketFromAll(socketId: string) {
  for (const [projectId, room] of projectPresence) {
    if (room.delete(socketId) && room.size === 0) {
      projectPresence.delete(projectId);
    }
  }
}

export function listPresence(projectId: string): PresenceState[] {
  const room = projectPresence.get(projectId);
  if (!room) return [];
  return Array.from(room.values());
}
