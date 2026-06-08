"use client";

import { useState } from "react";
import { CitationListItem } from "@/components/ui/CitationListItem";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { StatusPill } from "@/components/ui/StatusPill";
import { SectionHeader } from "@/components/ui/SectionHeader";

type Citation = {
  key: string;
  title: string | null;
  authors: string | null;
  year?: string | null;
  doi?: string | null;
  rawBibtex?: string;
};

type Analysis = {
  used: string[];
  unused: string[];
  missing: string[];
};

type LookupSource = "doi" | "arxiv" | "isbn" | "pmid" | "url" | "bibtex";

type Preview = {
  suggestedKey: string;
  title: string;
  authors: string;
  year: string;
  bibtex: string;
  source: string;
};

type Props = {
  projectId: string;
  canEdit: boolean;
  citations: Citation[];
  analysis: Analysis;
  onRefresh: () => Promise<void>;
};

const SOURCES: Array<{ id: LookupSource; label: string; placeholder: string }> = [
  { id: "doi", label: "DOI", placeholder: "10.1000/xyz or doi.org/…" },
  { id: "arxiv", label: "arXiv", placeholder: "2301.12345" },
  { id: "isbn", label: "ISBN", placeholder: "978-0-123456-78-9" },
  { id: "pmid", label: "PubMed", placeholder: "12345678" },
  { id: "url", label: "URL", placeholder: "DOI or arXiv URL" },
  { id: "bibtex", label: "BibTeX", placeholder: "@article{key, …}" },
];

export function CitationsPanel({
  projectId,
  canEdit,
  citations,
  analysis,
  onRefresh,
}: Props) {
  const [source, setSource] = useState<LookupSource>("doi");
  const [input, setInput] = useState("");
  const [customKey, setCustomKey] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [syncScope, setSyncScope] = useState<"used" | "all">("used");
  const [showImport, setShowImport] = useState(false);

  async function lookup(save: boolean) {
    if (!input.trim()) return;
    setLoading(true);
    setStatus("");
    setPreview(null);
    try {
      const isBulk = source === "bibtex" && input.includes("@") && input.split("@").length > 2;
      const res = await fetch(`/api/projects/${projectId}/citations/lookup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source,
          value: input,
          key: customKey.trim() || undefined,
          save,
          bulk: isBulk && save,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lookup failed");

      if (data.results) {
        setStatus(`Added ${data.saved?.length || 0} citations`);
        setInput("");
        setCustomKey("");
        await onRefresh();
      } else {
        if (save) {
          setStatus(`Added "${data.citation?.key || data.suggestedKey}"`);
          setInput("");
          setCustomKey("");
          setPreview(null);
          setShowImport(false);
          await onRefresh();
        } else {
          setPreview(data);
          setCustomKey(data.suggestedKey);
        }
      }
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed");
    }
    setLoading(false);
  }

  async function syncBibliography() {
    setLoading(true);
    setStatus("");
    try {
      const res = await fetch(`/api/projects/${projectId}/citations/sync-bibliography`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: syncScope }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");
      setStatus(data.message);
      if (data.stillMissing?.length) {
        setStatus(`${data.message}. Still missing: ${data.stillMissing.join(", ")}`);
      }
      await onRefresh();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Sync failed");
    }
    setLoading(false);
  }

  function copyCite(key: string) {
    navigator.clipboard.writeText(`\\cite{${key}}`);
    setStatus(`Copied \\cite{${key}}`);
  }

  function citationStatus(key: string): "used" | "unused" | "missing" {
    if (analysis.missing.includes(key)) return "missing";
    if (analysis.used.includes(key)) return "used";
    return "unused";
  }

  return (
    <div className="flex h-full flex-col">
      <PanelHeader
        title="References"
        subtitle={`${citations.length} in library`}
        actions={
          canEdit ? (
            <Button variant="ghost" size="sm" onClick={() => setShowImport(!showImport)}>
              {showImport ? "Close" : "Import"}
            </Button>
          ) : undefined
        }
      />

      <div className="border-b border-[var(--border-subtle)] px-3 py-2">
        <div className="flex flex-wrap gap-2">
          <StatusPill tone="success">{analysis.used.length} used</StatusPill>
          <StatusPill tone="warning">{analysis.unused.length} unused</StatusPill>
          {analysis.missing.length > 0 && (
            <StatusPill tone="danger">{analysis.missing.length} missing</StatusPill>
          )}
        </div>

        {canEdit && (
          <div className="mt-2 space-y-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={syncBibliography}
              disabled={loading}
              className="w-full"
            >
              {loading ? "Syncing…" : "Sync to bibliography"}
            </Button>
            <div className="flex gap-3 text-ui-xs text-[var(--muted)]">
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  checked={syncScope === "used"}
                  onChange={() => setSyncScope("used")}
                />
                Cited only
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  checked={syncScope === "all"}
                  onChange={() => setSyncScope("all")}
                />
                Full library
              </label>
            </div>
          </div>
        )}
      </div>

      {analysis.missing.length > 0 && (
        <div className="border-b border-[var(--danger)]/20 bg-[var(--danger)]/5 px-3 py-2">
          <p className="text-ui-xs font-medium text-[var(--danger)]">
            Cited in source but not in library
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            {analysis.missing.map((k) => (
              <code key={k} className="font-mono text-ui-xs text-[var(--foreground)]">
                {k}
              </code>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {citations.length === 0 ? (
          <EmptyState
            title="No citations imported"
            description="Build your reference library by importing from DOI, arXiv, ISBN, URL, or BibTeX."
            hint={
              <>
                Paste a DOI: <span className="text-[var(--foreground)]">10.1000/xyz</span>
                <br />
                or arXiv: <span className="text-[var(--foreground)]">2301.12345</span>
              </>
            }
          />
        ) : (
          citations.map((c) => (
            <CitationListItem
              key={c.key}
              citeKey={c.key}
              title={c.title}
              authors={c.authors}
              year={c.year}
              status={citationStatus(c.key)}
              onCopy={() => copyCite(c.key)}
            />
          ))
        )}
      </div>

      {canEdit && showImport && (
        <div className="shrink-0 border-t border-[var(--border-subtle)] bg-[var(--surface-raised)] p-3">
          <SectionHeader className="mb-2">Import citation</SectionHeader>
          <div className="mb-2 flex flex-wrap gap-1">
            {SOURCES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setSource(s.id);
                  setPreview(null);
                  setStatus("");
                }}
                className={`rounded-[var(--radius-sm)] px-2 py-0.5 text-ui-xs transition-colors ${
                  source === s.id
                    ? "bg-[var(--accent)]/12 text-[var(--accent)]"
                    : "text-[var(--muted)] hover:bg-[var(--surface-hover)]"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {source === "bibtex" ? (
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="@article{key, title=…, author=…, year=…}"
              rows={4}
              className="mb-2 font-mono text-ui-xs"
            />
          ) : (
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={SOURCES.find((s) => s.id === source)?.placeholder}
              className="mb-2 text-ui-xs"
              onKeyDown={(e) => e.key === "Enter" && lookup(false)}
            />
          )}

          {preview && (
            <div className="mb-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--background)] p-2">
              <p className="text-ui-xs font-medium">{preview.title}</p>
              <p className="text-ui-xs text-[var(--muted)]">
                {preview.authors} ({preview.year})
              </p>
            </div>
          )}

          <Input
            value={customKey}
            onChange={(e) => setCustomKey(e.target.value)}
            placeholder="Citation key (optional)"
            className="mb-2 text-ui-xs"
          />

          <div className="flex gap-2">
            {source !== "bibtex" || !input.includes("@") || input.split("@").length <= 2 ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => lookup(false)}
                disabled={loading || !input.trim()}
                className="flex-1"
              >
                Preview
              </Button>
            ) : null}
            <Button
              variant="primary"
              size="sm"
              onClick={() => lookup(true)}
              disabled={loading || !input.trim()}
              className="flex-1"
            >
              {loading ? "…" : preview ? "Add" : "Import"}
            </Button>
          </div>

          {status && (
            <p
              className={`mt-2 text-ui-xs ${
                status.includes("fail") || status.includes("Invalid")
                  ? "text-[var(--danger)]"
                  : "text-[var(--muted)]"
              }`}
            >
              {status}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
