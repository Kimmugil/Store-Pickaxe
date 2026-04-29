"use client";
import { useTexts } from "./TextsProvider";
import type { Analysis } from "@/lib/types";
import { formatDate } from "@/lib/utils";

interface Props {
  analysis: Analysis;
  compact?: boolean;
}

export default function AnalysisCard({ analysis, compact = false }: Props) {
  const texts = useTexts();

  const gSentiment = analysis.google_sentiment;
  const aSentiment = analysis.apple_sentiment;

  return (
    <div className={compact ? "" : "space-y-5"}>
      {/* Overall summary */}
      <p
        className="text-sm font-medium text-[#1A1A1A] leading-relaxed px-3 py-2 rounded-xl"
        style={{ background: "#FFFDE7", border: "1.5px solid #1A1A1A" }}
      >
        {analysis.overall_summary}
      </p>

      {/* Sentiment scores */}
      {!compact && (
        <div className="grid grid-cols-2 gap-3">
          {gSentiment != null && (
            <SentimentGauge
              label={texts["common.platform.google"] || "Google Play"}
              score={gSentiment}
              color="#4285F4"
            />
          )}
          {aSentiment != null && (
            <SentimentGauge
              label={texts["common.platform.apple"] || "App Store"}
              score={aSentiment}
              color="#1A1A1A"
            />
          )}
        </div>
      )}

      {/* Complaints / Praises */}
      <div className="grid grid-cols-2 gap-3">
        {analysis.main_complaints?.length > 0 && (
          <TagGroup
            label={texts["detail.analysis.complaints"] || "주요 불만"}
            items={analysis.main_complaints}
            itemStyle={{ background: "#FFF5F5", color: "#DC2626", border: "1.5px solid #DC2626" }}
            labelColor="#DC2626"
          />
        )}
        {analysis.main_praises?.length > 0 && (
          <TagGroup
            label={texts["detail.analysis.praises"] || "주요 칭찬"}
            items={analysis.main_praises}
            itemStyle={{ background: "#F0FFF4", color: "#16A34A", border: "1.5px solid #16A34A" }}
            labelColor="#16A34A"
          />
        )}
      </div>

      {/* Keywords */}
      {!compact && (
        <div className="grid grid-cols-2 gap-3">
          {analysis.keywords_google?.length > 0 && (
            <KeywordList
              label={`${texts["common.platform.google"] || "Google"} 키워드`}
              keywords={analysis.keywords_google}
              color="#4285F4"
            />
          )}
          {analysis.keywords_apple?.length > 0 && (
            <KeywordList
              label={`${texts["common.platform.apple"] || "Apple"} 키워드`}
              keywords={analysis.keywords_apple}
              color="#1A1A1A"
            />
          )}
        </div>
      )}

      {/* Platform diff */}
      {analysis.platform_diff && (
        <p
          className="text-xs font-medium rounded-xl px-3 py-2"
          style={{ background: "#F0EFEC", color: "#4A4A4A", border: "1.5px solid #E2E8F0" }}
        >
          {analysis.platform_diff}
        </p>
      )}

      {/* Meta */}
      {!compact && (
        <p className="text-xs text-[#9CA3AF] font-medium">
          {formatDate(analysis.created_at)} · {texts["detail.analysis.sample"] || "샘플"}{" "}
          Google {analysis.sample_count_google} / Apple {analysis.sample_count_apple}
        </p>
      )}
    </div>
  );
}

function SentimentGauge({ label, score, color }: { label: string; score: number; color: string }) {
  const trackColor = score >= 75 ? "#56D0A0" : score >= 50 ? "#B7960A" : "#FF6B6B";
  return (
    <div
      className="space-y-2 p-3 rounded-xl"
      style={{ border: "2px solid #1A1A1A", background: "#FAFAFA" }}
    >
      <div className="flex justify-between text-xs">
        <span style={{ color }} className="font-black">{label}</span>
        <span className="font-black text-base" style={{ color: trackColor }}>{score}</span>
      </div>
      <div
        className="h-2.5 rounded-full overflow-hidden"
        style={{ background: "#E2E8F0", border: "1px solid #1A1A1A" }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${score}%`, backgroundColor: trackColor }}
        />
      </div>
    </div>
  );
}

function TagGroup({
  label,
  items,
  itemStyle,
  labelColor,
}: {
  label: string;
  items: string[];
  itemStyle: React.CSSProperties;
  labelColor: string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-black" style={{ color: labelColor }}>{label}</p>
      <div className="flex flex-col gap-1.5">
        {items.map((item, i) => (
          <span
            key={i}
            className="text-xs font-bold rounded-xl px-2.5 py-1.5"
            style={itemStyle}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function KeywordList({ label, keywords, color }: { label: string; keywords: string[]; color: string }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-black" style={{ color }}>{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {keywords.map((kw, i) => (
          <span
            key={i}
            className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ background: "#F0EFEC", color: "#4A4A4A", border: "1.5px solid #1A1A1A" }}
          >
            {kw}
          </span>
        ))}
      </div>
    </div>
  );
}
