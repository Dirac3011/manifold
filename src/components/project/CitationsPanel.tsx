"use client";

import { useState } from "react";

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
  { id: "doi", label: "DOI", placeholder: "10.1000/xyz or doi.org/..." },
  { id: "arxiv", label: "arXiv", placeholder: "2301.12345 or arxiv.org/abs/..." },
  { id: "isbn", label: "ISBN", placeholder: "978-0-123456-78-9" },
  { id: "pmid", label: "PubMed", placeholder: "12345678" },
  { id: "url", label: "URL", placeholder: "DOI or arXiv URL" },
  { id: "bibtex", label: "BibTeX", placeholder: "@article{key, ...}" },
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
          setStatus(`Added citation "${data.citation?.key || data.suggestedKey}"`);
          setInput("");
          setCustomKey("");
          setPreview(null);
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

  const statusColor = {
    used: "border-[var(--border)]",
    unused: "border-[var(--warning)]/50",
    missing: "border-[var(--danger)]",
  };

  const statusBadge = {
    used: "text-[var(--success)]",
    unused: "text-[var(--warning)]",
    missing: "text-[var(--danger)]",
  };

  return (
    <div className="flex h-full flex-col text-sm">
      <div className="border-b border-[var(--border)] p-3">
        <div className="mb-2 flex flex-wrap gap-2 text-xs">
          <span className="rounded bg-[var(--surface-hover)] px-2 py-0.5">
            {analysis.used.length} used
          </span>
          <span className="rounded bg-[var(--surface-hover)] px-2 py-0.5 text-[var(--warning)]">
            {analysis.unused.length} unused
          </span>
          {analysis.missing.length > 0 && (
            <span className="rounded bg-[var(--danger)]/10 px-2 py-0.5 text-[var(--danger)]">
              {analysis.missing.length} missing
            </span>
          )}
        </div>

        {canEdit && (
          <div className="space-y-2">
            <button
              onClick={syncBibliography}
              disabled={loading}
              className="w-full rounded bg-[var(--accent)] py-1.5 text-xs font-medium text-[#0f1117] disabled:opacity-50"
            >
              {loading ? "Working..." : "Sync to bibliography"}
            </button>
            <div className="flex gap-2 text-xs">
              <label className="flex items-center gap-1 text-[var(--muted)]">
                <input
                  type="radio"
                  checked={syncScope === "used"}
                  onChange={() => setSyncScope("used")}
                />
                Cited only
              </label>
              <label className="flex items-center gap-1 text-[var(--muted)]">
                <input
                  type="radio"
                  checked={syncScope === "all"}
                  onChange={() => setSyncScope("all")}
                />
                All library
              </label>
            </div>
            <p className="text-xs text-[var(--muted)]">
              Adds missing entries to <code>references.bib</code> or inline{" "}
              <code>\bibitem</code>, matching your existing format.
            </p>
          </div>
        )}
      </div>

      {analysis.missing.length > 0 && (
        <div className="border-b border-[var(--danger)]/30 bg-[var(--danger)]/5 p-2">
          <p className="mb-1 text-xs font-medium text-[var(--danger)]">
            Cited in LaTeX but not in library
          </p>
          <div className="flex flex-wrap gap-1">
            {analysis.missing.map((k) => (
              <code key={k} className="rounded bg-[var(--surface)] px-1.5 py-0.5 text-xs">
                {k}
              </code>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-2">
        {citations.length === 0 ? (
          <p className="py-4 text-center text-xs text-[var(--muted)]">
            No citations yet. Import one below.
          </p>
        ) : (
          citations.map((c) => {
            const st = citationStatus(c.key);
            return (
              <div
                key={c.key}
                className={`mb-2 rounded border p-2 ${statusColor[st]}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <code className="text-xs text-[var(--accent)]">{c.key}</code>
                      <span className={`text-xs ${statusBadge[st]}`}>{st}</span>
                    </div>
                    {c.title && <p className="mt-0.5 text-xs">{c.title}</p>}
                    {c.authors && (
                      <p className="text-xs text-[var(--muted)]">{c.authors}</p>
                    )}
                    {c.year && (
                      <p className="text-xs text-[var(--muted)]">{c.year}</p>
                    )}
                  </div>
                  <button
                    onClick={() => copyCite(c.key)}
                    className="shrink-0 text-xs text-[var(--accent)] hover:underline"
                    title="Copy \\cite{key}"
                  >
                    cite
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {canEdit && (
        <div className="border-t border-[var(--border)] p-3">
          <p className="mb-2 text-xs font-semibold text-[var(--muted)]">Import citation</p>
          <div className="mb-2 flex flex-wrap gap-1">
            {SOURCES.map((s) => (
              <button
                key={s.id}
                onClick={() => { setSource(s.id); setPreview(null); setStatus(""); }}
                className={`rounded px-2 py-0.5 text-xs ${
                  source === s.id
                    ? "bg-[var(--accent)] text-[#0f1117]"
                    : "bg-[var(--surface-hover)] text-[var(--muted)]"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {source === "bibtex" ? (
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="@article{key, title=..., author=..., year=...}"
              rows={5}
              className="mb-2 w-full resize-none rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 font-mono text-xs"
            />
          ) : (
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={SOURCES.find((s) => s.id === source)?.placeholder}
              className="mb-2 w-full rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs"
              onKeyDown={(e) => e.key === "Enter" && lookup(false)}
            />
          )}

          {preview && (
            <div className="mb-2 rounded border border-[var(--border)] bg-[var(--background)] p-2">
              <p className="text-xs font-medium">{preview.title}</p>
              <p className="text-xs text-[var(--muted)]">{preview.authors} ({preview.year})</p>
              <pre className="mt-1 max-h-24 overflow-auto font-mono text-xs text-[var(--muted)]">
                {preview.bibtex}
              </pre>
            </div>
          )}

          <input
            value={customKey}
            onChange={(e) => setCustomKey(e.target.value)}
            placeholder="Citation key (optional)"
            className="mb-2 w-full rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs"
          />

          <div className="flex gap-2">
            {source !== "bibtex" || !input.includes("@") || input.split("@").length <= 2 ? (
              <button
                onClick={() => lookup(false)}
                disabled={loading || !input.trim()}
                className="flex-1 rounded border border-[var(--border)] py-1 text-xs hover:bg-[var(--surface-hover)] disabled:opacity-50"
              >
                Preview
              </button>
            ) : null}
            <button
              onClick={() => lookup(true)}
              disabled={loading || !input.trim()}
              className="flex-1 rounded bg-[var(--accent)] py-1 text-xs font-medium text-[#0f1117] disabled:opacity-50"
            >
              {loading ? "..." : preview ? "Add" : "Import"}
            </button>
          </div>

          {status && (
            <p className={`mt-2 text-xs ${status.includes("fail") || status.includes("Invalid") ? "text-[var(--danger)]" : "text-[var(--muted)]"}`}>
              {status}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
