/** Muted academic styling for theorem object types and statuses */

export const OBJECT_TYPE_STYLES: Record<
  string,
  { label: string; stripe: string; text: string }
> = {
  THEOREM: {
    label: "Theorem",
    stripe: "var(--type-theorem)",
    text: "text-[var(--type-theorem)]",
  },
  LEMMA: {
    label: "Lemma",
    stripe: "var(--type-lemma)",
    text: "text-[var(--type-lemma)]",
  },
  DEFINITION: {
    label: "Definition",
    stripe: "var(--type-definition)",
    text: "text-[var(--type-definition)]",
  },
  COROLLARY: {
    label: "Corollary",
    stripe: "var(--type-corollary)",
    text: "text-[var(--type-corollary)]",
  },
  CONJECTURE: {
    label: "Conjecture",
    stripe: "var(--type-conjecture)",
    text: "text-[var(--type-conjecture)]",
  },
  REMARK: {
    label: "Remark",
    stripe: "var(--type-remark)",
    text: "text-[var(--type-remark)]",
  },
};

export function formatObjectType(type: string): string {
  return OBJECT_TYPE_STYLES[type]?.label ?? type.charAt(0) + type.slice(1).toLowerCase();
}

/** Statuses available in the object status menu */
export const OBJECT_STATUS_OPTIONS = [
  "DRAFT",
  "PROOF_INCOMPLETE",
  "PROOF_COMPLETE",
  "NEEDS_REVIEW",
  "REVIEWED",
  "DEPRECATED",
] as const;

export const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  PROOF_INCOMPLETE: "Proof Incomplete",
  PROOF_COMPLETE: "Proof Complete",
  NEEDS_REVIEW: "Needs Review",
  REVIEWED: "Reviewed",
  DEPRECATED: "Archived",
};

function titleCaseWords(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatStatus(status: string): string {
  if (STATUS_LABELS[status]) return STATUS_LABELS[status];
  return titleCaseWords(status.replace(/_/g, " "));
}

export function statusTone(
  status: string
): "neutral" | "success" | "warning" | "danger" | "muted" {
  if (status === "DEPRECATED") return "muted";
  if (status === "PROOF_COMPLETE" || status === "REVIEWED") return "success";
  if (status === "NEEDS_REVIEW" || status === "PROOF_INCOMPLETE") return "warning";
  return "neutral";
}
