"use client";

type PulsePillTone = 'coral' | 'mint' | 'sky';

interface PulsePillProps {
  label: string;
  value: string;
  tone?: PulsePillTone;
}

export function PulsePill({ label, value, tone = 'coral' }: PulsePillProps) {
  const bg: Record<PulsePillTone, string> = {
    coral: 'var(--coral-soft)',
    mint: 'var(--mint-soft)',
    sky: 'var(--sky-soft)',
  };
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        borderRadius: 12,
        background: bg[tone],
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-2)' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 800 }}>{value}</span>
    </div>
  );
}
