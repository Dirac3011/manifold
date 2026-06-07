"use client";

import { useEffect, useState } from "react";

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

  const kindLabel = { file: "File", object: "Object", citation: "Citation" };
  const kindColor = {
    file: "text-blue-400",
    object: "text-purple-400",
    citation: "text-green-400",
  };

  return (
    <div className="flex h-full flex-col p-3">
      <h3 className="mb-2 text-sm font-semibold">Project search</h3>
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search files, theorems, citations…"
        className="mb-3 w-full rounded border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
      />
      {loading && <p className="text-xs text-[var(--muted)]">Searching…</p>}
      {!loading && query.length >= 2 && results.length === 0 && (
        <p className="text-xs text-[var(--muted)]">No results</p>
      )}
      <div className="flex-1 overflow-y-auto">
        {results.map((r) => (
          <button
            key={`${r.kind}-${r.id}-${r.line ?? 0}`}
            onClick={() => handleSelect(r)}
            className="mb-1 block w-full rounded border border-[var(--border)] p-2 text-left hover:border-[var(--accent)]"
          >
            <span className={`text-xs font-medium ${kindColor[r.kind]}`}>
              {kindLabel[r.kind]}
            </span>
            <p className="text-sm">{r.label}</p>
            {r.detail && <p className="text-xs text-[var(--muted)]">{r.detail}</p>}
          </button>
        ))}
      </div>
    </div>
  );
}
