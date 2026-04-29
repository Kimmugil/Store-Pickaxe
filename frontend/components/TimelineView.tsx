"use client";
import { useState } from "react";
import { Tag, AlertTriangle, Zap, Wrench, ChevronRight } from "lucide-react";
import type { TimelineEvent, Analysis, Texts } from "@/lib/types";
import { useTexts } from "./TextsProvider";
import { formatDate, eventTypeLabel } from "@/lib/utils";
import AnalysisCard from "./AnalysisCard";

interface Props {
  events: TimelineEvent[];
  analyses: Analysis[];
}

const EVENT_ICONS: Record<string, ({ size }: { size?: number }) => JSX.Element> = {
  version_release: Tag,
  sentiment_shift: AlertTriangle,
  review_surge: Zap,
  admin_patch: Wrench,
};

const EVENT_COLORS: Record<string, string> = {
  version_release: "bg-indigo-50 text-indigo-600 border-indigo-100",
  sentiment_shift: "bg-red-50 text-red-600 border-red-100",
  review_surge: "bg-yellow-50 text-yellow-600 border-yellow-100",
  admin_patch: "bg-blue-50 text-blue-600 border-blue-100",
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
      <div className="text-sm text-gray-400 py-8 text-center">
        {texts["detail.timeline.empty"] || "감지된 이벤트가 없습니다."}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sorted.map((event) => {
        const Icon = EVENT_ICONS[event.event_type] ?? Tag;
        const colorCls = EVENT_COLORS[event.event_type] ?? "bg-gray-50 text-gray-600 border-gray-100";
        const analysis = event.analysis_id ? analysisMap[event.analysis_id] : null;
        const isExpanded = expandedAnalysis === event.event_id;

        return (
          <div key={event.event_id} className="card overflow-hidden">
            <div className="p-4 flex items-start gap-3">
              <span className={`badge border ${colorCls} mt-0.5 flex-shrink-0`}>
                <Icon size={11} />
                {eventTypeLabel(event.event_type, texts)}
              </span>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-gray-400">{formatDate(event.event_date)}</span>
                  {event.version && (
                    <span className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                      v{event.version}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-700 mt-0.5">{event.summary}</p>

                {/* 평점 변화 */}
                <div className="flex gap-3 mt-1.5 flex-wrap">
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
                      color="#555555"
                    />
                  )}
                </div>
              </div>

              {/* AI 분석 토글 */}
              {analysis && (
                <button
                  onClick={() => setExpandedAnalysis(isExpanded ? null : event.event_id)}
                  className="flex-shrink-0 flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 font-medium"
                >
                  AI <ChevronRight size={12} className={`transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                </button>
              )}
              {!analysis && event.analysis_id && (
                <span className="text-xs text-gray-300 flex-shrink-0">
                  {texts["detail.analysis.loading"] || "분석 중"}
                </span>
              )}
            </div>

            {/* 분석 내용 (펼침) */}
            {analysis && isExpanded && (
              <div className="border-t border-gray-50 px-4 pb-4 pt-3">
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
  const deltaColor = delta > 0 ? "text-positive" : delta < 0 ? "text-negative" : "text-neutral-400";

  return (
    <span className="text-xs flex items-center gap-1">
      <span style={{ color }} className="font-medium">{platform}</span>
      <span className="text-gray-400">{before.toFixed(1)}</span>
      <span className="text-gray-300">→</span>
      <span className="text-gray-700 font-medium">{after.toFixed(1)}</span>
      <span className={`font-medium ${deltaColor}`}>({sign}{delta.toFixed(1)})</span>
    </span>
  );
}
