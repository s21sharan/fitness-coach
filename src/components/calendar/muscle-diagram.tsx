interface MuscleDiagramProps {
  muscleData: Record<string, { sets: number; volume: number }>;
}

function getColor(sets: number): string {
  if (sets === 0) return "#dce1e8";
  if (sets <= 4) return "#f8a4a4";
  if (sets <= 9) return "#ef4444";
  if (sets <= 14) return "#dc2626";
  return "#991b1b";
}

const BASE = "#dce1e8";

// Front body SVG paths (simplified anatomical outline)
function FrontBody({ m }: { m: (group: string) => string }) {
  return (
    <svg viewBox="0 0 120 260" width="55" height="120" fill="none">
      {/* Head */}
      <ellipse cx="60" cy="18" rx="12" ry="14" fill="#c9cfd8" />
      {/* Neck */}
      <rect x="54" y="30" width="12" height="8" rx="3" fill="#c9cfd8" />
      {/* Shoulders / Delts */}
      <path d="M38 42 C32 42 28 50 30 58 L38 58 L38 42Z" fill={m("shoulders")} />
      <path d="M82 42 C88 42 92 50 90 58 L82 58 L82 42Z" fill={m("shoulders")} />
      {/* Chest */}
      <path d="M38 42 L82 42 L82 72 C82 78 72 82 60 82 C48 82 38 78 38 72 Z" fill={m("chest")} />
      {/* Core / Abs */}
      <path d="M44 82 L76 82 L74 130 C74 134 68 136 60 136 C52 136 46 134 46 130 Z" fill={m("core")} />
      {/* Biceps */}
      <path d="M30 58 L38 58 L36 90 L28 90 C26 80 26 68 30 58Z" fill={m("biceps")} />
      <path d="M90 58 L82 58 L84 90 L92 90 C94 80 94 68 90 58Z" fill={m("biceps")} />
      {/* Forearms */}
      <path d="M28 90 L36 90 L34 124 L26 124 C24 112 24 100 28 90Z" fill={m("forearms")} />
      <path d="M92 90 L84 90 L86 124 L94 124 C96 112 96 100 92 90Z" fill={m("forearms")} />
      {/* Quads */}
      <path d="M44 136 L58 136 L54 200 L40 200 C38 180 38 156 44 136Z" fill={m("quads")} />
      <path d="M76 136 L62 136 L66 200 L80 200 C82 180 82 156 76 136Z" fill={m("quads")} />
      {/* Calves */}
      <path d="M40 206 L54 206 L52 248 L42 248 C40 236 38 220 40 206Z" fill={m("calves")} />
      <path d="M80 206 L66 206 L68 248 L78 248 C80 236 82 220 80 206Z" fill={m("calves")} />
      {/* Knees (neutral) */}
      <ellipse cx="47" cy="203" rx="7" ry="5" fill="#c9cfd8" />
      <ellipse cx="73" cy="203" rx="7" ry="5" fill="#c9cfd8" />
      {/* Hands (neutral) */}
      <ellipse cx="30" cy="128" rx="5" ry="6" fill="#c9cfd8" />
      <ellipse cx="90" cy="128" rx="5" ry="6" fill="#c9cfd8" />
      {/* Outline */}
      <path d="M60 4 C48 4 46 14 46 18 C46 26 50 32 54 34 L54 38 L38 42 C32 42 28 50 30 58 L28 90 C24 100 24 112 26 124 L30 130 M60 4 C72 4 74 14 74 18 C74 26 70 32 66 34 L66 38 L82 42 C88 42 92 50 90 58 L92 90 C96 100 96 112 94 124 L90 130" stroke="#a0a8b4" strokeWidth="0.8" fill="none" />
    </svg>
  );
}

// Back body SVG paths
function BackBody({ m }: { m: (group: string) => string }) {
  return (
    <svg viewBox="0 0 120 260" width="55" height="120" fill="none">
      {/* Head */}
      <ellipse cx="60" cy="18" rx="12" ry="14" fill="#c9cfd8" />
      {/* Neck */}
      <rect x="54" y="30" width="12" height="8" rx="3" fill="#c9cfd8" />
      {/* Back / Lats */}
      <path d="M38 42 L82 42 L84 72 C84 82 74 90 60 90 C46 90 36 82 36 72 Z" fill={m("back")} />
      {/* Shoulders (rear) */}
      <path d="M38 42 C32 42 28 50 30 58 L38 58 L38 42Z" fill={m("shoulders")} />
      <path d="M82 42 C88 42 92 50 90 58 L82 58 L82 42Z" fill={m("shoulders")} />
      {/* Lower back */}
      <path d="M44 90 L76 90 L74 130 C74 134 68 136 60 136 C52 136 46 134 46 130 Z" fill={m("back")} opacity="0.7" />
      {/* Triceps */}
      <path d="M30 58 L38 58 L36 90 L28 90 C26 80 26 68 30 58Z" fill={m("triceps")} />
      <path d="M90 58 L82 58 L84 90 L92 90 C94 80 94 68 90 58Z" fill={m("triceps")} />
      {/* Forearms */}
      <path d="M28 90 L36 90 L34 124 L26 124 C24 112 24 100 28 90Z" fill={m("forearms")} />
      <path d="M92 90 L84 90 L86 124 L94 124 C96 112 96 100 92 90Z" fill={m("forearms")} />
      {/* Glutes */}
      <path d="M44 130 L76 130 L78 156 C78 162 70 166 60 166 C50 166 42 162 42 156 Z" fill={m("glutes")} />
      {/* Hamstrings */}
      <path d="M42 166 L58 166 L54 210 L38 210 C36 194 36 178 42 166Z" fill={m("hamstrings")} />
      <path d="M78 166 L62 166 L66 210 L82 210 C84 194 84 178 78 166Z" fill={m("hamstrings")} />
      {/* Calves */}
      <path d="M38 216 L54 216 L52 248 L42 248 C40 236 38 226 38 216Z" fill={m("calves")} />
      <path d="M82 216 L66 216 L68 248 L78 248 C80 236 82 226 82 216Z" fill={m("calves")} />
      {/* Knees (neutral) */}
      <ellipse cx="46" cy="213" rx="7" ry="5" fill="#c9cfd8" />
      <ellipse cx="74" cy="213" rx="7" ry="5" fill="#c9cfd8" />
      {/* Hands */}
      <ellipse cx="30" cy="128" rx="5" ry="6" fill="#c9cfd8" />
      <ellipse cx="90" cy="128" rx="5" ry="6" fill="#c9cfd8" />
    </svg>
  );
}

export function MuscleDiagram({ muscleData }: MuscleDiagramProps) {
  const m = (group: string): string => {
    const d = muscleData[group];
    if (!d) return BASE;
    return getColor(d.sets);
  };

  const hasData = Object.values(muscleData).some((d) => d.sets > 0);
  if (!hasData) return null;

  return (
    <div>
      <div style={{ fontSize: 8, fontWeight: 700, color: "#9ca3af", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        Muscles
      </div>
      <div style={{ display: "flex", gap: 2, justifyContent: "center" }}>
        <FrontBody m={m} />
        <BackBody m={m} />
      </div>
      {/* Legend */}
      <div style={{ display: "flex", gap: 2, justifyContent: "center", marginTop: 3 }}>
        {[
          { color: "#dce1e8", label: "0" },
          { color: "#f8a4a4", label: "1-4" },
          { color: "#ef4444", label: "5-9" },
          { color: "#dc2626", label: "10+" },
        ].map((l) => (
          <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 2, fontSize: 7, color: "#9ca3af" }}>
            <span style={{ width: 6, height: 6, borderRadius: 1, background: l.color, display: "inline-block" }} />
            {l.label}
          </div>
        ))}
      </div>
    </div>
  );
}
