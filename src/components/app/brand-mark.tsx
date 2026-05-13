"use client";

type BrandName =
  | 'macrofactor'
  | 'hevy'
  | 'strava'
  | 'garmin'
  | 'gcal'
  | 'apple'
  | 'whoop'
  | 'oura'
  | 'trainingpeaks'
  | 'zwift'
  | 'wahoo'
  | 'myfitnesspal'
  | string;

interface BrandMarkProps {
  name: BrandName;
  size?: number;
}

export function BrandMark({ name, size = 36 }: BrandMarkProps) {
  const map: Record<string, { bg: string; label: string }> = {
    macrofactor: { bg: 'var(--brand-mf)', label: 'M' },
    hevy: { bg: 'var(--brand-hevy)', label: 'H' },
    strava: { bg: 'var(--brand-strava)', label: 'S' },
    garmin: { bg: 'var(--brand-garmin)', label: 'G' },
    gcal: { bg: 'var(--brand-gcal)', label: 'C' },
    apple: { bg: '#000', label: '' },
    whoop: { bg: 'var(--brand-whoop)', label: 'W' },
    oura: { bg: '#252525', label: 'O' },
    trainingpeaks: { bg: '#0A7B3E', label: 'TP' },
    zwift: { bg: '#FC6719', label: 'Z' },
    wahoo: { bg: '#1A6DB5', label: 'W' },
    myfitnesspal: { bg: '#0070D1', label: 'MF' },
  };
  const m = map[name] || { bg: '#888', label: '?' };

  if (name === 'strava') {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.28,
          background: m.bg,
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
        }}
      >
        <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="#fff">
          <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
        </svg>
      </div>
    );
  }

  if (name === 'garmin') {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.28,
          background: m.bg,
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
        }}
      >
        <svg
          width={size * 0.55}
          height={size * 0.55}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#fff"
          strokeWidth="2.5"
        >
          <path d="M3 14L12 5l9 9M6 14h12" />
        </svg>
      </div>
    );
  }

  if (name === 'apple') {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.28,
          background: '#000',
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
        }}
      >
        <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="#fff">
          <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01M12 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25" />
        </svg>
      </div>
    );
  }

  if (name === 'gcal') {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.28,
          background: '#fff',
          border: '1px solid var(--line)',
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
          color: 'var(--brand-gcal)',
          fontWeight: 800,
          fontSize: size * 0.48,
        }}
      >
        31
      </div>
    );
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        background: m.bg,
        display: 'grid',
        placeItems: 'center',
        color: '#fff',
        fontWeight: 800,
        fontSize: size * 0.5,
        flexShrink: 0,
      }}
    >
      {m.label}
    </div>
  );
}
