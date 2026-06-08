import katex from "katex";

/**
 * Render message/content with math:
 * - Inline: $$...$$
 * - Display: [...]  (single brackets on own lines or inline)
 */
function applyMarkdown(html: string): string {
  let out = html.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "<em>$1</em>");
  out = out.replace(/==([^=\n]+)==/g, '<mark class="md-highlight">$1</mark>');
  out = out.replace(/^- (.+)$/gm, '<span class="md-bullet">•</span> $1');
  return out;
}

export function renderMathContent(raw: string): string {
  let html = escapeHtml(raw);
  html = applyMarkdown(html);

  // Display math: [...] on its own or multiline
  html = html.replace(
    /\[\s*([\s\S]*?)\s*\]/g,
    (_, math) => {
      try {
        return `<div class="math-display my-2 overflow-x-auto">${katex.renderToString(math.trim(), {
          displayMode: true,
          throwOnError: false,
        })}</div>`;
      } catch {
        return `<pre class="math-error">[${math}]</pre>`;
      }
    }
  );

  // Inline math: $$...$$
  html = html.replace(/\$\$([^$]+)\$\$/g, (_, math) => {
    try {
      return katex.renderToString(math.trim(), {
        displayMode: false,
        throwOnError: false,
      });
    } catch {
      return `<code class="math-error">$$${math}$$</code>`;
    }
  });

  // Preserve line breaks
  html = html.replace(/\n/g, "<br/>");

  return html;
}

/** Render LaTeX environment body as preview (strip commands, render math) */
export function renderLatexPreview(rawLatex: string): string {
  let text = rawLatex
    .replace(/\\begin\{[^}]+\}/g, "")
    .replace(/\\end\{[^}]+\}/g, "")
    .replace(/\\label\{[^}]+\}/g, "")
    .replace(/\\emph\{([^}]+)\}/g, "$1")
    .replace(/\\textbf\{([^}]+)\}/g, "<strong>$1</strong>")
    .replace(/\\textit\{([^}]+)\}/g, "<em>$1</em>");

  // Convert $...$ and \[...\] to our math syntax
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, (_, m) => `[${m}]`);
  text = text.replace(/\$([^$]+)\$/g, (_, m) => `$$${m}$$`);

  return renderMathContent(text);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
