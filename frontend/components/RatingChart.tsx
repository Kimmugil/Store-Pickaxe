"use client";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import type { TimelineEvent } from "@/lib/types";
import { useTexts } from "./TextsProvider";

interface Props {
  events: TimelineEvent[];
}

export default function RatingChart({ events }: Props) {
  const texts = useTexts();

  const data = events
    .filter((e) => e.event_type === "monthly_summary" && e.event_date)
    .sort((a, b) => (a.event_date > b.event_date ? 1 : -1))
    .map((e) => ({
      month: e.event_date.slice(0, 7),           // "2025-04"
      label: e.event_date.slice(2, 7),            // "25-04"
      google: e.google_positive_rate ?? null,
      apple: e.apple_positive_rate ?? null,
    }));

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-gray-400">
        {texts["detail.rating.no_data"] || "수집된 데이터가 없습니다. 첫 수집 후 확인해 주세요."}
      </div>
    );
  }

  const versionMonths = new Set(
    events
      .filter((e) => e.event_type === "version_release" && e.event_date)
      .map((e) => e.event_date.slice(0, 7))
  );
  const shiftMonths = new Set(
    events
      .filter((e) => e.event_type === "sentiment_shift" && e.event_date)
      .map((e) => e.event_date.slice(0, 7))
  );

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11 }}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[0, 100]}
          ticks={[0, 25, 50, 75, 100]}
          tick={{ fontSize: 11 }}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
          formatter={(val: number) => `${val?.toFixed(1)}%`}
          labelFormatter={(label) => `${label} 긍정률`}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />

        {data
          .filter((d) => versionMonths.has(d.month))
          .map((d) => (
            <ReferenceLine key={`v-${d.label}`} x={d.label} stroke="#6366f1" strokeDasharray="4 2" strokeWidth={1.5} />
          ))}
        {data
          .filter((d) => shiftMonths.has(d.month))
          .map((d) => (
            <ReferenceLine key={`s-${d.label}`} x={d.label} stroke="#ef4444" strokeDasharray="4 2" strokeWidth={1.5} />
          ))}

        <Line
          type="monotone"
          dataKey="google"
          name={texts["common.platform.google"] || "Google Play"}
          stroke="#4285F4"
          strokeWidth={2}
          dot={{ r: 3 }}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="apple"
          name={texts["common.platform.apple"] || "App Store"}
          stroke="#555555"
          strokeWidth={2}
          dot={{ r: 3 }}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
