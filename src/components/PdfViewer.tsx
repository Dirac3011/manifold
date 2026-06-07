"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

type Props = {
  pdfUrl: string | null;
  loading?: boolean;
};

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.1;
const RESIZE_DEBOUNCE_MS = 250;

export function PdfViewer({ pdfUrl, loading }: Props) {
  const [numPages, setNumPages] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [stableWidth, setStableWidth] = useState(0);
  const [isResizing, setIsResizing] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const renderWidthRef = useRef(0);

  useEffect(() => {
    const el = measureRef.current;
    if (!el) return;

    const commitWidth = (width: number) => {
      if (width > 0 && Math.abs(width - renderWidthRef.current) > 2) {
        renderWidthRef.current = width;
        setStableWidth(width);
      }
      setIsResizing(false);
    };

    const update = () => {
      setIsResizing(true);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        commitWidth(el.clientWidth);
      }, RESIZE_DEBOUNCE_MS);
    };

    commitWidth(el.clientWidth);
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      ro.disconnect();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [pdfUrl]);

  const pageWidth = Math.max(stableWidth || renderWidthRef.current, 320) * zoom;

  const zoomIn = useCallback(() => {
    setZoom((z) => Math.min(MAX_ZOOM, Math.round((z + ZOOM_STEP) * 10) / 10));
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((z) => Math.max(MIN_ZOOM, Math.round((z - ZOOM_STEP) * 10) / 10));
  }, []);

  const resetZoom = useCallback(() => setZoom(1), []);

  async function downloadPdf() {
    if (!pdfUrl) return;
    const res = await fetch(pdfUrl);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "manifold-preview.pdf";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-[var(--muted)]">
        Compiling...
      </div>
    );
  }

  if (!pdfUrl) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-[var(--muted)]">
        <p className="text-sm">No PDF yet</p>
        <p className="text-xs">Click Compile to generate a preview</p>
      </div>
    );
  }

  return (
    <div ref={measureRef} className="flex h-full flex-col overflow-hidden bg-[var(--background)]">
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-3 py-1.5">
        <span className="text-xs text-[var(--muted)]">
          {numPages > 0 ? `${numPages} page${numPages !== 1 ? "s" : ""}` : "PDF"}
          {isResizing && " · resizing…"}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={zoomOut}
            disabled={zoom <= MIN_ZOOM}
            className="rounded px-2 py-1 text-xs hover:bg-[var(--surface-hover)] disabled:opacity-40"
            title="Zoom out"
          >
            −
          </button>
          <button
            type="button"
            onClick={resetZoom}
            className="min-w-[3rem] rounded px-2 py-1 text-xs hover:bg-[var(--surface-hover)]"
            title="Reset zoom"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={zoomIn}
            disabled={zoom >= MAX_ZOOM}
            className="rounded px-2 py-1 text-xs hover:bg-[var(--surface-hover)] disabled:opacity-40"
            title="Zoom in"
          >
            +
          </button>
          <span className="mx-1 h-4 w-px bg-[var(--border)]" />
          <button
            type="button"
            onClick={downloadPdf}
            className="rounded px-2 py-1 text-xs text-[var(--accent)] hover:bg-[var(--surface-hover)]"
          >
            Download
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-3">
        {docError ? (
          <p className="text-center text-sm text-[var(--danger)]">{docError}</p>
        ) : stableWidth > 0 ? (
          <Document
            key={pdfUrl}
            file={pdfUrl}
            onLoadSuccess={({ numPages: n }) => {
              setNumPages(n);
              setDocError(null);
            }}
            onLoadError={(err) => setDocError(err.message)}
            loading={
              <div className="py-8 text-center text-sm text-[var(--muted)]">
                Loading PDF...
              </div>
            }
            className="flex flex-col items-center gap-4"
          >
            {numPages > 0 &&
              Array.from({ length: numPages }, (_, i) => (
                <Page
                  key={`${pdfUrl}-page-${i + 1}`}
                  pageNumber={i + 1}
                  width={pageWidth}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  className="bg-white shadow-md"
                />
              ))}
          </Document>
        ) : (
          <div className="py-8 text-center text-sm text-[var(--muted)]">
            Preparing viewer...
          </div>
        )}
      </div>
    </div>
  );
}
