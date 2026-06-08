import { CompileErrorSummary } from "@/lib/ui/parse-compile-error";
import { Button } from "./Button";

type Props = {
  error: CompileErrorSummary;
  onJumpToLine?: (line: number) => void;
  onViewLog?: () => void;
};

export function CompilerBanner({ error, onJumpToLine, onViewLog }: Props) {
  const location =
    error.file && error.line
      ? `${error.file} line ${error.line}`
      : error.line
        ? `line ${error.line}`
        : error.file ?? "compilation";

  return (
    <div className="border-b border-[var(--danger)]/25 bg-[var(--danger)]/5 px-4 py-2.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-ui-sm font-medium text-[var(--danger)]">
            Compile failed in {location}
          </p>
          <p className="mt-0.5 text-ui-xs text-[var(--foreground)]">{error.message}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {error.line != null && onJumpToLine && (
            <Button variant="secondary" size="sm" onClick={() => onJumpToLine(error.line!)}>
              Jump to line
            </Button>
          )}
          {onViewLog && (
            <Button variant="ghost" size="sm" onClick={onViewLog}>
              View full log
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
