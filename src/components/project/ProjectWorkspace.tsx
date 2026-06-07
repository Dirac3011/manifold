"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { LatexEditor, LatexEditorHandle } from "../LatexEditor";
import dynamic from "next/dynamic";

const PdfViewer = dynamic(() => import("../PdfViewer").then((m) => m.PdfViewer), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-[var(--muted)]">
      Loading viewer...
    </div>
  ),
});
import { LoadingOverlay } from "../LoadingOverlay";
import { Sidebar, SidebarTab } from "./Sidebar";
import { ObjectPanel } from "./ObjectPanel";
import { ResizeHandle } from "./ResizeHandle";
import {
  CompileProfile,
  DEFAULT_COMPILE_PROFILE,
  getCompilerStorageKey,
} from "@/lib/latex/compilers";
import {
  clamp,
  LayoutPreset,
  LAYOUT_LABELS,
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

type File = { id: string; name: string; path: string; content: string; isMain: boolean };
type CompilerOption = { id: CompileProfile; label: string; description: string };
type Member = { id: string; name: string | null; username: string };
type Project = {
  id: string;
  name: string;
  access: { canEdit: boolean; canView: boolean; isOwner: boolean };
  owner: Member;
  members: Array<{ user: Member }>;
};

export function ProjectWorkspace({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<Project | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [dirty, setDirty] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("objects");
  const [prefs, setPrefs] = useState<WorkspacePreferences>(() =>
    loadPreferences(projectId)
  );
  const [appTheme, setAppTheme] = useState<AppTheme>(() => loadAppTheme());
  const [autoSaveStatus, setAutoSaveStatus] = useState("");
  const [rightPanel, setRightPanel] = useState<"pdf" | "object">("pdf");
  const [objects, setObjects] = useState<
    Array<{
      id: string;
      type: string;
      label: string | null;
      title: string | null;
      startLine: number;
      endLine: number;
      status: string;
      proofLatex: string | null;
      assigneeId: string | null;
      assignee: Member | null;
      citedIn: Array<{ citeKey: string; citation: { key: string } }>;
      thread?: { comments: Array<{ id: string; resolved: boolean }> };
    }>
  >([]);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [objectDetail, setObjectDetail] = useState<Parameters<typeof ObjectPanel>[0]["object"]>(null);
  const [currentLine, setCurrentLine] = useState(1);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
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
  const [initialLoading, setInitialLoading] = useState(true);
  const [layout, setLayout] = useState<WorkspaceLayout>(() => loadLayout(projectId));
  const editorRef = useRef<LatexEditorHandle>(null);
  const centerRef = useRef<HTMLDivElement>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoCompileTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAutoCompileRef = useRef(0);
  const compilingRef = useRef(false);

  const members: Member[] = project
    ? [
        project.owner,
        ...project.members.map((m) => m.user).filter((u) => u.id !== project.owner.id),
      ]
    : [];

  const loadProject = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}`);
    const data = await res.json();
    setProject(data);
    setFiles(data.files);
    if (!activeFileId && data.files?.length) {
      const main = data.files.find((f: File) => f.isMain) || data.files[0];
      setActiveFileId(main.id);
      setContent(main.content);
    }
  }, [projectId, activeFileId]);

  const loadObjects = useCallback(async () => {
    const params = new URLSearchParams();
    if (assigneeFilter) params.set("assigneeId", assigneeFilter);
    const res = await fetch(`/api/projects/${projectId}/objects?${params}`);
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
    setInitialLoading(true);
    Promise.all([
      loadProject(),
      loadObjects(),
      loadCitations(),
      loadReferences(),
      loadSnapshots(),
    ]).finally(() => {
      if (!cancelled) setInitialLoading(false);
    });
    fetch("/api/compilers")
      .then((r) => r.json())
      .then((data) => setCompilerOptions(data.profiles));
    const saved = localStorage.getItem(getCompilerStorageKey(projectId));
    if (saved === "draft" || saved === "standard" || saved === "final") {
      setCompiler(saved);
    }
    return () => {
      cancelled = true;
    };
  }, [loadProject, loadObjects, loadCitations, loadReferences, loadSnapshots, projectId]);

  useEffect(() => {
    saveLayout(projectId, layout);
  }, [projectId, layout]);

  useEffect(() => { loadObjects(); }, [loadObjects]);

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
      setContent(file.content);
      setDirty(false);
    }
  }

  async function save(silent = false) {
    if (!activeFileId || !project?.access.canEdit) return false;
    if (!silent) setAutoSaveStatus("");
    await fetch(`/api/projects/${projectId}/files`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileId: activeFileId, content }),
    });
    setDirty(false);
    setFiles((prev) =>
      prev.map((f) => (f.id === activeFileId ? { ...f, content } : f))
    );
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
        setRightPanel("object");
        loadObjectDetail(selectedObjectId);
      }
    }
    if (silent) setAutoSaveStatus("Saved");
    return true;
  }

  async function compile(auto = false) {
    if (!project?.access.canEdit || compilingRef.current) return;
    if (dirty) await save(auto);
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
    if (data.pdfUrl) {
      setPdfUrl(data.pdfUrl + "?t=" + Date.now());
      setRightPanel("pdf");
    }
    setCompiling(false);
    compilingRef.current = false;
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
    if (!prefs.autoSave || !dirty || !project?.access.canEdit) return;
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
  }, [content, dirty, prefs.autoSave, prefs.autoCompile, project?.access.canEdit]);

  function selectObject(id: string) {
    setSelectedObjectId(id);
    setRightPanel("object");
    loadObjectDetail(id);
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
    if (preset === "writing") setRightPanel("object");
  }

  function updateLayout(patch: Partial<WorkspaceLayout>) {
    setLayout((prev) => ({ ...prev, ...patch, preset: prev.preset }));
  }

  function resizeSidebar(delta: number) {
    updateLayout({ sidebarWidth: clamp(layout.sidebarWidth + delta, 140, 400) });
  }

  const sidebarTotalWidth =
    !layout.showSidebar
      ? 0
      : sidebarTab === null
        ? ICON_RAIL_WIDTH
        : sidebarTab === "channels"
          ? ICON_RAIL_WIDTH + 520
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

  function resizeRightPanel(delta: number) {
    const center = centerRef.current;
    if (!center) return;
    const total = center.clientWidth;
    if (total <= 0) return;
    const rightPx = total * (layout.rightPanelPercent / 100);
    const nextRightPx = clamp(rightPx - delta, 220, total - 240);
    updateLayout({ rightPanelPercent: (nextRightPx / total) * 100 });
  }

  function resizeLog(delta: number) {
    updateLayout({ logHeight: clamp(layout.logHeight - delta, 72, 360) });
  }

  const activeObjects = objects.filter((o) => o.status !== "DEPRECATED");

  const projectTexBundle = useMemo(
    () =>
      files
        .filter((f) => f.path.endsWith(".tex") || f.path.endsWith(".bib"))
        .map((f) => (f.id === activeFileId && dirty ? content : f.content))
        .join("\n"),
    [files, activeFileId, content, dirty]
  );

  return (
    <div className="relative flex h-screen flex-col">
      {initialLoading && <LoadingOverlay message="Loading project..." />}
      <header className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-sm text-[var(--muted)] hover:text-[var(--accent)]">
            ← Projects
          </Link>
          <h1 className="text-sm font-semibold">{project?.name || "Loading..."}</h1>
          {activeObjectAtLine && (
            <button
              onClick={() => selectObject(activeObjectAtLine.id)}
              className="rounded bg-[var(--surface-hover)] px-2 py-0.5 text-xs text-[var(--accent)] hover:underline"
            >
              {activeObjectAtLine.type}
              {activeObjectAtLine.label && `: ${activeObjectAtLine.label}`}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {dirty && <span className="text-xs text-[var(--warning)]">Unsaved</span>}
          {autoSaveStatus && (
            <span className="text-xs text-[var(--success)]">{autoSaveStatus}</span>
          )}
          {project?.access.canEdit && (
            <>
              <label className="flex items-center gap-1 text-xs text-[var(--muted)]">
                <input
                  type="checkbox"
                  checked={prefs.autoSave}
                  onChange={(e) => updatePrefs({ autoSave: e.target.checked })}
                />
                Auto-save
              </label>
              <label className="flex items-center gap-1 text-xs text-[var(--muted)]" title="Uses draft profile, max once per minute">
                <input
                  type="checkbox"
                  checked={prefs.autoCompile}
                  onChange={(e) => updatePrefs({ autoCompile: e.target.checked })}
                  disabled={!prefs.autoSave}
                />
                Auto-compile
              </label>
              <select
                value={compiler}
                onChange={(e) => selectCompiler(e.target.value as CompileProfile)}
                title={compilerOptions.find((o) => o.id === compiler)?.description}
                className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs"
              >
                {compilerOptions.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
              <button
                onClick={() => save()}
                disabled={!dirty}
                className="rounded border border-[var(--border)] px-3 py-1 text-xs hover:bg-[var(--surface-hover)] disabled:opacity-40"
              >
                Save
              </button>
              <button
                onClick={() => compile()}
                disabled={compiling}
                className="rounded bg-[var(--accent)] px-3 py-1 text-xs font-medium text-[#0f1117] disabled:opacity-50"
              >
                {compiling ? "Compiling..." : "Compile"}
              </button>
            </>
          )}
          <div className="flex items-center gap-1 rounded border border-[var(--border)] p-0.5">
            {(Object.keys(LAYOUT_LABELS) as LayoutPreset[]).map((preset) => (
              <button
                key={preset}
                onClick={() => applyLayoutPreset(preset)}
                title={LAYOUT_LABELS[preset]}
                className={`rounded px-2 py-0.5 text-xs ${
                  layout.preset === preset
                    ? "bg-[var(--accent)] text-[#0f1117]"
                    : "text-[var(--muted)] hover:bg-[var(--surface-hover)]"
                }`}
              >
                {LAYOUT_LABELS[preset]}
              </button>
            ))}
          </div>
          <button
            onClick={() => updateLayout({ showSidebar: !layout.showSidebar })}
            className="rounded border border-[var(--border)] px-3 py-1 text-xs hover:bg-[var(--surface-hover)]"
            title="Toggle sidebar"
          >
            {layout.showSidebar ? "Hide sidebar" : "Show sidebar"}
          </button>
          <button
            onClick={() => {
              const next = !layout.showRightPanel;
              updateLayout({ showRightPanel: next });
              if (next && rightPanel === "object" && !selectedObjectId) setRightPanel("pdf");
            }}
            className="rounded border border-[var(--border)] px-3 py-1 text-xs hover:bg-[var(--surface-hover)]"
            title="Toggle right panel"
          >
            {layout.showRightPanel ? "Hide panel" : "Show panel"}
          </button>
          {layout.showRightPanel && (
            <button
              onClick={() => setRightPanel(rightPanel === "pdf" ? "object" : "pdf")}
              className="rounded border border-[var(--border)] px-3 py-1 text-xs hover:bg-[var(--surface-hover)]"
            >
              {rightPanel === "pdf" ? "Object" : "PDF"}
            </button>
          )}
          <button
            onClick={toggleAppTheme}
            className="rounded border border-[var(--border)] px-3 py-1 text-xs hover:bg-[var(--surface-hover)]"
            title="Toggle editor and UI theme"
          >
            {appTheme === "dark" ? "Light" : "Dark"}
          </button>
        </div>
      </header>

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
              />
            </div>
            {sidebarTab && sidebarTab !== "channels" && (
              <ResizeHandle direction="horizontal" onResize={resizeSidebar} />
            )}
          </>
        )}

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div ref={centerRef} className="flex min-h-0 flex-1 overflow-hidden">
            <div className="min-w-[200px] flex-1 overflow-hidden">
              <LatexEditor
                ref={editorRef}
                value={content}
                onChange={(v) => { setContent(v); setDirty(true); }}
                onCursorLine={setCurrentLine}
                readOnly={!project?.access.canEdit}
                appTheme={appTheme}
                projectTexBundle={projectTexBundle}
              />
            </div>
            {layout.showRightPanel && (
              <>
                <ResizeHandle direction="horizontal" onResize={resizeRightPanel} />
                <div
                  className="shrink-0 overflow-hidden border-l border-[var(--border)]"
                  style={{ width: `${layout.rightPanelPercent}%` }}
                >
                  {rightPanel === "pdf" ? (
                    <PdfViewer pdfUrl={pdfUrl} loading={compiling} />
                  ) : (
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
                    />
                  )}
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
                <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-1">
                  <span className="text-xs font-medium text-[var(--muted)]">Compiler log</span>
                  <button
                    onClick={() => setShowLogs(false)}
                    className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
                  >
                    Hide
                  </button>
                </div>
                <pre className="overflow-auto p-2 font-mono text-xs text-[var(--muted)]" style={{ height: layout.logHeight - 28 }}>
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
