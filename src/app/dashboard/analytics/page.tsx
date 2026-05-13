"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FitnessChart } from "@/components/charts/fitness-chart";
import {
  RecoveryTrendChart, HrZoneChart, TrainingLoadChart,
  computeHrZones,
  type RecoveryPoint, type LoadPoint,
} from "@/components/charts/recovery-charts";
import { ChartModal } from "@/components/charts/chart-modal";
import { ChartCard } from "@/components/charts/chart-card";
import { ConnectionBar } from "@/components/app/connection-bar";
import { chartColors } from "@/components/charts/chart-theme";
import { useDashboardData } from "@/lib/hooks/use-dashboard-data";
import { computeFitnessCurve, estimateLoad, cType } from "@/lib/training/calendar-data";

type ModalKey = "fitness" | "hrv" | "sleep" | "rhr" | "bb" | "stress" | "hrzones" | "load" | null;

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
  const hrZones = useMemo(() => data ? computeHrZones(data.cardio) : [], [data]);
  const loadData: LoadPoint[] = useMemo(() => {
    if (!data) return [];
    const points: LoadPoint[] = [];
    for (const c of data.cardio) points.push({ date: c.date, load: estimateLoad(c.avg_hr, c.duration), type: cType(c.type) });
    for (const w of data.workouts) points.push({ date: w.date, load: Math.round((w.duration_minutes || 0) * 0.8), type: "lift" });
    return points;
  }, [data]);

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
    else if (modal === "hrzones" || modal === "load") fetchInsight("training");
    else if (modal && ["hrv", "sleep", "rhr", "bb", "stress"].includes(modal)) fetchInsight("recovery");
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
        <p style={{ fontSize: 12, color: "#6b7280", margin: "4px 0 0" }}>Trends and insights from the last 90 days. Click any chart to expand and view AI coaching notes.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 14, marginBottom: 14 }}>
        <div style={{ gridColumn: "span 2" }}>
          <ChartCard
            title="Fitness / Fatigue / Form"
            description="CTL (42-day), ATL (7-day), TSB. Are you building fitness or overreaching?"
            onClick={() => setModal("fitness")}
            accent={chartColors.fitness}
          >
            <FitnessChart data={fitnessCurve} compact />
          </ChartCard>
        </div>
        <ChartCard
          title="HR Zone Distribution"
          description="Time per HR zone across all cardio (90d)."
          onClick={() => setModal("hrzones")}
          accent={chartColors.zones[1]}
        >
          <HrZoneChart zones={hrZones} compact />
        </ChartCard>
        <ChartCard
          title="Weekly Training Load"
          description="Estimated load from HR × duration. Consistency > peaks."
          onClick={() => setModal("load")}
          accent={chartColors.load}
        >
          <TrainingLoadChart data={loadData} compact />
        </ChartCard>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 14, marginBottom: 14 }}>
        <ChartCard title="HRV" description="Higher = better recovery." onClick={() => setModal("hrv")} accent={chartColors.hrv}>
          <RecoveryTrendChart data={recoveryData} dataKey="hrv" color={chartColors.hrv} label="HRV" unit="" compact />
        </ChartCard>
        <ChartCard title="Sleep" description="Hours per night. 7-9h optimal." onClick={() => setModal("sleep")} accent={chartColors.sleep}>
          <RecoveryTrendChart data={recoveryData} dataKey="sleep_hours" color={chartColors.sleep} label="Sleep" unit="h" compact />
        </ChartCard>
        <ChartCard title="Resting HR" description="Lower = better aerobic fitness." onClick={() => setModal("rhr")} accent={chartColors.rhr}>
          <RecoveryTrendChart data={recoveryData} dataKey="resting_hr" color={chartColors.rhr} label="RHR" unit=" bpm" compact />
        </ChartCard>
        <ChartCard title="Body Battery" description="Garmin energy reserve estimate." onClick={() => setModal("bb")} accent={chartColors.bodyBattery}>
          <RecoveryTrendChart data={recoveryData} dataKey="body_battery" color={chartColors.bodyBattery} label="Body Battery" unit="" compact />
        </ChartCard>
        <ChartCard title="Stress" description="Garmin stress score. Lower = better." onClick={() => setModal("stress")} accent={chartColors.stress}>
          <RecoveryTrendChart data={recoveryData} dataKey="stress_level" color={chartColors.stress} label="Stress" unit="" compact />
        </ChartCard>
      </div>

      <ChartModal open={modal === "fitness"} onClose={() => setModal(null)} title="Fitness / Fatigue / Form (CTL / ATL / TSB)" insight={insightFor("fitness")} insightLoading={isLoadingInsight("fitness")}>
        <p style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.6, margin: "0 0 16px" }}>
          <b>Fitness (CTL)</b> is your 42-day rolling average training load — it represents your chronic training capacity. <b>Fatigue (ATL)</b> is the 7-day average — your acute tiredness. <b>Form (TSB = CTL - ATL)</b> tells you if you{"'"}re fresh (positive) or fatigued (negative). The sweet spot for racing is TSB between +5 and +25.
        </p>
        <FitnessChart data={fitnessCurve} />
      </ChartModal>

      <ChartModal open={modal === "hrzones"} onClose={() => setModal(null)} title="Heart Rate Zone Distribution" insight={insightFor("training")} insightLoading={isLoadingInsight("training")}>
        <p style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.6, margin: "0 0 16px" }}>
          <b>Z1 Recovery</b> (&lt;120 bpm): Easy recovery, warm-up. <b>Z2 Aerobic</b> (120-140): Base building, fat burning — aim for 80% of training here. <b>Z3 Tempo</b> (140-155): Sustainable hard effort. <b>Z4 Threshold</b> (155-170): Race pace, lactate threshold. <b>Z5 Anaerobic</b> (170+): Max effort intervals. The 80/20 rule suggests 80% Z1-Z2, 20% Z3-Z5.
        </p>
        <HrZoneChart zones={hrZones} />
      </ChartModal>

      <ChartModal open={modal === "load"} onClose={() => setModal(null)} title="Weekly Training Load" insight={insightFor("training")} insightLoading={isLoadingInsight("training")}>
        <p style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.6, margin: "0 0 16px" }}>
          Training load is estimated from heart rate intensity and duration (TRIMP). Consistent weekly load with gradual increases ({"<"}10% per week) builds fitness safely. Big spikes increase injury risk. Dips are OK for recovery weeks.
        </p>
        <TrainingLoadChart data={loadData} />
      </ChartModal>

      <ChartModal open={modal === "hrv"} onClose={() => setModal(null)} title="Heart Rate Variability (HRV)" insight={insightFor("recovery")} insightLoading={isLoadingInsight("recovery")}>
        <p style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.6, margin: "0 0 16px" }}>
          HRV measures the variation between heartbeats — higher values indicate better autonomic nervous system recovery. A downward trend over several days may signal overtraining, poor sleep, or illness. Your personal baseline matters more than absolute numbers.
        </p>
        <RecoveryTrendChart data={recoveryData} dataKey="hrv" color={chartColors.hrv} label="HRV" unit="" />
      </ChartModal>

      <ChartModal open={modal === "sleep"} onClose={() => setModal(null)} title="Sleep Duration" insight={insightFor("recovery")} insightLoading={isLoadingInsight("recovery")}>
        <p style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.6, margin: "0 0 16px" }}>
          Sleep is the #1 recovery tool. Athletes need 7-9 hours for optimal recovery, hormone production, and muscle repair. Consistency in sleep timing matters as much as duration.
        </p>
        <RecoveryTrendChart data={recoveryData} dataKey="sleep_hours" color={chartColors.sleep} label="Sleep" unit="h" domain={[4, 10]} />
      </ChartModal>

      <ChartModal open={modal === "rhr"} onClose={() => setModal(null)} title="Resting Heart Rate" insight={insightFor("recovery")} insightLoading={isLoadingInsight("recovery")}>
        <p style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.6, margin: "0 0 16px" }}>
          Resting heart rate trends downward as cardiovascular fitness improves. A sudden spike (5+ bpm above baseline) can indicate illness, stress, dehydration, or overtraining. Track the 7-day average rather than individual readings.
        </p>
        <RecoveryTrendChart data={recoveryData} dataKey="resting_hr" color={chartColors.rhr} label="Resting HR" unit=" bpm" />
      </ChartModal>

      <ChartModal open={modal === "bb"} onClose={() => setModal(null)} title="Body Battery" insight={insightFor("recovery")} insightLoading={isLoadingInsight("recovery")}>
        <p style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.6, margin: "0 0 16px" }}>
          Garmin{"'"}s Body Battery estimates your energy reserves on a 0-100 scale using HRV, stress, sleep, and activity data. It charges during sleep and drains during activity and stress. Starting a hard session above 50 is ideal.
        </p>
        <RecoveryTrendChart data={recoveryData} dataKey="body_battery" color={chartColors.bodyBattery} label="Body Battery" unit="" domain={[0, 100]} />
      </ChartModal>

      <ChartModal open={modal === "stress"} onClose={() => setModal(null)} title="Stress Level" insight={insightFor("recovery")} insightLoading={isLoadingInsight("recovery")}>
        <p style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.6, margin: "0 0 16px" }}>
          Garmin{"'"}s stress score (0-100) is derived from HRV analysis. Under 25 is resting, 26-50 is low stress, 51-75 is medium, and 76+ is high. Chronically elevated stress without recovery days signals overtraining risk.
        </p>
        <RecoveryTrendChart data={recoveryData} dataKey="stress_level" color={chartColors.stress} label="Stress" unit="" domain={[0, 100]} />
      </ChartModal>
    </div>
  );
}
