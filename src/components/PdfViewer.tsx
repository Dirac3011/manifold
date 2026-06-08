"use client";



import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { Document, Page, pdfjs } from "react-pdf";

import { Download, Maximize2, Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/Button";

import { StatusPill } from "@/components/ui/StatusPill";

import { EmptyState } from "@/components/ui/EmptyState";

import "react-pdf/dist/Page/AnnotationLayer.css";

import "react-pdf/dist/Page/TextLayer.css";



pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;



const MIN_RENDER_WIDTH = 280;

const H_PADDING = 32;

const MIN_ZOOM = 0.5;

const MAX_ZOOM = 2.5;

const ZOOM_STEP = 0.1;



type Props = {

  pdfUrl: string | null;

  loading?: boolean;

  stale?: boolean;

  compileFailed?: boolean;

  /** True while a split handle is being dragged — canvas scales via CSS instead of re-rasterizing */

  panelResizing?: boolean;

};



function PdfViewerInner({

  pdfUrl,

  loading,

  stale,

  compileFailed,

  panelResizing = false,

}: Props) {

  const [numPages, setNumPages] = useState(0);

  const [zoom, setZoom] = useState(1);

  const [fitWidth, setFitWidth] = useState(true);

  const [containerWidth, setContainerWidth] = useState(0);

  const [renderWidth, setRenderWidth] = useState(0);

  const [docError, setDocError] = useState<string | null>(null);

  const measureRef = useRef<HTMLDivElement>(null);

  const renderWidthRef = useRef(0);
  const panelResizingRef = useRef(panelResizing);
  panelResizingRef.current = panelResizing;

  const commitRenderWidth = useCallback((width: number) => {

    if (width < MIN_RENDER_WIDTH) return;

    if (Math.abs(width - renderWidthRef.current) < 2) return;

    renderWidthRef.current = width;

    setRenderWidth(width);

  }, []);



  useLayoutEffect(() => {

    const w = measureRef.current?.clientWidth ?? 0;

    if (w > 0) {

      setContainerWidth(w);

      commitRenderWidth(w);

    }

  }, [commitRenderWidth]);



  useEffect(() => {

    const el = measureRef.current;

    if (!el) return;



    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      if (w <= 0) return;
      setContainerWidth(w);
      if (!panelResizingRef.current) commitRenderWidth(w);
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, [pdfUrl, commitRenderWidth]);



  useEffect(() => {

    if (!panelResizing) {

      commitRenderWidth(containerWidth);

    }

  }, [panelResizing, containerWidth, commitRenderWidth]);



  useEffect(() => {

    if (pdfUrl) {

      setNumPages(0);

      setDocError(null);

    }

  }, [pdfUrl]);



  const rasterBase = Math.max(renderWidth, MIN_RENDER_WIDTH);

  const rasterPageWidth = Math.max(

    rasterBase * (fitWidth ? 1 : zoom) - H_PADDING,

    MIN_RENDER_WIDTH - H_PADDING

  );

  const displayPageWidth = Math.max(

    (fitWidth ? containerWidth : rasterBase * zoom) - H_PADDING,

    1

  );

  const scaleDuringDrag = panelResizing && fitWidth && renderWidth >= MIN_RENDER_WIDTH;



  const zoomIn = useCallback(() => {

    setFitWidth(false);

    setZoom((z) => Math.min(MAX_ZOOM, Math.round((z + ZOOM_STEP) * 10) / 10));

  }, []);



  const zoomOut = useCallback(() => {

    setFitWidth(false);

    setZoom((z) => Math.max(MIN_ZOOM, Math.round((z - ZOOM_STEP) * 10) / 10));

  }, []);



  const resetFitWidth = useCallback(() => {

    setFitWidth(true);

    setZoom(1);

  }, []);



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

      <div className="flex h-full flex-col items-center justify-center gap-2 bg-[var(--pdf-bg)] text-[var(--muted)]">

        <div className="loading-spinner" />

        <p className="text-ui-sm">Compiling document…</p>

      </div>

    );

  }



  if (!pdfUrl) {

    return (

      <EmptyState

        title="No PDF preview"

        description="Compile your project to generate a PDF preview of the manuscript."

        className="h-full bg-[var(--pdf-bg)]"

      />

    );

  }



  return (

    <div

      ref={measureRef}

      className="flex h-full min-w-0 flex-col overflow-hidden bg-[var(--pdf-bg)]"

    >

      <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2">

        <div className="flex items-center gap-2">

          <span className="text-ui-xs font-medium text-[var(--foreground)]">Preview</span>

          {numPages > 0 && (

            <span className="text-ui-xs text-[var(--muted)]">

              {numPages} page{numPages !== 1 ? "s" : ""}

            </span>

          )}

          {stale && !compileFailed && (

            <StatusPill tone="warning" dot>

              Source changed

            </StatusPill>

          )}

          {compileFailed && (

            <StatusPill tone="danger" dot>

              Compile failed

            </StatusPill>

          )}

        </div>

        <div className="flex items-center gap-0.5">

          <Button variant="ghost" size="sm" onClick={zoomOut} disabled={!fitWidth && zoom <= MIN_ZOOM} title="Zoom out">

            <Minus className="h-3.5 w-3.5" />

          </Button>

          <Button

            variant="ghost"

            size="sm"

            onClick={resetFitWidth}

            className="min-w-[3.5rem] font-mono"

            title="Fit width"

          >

            {fitWidth ? "Fit" : `${Math.round(zoom * 100)}%`}

          </Button>

          <Button variant="ghost" size="sm" onClick={zoomIn} disabled={!fitWidth && zoom >= MAX_ZOOM} title="Zoom in">

            <Plus className="h-3.5 w-3.5" />

          </Button>

          <span className="mx-1 h-4 w-px bg-[var(--border-subtle)]" />

          <Button variant="ghost" size="sm" onClick={resetFitWidth} title="Fit width">

            <Maximize2 className="h-3.5 w-3.5" />

          </Button>

          <Button variant="ghost" size="sm" onClick={downloadPdf} title="Download PDF">

            <Download className="h-3.5 w-3.5" />

          </Button>

        </div>

      </div>



      {(stale || compileFailed) && (

        <div className="shrink-0 border-b border-[var(--warning)]/25 bg-[var(--warning)]/6 px-3 py-1.5 text-ui-xs text-[var(--muted)]">

          {compileFailed

            ? "The preview may not reflect the latest source — fix compile errors and recompile."

            : "The preview is from the last successful compile. Recompile to update."}

        </div>

      )}



      <div className="min-h-0 flex-1 overflow-auto px-4 py-6">

        {docError ? (

          <p className="text-center text-ui-sm text-[var(--danger)]">{docError}</p>

        ) : renderWidth > 0 ? (

          <Document

            key={pdfUrl}

            file={pdfUrl}

            onLoadSuccess={({ numPages: n }) => {

              setNumPages(n);

              setDocError(null);

            }}

            onLoadError={(err) => setDocError(err.message)}

            loading={

              <div className="py-12 text-center text-ui-sm text-[var(--muted)]">

                Loading PDF…

              </div>

            }

            className="flex flex-col items-center gap-6"

          >

            {numPages > 0 &&

              Array.from({ length: numPages }, (_, i) => (

                <div

                  key={`page-${i + 1}`}

                  className={

                    scaleDuringDrag

                      ? "shrink-0 bg-white [&_.react-pdf__Page__canvas]:!h-auto [&_.react-pdf__Page__canvas]:!w-full"

                      : "shrink-0 bg-white"

                  }

                  style={{

                    width: displayPageWidth,

                    boxShadow: "var(--pdf-page-shadow)",

                  }}

                >

                  <Page

                    pageNumber={i + 1}

                    width={rasterPageWidth}

                    renderTextLayer={false}

                    renderAnnotationLayer={false}

                    loading={null}

                  />

                </div>

              ))}

          </Document>

        ) : (

          <div className="py-12 text-center text-ui-sm text-[var(--muted)]">

            Loading PDF…

          </div>

        )}

      </div>

    </div>

  );

}



export const PdfViewer = memo(PdfViewerInner);

