import { Topbar } from "@/components/topbar";
import { WeekSummary } from "@/components/review/week-summary";
import { StatCard } from "@/components/review/stat-card";
import { Sparkline } from "@/components/app/sparkline";
import { Bars } from "@/components/app/bars";
import { Heatmap } from "@/components/app/heatmap";

export default function ReviewPage() {
  return (
    <>
      <Topbar title="Weekly Review" subtitle="Week 18 of 2026" />
      <div className="main">
        <WeekSummary />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 14,
            marginBottom: 14,
          }}
        >
          <StatCard label="Sessions" value="5/5" delta="+1" tone="coral" sub="vs last week" />
          <StatCard label="Sleep avg" value="7h 12m" delta="+22m" tone="sky" sub="7.0 target" />
          <StatCard label="HRV avg" value="68" delta="+6" tone="mint" sub="14d baseline 56" />
          <StatCard label="Cal adherence" value="96%" delta="+4%" tone="lemon" sub="2,400 / day" />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.6fr 1fr",
            gap: 14,
            marginBottom: 14,
          }}
        >
          <div className="card">
            <div className="eyebrow">Training load · acute vs chronic</div>
            <h3 style={{ margin: "4px 0 14px", fontSize: 18, fontWeight: 800 }}>
              Optimal · ratio 1.12
            </h3>
            <Sparkline
              points={[42, 45, 48, 52, 58, 62, 65, 68, 70, 72, 74, 76, 78, 82, 84, 86]}
              width={520}
              height={140}
              color="var(--coral-deep)"
            />
          </div>
          <div className="card">
            <div className="eyebrow">PR progression · Bench</div>
            <h3 style={{ margin: "4px 0 14px", fontSize: 18, fontWeight: 800 }}>
              225 lb · +5 this week
            </h3>
            <Bars
              width={300}
              height={140}
              data={[
                { l: "W14", v: 200 },
                { l: "W15", v: 205 },
                { l: "W16", v: 210 },
                { l: "W17", v: 220 },
                { l: "W18", v: 225, active: true },
              ]}
              color="var(--ink)"
            />
          </div>
        </div>

        <div className="card" style={{ padding: 24 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 14,
            }}
          >
            <div>
              <div className="eyebrow">Last 20 weeks · adherence</div>
              <h3 style={{ margin: "4px 0 0", fontSize: 18, fontWeight: 800 }}>
                You showed up.
              </h3>
            </div>
            <div
              style={{
                fontSize: 11,
                color: "var(--muted)",
                fontWeight: 600,
              }}
            >
              92% adherence
            </div>
          </div>
          <Heatmap weeks={20} />
        </div>
      </div>
    </>
  );
}
