"use client";

import { Button } from "@/components/ui/Button";
import type { SaveConflict } from "@/lib/collab/types";

type Props = {
  conflict: SaveConflict;
  onUseServer: () => void;
  onKeepLocal: () => void;
  onDismiss: () => void;
};

export function SaveConflictBanner({
  conflict,
  onUseServer,
  onKeepLocal,
  onDismiss,
}: Props) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--danger)]/30 bg-[var(--danger)]/8 px-4 py-2">
      <p className="text-ui-xs text-[var(--foreground)]">
        <span className="font-medium text-[var(--danger)]">Save conflict</span>
        {" — "}someone else saved changes while you were editing. Choose which
        version to keep.
      </p>
      <div className="flex shrink-0 items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onUseServer}>
          Use server copy
        </Button>
        <Button variant="secondary" size="sm" onClick={onKeepLocal}>
          Keep my copy
        </Button>
        <button
          type="button"
          onClick={onDismiss}
          className="px-1 text-ui-xs text-[var(--muted)] hover:text-[var(--foreground)]"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    </div>
  );
}
