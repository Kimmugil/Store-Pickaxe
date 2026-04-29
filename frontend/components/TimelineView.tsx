"use client";
import { useState } from "react";
import { Tag, AlertTriangle, Zap, Wrench, ChevronRight } from "lucide-react";
import type { TimelineEvent, Analysis } from "@/lib/types";
import { useTexts } from "./TextsProvider";
import { formatDate, eventTypeLabel } from "@/lib/utils";
import AnalysisCard from "./AnalysisCard";

interface Props {
  events: TimelineEvent[];
  analyses: Analysis[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const EVENT_ICONS: Record<string, any> = {
  version_release: Tag,
  sentiment_shift: AlertTriangle,
  review_surge: Zap,
  admin_patch: Wrench,
};

const EVENT_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  version_release: { bg: "#EEF2FF", color: "#4338CA", border: "#4338CA" },
  sentiment_shift: { bg: "#FFF5F5", color: "#DC2626", border: "#DC2626" },
  review_surge:    { bg: "#FFFDE7", color: "#B7960A", border: "#B7960A" },
  admin_patch:     { bg: "#EFF6FF", color: "#1D4ED8", border: "#1D4ED8" },
};

const EVENT_CARD_BG: Record<string, string> = {
  version_release: "#EEF2FF",
  sentiment_shift: "#FFF5F5",
  review_surge:    "#FFFDE7",
  admin_patch:     "#EFF6FF",
};

export default function TimelineView({ events, analyses }: Props) {
  const texts = useTexts();
  const [expandedAnalysis, setExpandedAnalysis] = useState<string | null>(null);

  const sorted = [...events]
    .filter((e) => e.event_type !== "monthly_summary")
    .sort((a, b) => (b.event_date > a.event_date ? 1 : -1));
  const analysisMap = Object.fromEntries(analyses.map((a) => [a.analysis_id, a]));

  if (sorted.length === 0) {
    return (
      <div
        className="flex items-center justify-center py-10 rounded-2xl"
        style={{ border: "2px dashed #1A1A1A", background: "#FAFAFA" }}
      >
        <p className="text-sm font-bold text-[#9CA3AF]">
          {texts["detail.timeline.empty"] || "감지된 이벤트가 없습니다."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sorted.map((event) => {
        const Icon = EVENT_ICONS[event.event_type] ?? Tag;
        const style = EVENT_STYLES[event.event_type] ?? { bg: "#F0EFEC", color: "#4A4A4A", border: "#9CA3AF" };
        const cardBg = EVENT_CARD_BG[event.event_type] ?? "#FFFFFF";
        const analysis = event.analysis_id ? analysisMap[event.analysis_id] : null;
        const isExpanded = expandedAnalysis === event.event_id;

        return (
          <div
            key={event.event_id}
            className="rounded-2xl overflow-hidden"
            style={{ border: "2px solid #1A1A1A", background: cardBg }}
          >
            <div className="p-4 flex items-start gap-3">
              {/* Event type badge */}
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black flex-shrink-0 mt-0.5"
                style={{
                  background: style.bg,
                  color: style.color,
                  border: `1.5px solid ${style.border}`,
                }}
              >
                <Icon size={10} />
                {eventTypeLabel(event.event_type, texts)}
              </span>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-[#9CA3AF]">
                    {formatDate(event.event_date)}
                  </span>
                  {event.version && (
                    <span
                      className="text-xs font-mono font-bold px-1.5 py-0.5 rounded-md"
                      style={{ background: "#F0EFEC", border: "1.5px solid #1A1A1A", color: "#4A4A4A" }}
                    >
                      v{event.version}
                    </span>
                  )}
                </div>
                <p className="text-sm font-medium text-[#1A1A1A] mt-1">{event.summary}</p>

                {/* Rating changes */}
                <div className="flex gap-3 mt-2 flex-wrap">
                  {event.google_rating_before != null && event.google_rating_after != null && (
                    <RatingChange
                      platform={texts["common.platform.google"] || "Google"}
                      before={event.google_rating_before}
                      after={event.google_rating_after}
                      color="#4285F4"
                    />
                  )}
                  {event.apple_rating_before != null && event.apple_rating_after != null && (
                    <RatingChange
                      platform={texts["common.platform.apple"] || "Apple"}
                      before={event.apple_rating_before}
                      after={event.apple_rating_after}
                      color="#1A1A1A"
                    />
                  )}
                </div>
              </div>

              {/* AI analysis toggle */}
              {analysis && (
                <button
                  onClick={() => setExpandedAnalysis(isExpanded ? null : event.event_id)}
                  className="flex-shrink-0 flex items-center gap-1 text-xs font-black px-2.5 py-1 rounded-full transition-all"
                  style={{
                    background: isExpanded ? "#1A1A1A" : "#EEF2FF",
                    color: isExpanded ? "#FFFFFF" : "#4338CA",
                    border: "1.5px solid #1A1A1A",
                  }}
                >
                  AI
                  <ChevronRight
                    size={11}
                    className={`transition-transform ${isExpanded ? "rotate-90" : ""}`}
                  />
                </button>
              )}
              {!analysis && event.analysis_id && (
                <span className="text-xs text-[#9CA3AF] font-medium flex-shrink-0">
                  {texts["detail.analysis.loading"] || "분석 중"}
                </span>
              )}
            </div>

            {/* Expanded analysis */}
            {analysis && isExpanded && (
              <div
                className="px-4 pb-4 pt-3"
                style={{ borderTop: "2px solid #1A1A1A", background: "#FFFFFF" }}
              >
                <AnalysisCard analysis={analysis} compact />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function RatingChange({
  platform,
  before,
  after,
  color,
}: {
  platform: string;
  before: number;
  after: number;
  color: string;
}) {
  const delta = after - before;
  const sign = delta > 0 ? "+" : "";
  const deltaColor = delta > 0 ? "#56D0A0" : delta < 0 ? "#FF6B6B" : "#9CA3AF";

  return (
    <span className="text-xs flex items-center gap-1 font-bold">
      <span style={{ color }} className="font-black">{platform}</span>
      <span className="text-[#9CA3AF]">{before.toFixed(1)}</span>
      <span className="text-[#9CA3AF]">→</span>
      <span className="text-[#1A1A1A] font-black">{after.toFixed(1)}</span>
      <span className="font-black" style={{ color: deltaColor }}>
        ({sign}{delta.toFixed(1)})
      </span>
    </span>
  );
}
