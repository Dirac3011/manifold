import * as Y from "yjs";
import { prisma } from "@/lib/prisma";
import { syncProjectFromLatex } from "@/lib/latex/sync-objects";
import { YTEXT_KEY } from "./types";

type DocEntry = {
  doc: Y.Doc;
  projectId: string;
  fileId: string;
  sockets: Set<string>;
  persistTimer: ReturnType<typeof setTimeout> | null;
  lastPersistAt: number;
};

const docs = new Map<string, DocEntry>();
const PERSIST_DEBOUNCE_MS = 2000;

function docKey(projectId: string, fileId: string) {
  return `${projectId}:${fileId}`;
}

function getYText(doc: Y.Doc) {
  return doc.getText(YTEXT_KEY);
}

async function loadFileContent(projectId: string, fileId: string) {
  return prisma.file.findFirst({
    where: { id: fileId, projectId },
    select: { content: true, yjsState: true },
  });
}

export async function getOrCreateDoc(
  projectId: string,
  fileId: string
): Promise<Y.Doc> {
  const key = docKey(projectId, fileId);
  const existing = docs.get(key);
  if (existing) return existing.doc;

  const file = await loadFileContent(projectId, fileId);
  if (!file) throw new Error("File not found");

  const doc = new Y.Doc();
  const yText = getYText(doc);

  if (file.yjsState && file.yjsState.length > 0) {
    Y.applyUpdate(doc, new Uint8Array(file.yjsState));
  } else if (yText.length === 0) {
    yText.insert(0, file.content);
  }

  docs.set(key, {
    doc,
    projectId,
    fileId,
    sockets: new Set(),
    persistTimer: null,
    lastPersistAt: Date.now(),
  });

  return doc;
}

export function getDocEntry(projectId: string, fileId: string) {
  return docs.get(docKey(projectId, fileId));
}

export function encodeDocState(doc: Y.Doc): Uint8Array {
  return Y.encodeStateAsUpdate(doc);
}

export function applyDocUpdate(
  projectId: string,
  fileId: string,
  update: Uint8Array,
  origin: string
) {
  const entry = docs.get(docKey(projectId, fileId));
  if (!entry) return;
  Y.applyUpdate(entry.doc, update, origin);
  schedulePersist(entry);
}

function schedulePersist(entry: DocEntry) {
  if (entry.persistTimer) clearTimeout(entry.persistTimer);
  entry.persistTimer = setTimeout(() => {
    entry.persistTimer = null;
    void persistDoc(entry.projectId, entry.fileId).catch((err) =>
      console.error("collab persist failed:", err)
    );
  }, PERSIST_DEBOUNCE_MS);
}

export async function persistDoc(
  projectId: string,
  fileId: string
): Promise<{ version: number } | null> {
  const entry = docs.get(docKey(projectId, fileId));
  if (!entry) return null;

  const content = getYText(entry.doc).toString();
  const state = Buffer.from(encodeDocState(entry.doc));

  const file = await prisma.file.update({
    where: { id: fileId, projectId },
    data: {
      content,
      yjsState: state,
      version: { increment: 1 },
    },
    select: { version: true },
  });

  entry.lastPersistAt = Date.now();

  try {
    await syncProjectFromLatex(projectId);
  } catch (err) {
    console.error("syncProjectFromLatex after collab persist:", err);
  }

  return { version: file.version };
}

export function trackSocket(
  projectId: string,
  fileId: string,
  socketId: string
) {
  const entry = docs.get(docKey(projectId, fileId));
  if (entry) entry.sockets.add(socketId);
}

export function untrackSocket(
  projectId: string,
  fileId: string,
  socketId: string
) {
  const key = docKey(projectId, fileId);
  const entry = docs.get(key);
  if (!entry) return;

  entry.sockets.delete(socketId);
  if (entry.sockets.size === 0) {
    if (entry.persistTimer) clearTimeout(entry.persistTimer);
    void persistDoc(projectId, fileId)
      .catch((err) => console.error("collab final persist:", err))
      .finally(() => {
        entry.doc.destroy();
        docs.delete(key);
      });
  }
}
