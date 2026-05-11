interface MuscleDiagramProps {
  muscleData: Record<string, { sets: number; volume: number }>;
}

function getIntensityColor(sets: number): string {
  if (sets === 0) return "#f3f4f6";
  if (sets <= 4) return "#bfdbfe";
  if (sets <= 9) return "#60a5fa";
  if (sets <= 14) return "#2563eb";
  return "#1e3a5f";
}

function getTextColor(sets: number): string {
  if (sets >= 10) return "#ffffff";
  return "#1f2937";
}

interface MuscleCardProps {
  label: string;
  muscleKey: string;
  muscleData: Record<string, { sets: number; volume: number }>;
  style?: React.CSSProperties;
}

function MuscleCard({ label, muscleKey, muscleData, style }: MuscleCardProps) {
  const data = muscleData[muscleKey];
  const sets = data?.sets ?? 0;
  const bg = getIntensityColor(sets);
  const color = getTextColor(sets);

  return (
    <div
      style={{
        backgroundColor: bg,
        color,
        borderRadius: 4,
        padding: "3px 4px",
        textAlign: "center",
        fontSize: 10,
        lineHeight: 1.3,
        border: "1px solid rgba(0,0,0,0.08)",
        minWidth: 0,
        ...style,
      }}
      title={`${label}: ${sets} sets`}
    >
      <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {label}
      </div>
      <div style={{ opacity: 0.85 }}>{sets}s</div>
    </div>
  );
}

const LEGEND_STEPS = [
  { label: "0", color: "#f3f4f6" },
  { label: "1–4", color: "#bfdbfe" },
  { label: "5–9", color: "#60a5fa" },
  { label: "10–14", color: "#2563eb" },
  { label: "15+", color: "#1e3a5f" },
];

export function MuscleDiagram({ muscleData }: MuscleDiagramProps) {
  return (
    <div style={{ width: 180, fontFamily: "inherit" }}>
      {/* Body grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gridTemplateRows: "repeat(8, auto)",
          gap: 3,
        }}
      >
        {/* Row 1: Shoulders (spans middle) */}
        <div style={{ gridColumn: "1 / 4", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 3 }}>
          <div />
          <MuscleCard label="Shoulders" muscleKey="shoulders" muscleData={muscleData} />
          <div />
        </div>

        {/* Row 2: Biceps | Chest | Triceps */}
        <MuscleCard label="Biceps" muscleKey="biceps" muscleData={muscleData} />
        <MuscleCard label="Chest" muscleKey="chest" muscleData={muscleData} />
        <MuscleCard label="Triceps" muscleKey="triceps" muscleData={muscleData} />

        {/* Row 3: Back (center span) */}
        <div style={{ gridColumn: "1 / 4", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 3 }}>
          <div />
          <MuscleCard label="Back" muscleKey="back" muscleData={muscleData} />
          <div />
        </div>

        {/* Row 4: Core (center span) */}
        <div style={{ gridColumn: "1 / 4", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 3 }}>
          <div />
          <MuscleCard label="Core" muscleKey="core" muscleData={muscleData} />
          <div />
        </div>

        {/* Row 5: Forearms (center span) */}
        <div style={{ gridColumn: "1 / 4", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 3 }}>
          <div />
          <MuscleCard label="Forearms" muscleKey="forearms" muscleData={muscleData} />
          <div />
        </div>

        {/* Row 6: Quads | gap | Glutes */}
        <MuscleCard label="Quads" muscleKey="quads" muscleData={muscleData} />
        <div />
        <MuscleCard label="Glutes" muscleKey="glutes" muscleData={muscleData} />

        {/* Row 7: Hamstrings (center span) */}
        <div style={{ gridColumn: "1 / 4", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 3 }}>
          <div />
          <MuscleCard label="Hams" muscleKey="hamstrings" muscleData={muscleData} />
          <div />
        </div>

        {/* Row 8: Calves (center span) */}
        <div style={{ gridColumn: "1 / 4", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 3 }}>
          <div />
          <MuscleCard label="Calves" muscleKey="calves" muscleData={muscleData} />
          <div />
        </div>
      </div>

      {/* Legend */}
      <div style={{ marginTop: 8 }}>
        <div
          style={{
            fontSize: 9,
            color: "#6b7280",
            marginBottom: 3,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          Sets / week
        </div>
        <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
          {LEGEND_STEPS.map((step) => (
            <div key={step.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
              <div
                style={{
                  width: "100%",
                  height: 8,
                  backgroundColor: step.color,
                  border: "1px solid rgba(0,0,0,0.08)",
                  borderRadius: 2,
                }}
              />
              <div style={{ fontSize: 8, color: "#9ca3af", marginTop: 2, whiteSpace: "nowrap" }}>
                {step.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
