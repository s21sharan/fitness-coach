"use client";

interface MacroDonutProps {
  size?: number;
  p?: number;
  c?: number;
  f?: number;
}

export function MacroDonut({ size = 140, p = 148, c = 210, f = 62 }: MacroDonutProps) {
  const total = p * 4 + c * 4 + f * 9;
  const segs = [
    { v: (p * 4) / total, color: 'var(--coral-deep)' },
    { v: (c * 4) / total, color: 'var(--sky-deep)' },
    { v: (f * 9) / total, color: 'var(--lemon-deep)' },
  ];
  const r = (size - 18) / 2;
  const c2 = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} className="animated-ring">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#EEF2F4" strokeWidth="14" fill="none" />
        {segs.map((s, i) => {
          const len = s.v * c2;
          const dash = `${len} ${c2 - len}`;
          const offset = -acc * c2;
          acc += s.v;
          return (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke={s.color}
              strokeWidth="14"
              fill="none"
              strokeDasharray={dash}
              strokeDashoffset={offset}
              strokeLinecap="butt"
            />
          );
        })}
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          textAlign: 'center',
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--muted)',
              letterSpacing: '.08em',
              textTransform: 'uppercase',
            }}
          >
            Today
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>2,140</div>
          <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600 }}>kcal</div>
        </div>
      </div>
    </div>
  );
}
