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
      month: e.event_date.slice(0, 7),
      label: e.event_date.slice(2, 7),
      google: e.google_positive_rate ?? null,
      apple: e.apple_positive_rate ?? null,
    }));

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center h-48 rounded-xl"
        style={{ background: "#F0EFEC", border: "2px dashed #1A1A1A" }}
      >
        <p className="text-sm font-bold text-[#9CA3AF]">
          {texts["detail.rating.no_data"] || "수집된 데이터가 없습니다. 첫 수집 후 확인해 주세요."}
        </p>
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
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "#9CA3AF", fontWeight: 700 }}
          interval="preserveStartEnd"
          axisLine={{ stroke: "#1A1A1A", strokeWidth: 2 }}
          tickLine={{ stroke: "#1A1A1A" }}
        />
        <YAxis
          domain={[0, 100]}
          ticks={[0, 25, 50, 75, 100]}
          tick={{ fontSize: 11, fill: "#9CA3AF", fontWeight: 700 }}
          tickFormatter={(v) => `${v}%`}
          axisLine={{ stroke: "#1A1A1A", strokeWidth: 2 }}
          tickLine={{ stroke: "#1A1A1A" }}
        />
        <Tooltip
          contentStyle={{
            fontSize: 12,
            borderRadius: 12,
            border: "2px solid #1A1A1A",
            background: "#FFFFFF",
            boxShadow: "3px 3px 0px 0px #1A1A1A",
            fontWeight: 700,
          }}
          formatter={(val: number) => `${val?.toFixed(1)}%`}
          labelFormatter={(label) => `${label} 긍정률`}
        />
        <Legend
          wrapperStyle={{ fontSize: 12, fontWeight: 800 }}
        />

        {/* Version release reference lines */}
        {data
          .filter((d) => versionMonths.has(d.month))
          .map((d) => (
            <ReferenceLine
              key={`v-${d.label}`}
              x={d.label}
              stroke="#6366f1"
              strokeDasharray="4 2"
              strokeWidth={2}
            />
          ))}
        {/* Sentiment shift reference lines */}
        {data
          .filter((d) => shiftMonths.has(d.month))
          .map((d) => (
            <ReferenceLine
              key={`s-${d.label}`}
              x={d.label}
              stroke="#FF6B6B"
              strokeDasharray="4 2"
              strokeWidth={2}
            />
          ))}

        <Line
          type="monotone"
          dataKey="google"
          name={texts["common.platform.google"] || "Google Play"}
          stroke="#4285F4"
          strokeWidth={2.5}
          dot={{ r: 4, fill: "#4285F4", stroke: "#1A1A1A", strokeWidth: 1.5 }}
          activeDot={{ r: 6, fill: "#4285F4", stroke: "#1A1A1A", strokeWidth: 2 }}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="apple"
          name={texts["common.platform.apple"] || "App Store"}
          stroke="#1A1A1A"
          strokeWidth={2.5}
          dot={{ r: 4, fill: "#1A1A1A", stroke: "#1A1A1A", strokeWidth: 1.5 }}
          activeDot={{ r: 6, fill: "#1A1A1A", stroke: "#1A1A1A", strokeWidth: 2 }}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
