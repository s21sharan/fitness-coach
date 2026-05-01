"use client";

interface RingProps {
  size?: number;
  stroke?: number;
  value?: number;
  color?: string;
  track?: string;
  children?: React.ReactNode;
}

export function Ring({
  size = 120,
  stroke = 12,
  value = 0.64,
  color = 'var(--mint-deep)',
  track = '#EEF2F4',
  children,
}: RingProps) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - value);
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} className="animated-ring">
        <circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(.2,.8,.2,1)' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
        {children}
      </div>
    </div>
  );
}

interface TripleRingProps {
  size?: number;
  values?: [number, number, number];
}

export function TripleRing({ size = 160, values = [0.64, 0.42, 0.78] }: TripleRingProps) {
  const colors = ['var(--coral-deep)', 'var(--mint-deep)', 'var(--sky-deep)'];
  const tracks = ['var(--coral-soft)', 'var(--mint-soft)', 'var(--sky-soft)'];
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      {values.map((v, i) => {
        const stroke = 10;
        const ringSize = size - i * 30;
        const offset = (size - ringSize) / 2;
        return (
          <div key={i} style={{ position: 'absolute', top: offset, left: offset }}>
            <Ring size={ringSize} stroke={stroke} value={v} color={colors[i]} track={tracks[i]} />
          </div>
        );
      })}
    </div>
  );
}
