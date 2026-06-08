export type LayoutPreset = "default" | "focus" | "wide-pdf" | "writing" | "balanced";

export type WorkspaceLayout = {
  preset: LayoutPreset;
  sidebarWidth: number;
  /** Right panel width in pixels (editor/pdf split) */
  rightPanelWidth: number;
  logHeight: number;
  showSidebar: boolean;
  showRightPanel: boolean;
};

export const ICON_RAIL_WIDTH = 44;

export const RESIZE_HANDLE_WIDTH = 6;

/** Resizing constraints (desktop) */
export const LAYOUT_CONSTRAINTS = {
  sidebarMin: 220,
  sidebarMax: 420,
  editorMin: 280,
  rightPanelMin: 240,
  logMin: 120,
  logMaxPercent: 45,
  narrowBreakpoint: 1024,
} as const;

export const DEFAULT_LAYOUT: WorkspaceLayout = {
  preset: "default",
  sidebarWidth: 260,
  rightPanelWidth: 440,
  logHeight: 144,
  showSidebar: true,
  showRightPanel: true,
};

export const LAYOUT_PRESETS: Record<
  LayoutPreset,
  Omit<WorkspaceLayout, "preset">
> = {
  default: {
    sidebarWidth: 260,
    rightPanelWidth: 440,
    logHeight: 144,
    showSidebar: true,
    showRightPanel: true,
  },
  focus: {
    sidebarWidth: 260,
    rightPanelWidth: 440,
    logHeight: 144,
    showSidebar: false,
    showRightPanel: true,
  },
  "wide-pdf": {
    sidebarWidth: 260,
    rightPanelWidth: 560,
    logHeight: 144,
    showSidebar: true,
    showRightPanel: true,
  },
  writing: {
    sidebarWidth: 260,
    rightPanelWidth: 440,
    logHeight: 144,
    showSidebar: true,
    showRightPanel: false,
  },
  balanced: {
    sidebarWidth: 280,
    rightPanelWidth: 480,
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

function migrateRightPanelWidth(parsed: Partial<WorkspaceLayout>): number {
  if (typeof parsed.rightPanelWidth === "number") {
    return parsed.rightPanelWidth;
  }
  const legacy = (parsed as { rightPanelPercent?: number }).rightPanelPercent;
  if (typeof legacy === "number") {
    const estimate =
      typeof window !== "undefined"
        ? Math.round(legacy * 0.01 * window.innerWidth * 0.55)
        : Math.round(legacy * 0.01 * 1200);
    return estimate;
  }
  return DEFAULT_LAYOUT.rightPanelWidth;
}

export function loadLayout(projectId: string): WorkspaceLayout {
  if (typeof window === "undefined") return DEFAULT_LAYOUT;

  try {
    const raw = localStorage.getItem(getLayoutStorageKey(projectId));
    if (!raw) return DEFAULT_LAYOUT;

    const parsed = JSON.parse(raw) as Partial<WorkspaceLayout>;
    const rightPanelWidth = clampRightPanelPx(
      migrateRightPanelWidth(parsed),
      typeof window !== "undefined" ? window.innerWidth : 1400
    );

    return {
      ...DEFAULT_LAYOUT,
      ...parsed,
      sidebarWidth: clampSidebar(parsed.sidebarWidth ?? DEFAULT_LAYOUT.sidebarWidth),
      rightPanelWidth,
      logHeight: parsed.logHeight ?? DEFAULT_LAYOUT.logHeight,
    };
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

export function clampSidebar(width: number) {
  return clamp(width, LAYOUT_CONSTRAINTS.sidebarMin, LAYOUT_CONSTRAINTS.sidebarMax);
}

export function clampRightPanelPx(px: number, centerWidth: number) {
  const min = LAYOUT_CONSTRAINTS.rightPanelMin;
  const max = Math.max(
    min,
    centerWidth - LAYOUT_CONSTRAINTS.editorMin - RESIZE_HANDLE_WIDTH
  );
  return clamp(px, min, max);
}

export function clampLogHeight(px: number, viewportHeight: number) {
  const max = viewportHeight * (LAYOUT_CONSTRAINTS.logMaxPercent / 100);
  return clamp(px, LAYOUT_CONSTRAINTS.logMin, max);
}
