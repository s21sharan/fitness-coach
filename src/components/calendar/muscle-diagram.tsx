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
const SKIN = "#d4d9e1";
const OUTLINE = "#a0a8b4";
const SEPARATOR = "#b8bfc9";

function FrontBody({ m }: { m: (group: string) => string }) {
  return (
    <svg viewBox="0 0 200 480" width="46" height="110" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Head */}
      <ellipse cx="100" cy="28" rx="18" ry="22" fill={SKIN} />
      {/* Neck */}
      <path d="M90 48 L90 62 Q90 66 94 66 L106 66 Q110 66 110 62 L110 48" fill={SKIN} />

      {/* ── Shoulders / Delts ── */}
      {/* Left delt */}
      <path d="M68 72 Q52 70 44 82 Q40 92 42 104 L54 104 L62 80 Z" fill={m("shoulders")} />
      {/* Right delt */}
      <path d="M132 72 Q148 70 156 82 Q160 92 158 104 L146 104 L138 80 Z" fill={m("shoulders")} />

      {/* ── Chest / Pecs ── */}
      {/* Left pec */}
      <path d="M68 72 L96 72 L96 80 Q96 108 78 112 Q64 114 58 106 L62 80 Z" fill={m("chest")} />
      {/* Right pec */}
      <path d="M132 72 L104 72 L104 80 Q104 108 122 112 Q136 114 142 106 L138 80 Z" fill={m("chest")} />
      {/* Sternum line */}
      <line x1="100" y1="74" x2="100" y2="110" stroke={SEPARATOR} strokeWidth="0.6" />

      {/* ── Core / Abs ── */}
      {/* Left abs */}
      <path d="M78 114 Q82 112 96 112 L96 172 Q96 178 88 180 L76 178 Q68 174 68 166 L68 136 Q68 118 78 114Z" fill={m("core")} />
      {/* Right abs */}
      <path d="M122 114 Q118 112 104 112 L104 172 Q104 178 112 180 L124 178 Q132 174 132 166 L132 136 Q132 118 122 114Z" fill={m("core")} />
      {/* Ab segment lines */}
      <line x1="72" y1="126" x2="96" y2="126" stroke={SEPARATOR} strokeWidth="0.5" />
      <line x1="72" y1="142" x2="96" y2="142" stroke={SEPARATOR} strokeWidth="0.5" />
      <line x1="74" y1="158" x2="96" y2="158" stroke={SEPARATOR} strokeWidth="0.5" />
      <line x1="104" y1="126" x2="128" y2="126" stroke={SEPARATOR} strokeWidth="0.5" />
      <line x1="104" y1="142" x2="128" y2="142" stroke={SEPARATOR} strokeWidth="0.5" />
      <line x1="104" y1="158" x2="126" y2="158" stroke={SEPARATOR} strokeWidth="0.5" />
      {/* Linea alba */}
      <line x1="100" y1="112" x2="100" y2="178" stroke={SEPARATOR} strokeWidth="0.6" />

      {/* ── Biceps ── */}
      {/* Left bicep */}
      <path d="M42 104 Q36 106 34 118 Q32 134 36 148 L50 148 Q56 134 56 118 Q56 108 54 104 Z" fill={m("biceps")} />
      {/* Right bicep */}
      <path d="M158 104 Q164 106 166 118 Q168 134 164 148 L150 148 Q144 134 144 118 Q144 108 146 104 Z" fill={m("biceps")} />

      {/* ── Forearms ── */}
      {/* Left forearm */}
      <path d="M36 150 Q30 152 28 170 Q26 192 30 210 L44 208 Q48 190 48 170 Q50 154 50 150 Z" fill={m("forearms")} />
      {/* Right forearm */}
      <path d="M164 150 Q170 152 172 170 Q174 192 170 210 L156 208 Q152 190 152 170 Q150 154 150 150 Z" fill={m("forearms")} />

      {/* Hands */}
      <ellipse cx="37" cy="218" rx="8" ry="10" fill={SKIN} />
      <ellipse cx="163" cy="218" rx="8" ry="10" fill={SKIN} />

      {/* ── Quads ── */}
      {/* Left inner quad */}
      <path d="M88 182 L98 182 Q100 220 100 260 L98 310 Q96 320 90 322 L86 318 Q82 300 80 270 Q78 240 80 210 Q82 192 88 182Z" fill={m("quads")} />
      {/* Left outer quad */}
      <path d="M68 178 L86 182 Q82 192 80 210 Q78 240 80 270 Q82 300 84 316 L78 320 Q66 316 62 300 Q56 270 56 240 Q56 210 60 192 Q64 180 68 178Z" fill={m("quads")} />
      {/* Right inner quad */}
      <path d="M112 182 L102 182 Q100 220 100 260 L102 310 Q104 320 110 322 L114 318 Q118 300 120 270 Q122 240 120 210 Q118 192 112 182Z" fill={m("quads")} />
      {/* Right outer quad */}
      <path d="M132 178 L114 182 Q118 192 120 210 Q122 240 120 270 Q118 300 116 316 L122 320 Q134 316 138 300 Q144 270 144 240 Q144 210 140 192 Q136 180 132 178Z" fill={m("quads")} />
      {/* Quad separation lines */}
      <path d="M80 210 Q82 260 84 316" stroke={SEPARATOR} strokeWidth="0.5" fill="none" />
      <path d="M120 210 Q118 260 116 316" stroke={SEPARATOR} strokeWidth="0.5" fill="none" />

      {/* Kneecaps */}
      <ellipse cx="82" cy="326" rx="12" ry="8" fill={SKIN} />
      <ellipse cx="118" cy="326" rx="12" ry="8" fill={SKIN} />

      {/* ── Calves (front / tibialis) ── */}
      {/* Left calf */}
      <path d="M68 336 L92 336 Q94 360 92 390 Q90 420 88 440 L72 440 Q68 420 66 390 Q64 360 68 336Z" fill={m("calves")} />
      {/* Right calf */}
      <path d="M132 336 L108 336 Q106 360 108 390 Q110 420 112 440 L128 440 Q132 420 134 390 Q136 360 132 336Z" fill={m("calves")} />

      {/* Feet */}
      <path d="M70 442 L90 442 Q92 448 92 454 L68 454 Q66 448 70 442Z" fill={SKIN} />
      <path d="M130 442 L110 442 Q108 448 108 454 L132 454 Q134 448 130 442Z" fill={SKIN} />

      {/* ── Body outline ── */}
      {/* Left side */}
      <path d="M82 48 Q68 52 58 66 Q48 68 44 82 Q38 96 36 118 Q32 138 36 150 Q30 156 28 176 Q26 200 30 214"
        stroke={OUTLINE} strokeWidth="0.8" fill="none" />
      <path d="M68 178 Q56 186 56 210 Q54 250 58 290 Q62 316 68 336 Q64 350 64 390 Q66 430 70 442"
        stroke={OUTLINE} strokeWidth="0.8" fill="none" />
      {/* Right side */}
      <path d="M118 48 Q132 52 142 66 Q152 68 156 82 Q162 96 164 118 Q168 138 164 150 Q170 156 172 176 Q174 200 170 214"
        stroke={OUTLINE} strokeWidth="0.8" fill="none" />
      <path d="M132 178 Q144 186 144 210 Q146 250 142 290 Q138 316 132 336 Q136 350 136 390 Q134 430 130 442"
        stroke={OUTLINE} strokeWidth="0.8" fill="none" />
    </svg>
  );
}

function BackBody({ m }: { m: (group: string) => string }) {
  return (
    <svg viewBox="0 0 200 480" width="46" height="110" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Head */}
      <ellipse cx="100" cy="28" rx="18" ry="22" fill={SKIN} />
      {/* Neck */}
      <path d="M90 48 L90 62 Q90 66 94 66 L106 66 Q110 66 110 62 L110 48" fill={SKIN} />

      {/* ── Trapezius (upper back, neutral) ── */}
      <path d="M80 58 L100 66 L120 58 Q126 64 130 72 L100 82 L70 72 Q74 64 80 58Z" fill={SKIN} />

      {/* ── Shoulders / Rear Delts ── */}
      <path d="M68 72 Q52 70 44 82 Q40 92 42 104 L54 104 L62 80 Z" fill={m("shoulders")} />
      <path d="M132 72 Q148 70 156 82 Q160 92 158 104 L146 104 L138 80 Z" fill={m("shoulders")} />

      {/* ── Back / Lats ── */}
      {/* Left lat */}
      <path d="M68 72 L96 78 L96 130 Q96 140 86 144 Q72 146 66 138 L62 114 L62 80 Z" fill={m("back")} />
      {/* Right lat */}
      <path d="M132 72 L104 78 L104 130 Q104 140 114 144 Q128 146 134 138 L138 114 L138 80 Z" fill={m("back")} />
      {/* Spine line */}
      <line x1="100" y1="78" x2="100" y2="142" stroke={SEPARATOR} strokeWidth="0.6" />
      {/* Lat muscle fiber hints */}
      <path d="M70 90 Q82 95 94 98" stroke={SEPARATOR} strokeWidth="0.4" fill="none" />
      <path d="M68 108 Q80 114 94 116" stroke={SEPARATOR} strokeWidth="0.4" fill="none" />
      <path d="M130 90 Q118 95 106 98" stroke={SEPARATOR} strokeWidth="0.4" fill="none" />
      <path d="M132 108 Q120 114 106 116" stroke={SEPARATOR} strokeWidth="0.4" fill="none" />

      {/* ── Lower Back / Erectors ── */}
      {/* Left erector */}
      <path d="M86 146 Q90 144 96 142 L96 178 Q92 182 86 180 L74 178 Q68 174 68 168 L68 158 Q68 150 86 146Z" fill={m("back")} opacity="0.7" />
      {/* Right erector */}
      <path d="M114 146 Q110 144 104 142 L104 178 Q108 182 114 180 L126 178 Q132 174 132 168 L132 158 Q132 150 114 146Z" fill={m("back")} opacity="0.7" />
      <line x1="100" y1="142" x2="100" y2="178" stroke={SEPARATOR} strokeWidth="0.5" />

      {/* ── Triceps ── */}
      {/* Left tricep */}
      <path d="M42 104 Q36 106 34 118 Q32 134 36 148 L50 148 Q56 134 56 118 Q56 108 54 104 Z" fill={m("triceps")} />
      {/* Right tricep */}
      <path d="M158 104 Q164 106 166 118 Q168 134 164 148 L150 148 Q144 134 144 118 Q144 108 146 104 Z" fill={m("triceps")} />
      {/* Tricep separation lines (horseshoe hint) */}
      <path d="M40 118 Q44 130 44 144" stroke={SEPARATOR} strokeWidth="0.4" fill="none" />
      <path d="M160 118 Q156 130 156 144" stroke={SEPARATOR} strokeWidth="0.4" fill="none" />

      {/* ── Forearms ── */}
      <path d="M36 150 Q30 152 28 170 Q26 192 30 210 L44 208 Q48 190 48 170 Q50 154 50 150 Z" fill={m("forearms")} />
      <path d="M164 150 Q170 152 172 170 Q174 192 170 210 L156 208 Q152 190 152 170 Q150 154 150 150 Z" fill={m("forearms")} />

      {/* Hands */}
      <ellipse cx="37" cy="218" rx="8" ry="10" fill={SKIN} />
      <ellipse cx="163" cy="218" rx="8" ry="10" fill={SKIN} />

      {/* ── Glutes ── */}
      {/* Left glute */}
      <path d="M74 178 L96 178 Q98 190 98 200 Q98 214 90 220 Q78 224 70 216 Q64 208 64 196 Q64 186 74 178Z" fill={m("glutes")} />
      {/* Right glute */}
      <path d="M126 178 L104 178 Q102 190 102 200 Q102 214 110 220 Q122 224 130 216 Q136 208 136 196 Q136 186 126 178Z" fill={m("glutes")} />
      {/* Glute separation */}
      <line x1="100" y1="178" x2="100" y2="218" stroke={SEPARATOR} strokeWidth="0.5" />

      {/* ── Hamstrings ── */}
      {/* Left inner hamstring */}
      <path d="M90 222 L98 222 Q100 250 100 280 L98 316 Q96 322 90 324 L86 320 Q82 300 82 270 Q82 240 86 222Z" fill={m("hamstrings")} />
      {/* Left outer hamstring */}
      <path d="M68 218 L88 222 Q84 240 82 270 Q82 300 84 318 L78 322 Q66 318 62 302 Q56 272 58 242 Q60 222 68 218Z" fill={m("hamstrings")} />
      {/* Right inner hamstring */}
      <path d="M110 222 L102 222 Q100 250 100 280 L102 316 Q104 322 110 324 L114 320 Q118 300 118 270 Q118 240 114 222Z" fill={m("hamstrings")} />
      {/* Right outer hamstring */}
      <path d="M132 218 L112 222 Q116 240 118 270 Q118 300 116 318 L122 322 Q134 318 138 302 Q144 272 142 242 Q140 222 132 218Z" fill={m("hamstrings")} />
      {/* Hamstring separation */}
      <path d="M82 240 Q84 280 84 318" stroke={SEPARATOR} strokeWidth="0.4" fill="none" />
      <path d="M118 240 Q116 280 116 318" stroke={SEPARATOR} strokeWidth="0.4" fill="none" />

      {/* Knees */}
      <ellipse cx="82" cy="328" rx="12" ry="8" fill={SKIN} />
      <ellipse cx="118" cy="328" rx="12" ry="8" fill={SKIN} />

      {/* ── Calves (gastrocnemius) ── */}
      {/* Left calf */}
      <path d="M68 338 Q74 336 82 336 L92 338 Q96 360 94 386 Q92 412 88 440 L72 440 Q68 412 66 386 Q64 360 68 338Z" fill={m("calves")} />
      {/* Right calf */}
      <path d="M132 338 Q126 336 118 336 L108 338 Q104 360 106 386 Q108 412 112 440 L128 440 Q132 412 134 386 Q136 360 132 338Z" fill={m("calves")} />
      {/* Calf diamond shape hint */}
      <path d="M74 346 Q80 368 80 390" stroke={SEPARATOR} strokeWidth="0.4" fill="none" />
      <path d="M126 346 Q120 368 120 390" stroke={SEPARATOR} strokeWidth="0.4" fill="none" />

      {/* Feet */}
      <path d="M70 442 L90 442 Q92 448 92 454 L68 454 Q66 448 70 442Z" fill={SKIN} />
      <path d="M130 442 L110 442 Q108 448 108 454 L132 454 Q134 448 130 442Z" fill={SKIN} />

      {/* ── Body outline ── */}
      <path d="M82 48 Q68 52 58 66 Q48 68 44 82 Q38 96 36 118 Q32 138 36 150 Q30 156 28 176 Q26 200 30 214"
        stroke={OUTLINE} strokeWidth="0.8" fill="none" />
      <path d="M66 218 Q56 226 56 250 Q56 280 60 308 Q64 328 68 338 Q64 360 64 390 Q66 430 70 442"
        stroke={OUTLINE} strokeWidth="0.8" fill="none" />
      <path d="M118 48 Q132 52 142 66 Q152 68 156 82 Q162 96 164 118 Q168 138 164 150 Q170 156 172 176 Q174 200 170 214"
        stroke={OUTLINE} strokeWidth="0.8" fill="none" />
      <path d="M134 218 Q144 226 144 250 Q144 280 140 308 Q136 328 132 338 Q136 360 136 390 Q134 430 130 442"
        stroke={OUTLINE} strokeWidth="0.8" fill="none" />
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
      <div style={{ display: "flex", gap: 4, justifyContent: "center", alignItems: "flex-start" }}>
        <div style={{ textAlign: "center" }}>
          <FrontBody m={m} />
          <div style={{ fontSize: 7, fontWeight: 600, color: "#9ca3af", marginTop: 2 }}>Front</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <BackBody m={m} />
          <div style={{ fontSize: 7, fontWeight: 600, color: "#9ca3af", marginTop: 2 }}>Back</div>
        </div>
      </div>
      {/* Legend */}
      <div style={{ display: "flex", gap: 4, justifyContent: "center", marginTop: 4 }}>
        {[
          { color: "#dce1e8", label: "0" },
          { color: "#f8a4a4", label: "1-4" },
          { color: "#ef4444", label: "5-9" },
          { color: "#dc2626", label: "10+" },
        ].map((l) => (
          <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 2, fontSize: 7, color: "#9ca3af", fontWeight: 600 }}>
            <span style={{ width: 6, height: 6, borderRadius: 1, background: l.color, display: "inline-block" }} />
            {l.label}
          </div>
        ))}
      </div>
    </div>
  );
}
