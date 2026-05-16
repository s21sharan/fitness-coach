"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FitnessChart } from "@/components/charts/fitness-chart";
import {
  RecoveryTrendChart, TrainingLoadChart,
  type RecoveryPoint,
} from "@/components/charts/recovery-charts";
import { HrZoneTabs } from "@/components/charts/hr-zone-tabs";
import { Vo2Chart } from "@/components/charts/vo2-chart";
import { ChartModal } from "@/components/charts/chart-modal";
import { ChartCard } from "@/components/charts/chart-card";
import { ConnectionBar } from "@/components/app/connection-bar";
import { RacePredictorChart } from "@/components/charts/race-predictor-card";
import { E1rmTrajectoryChart } from "@/components/charts/e1rm-trajectory-chart";
import { FitnessForecastChart } from "@/components/charts/fitness-forecast-chart";
import { chartColors } from "@/components/charts/chart-theme";
import { useDashboardData } from "@/lib/hooks/use-dashboard-data";
import { computeFitnessCurve, computeLoadByType, computeVo2Trend } from "@/lib/training/calendar-data";
import { computeE1rmTrajectory, forecastFitness, predictRaceTimes } from "@/lib/training/predictions";
import { getUnitPreferences } from "@/lib/units";

type ModalKey = "fitness" | "hrv" | "sleep" | "rhr" | "hrzones" | "load" | "vo2" | "race" | "e1rm" | "forecast" | null;

export default function AnalyticsPage() {
  const { data, loading, syncing, fixingDates, triggerSync, triggerFixDates } = useDashboardData();
  const [modal, setModal] = useState<ModalKey>(null);
  const [insights, setInsights] = useState<Record<string, string>>({});
  const [insightLoading, setInsightLoading] = useState<string | null>(null);

  const fitnessCurve = useMemo(() => data ? computeFitnessCurve(data, 90) : [], [data]);
  const recoveryData: RecoveryPoint[] = useMemo(() => {
    if (!data) return [];
    return [...data.recovery].sort((a, b) => a.date.localeCompare(b.date));
  }, [data]);
  const loadByType = useMemo(() => data ? computeLoadByType(data, 12) : [], [data]);
  const vo2Trend = useMemo(() => data ? computeVo2Trend(data) : [], [data]);
  const racePredictions = useMemo(() => data ? predictRaceTimes(data.cardio) : [], [data]);
  const e1rmSeries = useMemo(() => data ? computeE1rmTrajectory(data.workouts, 28) : [], [data]);
  const fitnessForecast = useMemo(() => forecastFitness(fitnessCurve, 14), [fitnessCurve]);
  const weightUnit = useMemo(() => getUnitPreferences().weight, []);
  const hasGarmin = useMemo(
    () => !!data && data.integrations.some((i) => i.provider === "garmin"),
    [data],
  );

  const fetchInsight = useCallback(async (section: string) => {
    if (insights[section]) return;
    setInsightLoading(section);
    try {
      const res = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section }),
      });
      if (res.ok) {
        const { insight } = await res.json();
        setInsights((prev) => ({ ...prev, [section]: insight }));
      }
    } catch { /* ignore */ }
    setInsightLoading(null);
  }, [insights]);

  useEffect(() => {
    if (modal === "fitness") fetchInsight("fitness");
    else if (modal === "hrzones" || modal === "load" || modal === "vo2") fetchInsight("training");
    else if (modal && ["hrv", "sleep", "rhr"].includes(modal)) fetchInsight("recovery");
  }, [modal, fetchInsight]);

  const insightFor = (section: string) => insights[section] || null;
  const isLoadingInsight = (section: string) => insightLoading === section;

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", paddingTop: 120 }}>
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-black" />
      </div>
    );
  }
  if (!data) return <p style={{ padding: 32, color: "#6b7280" }}>Failed to load data.</p>;

  return (
    <div style={{ padding: "16px 20px 40px", maxWidth: 1600, margin: "0 auto" }}>
      <ConnectionBar
        integrations={data.integrations}
        syncing={syncing}
        onSync={triggerSync}
        fixingDates={fixingDates}
        onFixDates={triggerFixDates}
      />

      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", letterSpacing: "-0.02em", margin: 0 }}>Analytics</h1>
        <p style={{ fontSize: 12, color: "#6b7280", margin: "4px 0 0" }}>Trends from the last 90 days. Click any chart to expand and view AI coaching notes.</p>
      </div>

      {/* Row 1 — Training story */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 14, marginBottom: 14 }}>
        <div style={{ gridColumn: "span 2" }}>
          <ChartCard
            title="Fitness Trend"
            description="How your training is stacking up. Green is fresh, red is fatigued."
            onClick={() => setModal("fitness")}
            accent={chartColors.fitness}
          >
            <FitnessChart data={fitnessCurve} compact />
          </ChartCard>
        </div>
        <div style={{ gridColumn: "span 2" }}>
          <ChartCard
            title="Weekly Load"
            description="How hard you trained each week, by activity."
            onClick={() => setModal("load")}
            accent={chartColors.load}
          >
            <TrainingLoadChart data={loadByType} compact />
          </ChartCard>
        </div>
      </div>

      {/* Row — Predictions */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14, marginBottom: 14 }}>
        <ChartCard
          title="Race-time Predictions"
          description="From your recent runs, using the Riegel formula."
          onClick={() => setModal("race")}
          accent={chartColors.byType.run}
        >
          <RacePredictorChart predictions={racePredictions} compact />
        </ChartCard>
        <ChartCard
          title="Lift Trajectory"
          description="Estimated 1RM trend and a 4-week projection for your main lifts."
          onClick={() => setModal("e1rm")}
          accent={chartColors.byType.lift}
        >
          <E1rmTrajectoryChart series={e1rmSeries} weightUnit={weightUnit} compact />
        </ChartCard>
        <ChartCard
          title="Fitness Forecast"
          description="Where fitness, fatigue, and form go if you hold current training load."
          onClick={() => setModal("forecast")}
          accent={chartColors.fitness}
        >
          <FitnessForecastChart forecast={fitnessForecast} compact />
        </ChartCard>
      </div>

      {/* Row — Heart rate (HR Zones always; VO2 Max only with Garmin) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 14, marginBottom: 14 }}>
        <div style={{ gridColumn: hasGarmin ? "span 2" : "span 4" }}>
          <ChartCard
            title="Heart Rate Zones"
            description="Where your heart rate spent its time. Switch sport to compare."
            onClick={() => setModal("hrzones")}
            accent={chartColors.zones[1]}
          >
            <HrZoneTabs cardio={data.cardio} boundaries={data.hrZones?.boundaries ?? null} compact />
          </ChartCard>
        </div>
        {hasGarmin && (
          <div style={{ gridColumn: "span 2" }}>
            <ChartCard
              title="VO2 Max"
              description="Aerobic capacity estimate from Garmin run and bike activities."
              onClick={() => setModal("vo2")}
              accent={chartColors.vo2}
            >
              <Vo2Chart data={vo2Trend} compact />
            </ChartCard>
          </div>
        )}
      </div>

      {/* Row — Recovery (Garmin-only; entire row hidden when no health source) */}
      {hasGarmin && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14, marginBottom: 14 }}>
          <ChartCard title="HRV" description="Higher is better. A drop can mean fatigue or illness." onClick={() => setModal("hrv")} accent={chartColors.hrv}>
            <RecoveryTrendChart data={recoveryData} dataKey="hrv" color={chartColors.hrv} label="HRV" unit="" compact />
          </ChartCard>
          <ChartCard title="Sleep" description="Hours per night. 7–9 is the sweet spot." onClick={() => setModal("sleep")} accent={chartColors.sleep}>
            <RecoveryTrendChart data={recoveryData} dataKey="sleep_hours" color={chartColors.sleep} label="Sleep" unit="h" compact />
          </ChartCard>
          <ChartCard title="Resting HR" description="Lower trends usually mean better aerobic fitness." onClick={() => setModal("rhr")} accent={chartColors.rhr}>
            <RecoveryTrendChart data={recoveryData} dataKey="resting_hr" color={chartColors.rhr} label="RHR" unit=" bpm" compact />
          </ChartCard>
        </div>
      )}

      {!hasGarmin && (
        <div
          style={{
            background: "#f9fafb",
            border: "1px dashed #d1d5db",
            borderRadius: 12,
            padding: "16px 18px",
            fontSize: 12,
            color: chartColors.textMuted,
            marginBottom: 14,
            lineHeight: 1.55,
          }}
        >
          <b style={{ color: chartColors.textPrimary }}>Health metrics hidden.</b> Recovery data (HRV, sleep,
          resting HR, VO2 max) needs a wearable connected. Garmin is available as a beta integration in{" "}
          <a href="/dashboard/settings" style={{ color: chartColors.fitness, fontWeight: 700 }}>Settings → Integrations</a>.
        </div>
      )}

      <ChartModal open={modal === "fitness"} onClose={() => setModal(null)} title="Fitness Trend" insight={insightFor("fitness")} insightLoading={isLoadingInsight("fitness")}>
        <p style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.6, margin: "0 0 16px" }}>
          <b>Fitness</b> is the long-term load you{"'"}ve built up — your training capacity. <b>Fatigue</b> is short-term tiredness from the past week. <b>Form</b> is fitness minus fatigue: positive means you{"'"}re fresh and ready to race, negative means you{"'"}re absorbing hard training. A small positive number (around +5 to +25) is the sweet spot before a big effort.
        </p>
        <FitnessChart data={fitnessCurve} />
      </ChartModal>

      <ChartModal open={modal === "hrzones"} onClose={() => setModal(null)} title="Heart Rate Zones" insight={insightFor("training")} insightLoading={isLoadingInsight("training")}>
        <p style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.6, margin: "0 0 16px" }}>
          {(() => {
            const bs = data?.hrZones?.boundaries;
            const r = (i: number) => {
              if (!bs || bs.length !== 5) return ["<120 bpm", "120-140", "140-155", "155-170", "170+"][i];
              const b = bs[i];
              return i === 0 ? `<${b.high} bpm` : i === 4 ? `${b.low}+ bpm` : `${b.low}-${b.high}`;
            };
            return (
              <>
                <b>Z1 Recovery</b> ({r(0)}): warm-up and easy days. <b>Z2 Aerobic</b> ({r(1)}): base building — aim for most of your time here. <b>Z3 Tempo</b> ({r(2)}): sustainable hard effort. <b>Z4 Threshold</b> ({r(3)}): race pace. <b>Z5 Anaerobic</b> ({r(4)}): max intervals. A common target is roughly 80% easy, 20% hard.
                {data?.hrZones?.source === "garmin" && (
                  <span style={{ display: "block", marginTop: 8, fontSize: 11, color: "#9ca3af" }}>Zones synced from your Garmin settings.</span>
                )}
              </>
            );
          })()}
        </p>
        <HrZoneTabs cardio={data.cardio} boundaries={data.hrZones?.boundaries ?? null} />
      </ChartModal>

      <ChartModal open={modal === "load"} onClose={() => setModal(null)} title="Weekly Load" insight={insightFor("training")} insightLoading={isLoadingInsight("training")}>
        <p style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.6, margin: "0 0 16px" }}>
          Each bar is one week of training, stacked by activity type. Load is estimated from heart rate intensity and duration. Consistency with gradual increases (under ~10% per week) builds fitness safely. Big spikes raise injury risk; dips are fine for recovery weeks.
        </p>
        <TrainingLoadChart data={loadByType} />
      </ChartModal>

      <ChartModal open={modal === "vo2"} onClose={() => setModal(null)} title="VO2 Max" insight={insightFor("training")} insightLoading={isLoadingInsight("training")}>
        <p style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.6, margin: "0 0 16px" }}>
          VO2 max is an estimate of how much oxygen your body can use during hard exercise — a key marker of aerobic capacity. Garmin estimates a separate value for running and cycling because the demands are different. Trends matter more than absolute numbers; expect slow improvements over months, not days.
        </p>
        <Vo2Chart data={vo2Trend} />
      </ChartModal>

      <ChartModal open={modal === "hrv"} onClose={() => setModal(null)} title="Heart Rate Variability" insight={insightFor("recovery")} insightLoading={isLoadingInsight("recovery")}>
        <p style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.6, margin: "0 0 16px" }}>
          HRV measures the variation between heartbeats — higher values usually mean your nervous system is well recovered. A downward trend over several days can signal overtraining, poor sleep, or illness. Your personal baseline matters more than absolute numbers.
        </p>
        <RecoveryTrendChart data={recoveryData} dataKey="hrv" color={chartColors.hrv} label="HRV" unit="" />
      </ChartModal>

      <ChartModal open={modal === "sleep"} onClose={() => setModal(null)} title="Sleep Duration" insight={insightFor("recovery")} insightLoading={isLoadingInsight("recovery")}>
        <p style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.6, margin: "0 0 16px" }}>
          Sleep is the most powerful recovery tool. Athletes need 7–9 hours for hormone production, muscle repair, and adaptation. Consistency in bedtime matters as much as total duration.
        </p>
        <RecoveryTrendChart data={recoveryData} dataKey="sleep_hours" color={chartColors.sleep} label="Sleep" unit="h" domain={[4, 10]} />
      </ChartModal>

      <ChartModal open={modal === "rhr"} onClose={() => setModal(null)} title="Resting Heart Rate" insight={insightFor("recovery")} insightLoading={isLoadingInsight("recovery")}>
        <p style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.6, margin: "0 0 16px" }}>
          Resting heart rate trends downward as cardiovascular fitness improves. A sudden spike (5+ bpm above baseline) can mean illness, stress, dehydration, or overtraining. Watch the 7-day average rather than single readings.
        </p>
        <RecoveryTrendChart data={recoveryData} dataKey="resting_hr" color={chartColors.rhr} label="Resting HR" unit=" bpm" />
      </ChartModal>

      <ChartModal open={modal === "race"} onClose={() => setModal(null)} title="Race-time Predictions">
        <p style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.6, margin: "0 0 16px" }}>
          Predictions use the <b>Riegel formula</b> (T₂ = T₁ × (D₂ / D₁)^1.06) applied to your fastest recent run within a reasonable distance of each target. They assume even pacing and similar conditions — actual race times depend heavily on terrain, weather, and taper. For best accuracy, base predictions on efforts within 0.5x–2x of the target distance.
        </p>
        <RacePredictorChart predictions={racePredictions} />
      </ChartModal>

      <ChartModal open={modal === "e1rm"} onClose={() => setModal(null)} title="Lift Trajectory">
        <p style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.6, margin: "0 0 16px" }}>
          Each solid line is the highest <b>estimated 1RM</b> (e1RM) you hit on a given session for that lift, using the Epley formula (weight × (1 + reps/30)). The dashed line is a linear projection from the last 12 sessions. Projections are rough — they assume continued trend, no plateau, no injury. Use them to compare progress between lifts, not as a target for the next month.
        </p>
        <E1rmTrajectoryChart series={e1rmSeries} weightUnit={weightUnit} />
      </ChartModal>

      <ChartModal open={modal === "forecast"} onClose={() => setModal(null)} title="Fitness Forecast">
        <p style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.6, margin: "0 0 16px" }}>
          This projects your <b>Fitness (CTL)</b>, <b>Fatigue (ATL)</b>, and <b>Form (TSB)</b> 14 days forward, assuming you continue your last 14 days of average daily load. If you plan to taper or push harder, your actual numbers will diverge. Use the predicted peak Form to time race week — many athletes target TSB around +5 to +25.
        </p>
        <FitnessForecastChart forecast={fitnessForecast} />
      </ChartModal>
    </div>
  );
}
