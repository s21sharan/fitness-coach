"use client";

interface SparklineProps {
  points?: number[];
  width?: number;
  height?: number;
  color?: string;
}

export function Sparkline({
  points = [4, 6, 5, 7, 6, 8, 7, 9, 8, 10, 9, 11],
  width = 240,
  height = 60,
  color = 'var(--sky-deep)',
}: SparklineProps) {
  const max = Math.max(...points);
  const min = Math.min(...points);
  const span = max - min || 1;
  const step = width / (points.length - 1);
  const ys = points.map((p) => height - ((p - min) / span) * (height - 8) - 4);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${i * step},${ys[i]}`).join(' ');
  const fill = `${path} L${width},${height} L0,${height} Z`;
  const id = 'sg' + Math.random().toString(36).slice(2, 7);
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ overflow: 'visible' }}
    >
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity={0.4} />
          <stop offset="1" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={fill} fill={`url(#${id})`} />
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          strokeDasharray: 600,
          strokeDashoffset: 600,
          animation: 'draw-line 1.6s ease-out forwards',
        }}
      />
      <circle cx={width} cy={ys[ys.length - 1]} r="4" fill="var(--ink)" />
    </svg>
  );
}
