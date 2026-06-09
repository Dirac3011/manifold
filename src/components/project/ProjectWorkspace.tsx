"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import type { LatexEditorHandle, EditorTextSelection } from "../LatexEditor";
import { WorkspaceToolbar } from "./WorkspaceToolbar";
import { CompilerBanner } from "@/components/ui/CompilerBanner";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { Button } from "@/components/ui/Button";
import { formatAgo } from "@/lib/ui/format-ago";
import {
  compileLogIndicatesFailure,
  parseCompileError,
} from "@/lib/ui/parse-compile-error";
import dynamic from "next/dynamic";
import type { ProjectBootstrap } from "@/lib/project/bootstrap";

const LatexEditor = dynamic(
  () => import("../LatexEditor").then((m) => ({ default: m.LatexEditor })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-[var(--background)] text-ui-sm text-[var(--muted)]">
        Loading editor…
      </div>
    ),
  }
);

const PdfViewer = dynamic(
  () => import("../PdfViewer").then((m) => ({ default: m.PdfViewer })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-[var(--muted)]">
        Loading viewer...
      </div>
    ),
  }
);

import { Sidebar, SidebarTab } from "./Sidebar";
import { DocumentOutlinePanel } from "./DocumentOutlinePanel";
import type { ObjectDetail } from "./ObjectPanel";

const ObjectPanel = dynamic(
  () => import("./ObjectPanel").then((m) => ({ default: m.ObjectPanel })),
  { loading: () => <RightPanelLoading label="Object" /> }
);
const ProjectNotesPanel = dynamic(
  () => import("./ProjectNotesPanel").then((m) => ({ default: m.ProjectNotesPanel })),
  { loading: () => <RightPanelLoading label="Notes" /> }
);
const ReviewInboxPanel = dynamic(
  () => import("./ReviewInboxPanel").then((m) => ({ default: m.ReviewInboxPanel })),
  { loading: () => <RightPanelLoading label="Review" /> }
);
import { ResizeHandle } from "./ResizeHandle";
import {
  ObjectInspectTab,
  ProjectNote,
  RightPanelMode,
  NarrowWorkspaceMode,
  NoteContext,
} from "@/lib/discussion/types";
import { detectSelectionContext } from "@/lib/discussion/detect-selection-context";
import {
  CompileProfile,
  DEFAULT_COMPILE_PROFILE,
  getCompilerStorageKey,
} from "@/lib/latex/compilers";
import {
  clampLogHeight,
  clampRightPanelPx,
  clampSidebar,
  LAYOUT_CONSTRAINTS,
  LayoutPreset,
  LAYOUT_PRESETS,
  ICON_RAIL_WIDTH,
  loadLayout,
  saveLayout,
  WorkspaceLayout,
} from "@/lib/workspace-layout";
import {
  AUTO_COMPILE_DELAY_MS,
  AUTO_SAVE_DELAY_MS,
  loadPreferences,
  MIN_AUTO_COMPILE_INTERVAL_MS,
  savePreferences,
  WorkspacePreferences,
} from "@/lib/workspace-preferences";
import { AppTheme, loadAppTheme, saveAppTheme } from "@/lib/theme";
import { useCollabSession } from "@/lib/collab/useCollabSession";
import { PresenceBar } from "./PresenceBar";
import { SaveConflictBanner } from "./SaveConflictBanner";

function RightPanelLoading({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center bg-[var(--surface)] text-ui-sm text-[var(--muted)]">
      Loading {label.toLowerCase()}…
    </div>
  );
}

type File = {
  id: string;
  name: string;
  path: string;
  content: string;
  isMain: boolean;
  version: number;
};
type CompilerOption = { id: CompileProfile; label: string; description: string };
type Member = { id: string; name: string | null; username: string };
type Project = {
  id: string;
  name: string;
  access: { canEdit: boolean; canView: boolean; isOwner: boolean };
  owner: Member;
  members: Array<{ user: Member }>;
};

export function ProjectWorkspace({
  projectId,
  initialData,
}: {
  projectId: string;
  initialData?: ProjectBootstrap;
}) {
  const mainFile = initialData?.files.find(
    (f) => f.id === initialData.mainFileId
  );
  const [project, setProject] = useState<Project | null>(
    initialData?.project ?? null
  );
  const [files, setFiles] = useState<File[]>(
    initialData?.files.map((f) => ({ ...f, version: f.version ?? 0 })) ?? []
  );
  const [activeFileId, setActiveFileId] = useState<string | null>(
    initialData?.mainFileId ?? null
  );
  const [content, setContent] = useState(mainFile?.content ?? "");
  const [dirty, setDirty] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("objects");
  const [prefs, setPrefs] = useState<WorkspacePreferences>(() =>
    loadPreferences(projectId)
  );
  const [appTheme, setAppTheme] = useState<AppTheme>(() => loadAppTheme());
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved" | "idle">("idle");
  const [lastSaveAt, setLastSaveAt] = useState<number | null>(null);
  const [lastCompileAt, setLastCompileAt] = useState<number | null>(
    initialData?.lastCompileAt
      ? new Date(initialData.lastCompileAt).getTime()
      : null
  );
  const [compileFailed, setCompileFailed] = useState(false);
  const [agoTick, setAgoTick] = useState(0);
  const [rightPanelMode, setRightPanelMode] = useState<RightPanelMode>("pdf");
  const [objectInspectTab, setObjectInspectTab] = useState<ObjectInspectTab>("overview");
  const [projectNotes, setProjectNotes] = useState<ProjectNote[]>([]);
  const [notesChannelId, setNotesChannelId] = useState<string | null>(null);
  const [notesReady, setNotesReady] = useState(false);
  const [narrowMode, setNarrowMode] = useState(false);
  const [narrowTab, setNarrowTab] = useState<NarrowWorkspaceMode>("editor");
  const [outlineCollapsed, setOutlineCollapsed] = useState(false);
  const [editorSelection, setEditorSelection] = useState<EditorTextSelection | null>(null);
  const [objects, setObjects] = useState<ProjectBootstrap["objects"]>(
    initialData?.objects ?? []
  );
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [objectDetail, setObjectDetail] = useState<ObjectDetail | null>(null);
  const [currentLine, setCurrentLine] = useState(1);
  const [pdfUrl, setPdfUrl] = useState<string | null>(
    initialData?.lastPdfUrl ?? null
  );
  const [compileLog, setCompileLog] = useState("");
  const [compiling, setCompiling] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [compiler, setCompiler] = useState<CompileProfile>(DEFAULT_COMPILE_PROFILE);
  const [compilerOptions, setCompilerOptions] = useState<CompilerOption[]>([]);
  const [citations, setCitations] = useState<
    Array<{ key: string; title: string | null; authors: string | null; rawBibtex?: string }>
  >([]);
  const [citationAnalysis, setCitationAnalysis] = useState({
    used: [] as string[],
    unused: [] as string[],
    missing: [] as string[],
  });
  const [dependencies, setDependencies] = useState<
    Array<{
      fromId: string;
      toId: string;
      refLabel: string;
      from: { id: string; label: string | null; type: string; title: string | null };
      to: { id: string; label: string | null; type: string; title: string | null };
    }>
  >([]);
  const [snapshots, setSnapshots] = useState<
    Array<{ id: string; reason: string; createdAt: string; user?: { username: string } }>
  >([]);
  const [objectFilter, setObjectFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [initialLoading, setInitialLoading] = useState(!initialData);
  const [layout, setLayout] = useState<WorkspaceLayout>(() => loadLayout(projectId));
  const editorRef = useRef<LatexEditorHandle>(null);
  const fileInitializedRef = useRef(!!initialData);
  const prevAssigneeRef = useRef(assigneeFilter);
  const centerRef = useRef<HTMLDivElement>(null);
  const splitResizeRafRef = useRef<number | null>(null);
  const sidebarResizeRafRef = useRef<number | null>(null);
  const pendingRightDeltaRef = useRef(0);
  const pendingSidebarDeltaRef = useRef(0);
  const [splitResizing, setSplitResizing] = useState(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoCompileTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAutoCompileRef = useRef(0);
  const compilingRef = useRef(false);

  const { data: session } = useSession();

  const members: Member[] = project
    ? [
        project.owner,
        ...project.members.map((m) => m.user).filter((u) => u.id !== project.owner.id),
      ]
    : [];

  const collabUser = useMemo(() => {
    if (!session?.user?.id) return null;
    const member = members.find((m) => m.id === session.user!.id);
    if (member) {
      return { id: member.id, name: member.name, username: member.username };
    }
    return {
      id: session.user.id,
      name: session.user.name ?? null,
      username: session.user.email?.split("@")[0] ?? "user",
    };
  }, [session, members]);

  const collab = useCollabSession({
    projectId,
    user: collabUser,
    canEdit: project?.access.canEdit ?? false,
    activeFileId,
    enabled: !!project && !initialLoading,
  });

  const isCollabEditing = collab.collabActive;
  const effectiveDirty = isCollabEditing ? collab.hasLocalEdits : dirty;

  const loadProject = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}`);
    if (!res.ok) return;
    const data = await res.json();
    setProject(data);
    setFiles(data.files);
    if (!fileInitializedRef.current && data.files?.length) {
      fileInitializedRef.current = true;
      const main = data.files.find((f: File) => f.isMain) || data.files[0];
      setActiveFileId(main.id);
      setContent(main.content);
    }
  }, [projectId]);

  const loadObjects = useCallback(async () => {
    const params = new URLSearchParams();
    if (assigneeFilter) params.set("assigneeId", assigneeFilter);
    const res = await fetch(`/api/projects/${projectId}/objects?${params}`);
    if (!res.ok) return;
    setObjects(await res.json());
  }, [projectId, assigneeFilter]);

  const loadCitations = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/citations`);
    const data = await res.json();
    setCitations(data.citations);
    setCitationAnalysis(data.analysis);
  }, [projectId]);

  const loadReferences = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/references`);
    const data = await res.json();
    setDependencies(data.dependencies);
  }, [projectId]);

  const loadSnapshots = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/snapshots`);
    setSnapshots(await res.json());
  }, [projectId]);

  const loadObjectDetail = useCallback(
    async (objectId: string) => {
      const res = await fetch(`/api/projects/${projectId}/objects/${objectId}`);
      setObjectDetail(await res.json());
    },
    [projectId]
  );

  useEffect(() => {
    let cancelled = false;
    if (!initialData) {
      setInitialLoading(true);
      Promise.all([loadProject(), loadObjects()]).finally(() => {
        if (!cancelled) setInitialLoading(false);
      });
    } else {
      fileInitializedRef.current = true;
    }

    loadCitations();
    loadReferences();
    loadSnapshots();

    fetch("/api/compilers")
      .then((r) => r.json())
      .then((data) => {
        if (data?.profiles) setCompilerOptions(data.profiles);
      });

    const saved = localStorage.getItem(getCompilerStorageKey(projectId));
    if (saved === "draft" || saved === "standard" || saved === "final") {
      setCompiler(saved);
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount + project switch only
  }, [projectId]);

  useEffect(() => {
    const t = setTimeout(() => saveLayout(projectId, layout), 400);
    return () => clearTimeout(t);
  }, [projectId, layout]);

  useEffect(() => {
    if (prevAssigneeRef.current === assigneeFilter) return;
    prevAssigneeRef.current = assigneeFilter;
    loadObjects();
  }, [assigneeFilter, loadObjects]);

  const loadProjectNotes = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/notes`);
    if (!res.ok) return;
    const data = await res.json();
    if (Array.isArray(data)) {
      setProjectNotes(data);
    } else if (data?.notes && Array.isArray(data.notes)) {
      setProjectNotes(data.notes);
      if (data.generalChannelId) setNotesChannelId(data.generalChannelId);
    }
    setNotesReady(true);
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      if (!cancelled) void loadProjectNotes();
    };
    const id =
      typeof requestIdleCallback !== "undefined"
        ? requestIdleCallback(run, { timeout: 1500 })
        : window.setTimeout(run, 400);
    return () => {
      cancelled = true;
      if (typeof cancelIdleCallback !== "undefined") {
        cancelIdleCallback(id as number);
      } else {
        clearTimeout(id);
      }
    };
  }, [loadProjectNotes]);

  const preloadNotesPanel = useCallback(() => {
    void import("./ProjectNotesPanel");
  }, []);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${LAYOUT_CONSTRAINTS.narrowBreakpoint}px)`);
    const update = () => setNarrowMode(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (selectedObjectId) loadObjectDetail(selectedObjectId);
  }, [selectedObjectId, loadObjectDetail]);

  const activeObjectAtLine = objects.find(
    (o) =>
      currentLine >= o.startLine &&
      currentLine <= o.endLine &&
      o.status !== "DEPRECATED"
  );

  useEffect(() => {
    const ranges = activeObjectAtLine
      ? [{ startLine: activeObjectAtLine.startLine, endLine: activeObjectAtLine.endLine }]
      : selectedObjectId
        ? (() => {
            const o = objects.find((x) => x.id === selectedObjectId);
            return o ? [{ startLine: o.startLine, endLine: o.endLine }] : [];
          })()
        : [];
    editorRef.current?.setHighlights(ranges);
  }, [activeObjectAtLine, selectedObjectId, objects, currentLine]);

  function selectCompiler(profile: CompileProfile) {
    setCompiler(profile);
    localStorage.setItem(getCompilerStorageKey(projectId), profile);
  }

  function selectFile(id: string) {
    const file = files.find((f) => f.id === id);
    if (file) {
      setActiveFileId(id);
      if (!isCollabEditing) {
        setContent(file.content);
        setDirty(false);
      }
    }
  }

  async function save(silent = false) {
    if (!activeFileId || !project?.access.canEdit) return false;
    setSaveStatus("saving");

    const fileMeta = files.find((f) => f.id === activeFileId);
    const saveContent = isCollabEditing ? collab.getContent() : content;
    const version = fileMeta?.version ?? 0;

    if (isCollabEditing) {
      const newVersion = await collab.checkpoint();
      if (newVersion != null) {
        setDirty(false);
        setSaveStatus("saved");
        setLastSaveAt(Date.now());
        setFiles((prev) =>
          prev.map((f) =>
            f.id === activeFileId
              ? { ...f, content: saveContent, version: newVersion }
              : f
          )
        );
      } else {
        setSaveStatus("unsaved");
        return false;
      }
    } else {
      const res = await fetch(`/api/projects/${projectId}/files`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileId: activeFileId,
          content: saveContent,
          version,
        }),
      });
      if (res.status === 409) {
        const data = await res.json();
        collab.setSaveConflict({
          serverContent: data.serverContent,
          serverVersion: data.serverVersion,
          localContent: saveContent,
        });
        setSaveStatus("unsaved");
        return false;
      }
      if (!res.ok) {
        setSaveStatus("unsaved");
        return false;
      }
      const updated = await res.json();
      setDirty(false);
      setSaveStatus("saved");
      setLastSaveAt(Date.now());
      setFiles((prev) =>
        prev.map((f) =>
          f.id === activeFileId
            ? { ...f, content: saveContent, version: updated.version ?? version + 1 }
            : f
        )
      );
    }
    const params = new URLSearchParams();
    if (assigneeFilter) params.set("assigneeId", assigneeFilter);
    const [, objectsRes] = await Promise.all([
      loadCitations(),
      fetch(`/api/projects/${projectId}/objects?${params}`),
      loadReferences(),
      loadSnapshots(),
    ]);
    const freshObjects = await objectsRes.json();
    setObjects(freshObjects);
    if (selectedObjectId) {
      const selected = freshObjects.find((o: { id: string; status: string }) => o.id === selectedObjectId);
      if (selected?.status === "DEPRECATED") {
        setRightPanelMode("inspect");
        loadObjectDetail(selectedObjectId);
      }
    }
    return true;
  }

  async function compile(auto = false) {
    if (!project?.access.canEdit || compilingRef.current) return;
    if (effectiveDirty) await save(auto);
    if (auto) {
      const elapsed = Date.now() - lastAutoCompileRef.current;
      if (elapsed < MIN_AUTO_COMPILE_INTERVAL_MS) return;
    }
    compilingRef.current = true;
    setCompiling(true);
    if (!auto) setShowLogs(true);
    const profile = auto ? "draft" : compiler;
    const res = await fetch(`/api/projects/${projectId}/compile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ compiler: profile }),
    });
    const data = await res.json();
    setCompileLog(data.log);
    const failed = compileLogIndicatesFailure(data.log) || !data.pdfUrl;
    setCompileFailed(failed);
    if (data.pdfUrl) {
      setPdfUrl(data.pdfUrl + "?t=" + Date.now());
      setLastCompileAt(Date.now());
      setRightPanelMode("pdf");
    }
    setCompiling(false);
    compilingRef.current = false;
    if (failed && !auto) setShowLogs(true);
    if (auto) lastAutoCompileRef.current = Date.now();
    await Promise.all([loadObjects(), loadSnapshots()]);
  }

  function updatePrefs(patch: Partial<WorkspacePreferences>) {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      savePreferences(projectId, next);
      return next;
    });
  }

  function toggleAppTheme() {
    setAppTheme((prev) => {
      const next: AppTheme = prev === "dark" ? "light" : "dark";
      saveAppTheme(next);
      return next;
    });
  }

  useEffect(() => {
    if (effectiveDirty) setSaveStatus("unsaved");
  }, [effectiveDirty]);

  useEffect(() => {
    const id = setInterval(() => setAgoTick((t) => t + 1), 10000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!prefs.autoSave || !effectiveDirty || !project?.access.canEdit) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      save(true).then((ok) => {
        if (ok && prefs.autoCompile) {
          if (autoCompileTimerRef.current) clearTimeout(autoCompileTimerRef.current);
          autoCompileTimerRef.current = setTimeout(() => compile(true), AUTO_COMPILE_DELAY_MS);
        }
      });
    }, AUTO_SAVE_DELAY_MS);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [content, effectiveDirty, prefs.autoSave, prefs.autoCompile, project?.access.canEdit]);

  function selectObject(id: string, tab: ObjectInspectTab = "overview") {
    setSelectedObjectId(id);
    setObjectInspectTab(tab);
    setRightPanelMode("inspect");
    updateLayout({ showRightPanel: true });
    if (narrowMode) setNarrowTab("inspect");
    loadObjectDetail(id);
  }

  function openObjectDiscussion(id: string) {
    selectObject(id, "discussion");
  }

  function openProjectNotes() {
    preloadNotesPanel();
    if (!notesReady) void loadProjectNotes();
    setRightPanelMode("notes");
    updateLayout({ showRightPanel: true });
    if (narrowMode) setNarrowTab("inspect");
  }

  function openReviewInbox() {
    setRightPanelMode("review");
    updateLayout({ showRightPanel: true });
    if (narrowMode) setNarrowTab("inspect");
    loadProjectNotes();
    loadObjects();
  }

  function openPdfPanel() {
    setRightPanelMode("pdf");
    updateLayout({ showRightPanel: true });
    if (narrowMode) setNarrowTab("preview");
  }

  function jumpToSource(line: number) {
    editorRef.current?.jumpToLine(line);
    setCurrentLine(line);
  }

  function handleMentionClick(label: string) {
    const obj = objects.find((o) => o.label === label);
    if (obj) selectObject(obj.id);
  }

  async function addFile(name: string) {
    const res = await fetch(`/api/projects/${projectId}/files`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        content: name.endsWith(".bib") ? "" : "% New file\n",
      }),
    });
    if (res.ok) await loadProject();
  }

  async function refreshCitations() {
    await Promise.all([loadCitations(), loadProject(), loadObjects()]);
  }

  function handleGitSync() {
    loadProject();
    loadObjects();
    loadCitations();
    loadReferences();
  }

  function applyLayoutPreset(preset: LayoutPreset) {
    setLayout({ preset, ...LAYOUT_PRESETS[preset] });
    if (preset === "writing") setRightPanelMode("inspect");
  }

  function updateLayout(patch: Partial<WorkspaceLayout>) {
    setLayout((prev) => ({ ...prev, ...patch, preset: prev.preset }));
  }

  function resizeSidebar(delta: number) {
    pendingSidebarDeltaRef.current += delta;
    if (sidebarResizeRafRef.current != null) return;
    sidebarResizeRafRef.current = requestAnimationFrame(() => {
      sidebarResizeRafRef.current = null;
      const d = pendingSidebarDeltaRef.current;
      pendingSidebarDeltaRef.current = 0;
      if (d === 0) return;
      setLayout((prev) => ({
        ...prev,
        sidebarWidth: clampSidebar(prev.sidebarWidth + d),
      }));
    });
  }

  const sidebarTotalWidth =
    !layout.showSidebar
      ? 0
      : sidebarTab === null
        ? ICON_RAIL_WIDTH
        : sidebarTab === "citations"
          ? ICON_RAIL_WIDTH + 300
          : ICON_RAIL_WIDTH + layout.sidebarWidth;

  function handleSearchSelectFile(fileId: string, line?: number) {
    selectFile(fileId);
    if (line) jumpToSource(line);
    setSidebarTab("files");
  }

  function handleSearchSelectCitation() {
    setSidebarTab("citations");
  }

  const beginSplitResize = useCallback(() => setSplitResizing(true), []);
  const endSplitResize = useCallback(() => setSplitResizing(false), []);

  function resizeRightPanel(delta: number) {
    pendingRightDeltaRef.current += delta;
    if (splitResizeRafRef.current != null) return;
    splitResizeRafRef.current = requestAnimationFrame(() => {
      splitResizeRafRef.current = null;
      const total = centerRef.current?.clientWidth ?? 0;
      const d = pendingRightDeltaRef.current;
      pendingRightDeltaRef.current = 0;
      if (total <= 0 || d === 0) return;
      setLayout((prev) => ({
        ...prev,
        rightPanelWidth: clampRightPanelPx(prev.rightPanelWidth - d, total),
      }));
    });
  }

  function resizeLog(delta: number) {
    const vh = typeof window !== "undefined" ? window.innerHeight : 800;
    setLayout((prev) => ({
      ...prev,
      logHeight: clampLogHeight(prev.logHeight - delta, vh),
    }));
  }

  useEffect(() => {
    function onWindowResize() {
      const total = centerRef.current?.clientWidth;
      if (!total) return;
      setLayout((prev) => {
        const clamped = clampRightPanelPx(prev.rightPanelWidth, total);
        return clamped === prev.rightPanelWidth
          ? prev
          : { ...prev, rightPanelWidth: clamped };
      });
    }
    window.addEventListener("resize", onWindowResize);
    return () => window.removeEventListener("resize", onWindowResize);
  }, []);

  const activeFile = files.find((f) => f.id === activeFileId);
  const compileError = useMemo(
    () => (compileFailed ? parseCompileError(compileLog) : null),
    [compileFailed, compileLog]
  );

  const reviewCount = useMemo(() => {
    let count = 0;
    for (const o of objects) {
      if (o.status === "NEEDS_REVIEW") count++;
      count += o.thread?.comments.filter((c) => !c.resolved).length ?? 0;
    }
    count += projectNotes.filter((n) => n.noteType === "QUESTION").length;
    if (compileFailed && compileError) count++;
    return count;
  }, [objects, projectNotes, compileFailed, compileError]);

  const noteSelectionContext = useMemo((): NoteContext | null => {
    if (!editorSelection) return null;
    return detectSelectionContext(
      {
        startLine: editorSelection.startLine,
        endLine: editorSelection.endLine,
        text: editorSelection.text,
      },
      activeFile ? { id: activeFile.id, name: activeFile.name } : null,
      objects
    );
  }, [editorSelection, activeFile, objects]);

  const activeObjects = objects.filter((o) => o.status !== "DEPRECATED");
  void agoTick;

  const compileStatus = compiling
    ? "compiling"
    : compileFailed
      ? "failed"
      : effectiveDirty && pdfUrl
        ? "stale"
        : pdfUrl
          ? "success"
          : "idle";

  const projectTexBundle = useMemo(
    () =>
      files
        .filter((f) => f.path.endsWith(".tex") || f.path.endsWith(".bib"))
        .map((f) => {
          if (f.id !== activeFileId) return f.content;
          if (isCollabEditing) return collab.getContent();
          return effectiveDirty ? content : f.content;
        })
        .join("\n"),
    [files, activeFileId, content, effectiveDirty, isCollabEditing, collab]
  );

  const mainFileContent = useMemo(() => {
    const main = files.find((f) => f.isMain) ?? files[0];
    if (!main) return "";
    if (main.id === activeFileId) {
      if (isCollabEditing) return collab.getContent();
      return effectiveDirty ? content : main.content;
    }
    return main.content;
  }, [files, activeFileId, content, effectiveDirty, isCollabEditing, collab]);

  async function renameProject(name: string) {
    const res = await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      const updated = await res.json();
      setProject((prev) => (prev ? { ...prev, name: updated.name } : prev));
    }
  }

  return (
    <div className="relative flex h-screen flex-col">
      {initialLoading && (
        <div className="pointer-events-none absolute inset-x-0 top-11 z-40 h-0.5 overflow-hidden bg-[var(--border-subtle)]">
          <div className="h-full w-1/3 animate-pulse bg-[var(--accent)]" />
        </div>
      )}
      <WorkspaceToolbar
        projectName={project?.name || "Loading…"}
        canRenameProject={project?.access.canEdit ?? false}
        onProjectRename={renameProject}
        activeFileName={activeFile?.name ?? null}
        canEdit={project?.access.canEdit ?? false}
        saveStatus={saveStatus}
        saveAgo={formatAgo(lastSaveAt)}
        compileStatus={compileStatus}
        compileAgo={formatAgo(lastCompileAt)}
        compiler={compiler}
        compilerOptions={compilerOptions}
        onCompilerChange={selectCompiler}
        onSave={() => save()}
        onCompile={() => compile()}
        layoutPreset={layout.preset}
        onLayoutPreset={applyLayoutPreset}
        showSidebar={layout.showSidebar}
        onToggleSidebar={() => updateLayout({ showSidebar: !layout.showSidebar })}
        showRightPanel={layout.showRightPanel}
        onToggleRightPanel={() => {
          updateLayout({ showRightPanel: !layout.showRightPanel });
        }}
        rightPanelMode={rightPanelMode}
        onOpenPdf={openPdfPanel}
        onOpenNotes={openProjectNotes}
        onWarmNotes={preloadNotesPanel}
        onOpenReview={openReviewInbox}
        reviewCount={reviewCount}
        appTheme={appTheme}
        onToggleTheme={toggleAppTheme}
        autoSave={prefs.autoSave}
        autoCompile={prefs.autoCompile}
        onAutoSaveChange={(v) => updatePrefs({ autoSave: v })}
        onAutoCompileChange={(v) => updatePrefs({ autoCompile: v })}
        activeObjectLabel={
          activeObjectAtLine?.label ??
          (activeObjectAtLine ? activeObjectAtLine.type.toLowerCase() : null)
        }
        onActiveObjectClick={
          activeObjectAtLine
            ? () => selectObject(activeObjectAtLine.id)
            : undefined
        }
        presenceSlot={
          <PresenceBar
            presence={collab.presence}
            currentUserId={session?.user?.id}
            activeFileId={activeFileId}
            status={collab.connectionStatus}
            error={collab.collabError}
          />
        }
      />

      {collab.saveConflict && (
        <SaveConflictBanner
          conflict={collab.saveConflict}
          onUseServer={() => {
            collab.applyServerContent(collab.saveConflict!.serverContent);
            setFiles((prev) =>
              prev.map((f) =>
                f.id === activeFileId
                  ? {
                      ...f,
                      content: collab.saveConflict!.serverContent,
                      version: collab.saveConflict!.serverVersion,
                    }
                  : f
              )
            );
            if (!isCollabEditing) {
              setContent(collab.saveConflict!.serverContent);
            }
            collab.clearConflict();
            setDirty(false);
          }}
          onKeepLocal={async () => {
            const conflict = collab.saveConflict;
            if (!conflict || !activeFileId) return;
            const res = await fetch(`/api/projects/${projectId}/files`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                fileId: activeFileId,
                content: conflict.localContent,
                force: true,
              }),
            });
            if (res.ok) {
              const updated = await res.json();
              collab.applyServerContent(conflict.localContent);
              collab.clearConflict();
              setFiles((prev) =>
                prev.map((f) =>
                  f.id === activeFileId
                    ? { ...f, content: conflict.localContent, version: updated.version }
                    : f
                )
              );
              if (!isCollabEditing) setContent(conflict.localContent);
            }
          }}
          onDismiss={collab.clearConflict}
        />
      )}

      {compileError && !compiling && !showLogs && (
        <CompilerBanner
          error={compileError}
          onJumpToLine={(line) => jumpToSource(line)}
          onViewLog={() => setShowLogs(true)}
        />
      )}

      <div className="flex flex-1 overflow-hidden">
        {layout.showSidebar && (
          <>
            <div className="shrink-0 overflow-hidden" style={{ width: sidebarTotalWidth }}>
              <Sidebar
            tab={sidebarTab}
            onTabChange={setSidebarTab}
            onMentionClick={handleMentionClick}
            onSearchSelectFile={handleSearchSelectFile}
            onSearchSelectCitation={handleSearchSelectCitation}
            panelWidth={layout.sidebarWidth}
            projectId={projectId}
            isOwner={project?.access.isOwner ?? false}
            canEdit={project?.access.canEdit ?? false}
            files={files}
            activeFileId={activeFileId}
            onFileSelect={selectFile}
            onAddFile={addFile}
            objects={objects}
            members={members}
            selectedObjectId={selectedObjectId}
            onObjectSelect={selectObject}
            currentLine={currentLine}
            citations={citations}
            citationAnalysis={citationAnalysis}
            onCitationsRefresh={refreshCitations}
            onGitSync={handleGitSync}
            dependencies={dependencies}
            snapshots={snapshots}
            objectFilter={objectFilter}
            assigneeFilter={assigneeFilter}
            onObjectFilterChange={setObjectFilter}
            onAssigneeFilterChange={setAssigneeFilter}
            onOpenReview={openReviewInbox}
            reviewCount={reviewCount}
            onObjectDiscussion={openObjectDiscussion}
              />
            </div>
            {sidebarTab && (
              <ResizeHandle
                direction="horizontal"
                onResize={resizeSidebar}
                onResizeStart={beginSplitResize}
                onResizeEnd={endSplitResize}
              />
            )}
          </>
        )}

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {narrowMode && (
            <div className="flex shrink-0 border-b border-[var(--border-subtle)] bg-[var(--surface)]">
              {(
                [
                  ["editor", "Editor"],
                  ["preview", "Preview"],
                  ["inspect", "Inspect"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setNarrowTab(id)}
                  className={`flex-1 px-3 py-2 text-ui-xs font-medium ${
                    narrowTab === id
                      ? "border-b-2 border-[var(--accent)] text-[var(--accent)]"
                      : "text-[var(--muted)]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          <div ref={centerRef} className="flex min-h-0 flex-1 overflow-hidden">
            {(!narrowMode || narrowTab === "editor") && (
              <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                <div className="min-h-0 flex-1 overflow-hidden">
                  <LatexEditor
                    key={activeFileId ?? "none"}
                    ref={editorRef}
                    value={content}
                    onChange={(v) => { setContent(v); setDirty(true); }}
                    onCursorLine={(line) => {
                      setCurrentLine(line);
                      collab.reportCursor(line);
                    }}
                    onSelectionChange={setEditorSelection}
                    readOnly={!project?.access.canEdit}
                    appTheme={appTheme}
                    projectTexBundle={projectTexBundle}
                    collab={
                      collab.yText && collab.awareness
                        ? {
                            yText: collab.yText,
                            awareness: collab.awareness,
                            synced: collab.fileSynced,
                          }
                        : null
                    }
                  />
                </div>
                <DocumentOutlinePanel
                  content={mainFileContent}
                  currentLine={currentLine}
                  onJumpToLine={jumpToSource}
                  collapsed={outlineCollapsed}
                  onToggleCollapsed={() => setOutlineCollapsed((v) => !v)}
                />
              </div>
            )}

            {layout.showRightPanel && (!narrowMode || narrowTab !== "editor") && (
              <>
                {!narrowMode && (
                  <ResizeHandle
                    direction="horizontal"
                    onResize={resizeRightPanel}
                    onResizeStart={beginSplitResize}
                    onResizeEnd={endSplitResize}
                  />
                )}
                <div
                  className={`shrink-0 overflow-hidden border-l border-[var(--border)] ${
                    narrowMode ? "w-full flex-1" : ""
                  }`}
                  style={
                    narrowMode
                      ? undefined
                      : { width: layout.rightPanelWidth }
                  }
                >
                  {(() => {
                    const showPanel = !narrowMode || narrowTab !== "editor";
                    const mode = narrowMode && narrowTab === "preview" ? "pdf" : rightPanelMode;
                    if (!showPanel) return null;

                    if (mode === "pdf") {
                      return (
                        <PdfViewer
                          pdfUrl={pdfUrl}
                          loading={compiling}
                          stale={effectiveDirty && !!pdfUrl && !compiling}
                          compileFailed={compileFailed && !compiling}
                          panelResizing={splitResizing}
                        />
                      );
                    }
                    if (mode === "review") {
                      return (
                        <ReviewInboxPanel
                          objects={objects}
                          notes={projectNotes}
                          compileError={compileError}
                          onOpenObject={(id, tab) => selectObject(id, tab ?? "overview")}
                          onOpenNotes={openProjectNotes}
                          onJumpToLine={jumpToSource}
                        />
                      );
                    }
                    if (mode === "notes" || (mode === "inspect" && !selectedObjectId)) {
                      return (
                        <ProjectNotesPanel
                          projectId={projectId}
                          canEdit={project?.access.canEdit ?? false}
                          notes={projectNotes}
                          notesReady={notesReady}
                          generalChannelId={notesChannelId}
                          onNotesChange={setProjectNotes}
                          onChannelId={setNotesChannelId}
                          selectionContext={noteSelectionContext}
                          onContextNavigate={(ctx) => {
                            if (ctx.objectId) selectObject(ctx.objectId);
                          }}
                          onMentionClick={handleMentionClick}
                        />
                      );
                    }
                    if (mode === "inspect" && selectedObjectId) {
                      return (
                        <ObjectPanel
                          object={objectDetail}
                          projectId={projectId}
                          members={members}
                          onJumpToSource={jumpToSource}
                          onRefresh={() => {
                            loadObjects();
                            if (selectedObjectId) loadObjectDetail(selectedObjectId);
                          }}
                          canEdit={project?.access.canEdit ?? false}
                          inspectTab={objectInspectTab}
                          onInspectTabChange={setObjectInspectTab}
                        />
                      );
                    }
                    return null;
                  })()}
                </div>
              </>
            )}
          </div>

          {showLogs && (
            <>
              <ResizeHandle direction="vertical" onResize={resizeLog} />
              <div
                className="shrink-0 border-t border-[var(--border)] bg-[var(--background)]"
                style={{ height: layout.logHeight }}
              >
                <PanelHeader
                  title="Compiler log"
                  actions={
                    <Button variant="ghost" size="sm" onClick={() => setShowLogs(false)}>
                      Hide
                    </Button>
                  }
                />
                {compileError && (
                  <CompilerBanner
                    error={compileError}
                    onJumpToLine={(line) => jumpToSource(line)}
                  />
                )}
                <pre
                  className="overflow-auto bg-[var(--background)] p-3 font-mono text-ui-xs leading-relaxed text-[var(--muted)]"
                  style={{ height: layout.logHeight - (compileError ? 88 : 44) }}
                >
                  {compileLog || "No compilation yet."}
                </pre>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
