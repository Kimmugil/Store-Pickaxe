"use client";
import { useTexts } from "./TextsProvider";
import type { Analysis, Texts } from "@/lib/types";
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
    <div className={compact ? "" : "space-y-4"}>
      {/* 종합 요약 */}
      <p className="text-sm text-gray-700 leading-relaxed">{analysis.overall_summary}</p>

      {/* 감정 점수 */}
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
              color="#555555"
            />
          )}
        </div>
      )}

      {/* 불만 / 칭찬 */}
      <div className="grid grid-cols-2 gap-3">
        {analysis.main_complaints?.length > 0 && (
          <TagGroup
            label={texts["detail.analysis.complaints"] || "주요 불만"}
            items={analysis.main_complaints}
            color="bg-red-50 text-red-700"
          />
        )}
        {analysis.main_praises?.length > 0 && (
          <TagGroup
            label={texts["detail.analysis.praises"] || "주요 칭찬"}
            items={analysis.main_praises}
            color="bg-green-50 text-green-700"
          />
        )}
      </div>

      {/* 키워드 */}
      {!compact && (
        <div className="grid grid-cols-2 gap-3">
          {analysis.keywords_google?.length > 0 && (
            <KeywordList
              label={`${texts["common.platform.google"] || "Google"} 키워드`}
              keywords={analysis.keywords_google}
              color="text-blue-500"
            />
          )}
          {analysis.keywords_apple?.length > 0 && (
            <KeywordList
              label={`${texts["common.platform.apple"] || "Apple"} 키워드`}
              keywords={analysis.keywords_apple}
              color="text-gray-500"
            />
          )}
        </div>
      )}

      {/* 플랫폼 차이 */}
      {analysis.platform_diff && (
        <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
          {analysis.platform_diff}
        </p>
      )}

      {/* 메타 */}
      {!compact && (
        <p className="text-xs text-gray-300">
          {formatDate(analysis.created_at)} · {texts["detail.analysis.sample"] || "샘플"}{" "}
          Google {analysis.sample_count_google} / Apple {analysis.sample_count_apple}
        </p>
      )}
    </div>
  );
}

function SentimentGauge({ label, score, color }: { label: string; score: number; color: string }) {
  const trackColor = score >= 75 ? "#16a34a" : score >= 50 ? "#ca8a04" : "#dc2626";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span style={{ color }} className="font-medium">{label}</span>
        <span className="font-bold" style={{ color: trackColor }}>{score}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${score}%`, backgroundColor: trackColor }}
        />
      </div>
    </div>
  );
}

function TagGroup({ label, items, color }: { label: string; items: string[]; color: string }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-gray-400">{label}</p>
      <div className="flex flex-col gap-1">
        {items.map((item, i) => (
          <span key={i} className={`text-xs rounded-lg px-2.5 py-1.5 ${color}`}>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function KeywordList({ label, keywords, color }: { label: string; keywords: string[]; color: string }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-gray-400">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {keywords.map((kw, i) => (
          <span key={i} className={`text-xs font-medium bg-gray-100 rounded-full px-2 py-0.5 ${color}`}>
            {kw}
          </span>
        ))}
      </div>
    </div>
  );
}
