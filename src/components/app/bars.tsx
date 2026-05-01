"use client";

interface BarDatum {
  v: number;
  l: string;
  active?: boolean;
}

interface BarsProps {
  data: BarDatum[];
  color?: string;
  height?: number;
  width?: number;
}

export function Bars({ data, color = 'var(--mint-deep)', height = 120, width = 300 }: BarsProps) {
  const max = Math.max(...data.map((d) => d.v));
  const bw = (width - (data.length - 1) * 8) / data.length;
  return (
    <svg width={width} height={height + 24}>
      {data.map((d, i) => {
        const h = (d.v / max) * height;
        const x = i * (bw + 8);
        const y = height - h;
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={bw}
              height={h}
              rx={6}
              fill={d.active ? 'var(--coral-deep)' : color}
              opacity={d.active ? 1 : 0.7}
            >
              <animate attributeName="height" from="0" to={h} dur="0.8s" fill="freeze" />
              <animate attributeName="y" from={height} to={y} dur="0.8s" fill="freeze" />
            </rect>
            <text
              x={x + bw / 2}
              y={height + 16}
              fontSize="10"
              fontWeight="700"
              fill="var(--muted)"
              textAnchor="middle"
            >
              {d.l}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
