import type { Monaco } from "@monaco-editor/react";
import type { languages, editor, Position } from "monaco-editor";
import { ENVIRONMENT_MAP } from "./types";

export type CommandSuggestion = {
  name: string;
  snippet?: string;
  detail: string;
  kind: "builtin" | "custom" | "environment" | "package";
  arity?: number;
};

let completionRegistered = false;
let projectTexBundle = "";

export function setLatexCompletionContext(texBundle: string) {
  projectTexBundle = texBundle;
}

const BUILTIN_COMMANDS: CommandSuggestion[] = [
  { name: "documentclass", snippet: "documentclass{${1:article}}", detail: "Document class", kind: "builtin" },
  { name: "usepackage", snippet: "usepackage{${1:amsmath}}", detail: "Load package", kind: "builtin" },
  { name: "begin", snippet: "begin{${1:environment}}\n\t$0\n\\end{${1:environment}}", detail: "Begin environment", kind: "builtin" },
  { name: "end", snippet: "end{${1:environment}}", detail: "End environment", kind: "builtin" },
  { name: "section", snippet: "section{${1:title}}", detail: "Section heading", kind: "builtin" },
  { name: "subsection", snippet: "subsection{${1:title}}", detail: "Subsection heading", kind: "builtin" },
  { name: "subsubsection", snippet: "subsubsection{${1:title}}", detail: "Subsubsection", kind: "builtin" },
  { name: "chapter", snippet: "chapter{${1:title}}", detail: "Chapter heading", kind: "builtin" },
  { name: "paragraph", snippet: "paragraph{${1:title}}", detail: "Paragraph heading", kind: "builtin" },
  { name: "label", snippet: "label{${1:key}}", detail: "Set label", kind: "builtin" },
  { name: "ref", snippet: "ref{${1:label}}", detail: "Reference", kind: "builtin" },
  { name: "eqref", snippet: "eqref{${1:label}}", detail: "Equation reference", kind: "builtin" },
  { name: "cref", snippet: "cref{${1:label}}", detail: "Clever reference", kind: "builtin" },
  { name: "Cref", snippet: "Cref{${1:label}}", detail: "Clever Reference (capitalized)", kind: "builtin" },
  { name: "cite", snippet: "cite{${1:key}}", detail: "Citation", kind: "builtin" },
  { name: "citep", snippet: "citep{${1:key}}", detail: "Parenthetical citation", kind: "builtin" },
  { name: "citet", snippet: "citet{${1:key}}", detail: "Textual citation", kind: "builtin" },
  { name: "textbf", snippet: "textbf{${1:text}}", detail: "Bold text", kind: "builtin" },
  { name: "textit", snippet: "textit{${1:text}}", detail: "Italic text", kind: "builtin" },
  { name: "emph", snippet: "emph{${1:text}}", detail: "Emphasized text", kind: "builtin" },
  { name: "texttt", snippet: "texttt{${1:text}}", detail: "Monospace text", kind: "builtin" },
  { name: "underline", snippet: "underline{${1:text}}", detail: "Underline", kind: "builtin" },
  { name: "maketitle", detail: "Render title", kind: "builtin" },
  { name: "title", snippet: "title{${1:My Title}}", detail: "Document title", kind: "builtin" },
  { name: "author", snippet: "author{${1:Name}}", detail: "Document author", kind: "builtin" },
  { name: "date", snippet: "date{${1:\\today}}", detail: "Document date", kind: "builtin" },
  { name: "tableofcontents", detail: "Table of contents", kind: "builtin" },
  { name: "input", snippet: "input{${1:file}}", detail: "Include file (no new page)", kind: "builtin" },
  { name: "include", snippet: "include{${1:file}}", detail: "Include file (new page)", kind: "builtin" },
  { name: "includegraphics", snippet: "includegraphics[width=${1:0.8\\textwidth}]{${2:file}}", detail: "Include image", kind: "builtin" },
  { name: "newcommand", snippet: "newcommand{${1:\\cmd}}[${2:0}]{${3:def}}", detail: "Define command", kind: "builtin" },
  { name: "renewcommand", snippet: "renewcommand{${1:\\cmd}}[${2:0}]{${3:def}}", detail: "Redefine command", kind: "builtin" },
  { name: "newtheorem", snippet: "newtheorem{${1:env}}{${2:Name}}", detail: "Define theorem-like env", kind: "builtin" },
  { name: "bibliography", snippet: "bibliography{${1:references}}", detail: "BibTeX bibliography", kind: "builtin" },
  { name: "bibliographystyle", snippet: "bibliographystyle{${1:plainnat}}", detail: "BibTeX style", kind: "builtin" },
  { name: "item", detail: "List item", kind: "builtin" },
  { name: "footnote", snippet: "footnote{${1:text}}", detail: "Footnote", kind: "builtin" },
  { name: "caption", snippet: "caption{${1:text}}", detail: "Figure/table caption", kind: "builtin" },
  { name: "centering", detail: "Center content", kind: "builtin" },
  { name: "hfill", detail: "Horizontal fill", kind: "builtin" },
  { name: "vspace", snippet: "vspace{${1:1em}}", detail: "Vertical space", kind: "builtin" },
  { name: "hspace", snippet: "hspace{${1:1em}}", detail: "Horizontal space", kind: "builtin" },
  { name: "newline", detail: "Line break", kind: "builtin" },
  { name: "clearpage", detail: "Clear page", kind: "builtin" },
  { name: "newpage", detail: "New page", kind: "builtin" },
  // Math
  { name: "frac", snippet: "frac{${1:num}}{${2:den}}", detail: "Fraction", kind: "builtin" },
  { name: "sqrt", snippet: "sqrt{${1:x}}", detail: "Square root", kind: "builtin" },
  { name: "sum", snippet: "sum_{${1:i=1}}^{${2:n}}", detail: "Summation", kind: "builtin" },
  { name: "prod", snippet: "prod_{${1:i=1}}^{${2:n}}", detail: "Product", kind: "builtin" },
  { name: "int", snippet: "int_{${1:a}}^{${2:b}}", detail: "Integral", kind: "builtin" },
  { name: "lim", snippet: "lim_{${1:x \\to \\infty}}", detail: "Limit", kind: "builtin" },
  { name: "infty", detail: "Infinity", kind: "builtin" },
  { name: "partial", detail: "Partial derivative", kind: "builtin" },
  { name: "nabla", detail: "Nabla", kind: "builtin" },
  { name: "cdot", detail: "Center dot", kind: "builtin" },
  { name: "times", detail: "Times", kind: "builtin" },
  { name: "leq", detail: "Less or equal", kind: "builtin" },
  { name: "geq", detail: "Greater or equal", kind: "builtin" },
  { name: "neq", detail: "Not equal", kind: "builtin" },
  { name: "approx", detail: "Approximately", kind: "builtin" },
  { name: "equiv", detail: "Equivalent", kind: "builtin" },
  { name: "subset", detail: "Subset", kind: "builtin" },
  { name: "subseteq", detail: "Subset or equal", kind: "builtin" },
  { name: "in", detail: "Element of", kind: "builtin" },
  { name: "forall", detail: "For all", kind: "builtin" },
  { name: "exists", detail: "Exists", kind: "builtin" },
  { name: "left", snippet: "left(${1:content}\\right)", detail: "Left delimiter", kind: "builtin" },
  { name: "right", snippet: "right)", detail: "Right delimiter", kind: "builtin" },
  { name: "mathbb", snippet: "mathbb{${1:R}}", detail: "Blackboard bold", kind: "builtin" },
  { name: "mathcal", snippet: "mathcal{${1:F}}", detail: "Calligraphic", kind: "builtin" },
  { name: "mathrm", snippet: "mathrm{${1:text}}", detail: "Roman math", kind: "builtin" },
  { name: "mathbf", snippet: "mathbf{${1:x}}", detail: "Bold math", kind: "builtin" },
  { name: "mathit", snippet: "mathit{${1:x}}", detail: "Italic math", kind: "builtin" },
  { name: "operatorname", snippet: "operatorname{${1:name}}", detail: "Math operator", kind: "builtin" },
  { name: "alpha", detail: "Greek α", kind: "builtin" },
  { name: "beta", detail: "Greek β", kind: "builtin" },
  { name: "gamma", detail: "Greek γ", kind: "builtin" },
  { name: "delta", detail: "Greek δ", kind: "builtin" },
  { name: "epsilon", detail: "Greek ε", kind: "builtin" },
  { name: "theta", detail: "Greek θ", kind: "builtin" },
  { name: "lambda", detail: "Greek λ", kind: "builtin" },
  { name: "mu", detail: "Greek μ", kind: "builtin" },
  { name: "pi", detail: "Greek π", kind: "builtin" },
  { name: "sigma", detail: "Greek σ", kind: "builtin" },
  { name: "omega", detail: "Greek ω", kind: "builtin" },
];

const MATH_ENVIRONMENTS = [
  "equation", "equation*", "align", "align*", "gather", "gather*",
  "multline", "multline*", "matrix", "pmatrix", "bmatrix", "vmatrix",
  "cases", "split", "aligned",
];

const STANDARD_ENVIRONMENTS = [
  ...Object.keys(ENVIRONMENT_MAP),
  "document", "abstract", "itemize", "enumerate", "description",
  "figure", "figure*", "table", "table*", "tabular", "center",
  "proof", "proof*", "minipage", "frame", "quote", "quotation",
  ...MATH_ENVIRONMENTS,
];

function snippetForArity(name: string, arity: number): string {
  if (arity <= 0) return name;
  const args = Array.from({ length: arity }, (_, i) => `{${i + 1}:arg${i + 1}}`).join("");
  return `${name}${args}$0`;
}

/** Parse custom macros from LaTeX source (current file + project bundle). */
export function extractCustomCommands(content: string): CommandSuggestion[] {
  const seen = new Set<string>();
  const results: CommandSuggestion[] = [];

  function add(name: string, arity: number, detail: string) {
    if (!name || seen.has(name)) return;
    seen.add(name);
    results.push({
      name,
      arity,
      snippet: snippetForArity(name, arity),
      detail,
      kind: "custom",
    });
  }

  const patterns: Array<{ re: RegExp; arityGroup?: number }> = [
    {
      re: /\\(?:new|renew|provide|DeclareRobust)command\*?(?:\[[^\]]*\])?\s*\{?\\([a-zA-Z@]+)\}?(?:\[(\d+)\])?/g,
      arityGroup: 2,
    },
    { re: /\\DeclareMathOperator\*?\s*\{?\\([a-zA-Z@]+)\}?\s*\{[^}]*\}/g },
    { re: /\\def\\([a-zA-Z@]+)/g },
    {
      re: /\\NewDocumentCommand\s*\{?\\([a-zA-Z@]+)\}?\s*\{[^}]*\}/g,
    },
    {
      re: /\\newtheorem\*?\s*\{([^}]+)\}/g,
    },
  ];

  for (const { re, arityGroup } of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      const name = m[1];
      const arity = arityGroup && m[arityGroup] ? parseInt(m[arityGroup], 10) : 0;
      if (re.source.includes("newtheorem")) {
        add(name, 0, `Custom environment \\begin{${name}}`);
      } else {
        add(name, arity, "Custom command");
      }
    }
  }

  // Count # parameters in \def\cmd#1#2{...} on same line
  const defLineRe = /\\def\\([a-zA-Z@]+)((?:#\d)+)?/g;
  let dm: RegExpExecArray | null;
  while ((dm = defLineRe.exec(content)) !== null) {
    const arity = dm[2] ? (dm[2].match(/#/g) || []).length : 0;
    add(dm[1], arity, "Custom command (\\def)");
  }

  return results;
}

function extractLabels(content: string): string[] {
  const labels: string[] = [];
  const re = /\\label\{([^}]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) labels.push(m[1]);
  return [...new Set(labels)];
}

function extractCiteKeys(content: string): string[] {
  const keys: string[] = [];
  const bibitemRe = /\\bibitem(?:\[[^\]]*\])?\{([^}]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = bibitemRe.exec(content)) !== null) keys.push(m[1]);
  const bibtexRe = /@\w+\{\s*([^,\s]+)\s*,/g;
  while ((m = bibtexRe.exec(content)) !== null) keys.push(m[1]);
  return [...new Set(keys)];
}

function getContext(
  model: editor.ITextModel,
  position: Position
): {
  mode: "command" | "environment" | "label" | "cite" | "none";
  prefix: string;
  replaceStart: number;
} {
  const line = model.getLineContent(position.lineNumber);
  const col = position.column - 1;
  const before = line.slice(0, col);

  const envMatch = before.match(/\\(?:begin|end)\{([^}]*)$/);
  if (envMatch) {
    return {
      mode: "environment",
      prefix: envMatch[1],
      replaceStart: col - envMatch[1].length,
    };
  }

  const labelMatch = before.match(/\\(?:label|ref|eqref|cref|Cref)\{([^}]*)$/);
  if (labelMatch) {
    return {
      mode: "label",
      prefix: labelMatch[1],
      replaceStart: col - labelMatch[1].length,
    };
  }

  const citeMatch = before.match(/\\(?:cite|citep|citet|citealp|citeauthor)\{([^}]*)$/);
  if (citeMatch) {
    return {
      mode: "cite",
      prefix: citeMatch[1],
      replaceStart: col - citeMatch[1].length,
    };
  }

  const cmdMatch = before.match(/\\([a-zA-Z@]*)$/);
  if (cmdMatch) {
    return {
      mode: "command",
      prefix: cmdMatch[1],
      replaceStart: col - cmdMatch[1].length,
    };
  }

  return { mode: "none", prefix: "", replaceStart: col };
}

function toCompletionItem(
  monaco: Monaco,
  cmd: CommandSuggestion,
  range: languages.CompletionItem["range"],
  sortPrefix: string
): languages.CompletionItem {
  const isSnippet = !!cmd.snippet;
  return {
    label: cmd.name,
    kind:
      cmd.kind === "environment"
        ? monaco.languages.CompletionItemKind.Enum
        : cmd.kind === "custom"
          ? monaco.languages.CompletionItemKind.Function
          : monaco.languages.CompletionItemKind.Keyword,
    insertText: isSnippet ? cmd.snippet! : cmd.name,
    insertTextRules: isSnippet
      ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
      : undefined,
    detail: cmd.detail,
    sortText: `${sortPrefix}${cmd.name}`,
    range,
  };
}

export function registerLatexCompletion(monaco: Monaco) {
  if (completionRegistered) return;
  completionRegistered = true;

  monaco.languages.registerCompletionItemProvider("latex", {
    triggerCharacters: ["\\", "{", ","],
    provideCompletionItems(model, position) {
      const ctx = getContext(model, position);
      if (ctx.mode === "none") return { suggestions: [] };

      const line = model.getLineContent(position.lineNumber);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: ctx.replaceStart + 1,
        endColumn: position.column,
      };

      const bundle = model.getValue() + "\n" + projectTexBundle;
      const prefixLower = ctx.prefix.toLowerCase();

      if (ctx.mode === "environment") {
        const customEnvs = extractCustomCommands(bundle)
          .filter((c) => c.detail.includes("environment"))
          .map((c) => c.name);
        const envs = [...new Set([...STANDARD_ENVIRONMENTS, ...customEnvs])];
        const suggestions = envs
          .filter((e) => e.toLowerCase().startsWith(prefixLower))
          .map((e) =>
            toCompletionItem(
              monaco,
              { name: e, detail: `Environment ${e}`, kind: "environment" },
              range,
              "0"
            )
          );
        return { suggestions };
      }

      if (ctx.mode === "label") {
        const labels = extractLabels(bundle);
        const suggestions = labels
          .filter((l) => l.toLowerCase().includes(prefixLower))
          .map((l) =>
            toCompletionItem(
              monaco,
              { name: l, detail: "Label", kind: "custom" },
              range,
              "0"
            )
          );
        return { suggestions };
      }

      if (ctx.mode === "cite") {
        const keys = extractCiteKeys(bundle);
        const suggestions = keys
          .filter((k) => k.toLowerCase().includes(prefixLower))
          .map((k) =>
            toCompletionItem(
              monaco,
              { name: k, detail: "Citation key", kind: "custom" },
              range,
              "0"
            )
          );
        return { suggestions };
      }

      // command mode
      const custom = extractCustomCommands(bundle);
      const customFiltered = custom.filter((c) =>
        c.name.toLowerCase().startsWith(prefixLower)
      );
      const builtinFiltered = BUILTIN_COMMANDS.filter((c) =>
        c.name.toLowerCase().startsWith(prefixLower)
      );

      const customNames = new Set(custom.map((c) => c.name));
      const builtinDeduped = builtinFiltered.filter((c) => !customNames.has(c.name));

      const suggestions = [
        ...customFiltered.map((c) => toCompletionItem(monaco, c, range, "0")),
        ...builtinDeduped.map((c) => toCompletionItem(monaco, c, range, "1")),
      ];

      return { suggestions };
    },
  });
}
