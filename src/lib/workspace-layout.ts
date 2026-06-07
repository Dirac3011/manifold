export type LayoutPreset = "default" | "focus" | "wide-pdf" | "writing" | "balanced";

export type WorkspaceLayout = {
  preset: LayoutPreset;
  sidebarWidth: number;
  rightPanelPercent: number;
  logHeight: number;
  showSidebar: boolean;
  showRightPanel: boolean;
};

export const ICON_RAIL_WIDTH = 48;

export const DEFAULT_LAYOUT: WorkspaceLayout = {
  preset: "default",
  sidebarWidth: 200,
  rightPanelPercent: 45,
  logHeight: 144,
  showSidebar: true,
  showRightPanel: true,
};

export const LAYOUT_PRESETS: Record<
  LayoutPreset,
  Omit<WorkspaceLayout, "preset">
> = {
  default: {
    sidebarWidth: 200,
    rightPanelPercent: 45,
    logHeight: 144,
    showSidebar: true,
    showRightPanel: true,
  },
  focus: {
    sidebarWidth: 200,
    rightPanelPercent: 45,
    logHeight: 144,
    showSidebar: false,
    showRightPanel: true,
  },
  "wide-pdf": {
    sidebarWidth: 200,
    rightPanelPercent: 65,
    logHeight: 144,
    showSidebar: true,
    showRightPanel: true,
  },
  writing: {
    sidebarWidth: 200,
    rightPanelPercent: 45,
    logHeight: 144,
    showSidebar: true,
    showRightPanel: false,
  },
  balanced: {
    sidebarWidth: 200,
    rightPanelPercent: 50,
    logHeight: 144,
    showSidebar: true,
    showRightPanel: true,
  },
};

export const LAYOUT_LABELS: Record<LayoutPreset, string> = {
  default: "Default",
  focus: "Focus",
  "wide-pdf": "Wide PDF",
  writing: "Writing",
  balanced: "Balanced",
};

export function getLayoutStorageKey(projectId: string) {
  return `manifold-layout-${projectId}`;
}

export function loadLayout(projectId: string): WorkspaceLayout {
  if (typeof window === "undefined") return DEFAULT_LAYOUT;
  try {
    const raw = localStorage.getItem(getLayoutStorageKey(projectId));
    if (!raw) return DEFAULT_LAYOUT;
    const parsed = JSON.parse(raw) as Partial<WorkspaceLayout>;
    return { ...DEFAULT_LAYOUT, ...parsed };
  } catch {
    return DEFAULT_LAYOUT;
  }
}

export function saveLayout(projectId: string, layout: WorkspaceLayout) {
  if (typeof window === "undefined") return;
  localStorage.setItem(getLayoutStorageKey(projectId), JSON.stringify(layout));
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
