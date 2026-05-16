"use client";

import {
  ResponsiveContainer, ComposedChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ReferenceLine,
} from "recharts";
import type { E1rmSeries } from "@/lib/training/predictions";
import { convertWeight, weightLabel, type WeightUnit } from "@/lib/units";
import { chartColors, tooltipStyle, tooltipItemStyle, tooltipLabelStyle, gridProps, axisProps } from "./chart-theme";

interface E1rmTrajectoryChartProps {
  series: E1rmSeries[];
  weightUnit: WeightUnit;
  compact?: boolean;
}

const SERIES_COLORS: Record<string, string> = {
  bench: chartColors.fitness,
  squat: chartColors.fatigue,
  deadlift: chartColors.rhr,
  ohp: chartColors.hrv,
};

function formatDate(d: string): string {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

type Row = { date: string } & Record<string, number | null | string>;

export function E1rmTrajectoryChart({ series, weightUnit, compact = false }: E1rmTrajectoryChartProps) {
  if (series.length === 0) {
    return (
      <div style={{ color: chartColors.textFaint, fontSize: 12, padding: 20 }}>
        Not enough lift data yet — log a few sessions to see trajectory.
      </div>
    );
  }

  const lastHistDate = series
    .flatMap((s) => s.history.map((p) => p.date))
    .sort()
    .pop() ?? null;

  const dateSet = new Set<string>();
  for (const s of series) {
    for (const p of s.history) dateSet.add(p.date);
    for (const p of s.projection) dateSet.add(p.date);
  }
  const dates = Array.from(dateSet).sort();

  // Split each series into _hist and _proj keys so we can style them
  // separately (solid vs dashed). Stitch the last history point into the
  // projection series so the dashed line begins where the solid one ends.
  const merged: Row[] = dates.map((date) => {
    const row: Row = { date };
    for (const s of series) {
      const hist = s.history.find((p) => p.date === date);
      const proj = s.projection.find((p) => p.date === date);
      const lastHistForSeries = s.history[s.history.length - 1];
      row[`${s.liftId}_hist`] = hist ? Math.round(convertWeight(hist.e1rm, weightUnit) * 10) / 10 : null;
      if (proj) {
        row[`${s.liftId}_proj`] = Math.round(convertWeight(proj.e1rm, weightUnit) * 10) / 10;
      } else if (lastHistForSeries && date === lastHistForSeries.date) {
        // Anchor the projection line at the last observed point.
        row[`${s.liftId}_proj`] = Math.round(convertWeight(lastHistForSeries.e1rm, weightUnit) * 10) / 10;
      } else {
        row[`${s.liftId}_proj`] = null;
      }
    }
    return row;
  });

  const h = compact ? 140 : 320;
  const ulabel = weightLabel(weightUnit);

  return (
    <div>
      <ResponsiveContainer width="100%" height={h}>
        <ComposedChart data={merged} margin={{ top: 8, right: 8, bottom: 4, left: compact ? -24 : 0 }}>
          {!compact && <CartesianGrid {...gridProps} />}
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={compact ? false : axisProps.tick}
            interval={compact ? 999 : Math.floor(merged.length / 6)}
            axisLine={false}
            tickLine={false}
          />
          {!compact && <YAxis {...axisProps} unit={ulabel} />}
          {!compact && (
            <Tooltip
              contentStyle={tooltipStyle}
              itemStyle={tooltipItemStyle}
              labelStyle={tooltipLabelStyle}
              labelFormatter={formatDate}
              formatter={(value: number) => [`${value} ${ulabel}`, undefined]}
              cursor={{ stroke: chartColors.gridStrong, strokeWidth: 1 }}
            />
          )}
          {!compact && lastHistDate && (
            <ReferenceLine
              x={lastHistDate}
              stroke={chartColors.gridStrong}
              strokeDasharray="3 4"
              label={{ value: "now", position: "top", fontSize: 10, fill: chartColors.textFaint }}
            />
          )}
          {series.map((s) => {
            const color = SERIES_COLORS[s.liftId] ?? chartColors.fitness;
            return (
              <Line
                key={`${s.liftId}_hist`}
                dataKey={`${s.liftId}_hist`}
                stroke={color}
                strokeWidth={compact ? 1.8 : 2.2}
                dot={false}
                name={s.label}
                connectNulls
                isAnimationActive={false}
              />
            );
          })}
          {series.map((s) => {
            const color = SERIES_COLORS[s.liftId] ?? chartColors.fitness;
            return (
              <Line
                key={`${s.liftId}_proj`}
                dataKey={`${s.liftId}_proj`}
                stroke={color}
                strokeWidth={compact ? 1.4 : 1.8}
                strokeDasharray="4 3"
                dot={false}
                name={`${s.label} (projected)`}
                legendType="none"
                connectNulls
                isAnimationActive={false}
              />
            );
          })}
          {!compact && <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
