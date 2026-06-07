export type WorkspacePreferences = {
  autoSave: boolean;
  autoCompile: boolean;
};

export const DEFAULT_PREFERENCES: WorkspacePreferences = {
  autoSave: false,
  autoCompile: false,
};

export const AUTO_SAVE_DELAY_MS = 3000;
export const AUTO_COMPILE_DELAY_MS = 20000;
export const MIN_AUTO_COMPILE_INTERVAL_MS = 60000;

export function getPreferencesStorageKey(projectId: string) {
  return `manifold-prefs-${projectId}`;
}

export function loadPreferences(projectId: string): WorkspacePreferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  try {
    const raw = localStorage.getItem(getPreferencesStorageKey(projectId));
    if (!raw) return DEFAULT_PREFERENCES;
    return { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function savePreferences(projectId: string, prefs: WorkspacePreferences) {
  if (typeof window === "undefined") return;
  localStorage.setItem(getPreferencesStorageKey(projectId), JSON.stringify(prefs));
}
