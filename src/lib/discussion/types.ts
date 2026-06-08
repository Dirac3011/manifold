export type ProjectNoteType = "NOTE" | "QUESTION" | "DECISION" | "TODO" | "UPDATE";

export type NoteContext = {
  objectId?: string;
  objectLabel?: string;
  fileId?: string;
  fileName?: string;
  citationKey?: string;
  compileError?: string;
  /** Excerpt when the user highlighted plain source text (not a theorem object). */
  selectedText?: string;
  /** Legacy — no longer attached from the UI */
  lineStart?: number;
  lineEnd?: number;
};

export type ProjectNote = {
  id: string;
  content: string;
  mentions: string[];
  noteType: ProjectNoteType;
  context: NoteContext | null;
  createdAt: string;
  author: { id: string; name: string | null; username: string };
  channelId?: string | null;
  legacyChannelName?: string | null;
};

export type RightPanelMode = "pdf" | "inspect" | "notes" | "review";

export type ObjectInspectTab = "overview" | "discussion";

export type NarrowWorkspaceMode = "editor" | "preview" | "inspect";

export const NOTE_TYPE_LABELS: Record<ProjectNoteType, string> = {
  NOTE: "Note",
  QUESTION: "Question",
  DECISION: "Decision",
  TODO: "Todo",
  UPDATE: "Update",
};

export const NOTE_TYPES: ProjectNoteType[] = [
  "NOTE",
  "QUESTION",
  "DECISION",
  "TODO",
  "UPDATE",
];
