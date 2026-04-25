"use client";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import type { Snapshot, TimelineEvent, Texts } from "@/lib/types";
import { useTexts } from "./TextsProvider";

interface Props {
  snapshots: Snapshot[];
  events: TimelineEvent[];
}

export default function RatingChart({ snapshots, events }: Props) {
  const texts = useTexts();

  const data = snapshots
    .filter((s) => s.date)
    .sort((a, b) => (a.date > b.date ? 1 : -1))
    .map((s) => ({
      date: s.date.slice(0, 10),
      google: s.google_rating ? Number(s.google_rating.toFixed(2)) : null,
      apple: s.apple_rating ? Number(s.apple_rating.toFixed(2)) : null,
    }));

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-gray-400">
        {texts["detail.rating.no_data"] || "수집된 평점 데이터가 없습니다."}
      </div>
    );
  }

  const versionEvents = events
    .filter((e) => e.event_type === "version_release" && e.event_date)
    .map((e) => e.event_date.slice(0, 10));

  const shiftEvents = events
    .filter((e) => e.event_type === "sentiment_shift" && e.event_date)
    .map((e) => e.event_date.slice(0, 10));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11 }}
          tickFormatter={(v) => v.slice(5)}
          interval="preserveStartEnd"
        />
        <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 11 }} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
          formatter={(val: number) => val?.toFixed(2)}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />

        {versionEvents.map((d) => (
          <ReferenceLine key={`v-${d}`} x={d} stroke="#6366f1" strokeDasharray="4 2" strokeWidth={1.5} />
        ))}
        {shiftEvents.map((d) => (
          <ReferenceLine key={`s-${d}`} x={d} stroke="#ef4444" strokeDasharray="4 2" strokeWidth={1.5} />
        ))}

        <Line
          type="monotone"
          dataKey="google"
          name={texts["common.platform.google"] || "Google Play"}
          stroke="#4285F4"
          strokeWidth={2}
          dot={false}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="apple"
          name={texts["common.platform.apple"] || "App Store"}
          stroke="#555555"
          strokeWidth={2}
          dot={false}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
