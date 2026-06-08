"use client";



import Link from "next/link";

import { ChevronDown, ClipboardList, Moon, PanelLeft, PanelRight, StickyNote, Sun } from "lucide-react";

import { CompileProfile } from "@/lib/latex/compilers";

import { LayoutPreset, LAYOUT_LABELS } from "@/lib/workspace-layout";

import { AppTheme } from "@/lib/theme";

import { RightPanelMode } from "@/lib/discussion/types";

import { ManifoldLogo } from "@/components/ManifoldLogo";
import { Button } from "@/components/ui/Button";

import { Select } from "@/components/ui/Select";

import { StatusPill } from "@/components/ui/StatusPill";



type SaveStatus = "saved" | "saving" | "unsaved" | "idle";

type CompileStatus =

  | "idle"

  | "compiling"

  | "success"

  | "failed"

  | "stale";



type Props = {

  projectName: string;

  activeFileName: string | null;

  canEdit: boolean;

  saveStatus: SaveStatus;

  saveAgo?: string;

  compileStatus: CompileStatus;

  compileAgo?: string;

  compiler: CompileProfile;

  compilerOptions: Array<{ id: CompileProfile; label: string; description: string }>;

  onCompilerChange: (p: CompileProfile) => void;

  onSave: () => void;

  onCompile: () => void;

  layoutPreset: LayoutPreset;

  onLayoutPreset: (p: LayoutPreset) => void;

  showSidebar: boolean;

  onToggleSidebar: () => void;

  showRightPanel: boolean;

  onToggleRightPanel: () => void;

  rightPanelMode: RightPanelMode;

  onOpenPdf: () => void;

  onOpenNotes: () => void;

  onWarmNotes?: () => void;

  onOpenReview: () => void;

  reviewCount?: number;

  appTheme: AppTheme;

  onToggleTheme: () => void;

  autoSave: boolean;

  autoCompile: boolean;

  onAutoSaveChange: (v: boolean) => void;

  onAutoCompileChange: (v: boolean) => void;

  activeObjectLabel?: string | null;

  onActiveObjectClick?: () => void;

  presenceSlot?: React.ReactNode;

};



export function WorkspaceToolbar({

  projectName,

  activeFileName,

  canEdit,

  saveStatus,

  saveAgo,

  compileStatus,

  compileAgo,

  compiler,

  compilerOptions,

  onCompilerChange,

  onSave,

  onCompile,

  layoutPreset,

  onLayoutPreset,

  showSidebar,

  onToggleSidebar,

  showRightPanel,

  onToggleRightPanel,

  rightPanelMode,

  onOpenPdf,

  onOpenNotes,

  onWarmNotes,

  onOpenReview,

  reviewCount = 0,

  appTheme,

  onToggleTheme,

  autoSave,

  autoCompile,

  onAutoSaveChange,

  onAutoCompileChange,

  activeObjectLabel,

  onActiveObjectClick,

  presenceSlot,

}: Props) {

  const saveLabel =

    saveStatus === "unsaved"

      ? "Unsaved changes"

      : saveStatus === "saving"

        ? "Saving…"

        : saveAgo

          ? `Saved ${saveAgo}`

          : saveStatus === "saved"

            ? "Saved"

            : "";



  const compileLabel =

    compileStatus === "compiling"

      ? "Compiling…"

      : compileStatus === "failed"

        ? "Compile failed"

        : compileStatus === "stale"

          ? "PDF stale"

          : compileAgo

            ? `Compiled ${compileAgo}`

            : "";



  return (

    <header className="flex shrink-0 items-center justify-between gap-4 border-b border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-2">

      <div className="flex min-w-0 items-center gap-2 text-ui-sm">

        <Link

          href="/dashboard"

          className="flex shrink-0 items-center gap-1.5 font-medium text-[var(--muted)] transition-colors hover:text-[var(--accent)]"

        >

          <ManifoldLogo size={20} />

          Manifold

        </Link>

        <span className="text-[var(--border)]">/</span>

        <span className="truncate font-medium text-[var(--foreground)]">

          {projectName || "…"}

        </span>

        {activeFileName && (

          <>

            <span className="text-[var(--border)]">/</span>

            <span className="truncate font-mono text-ui-xs text-[var(--muted)]">

              {activeFileName}

            </span>

          </>

        )}

        {activeObjectLabel && onActiveObjectClick && (

          <button

            type="button"

            onClick={onActiveObjectClick}

            className="ml-1 hidden truncate rounded-[var(--radius-sm)] bg-[var(--accent)]/10 px-2 py-0.5 font-mono text-ui-xs text-[var(--accent)] hover:bg-[var(--accent)]/15 sm:inline"

          >

            {activeObjectLabel}

          </button>

        )}

      </div>



      <div className="flex shrink-0 items-center gap-2">

        {saveLabel && (

          <StatusPill

            tone={

              saveStatus === "unsaved"

                ? "warning"

                : saveStatus === "saving"

                  ? "accent"

                  : "muted"

            }

          >

            {saveLabel}

          </StatusPill>

        )}

        {compileLabel && (

          <StatusPill

            tone={

              compileStatus === "failed"

                ? "danger"

                : compileStatus === "stale"

                  ? "warning"

                  : compileStatus === "compiling"

                    ? "accent"

                    : "muted"

            }

          >

            {compileLabel}

          </StatusPill>

        )}



        <Button

          variant={rightPanelMode === "pdf" ? "secondary" : "ghost"}

          size="sm"

          onClick={onOpenPdf}

          title="PDF preview"

        >

          Preview

        </Button>

        <Button

          variant={rightPanelMode === "notes" ? "secondary" : "ghost"}

          size="sm"

          onClick={onOpenNotes}

          onMouseEnter={onWarmNotes}

          title="Project Notes"

        >

          <StickyNote className="mr-1 h-3.5 w-3.5" />

          Notes

        </Button>

        <Button

          variant={rightPanelMode === "review" ? "secondary" : "ghost"}

          size="sm"

          onClick={onOpenReview}

          title="Review inbox"

        >

          <ClipboardList className="mr-1 h-3.5 w-3.5" />

          Review

          {reviewCount > 0 && (

            <span className="ml-1 rounded-full bg-[var(--warning)] px-1.5 text-[10px] font-medium text-[var(--accent-foreground)]">

              {reviewCount > 9 ? "9+" : reviewCount}

            </span>

          )}

        </Button>



        {canEdit && (

          <>

            <Button variant="ghost" size="sm" onClick={onSave} disabled={saveStatus !== "unsaved"}>

              Save

            </Button>

            <div className="flex items-center gap-1">

              <Button

                variant="primary"

                size="sm"

                onClick={onCompile}

                disabled={compileStatus === "compiling"}

              >

                {compileStatus === "compiling" ? "Compiling…" : "Compile"}

              </Button>

              <Select

                value={compiler}

                onChange={(e) => onCompilerChange(e.target.value as CompileProfile)}

                title={compilerOptions.find((o) => o.id === compiler)?.description}

                className="w-auto py-1 pr-7"

                aria-label="Compiler profile"

              >

                {compilerOptions.map((o) => (

                  <option key={o.id} value={o.id}>

                    {o.label}

                  </option>

                ))}

              </Select>

            </div>

          </>

        )}



        <details className="relative group/menu">

          <summary className="flex cursor-pointer list-none items-center gap-1 rounded-[var(--radius-sm)] px-2 py-1 text-ui-xs text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] [&::-webkit-details-marker]:hidden">

            View

            <ChevronDown className="h-3 w-3" />

          </summary>

          <div className="absolute right-0 top-full z-50 mt-1 w-52 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] py-1 shadow-[var(--shadow-sm)]">

            <div className="border-b border-[var(--border-subtle)] px-3 py-2">

              <p className="text-ui-xs font-medium text-[var(--muted)]">Layout</p>

              <div className="mt-1.5 flex flex-wrap gap-1">

                {(Object.keys(LAYOUT_LABELS) as LayoutPreset[]).map((preset) => (

                  <button

                    key={preset}

                    type="button"

                    onClick={() => onLayoutPreset(preset)}

                    className={`rounded-[var(--radius-sm)] px-2 py-0.5 text-ui-xs ${

                      layoutPreset === preset

                        ? "bg-[var(--accent)]/12 text-[var(--accent)]"

                        : "text-[var(--muted)] hover:bg-[var(--surface-hover)]"

                    }`}

                  >

                    {LAYOUT_LABELS[preset]}

                  </button>

                ))}

              </div>

            </div>

            <button

              type="button"

              onClick={onToggleSidebar}

              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-ui-xs hover:bg-[var(--surface-hover)]"

            >

              <PanelLeft className="h-3.5 w-3.5" />

              {showSidebar ? "Hide sidebar" : "Show sidebar"}

            </button>

            <button

              type="button"

              onClick={onToggleRightPanel}

              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-ui-xs hover:bg-[var(--surface-hover)]"

            >

              <PanelRight className="h-3.5 w-3.5" />

              {showRightPanel ? "Hide right panel" : "Show right panel"}

            </button>

            {canEdit && (

              <div className="border-t border-[var(--border-subtle)] px-3 py-2">

                <label className="flex items-center gap-2 text-ui-xs text-[var(--muted)]">

                  <input

                    type="checkbox"

                    checked={autoSave}

                    onChange={(e) => onAutoSaveChange(e.target.checked)}

                  />

                  Auto-save

                </label>

                <label className="mt-1 flex items-center gap-2 text-ui-xs text-[var(--muted)]">

                  <input

                    type="checkbox"

                    checked={autoCompile}

                    onChange={(e) => onAutoCompileChange(e.target.checked)}

                    disabled={!autoSave}

                  />

                  Auto-compile

                </label>

              </div>

            )}

            <button

              type="button"

              onClick={onToggleTheme}

              className="flex w-full items-center gap-2 border-t border-[var(--border-subtle)] px-3 py-1.5 text-left text-ui-xs hover:bg-[var(--surface-hover)]"

            >

              {appTheme === "dark" ? (

                <Sun className="h-3.5 w-3.5" />

              ) : (

                <Moon className="h-3.5 w-3.5" />

              )}

              {appTheme === "dark" ? "Light mode" : "Dark mode"}

            </button>

          </div>

        </details>

        {presenceSlot && (
          <div className="ml-1 flex items-center border-l border-[var(--border-subtle)] pl-3">
            {presenceSlot}
          </div>
        )}

      </div>

    </header>

  );

}

