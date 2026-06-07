"use client";

import { useState } from "react";
import {
  BookOpen,
  Clock,
  FileText,
  GitBranch,
  Github,
  MessageSquare,
  Search,
  Shapes,
  Users,
} from "lucide-react";
import { DependencyGraph } from "../DependencyGraph";
import { ProjectTeamPanel } from "./ProjectTeamPanel";
import { GitPanel } from "./GitPanel";
import { ChannelPanel } from "./ChannelPanel";
import { ProjectSearch } from "./ProjectSearch";
import { CitationsPanel } from "./CitationsPanel";

export type SidebarTab =
  | "files"
  | "objects"
  | "citations"
  | "graph"
  | "history"
  | "team"
  | "git"
  | "channels"
  | "search"
  | null;

type MathObject = {
  id: string;
  type: string;
  label: string | null;
  title: string | null;
  startLine: number;
  endLine: number;
  status: string;
  proofLatex: string | null;
  assigneeId?: string | null;
  assignee?: { id: string; name: string | null; username: string } | null;
  citedIn?: Array<{ citeKey: string; citation: { key: string } }>;
  thread?: { comments: Array<{ id: string; resolved: boolean }> };
};

type Citation = {
  id?: string;
  key: string;
  title: string | null;
  authors: string | null;
  doi?: string | null;
  rawBibtex?: string;
};

type Member = { id: string; name: string | null; username: string };

type Props = {
  tab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  projectId: string;
  isOwner: boolean;
  canEdit: boolean;
  files: Array<{ id: string; name: string; path: string; isMain: boolean }>;
  activeFileId: string | null;
  onFileSelect: (id: string) => void;
  onAddFile: (name: string) => Promise<void>;
  objects: MathObject[];
  members: Member[];
  selectedObjectId: string | null;
  onObjectSelect: (id: string) => void;
  onMentionClick: (label: string) => void;
  onSearchSelectFile: (fileId: string, line?: number) => void;
  onSearchSelectCitation: () => void;
  currentLine: number;
  citations: Citation[];
  citationAnalysis: { used: string[]; unused: string[]; missing: string[] };
  onCitationsRefresh: () => Promise<void>;
  onGitSync: () => void;
  dependencies: Array<{
    fromId: string;
    toId: string;
    refLabel: string;
    from: { id: string; label: string | null; type: string; title: string | null };
    to: { id: string; label: string | null; type: string; title: string | null };
  }>;
  snapshots: Array<{ id: string; reason: string; createdAt: string; user?: { username: string } }>;
  objectFilter: string;
  assigneeFilter: string;
  onObjectFilterChange: (f: string) => void;
  onAssigneeFilterChange: (f: string) => void;
  panelWidth?: number;
};

const RAIL_ITEMS: Array<{
  id: SidebarTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: "files", label: "File tree", icon: FileText },
  { id: "objects", label: "Objects", icon: Shapes },
  { id: "citations", label: "Citations", icon: BookOpen },
  { id: "graph", label: "Dependency graph", icon: GitBranch },
  { id: "channels", label: "Channels", icon: MessageSquare },
  { id: "search", label: "Search", icon: Search },
  { id: "team", label: "Team", icon: Users },
  { id: "git", label: "Git", icon: Github },
  { id: "history", label: "History", icon: Clock },
];

const TYPE_COLORS: Record<string, string> = {
  THEOREM: "text-blue-400",
  LEMMA: "text-purple-400",
  DEFINITION: "text-green-400",
  COROLLARY: "text-yellow-400",
  CONJECTURE: "text-red-400",
  REMARK: "text-gray-400",
};

function RailButton({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`group relative flex h-10 w-10 items-center justify-center rounded-md transition-colors ${
        active
          ? "bg-[var(--accent)]/20 text-[var(--accent)]"
          : "text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
      }`}
    >
      <Icon className="h-4 w-4" />
      <span className="pointer-events-none absolute left-full z-50 ml-2 hidden whitespace-nowrap rounded bg-[var(--surface)] px-2 py-1 text-xs shadow-md group-hover:block">
        {label}
      </span>
    </button>
  );
}

export function Sidebar({
  tab,
  onTabChange,
  projectId,
  isOwner,
  canEdit,
  files,
  activeFileId,
  onFileSelect,
  onAddFile,
  objects,
  members,
  selectedObjectId,
  onObjectSelect,
  onMentionClick,
  onSearchSelectFile,
  onSearchSelectCitation,
  currentLine,
  citations,
  citationAnalysis,
  onCitationsRefresh,
  onGitSync,
  dependencies,
  snapshots,
  objectFilter,
  assigneeFilter,
  onObjectFilterChange,
  onAssigneeFilterChange,
  panelWidth = 200,
}: Props) {
  const [newFileName, setNewFileName] = useState("");
  const [addingFile, setAddingFile] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const archivedObjects = objects.filter((o) => o.status === "DEPRECATED");
  const activeObjects = objects.filter((o) => o.status !== "DEPRECATED");

  const filteredObjects = objects.filter((o) => {
    if (o.status === "DEPRECATED") return false;
    if (assigneeFilter && o.assigneeId !== assigneeFilter) return false;
    if (objectFilter === "unresolved") {
      return o.thread?.comments.some((c) => !c.resolved);
    }
    if (objectFilter === "no-label") return !o.label;
    if (objectFilter === "has-proof") return !!o.proofLatex;
    if (objectFilter === "cite-issues") {
      return o.citedIn?.some((c) => citationAnalysis.missing.includes(c.citeKey));
    }
    if (objectFilter !== "all") return o.type === objectFilter;
    return true;
  });

  const graphNodes = [
    ...new Map(
      dependencies.flatMap((d) => [
        [d.from.id, d.from],
        [d.to.id, d.to],
      ])
    ).values(),
  ];

  function toggleTab(id: SidebarTab) {
    onTabChange(tab === id ? null : id);
  }

  async function handleAddFile() {
    if (!newFileName.trim()) return;
    setAddingFile(true);
    await onAddFile(newFileName.trim());
    setNewFileName("");
    setAddingFile(false);
  }

  const panelWide = tab === "channels" || tab === "citations";

  return (
    <div className="flex h-full">
      <nav className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-[var(--border)] bg-[var(--background)] py-2">
        {RAIL_ITEMS.map((item) => (
          <RailButton
            key={item.id}
            label={item.label}
            icon={item.icon}
            active={tab === item.id}
            onClick={() => toggleTab(item.id)}
          />
        ))}
      </nav>

      {tab && (
        <div
          className="flex min-w-0 flex-col overflow-hidden border-r border-[var(--border)] bg-[var(--surface)]"
          style={{ width: panelWide ? (tab === "citations" ? 300 : 520) : panelWidth }}
        >
          <div className="flex-1 overflow-y-auto">
            {tab === "files" && (
              <div className="p-2">
                <p className="mb-2 px-1 text-xs font-semibold text-[var(--muted)]">File tree</p>
                {files.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => onFileSelect(f.id)}
                    className={`block w-full rounded px-2 py-1.5 text-left text-sm ${
                      activeFileId === f.id
                        ? "bg-[var(--surface-hover)] text-[var(--accent)]"
                        : "hover:bg-[var(--surface-hover)]"
                    }`}
                  >
                    {f.name}
                    {f.isMain && <span className="ml-1 text-xs text-[var(--muted)]">main</span>}
                  </button>
                ))}
                {canEdit && (
                  <div className="mt-3 border-t border-[var(--border)] pt-2">
                    <input
                      value={newFileName}
                      onChange={(e) => setNewFileName(e.target.value)}
                      placeholder="e.g. chapter2.tex"
                      className="mb-1 w-full rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs"
                    />
                    <button
                      onClick={handleAddFile}
                      disabled={addingFile}
                      className="w-full rounded border border-[var(--border)] py-1 text-xs hover:bg-[var(--surface-hover)] disabled:opacity-50"
                    >
                      {addingFile ? "Adding..." : "+ Add file"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {tab === "objects" && (
              <div>
                <div className="space-y-2 border-b border-[var(--border)] p-2">
                  <select
                    value={objectFilter}
                    onChange={(e) => onObjectFilterChange(e.target.value)}
                    className="w-full rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs"
                  >
                    <option value="all">All objects</option>
                    <option value="THEOREM">Theorems</option>
                    <option value="LEMMA">Lemmas</option>
                    <option value="DEFINITION">Definitions</option>
                    <option value="COROLLARY">Corollaries</option>
                    <option value="CONJECTURE">Conjectures</option>
                    <option value="unresolved">Unresolved comments</option>
                    <option value="no-label">Missing label</option>
                    <option value="has-proof">Has proof</option>
                    <option value="cite-issues">Citation issues</option>
                  </select>
                  <select
                    value={assigneeFilter}
                    onChange={(e) => onAssigneeFilterChange(e.target.value)}
                    className="w-full rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs"
                  >
                    <option value="">All assignees</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name || m.username}
                      </option>
                    ))}
                  </select>
                </div>
                {filteredObjects.map((o) => {
                  const isCurrent = currentLine >= o.startLine && currentLine <= o.endLine;
                  const hasUnresolved = o.thread?.comments.some((c) => !c.resolved);
                  return (
                    <button
                      key={o.id}
                      onClick={() => onObjectSelect(o.id)}
                      className={`block w-full border-b border-[var(--border)] px-3 py-2 text-left hover:bg-[var(--surface-hover)] ${
                        selectedObjectId === o.id ? "bg-[var(--surface-hover)]" : ""
                      } ${isCurrent ? "border-l-2 border-l-[var(--accent)]" : ""}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium ${TYPE_COLORS[o.type] || ""}`}>
                          {o.type}
                        </span>
                        {hasUnresolved && (
                          <span className="h-1.5 w-1.5 rounded-full bg-[var(--warning)]" />
                        )}
                      </div>
                      <div className="text-xs text-[var(--muted)]">
                        {o.label || `L${o.startLine}`}
                        {o.title && ` — ${o.title}`}
                        {o.assignee && ` · ${o.assignee.name || o.assignee.username}`}
                      </div>
                    </button>
                  );
                })}
                {archivedObjects.length > 0 && (
                  <div className="border-t border-[var(--border)]">
                    <button
                      onClick={() => setShowArchived(!showArchived)}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium text-[var(--muted)] hover:bg-[var(--surface-hover)]"
                    >
                      <span>Archived ({archivedObjects.length})</span>
                      <span>{showArchived ? "▾" : "▸"}</span>
                    </button>
                    {showArchived &&
                      archivedObjects.map((o) => (
                        <button
                          key={o.id}
                          onClick={() => onObjectSelect(o.id)}
                          className={`block w-full border-b border-[var(--border)] px-3 py-2 text-left opacity-70 hover:bg-[var(--surface-hover)] ${
                            selectedObjectId === o.id ? "bg-[var(--surface-hover)]" : ""
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-[var(--warning)]">archived</span>
                            <span className={`text-xs font-medium ${TYPE_COLORS[o.type] || ""}`}>
                              {o.type}
                            </span>
                          </div>
                          <div className="text-xs text-[var(--muted)]">
                            {o.label || `L${o.startLine}`}
                            {o.title && ` — ${o.title}`}
                          </div>
                        </button>
                      ))}
                  </div>
                )}
              </div>
            )}

            {tab === "citations" && (
              <CitationsPanel
                projectId={projectId}
                canEdit={canEdit}
                citations={citations}
                analysis={citationAnalysis}
                onRefresh={onCitationsRefresh}
              />
            )}

            {tab === "graph" && (
              <DependencyGraph
                nodes={graphNodes}
                edges={dependencies}
                onSelectNode={onObjectSelect}
                selectedId={selectedObjectId}
              />
            )}

            {tab === "channels" && (
              <ChannelPanel
                projectId={projectId}
                canEdit={canEdit}
                isOwner={isOwner}
                objectRefs={activeObjects.map((o) => ({
                  label: o.label,
                  id: o.id,
                  type: o.type,
                  title: o.title,
                }))}
                onMentionClick={onMentionClick}
              />
            )}

            {tab === "search" && (
              <ProjectSearch
                projectId={projectId}
                onSelectFile={onSearchSelectFile}
                onSelectObject={onObjectSelect}
                onSelectCitation={onSearchSelectCitation}
              />
            )}

            {tab === "team" && (
              <ProjectTeamPanel projectId={projectId} isOwner={isOwner} />
            )}

            {tab === "git" && (
              <GitPanel
                projectId={projectId}
                isOwner={isOwner}
                canEdit={canEdit}
                onSyncComplete={onGitSync}
              />
            )}

            {tab === "history" && (
              <div className="p-2">
                {snapshots.map((s) => (
                  <div key={s.id} className="mb-2 rounded border border-[var(--border)] p-2 text-xs">
                    <span className="font-medium">
                      {s.reason.startsWith("compile:")
                        ? `compile (${s.reason.slice(8)})`
                        : s.reason}
                    </span>
                    <span className="ml-2 text-[var(--muted)]">
                      {new Date(s.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
