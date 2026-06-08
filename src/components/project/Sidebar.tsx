"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
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

const CitationsPanel = dynamic(
  () => import("./CitationsPanel").then((m) => ({ default: m.CitationsPanel })),
  { loading: () => <PanelLoading label="References" /> }
);
const DependencyGraph = dynamic(
  () => import("../DependencyGraph").then((m) => ({ default: m.DependencyGraph })),
  { loading: () => <PanelLoading label="Dependency graph" /> }
);
const ProjectSearch = dynamic(
  () => import("./ProjectSearch").then((m) => ({ default: m.ProjectSearch })),
  { loading: () => <PanelLoading label="Search" /> }
);
const ProjectTeamPanel = dynamic(
  () => import("./ProjectTeamPanel").then((m) => ({ default: m.ProjectTeamPanel })),
  { loading: () => <PanelLoading label="Collaborators" /> }
);
const GitPanel = dynamic(
  () => import("./GitPanel").then((m) => ({ default: m.GitPanel })),
  { loading: () => <PanelLoading label="Git" /> }
);
import { IconButton } from "@/components/ui/IconButton";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { ObjectListItem } from "@/components/ui/ObjectListItem";
import { EmptyState } from "@/components/ui/EmptyState";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
export type SidebarTab =
  | "files"
  | "objects"
  | "citations"
  | "graph"
  | "history"
  | "team"
  | "git"
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
  thread?: { comments: Array<{ id: string; resolved: boolean }> } | null;
  depsFrom?: Array<{ to: { label: string | null; type: string } }>;
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
  onOpenReview?: () => void;
  reviewCount?: number;
  onObjectDiscussion?: (id: string) => void;
};

const RAIL_ITEMS: Array<{
  id: SidebarTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeKey?: "objects" | "citations";
}> = [
  { id: "files", label: "Files", icon: FileText },
  { id: "objects", label: "Outline", icon: Shapes, badgeKey: "objects" },
  { id: "citations", label: "References", icon: BookOpen, badgeKey: "citations" },
  { id: "graph", label: "Dependencies", icon: GitBranch },
  { id: "search", label: "Search", icon: Search },
  { id: "team", label: "Collaborators", icon: Users },
  { id: "git", label: "Git", icon: Github },
  { id: "history", label: "History", icon: Clock },
];

function PanelLoading({ label }: { label: string }) {
  return (
    <p className="px-3 py-8 text-center text-ui-xs text-[var(--muted)]">
      Loading {label.toLowerCase()}…
    </p>
  );
}

const TAB_TITLES: Record<Exclude<SidebarTab, null>, string> = {
  files: "Files",
  objects: "Manuscript outline",
  citations: "References",
  graph: "Dependency graph",
  search: "Search",
  team: "Collaborators",
  git: "Git",
  history: "History",
};

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
  onOpenReview,
  reviewCount = 0,
  onObjectDiscussion,
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

  const badges = useMemo(() => {
    const unresolved = activeObjects.filter((o) =>
      o.thread?.comments.some((c) => !c.resolved)
    ).length;
    return {
      objects: unresolved,
      citations: citationAnalysis.missing.length,
    };
  }, [activeObjects, citationAnalysis.missing.length]);

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

  const panelWide = tab === "citations";

  return (
    <div className="flex h-full">
      <nav
        className="flex h-full w-11 shrink-0 flex-col items-center gap-0.5 border-r border-[var(--border-subtle)] bg-[var(--background)] py-2"
        aria-label="Workspace navigation"
      >
        {RAIL_ITEMS.map((item) => (
          <IconButton
            key={item.id}
            label={item.label}
            active={tab === item.id}
            badge={item.badgeKey ? badges[item.badgeKey] : undefined}
            onClick={() => toggleTab(item.id)}
          >
            <item.icon className="h-[18px] w-[18px] stroke-[1.5]" />
          </IconButton>
        ))}
        <div className="mt-auto pt-2">
          {onOpenReview && (
            <IconButton
              label="Review"
              badge={reviewCount > 0 ? reviewCount : undefined}
              onClick={onOpenReview}
            >
              <MessageSquare className="h-[18px] w-[18px] stroke-[1.5]" />
            </IconButton>
          )}
        </div>
      </nav>

      {tab && (
        <div
          className="flex min-w-0 flex-col overflow-hidden border-r border-[var(--border-subtle)] bg-[var(--surface)]"
          style={{ width: panelWide ? (tab === "citations" ? 300 : 480) : panelWidth }}
        >
          {tab !== "citations" && (
            <PanelHeader
              title={TAB_TITLES[tab]}
              subtitle={
                tab === "objects"
                  ? `${activeObjects.length} object${activeObjects.length !== 1 ? "s" : ""}`
                  : undefined
              }
            />
          )}

          <div className="flex-1 overflow-y-auto">
            {tab === "files" && (
              <div className="py-1">
                {files.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => onFileSelect(f.id)}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-ui-sm transition-colors hover:bg-[var(--surface-hover)] ${
                      activeFileId === f.id
                        ? "bg-[var(--surface-hover)] text-[var(--accent)]"
                        : "text-[var(--foreground)]"
                    }`}
                  >
                    <FileText className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]" />
                    <span className="truncate font-mono text-ui-xs">{f.name}</span>
                    {f.isMain && (
                      <span className="ml-auto shrink-0 text-ui-xs text-[var(--muted)]">main</span>
                    )}
                  </button>
                ))}
                {files.length === 0 && (
                  <EmptyState
                    title="No files yet"
                    description="Project files will appear here."
                  />
                )}
                {canEdit && (
                  <div className="mt-2 border-t border-[var(--border-subtle)] px-3 py-3">
                    <Input
                      value={newFileName}
                      onChange={(e) => setNewFileName(e.target.value)}
                      placeholder="chapter2.tex"
                      className="mb-2 text-ui-xs"
                      onKeyDown={(e) => e.key === "Enter" && handleAddFile()}
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleAddFile}
                      disabled={addingFile}
                      className="w-full"
                    >
                      {addingFile ? "Adding…" : "Add file"}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {tab === "objects" && (
              <div>
                <div className="space-y-2 border-b border-[var(--border-subtle)] px-3 py-2">
                  <Select
                    value={objectFilter}
                    onChange={(e) => onObjectFilterChange(e.target.value)}
                    aria-label="Filter objects"
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
                  </Select>
                  <Select
                    value={assigneeFilter}
                    onChange={(e) => onAssigneeFilterChange(e.target.value)}
                    aria-label="Filter by assignee"
                  >
                    <option value="">All assignees</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name || m.username}
                      </option>
                    ))}
                  </Select>
                </div>

                {filteredObjects.length === 0 ? (
                  <EmptyState
                    title="No theorem objects yet"
                    description="Theorem environments in your LaTeX source will appear here as a structured outline."
                    hint={
                      <>
                        {"\\begin{theorem}\\label{thm:main}"}
                        <br />
                        Main Result
                        <br />
                        {"\\end{theorem}"}
                      </>
                    }
                  />
                ) : (
                  filteredObjects.map((o) => {
                    const unresolved =
                      o.thread?.comments.filter((c) => !c.resolved).length ?? 0;
                    const totalComments = o.thread?.comments.length ?? 0;
                    const depHint = o.depsFrom?.[0]?.to.label
                      ? `Uses ${o.depsFrom[0].to.label}`
                      : null;
                    return (
                      <ObjectListItem
                        key={o.id}
                        type={o.type}
                        label={o.label}
                        title={o.title}
                        status={o.status}
                        startLine={o.startLine}
                        selected={selectedObjectId === o.id}
                        atCursor={
                          currentLine >= o.startLine && currentLine <= o.endLine
                        }
                        unresolvedCount={unresolved}
                        totalCommentCount={totalComments}
                        hasCiteIssue={o.citedIn?.some((c) =>
                          citationAnalysis.missing.includes(c.citeKey)
                        )}
                        missingLabel={!o.label}
                        dependencyHint={depHint}
                        proofComplete={!!o.proofLatex}
                        onClick={() => onObjectSelect(o.id)}
                        onDiscussionClick={
                          onObjectDiscussion
                            ? () => onObjectDiscussion(o.id)
                            : undefined
                        }
                      />
                    );
                  })
                )}

                {archivedObjects.length > 0 && (
                  <div className="border-t border-[var(--border-subtle)]">
                    <button
                      type="button"
                      onClick={() => setShowArchived(!showArchived)}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-ui-xs font-medium text-[var(--muted)] hover:bg-[var(--surface-hover)]"
                    >
                      <span>Archived ({archivedObjects.length})</span>
                      <span>{showArchived ? "▾" : "▸"}</span>
                    </button>
                    {showArchived &&
                      archivedObjects.map((o) => (
                        <ObjectListItem
                          key={o.id}
                          type={o.type}
                          label={o.label}
                          title={o.title}
                          status="DEPRECATED"
                          startLine={o.startLine}
                          selected={selectedObjectId === o.id}
                          onClick={() => onObjectSelect(o.id)}
                        />
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
              dependencies.length === 0 ? (
                <EmptyState
                  title="No dependency graph yet"
                  description="References between labeled theorem objects will appear here."
                />
              ) : (
                <DependencyGraph
                  nodes={graphNodes}
                  edges={dependencies}
                  onSelectNode={onObjectSelect}
                  selectedId={selectedObjectId}
                />
              )
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
              <div className="py-1">
                {snapshots.length === 0 ? (
                  <EmptyState
                    title="No history yet"
                    description="Snapshots are created when you compile or make significant changes."
                  />
                ) : (
                  snapshots.map((s) => (
                    <div
                      key={s.id}
                      className="border-b border-[var(--border-subtle)] px-3 py-2.5 text-ui-xs"
                    >
                      <span className="font-medium text-[var(--foreground)]">
                        {s.reason.startsWith("compile:")
                          ? `Compile (${s.reason.slice(8)})`
                          : s.reason}
                      </span>
                      <p className="mt-0.5 text-[var(--muted)]">
                        {new Date(s.createdAt).toLocaleString()}
                        {s.user && ` · ${s.user.username}`}
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
