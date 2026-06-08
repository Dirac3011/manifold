"use client";

type Node = {
  id: string;
  label: string | null;
  type: string;
  title: string | null;
};

type Edge = {
  fromId: string;
  toId: string;
  refLabel: string;
};

type Props = {
  nodes: Node[];
  edges: Edge[];
  onSelectNode: (id: string) => void;
  selectedId?: string | null;
};

export function DependencyGraph({
  nodes,
  edges,
  onSelectNode,
  selectedId,
}: Props) {
  if (nodes.length === 0) {
    return (
      <p className="p-4 text-sm text-[var(--muted)]">
        No dependencies detected yet. Add \\ref commands between labeled objects.
      </p>
    );
  }

  // Simple grid layout for MVP
  const cols = Math.ceil(Math.sqrt(nodes.length));
  const cellW = 140;
  const cellH = 60;
  const width = cols * cellW + 40;
  const rows = Math.ceil(nodes.length / cols);
  const height = rows * cellH + 40;

  const positions = new Map<string, { x: number; y: number }>();
  nodes.forEach((n, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    positions.set(n.id, { x: 20 + col * cellW + cellW / 2, y: 20 + row * cellH + 20 });
  });

  const typeColor: Record<string, string> = {
    THEOREM: "#7b8fd4",
    LEMMA: "#9b8ec4",
    DEFINITION: "#6ba88a",
    COROLLARY: "#b8a86a",
    CONJECTURE: "#c48a8a",
    REMARK: "#8b92a8",
  };

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      style={{ minHeight: 200 }}
    >
      {edges.map((e, i) => {
        const from = positions.get(e.fromId);
        const to = positions.get(e.toId);
        if (!from || !to) return null;
        return (
          <line
            key={i}
            x1={from.x}
            y1={from.y + 12}
            x2={to.x}
            y2={to.y - 12}
            stroke="var(--border)"
            strokeWidth={1.5}
            markerEnd="url(#arrow)"
          />
        );
      })}
      <defs>
        <marker
          id="arrow"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth={6}
          markerHeight={6}
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--muted)" />
        </marker>
      </defs>
      {nodes.map((n) => {
        const pos = positions.get(n.id)!;
        const color = typeColor[n.type] || "#6c9eff";
        const isSelected = n.id === selectedId;
        const display = n.label || n.type.toLowerCase();
        return (
          <g
            key={n.id}
            onClick={() => onSelectNode(n.id)}
            className="cursor-pointer"
          >
            <rect
              x={pos.x - 55}
              y={pos.y - 14}
              width={110}
              height={28}
              rx={6}
              fill={isSelected ? color : "var(--surface)"}
              stroke={color}
              strokeWidth={isSelected ? 2 : 1}
            />
            <text
              x={pos.x}
              y={pos.y + 4}
              textAnchor="middle"
              fill={isSelected ? "#0f1117" : "var(--foreground)"}
              fontSize={11}
              fontFamily="monospace"
            >
              {display.length > 14 ? display.slice(0, 12) + "…" : display}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
