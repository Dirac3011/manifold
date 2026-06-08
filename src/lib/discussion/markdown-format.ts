/** Wrap the current textarea selection with markdown delimiters. */
export function wrapSelection(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  before: string,
  after: string
): { next: string; cursorStart: number; cursorEnd: number } {
  const selected = value.slice(selectionStart, selectionEnd);
  const next =
    value.slice(0, selectionStart) +
    before +
    selected +
    after +
    value.slice(selectionEnd);
  const cursorStart = selectionStart + before.length;
  const cursorEnd = cursorStart + selected.length;
  return { next, cursorStart, cursorEnd };
}

/** Insert a bullet at the start of the current line(s). */
export function prefixLinesWithBullet(
  value: string,
  selectionStart: number,
  selectionEnd: number
): { next: string; cursorStart: number; cursorEnd: number } {
  const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
  const lineEnd = value.indexOf("\n", selectionEnd);
  const end = lineEnd === -1 ? value.length : lineEnd;
  const block = value.slice(lineStart, end);
  const lines = block.split("\n");
  const bulleted = lines
    .map((line) => (line.startsWith("- ") ? line : line ? `- ${line}` : "- "))
    .join("\n");
  const next = value.slice(0, lineStart) + bulleted + value.slice(end);
  const delta = bulleted.length - block.length;
  return {
    next,
    cursorStart: selectionStart,
    cursorEnd: selectionEnd + delta,
  };
}
