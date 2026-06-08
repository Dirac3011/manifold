export type CollabUser = {
  userId: string;
  name: string | null;
  username: string;
  color: string;
  canEdit: boolean;
};

export type PresenceState = CollabUser & {
  socketId: string;
  fileId: string | null;
  line: number | null;
};

export type SaveConflict = {
  serverContent: string;
  serverVersion: number;
  localContent: string;
};

export const YTEXT_KEY = "monaco";
