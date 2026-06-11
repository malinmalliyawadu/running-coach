"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  Cell,
  CartesianGrid,
} from "recharts";
import { useStore } from "./RunsProvider";
import { forecastTrend } from "@/lib/forecast";
import { weeklyBuckets } from "@/lib/stats";
import { formatDuration, formatDateShort } from "@/lib/format";

const AXIS_STYLE = {
  fontSize: 11,
  fill: "var(--paper-faint)",
  fontFamily: "var(--font-mono)",
};

function hoursTick(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return `${h}:${String(m).padStart(2, "0")}`;
}

export function ForecastTrendChart() {
  const { runs } = useStore();
  const trend = forecastTrend(runs).map((p) => ({
    ...p,
    band: [p.optimisticSec, p.conservativeSec] as [number, number],
  }));

  if (trend.length < 2) {
    return (
      <EmptyChart message="Your forecast trend appears after a couple of logged runs." />
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <ComposedChart data={trend} margin={{ top: 10, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid stroke="var(--line)" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatDateShort}
            tick={AXIS_STYLE}
            axisLine={{ stroke: "var(--line)" }}
            tickLine={false}
            minTickGap={40}
          />
          <YAxis
            tickFormatter={hoursTick}
            tick={AXIS_STYLE}
            axisLine={false}
            tickLine={false}
            domain={["dataMin - 600", "dataMax + 600"]}
            width={52}
          />
          <Tooltip
            contentStyle={{
              background: "var(--panel-2)",
              border: "1px solid var(--line-strong)",
              borderRadius: 4,
              fontSize: 12,
              fontFamily: "var(--font-mono)",
            }}
            labelStyle={{ color: "var(--paper-dim)" }}
            itemStyle={{ color: "var(--paper)" }}
            labelFormatter={(d) => formatDateShort(String(d))}
            formatter={(value, name) => {
              if (Array.isArray(value)) {
                const [lo, hi] = value.map(Number);
                return [`${formatDuration(lo)} – ${formatDuration(hi)}`, "range"];
              }
              return [formatDuration(Number(value)), name === "expectedSec" ? "forecast" : String(name)];
            }}
          />
          <Area
            dataKey="band"
            stroke="none"
            fill="var(--glacier)"
            fillOpacity={0.08}
            isAnimationActive={false}
          />
          <Line
            dataKey="expectedSec"
            stroke="var(--glacier)"
            strokeWidth={2}
            dot={{ r: 2.5, fill: "var(--glacier)", strokeWidth: 0 }}
            activeDot={{ r: 4, fill: "var(--coral)" }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function WeeklyVolumeChart() {
  const { runs } = useStore();
  const buckets = weeklyBuckets(runs);
  const hasData = buckets.some((b) => b.km > 0);

  if (!hasData) {
    return <EmptyChart message="Weekly volume shows up here as you log runs." />;
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <BarChart data={buckets} margin={{ top: 10, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid stroke="var(--line)" vertical={false} />
          <XAxis
            dataKey="weekLabel"
            tick={AXIS_STYLE}
            axisLine={{ stroke: "var(--line)" }}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis tick={AXIS_STYLE} axisLine={false} tickLine={false} width={40} />
          <Tooltip
            cursor={{ fill: "rgba(123,224,206,0.06)" }}
            contentStyle={{
              background: "var(--panel-2)",
              border: "1px solid var(--line-strong)",
              borderRadius: 4,
              fontSize: 12,
              fontFamily: "var(--font-mono)",
            }}
            labelStyle={{ color: "var(--paper-dim)" }}
            itemStyle={{ color: "var(--paper)" }}
            formatter={(value) => [`${Number(value)} km`, "volume"]}
          />
          <Bar dataKey="km" radius={[2, 2, 0, 0]} isAnimationActive={false}>
            {buckets.map((b, i) => (
              <Cell
                key={b.weekStart}
                fill={i === buckets.length - 1 ? "var(--coral)" : "var(--glacier-deep)"}
                fillOpacity={i === buckets.length - 1 ? 0.95 : 0.7}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-64 items-center justify-center">
      <p className="max-w-xs text-center text-sm text-[var(--paper-faint)]">{message}</p>
    </div>
  );
}
