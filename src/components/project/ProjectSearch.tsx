"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusPill } from "@/components/ui/StatusPill";

type SearchResult = {
  kind: "file" | "object" | "citation";
  id: string;
  label: string;
  detail?: string;
  line?: number;
};

type Props = {
  projectId: string;
  onSelectFile: (fileId: string, line?: number) => void;
  onSelectObject: (objectId: string) => void;
  onSelectCitation: () => void;
};

const kindLabel = { file: "File", object: "Object", citation: "Citation" };
const kindTone = {
  file: "neutral" as const,
  object: "accent" as const,
  citation: "success" as const,
};

export function ProjectSearch({
  projectId,
  onSelectFile,
  onSelectObject,
  onSelectCitation,
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => {
      fetch(`/api/projects/${projectId}/search?q=${encodeURIComponent(query.trim())}`)
        .then((r) => r.json())
        .then((d) => setResults(d.results || []))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [query, projectId]);

  function handleSelect(r: SearchResult) {
    if (r.kind === "file") onSelectFile(r.id, r.line);
    else if (r.kind === "object") onSelectObject(r.id);
    else onSelectCitation();
  }

  return (
    <div className="flex h-full flex-col p-3">
      <Input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search files, objects, citations…"
        className="mb-3"
      />
      {loading && <p className="text-ui-xs text-[var(--muted)]">Searching…</p>}
      {!loading && query.length >= 2 && results.length === 0 && (
        <EmptyState title="No results" description={`Nothing matched "${query}"`} />
      )}
      <div className="flex-1 overflow-y-auto">
        {results.map((r) => (
          <button
            key={`${r.kind}-${r.id}-${r.line ?? 0}`}
            type="button"
            onClick={() => handleSelect(r)}
            className="mb-0 block w-full border-b border-[var(--border-subtle)] px-1 py-2.5 text-left transition-colors hover:bg-[var(--surface-hover)]"
          >
            <StatusPill tone={kindTone[r.kind]}>{kindLabel[r.kind]}</StatusPill>
            <p className="mt-1 text-ui-sm">{r.label}</p>
            {r.detail && <p className="text-ui-xs text-[var(--muted)]">{r.detail}</p>}
          </button>
        ))}
      </div>
    </div>
  );
}
