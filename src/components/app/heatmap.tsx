"use client";

interface HeatmapCell {
  c: number;
  r: number;
  lvl: number;
}

interface HeatmapProps {
  weeks?: number;
}

export function Heatmap({ weeks = 14 }: HeatmapProps) {
  const cols = weeks;
  const rows = 7;
  const cells: HeatmapCell[] = [];
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const v = Math.random();
      const lvl = v > 0.85 ? 4 : v > 0.7 ? 3 : v > 0.5 ? 2 : v > 0.3 ? 1 : 0;
      cells.push({ c, r, lvl });
    }
  }
  const colors = [
    '#EEF2F4',
    'var(--mint-soft)',
    'var(--mint)',
    'var(--mint-deep)',
    'var(--coral-deep)',
  ];
  return (
    <svg width={cols * 16} height={rows * 16}>
      {cells.map((cell, i) => (
        <rect key={i} x={cell.c * 16} y={cell.r * 16} width={12} height={12} rx={3} fill={colors[cell.lvl]}>
          <animate
            attributeName="opacity"
            from="0"
            to="1"
            begin={`${i * 0.005}s`}
            dur="0.4s"
            fill="freeze"
          />
        </rect>
      ))}
    </svg>
  );
}
