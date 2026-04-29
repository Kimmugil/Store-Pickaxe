"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useTexts } from "@/components/TextsProvider";
import RatingChart from "@/components/RatingChart";
import TimelineView from "@/components/TimelineView";
import AnalysisCard from "@/components/AnalysisCard";
import ReviewList from "@/components/ReviewList";
import type { AppDetail } from "@/lib/types";
import { formatRating, ratingColor, formatDate } from "@/lib/utils";

export default function AppDetailPage({ params }: { params: Promise<{ app_key: string }> }) {
  const texts = useTexts();
  const [appKey, setAppKey] = useState("");
  const [data, setData] = useState<AppDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"rating" | "analysis" | "reviews">("rating");

  useEffect(() => {
    params.then((p) => setAppKey(p.app_key));
  }, [params]);

  useEffect(() => {
    if (!appKey) return;
    fetch(`/api/apps/${appKey}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [appKey]);

  if (loading) {
    return <div className="text-sm text-gray-400 py-16 text-center">{texts["common.loading"] || "로딩 중..."}</div>;
  }
  if (!data?.meta) {
    return <div className="text-sm text-negative py-16 text-center">{texts["common.error"] || "앱을 찾을 수 없습니다."}</div>;
  }

  const { meta, snapshots, timeline, analyses, google_reviews, apple_reviews } = data;
  const latestAnalysis = [...analyses].sort((a, b) => b.created_at > a.created_at ? 1 : -1)[0];

  const tabs = [
    { id: "rating" as const, label: texts["detail.tab.rating"] || "평점 추이" },
    { id: "analysis" as const, label: texts["detail.tab.analysis"] || "AI 분석" },
    { id: "reviews" as const, label: texts["detail.tab.reviews"] || "리뷰" },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* 뒤로가기 */}
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700">
        <ArrowLeft size={14} /> {texts["common.back"] || "목록으로"}
      </Link>

      {/* 앱 헤더 */}
      <div className="card p-5 flex items-start gap-4">
        {meta.icon_url ? (
          <Image src={meta.icon_url} alt={meta.app_name} width={64} height={64}
            className="rounded-2xl flex-shrink-0" unoptimized />
        ) : (
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-900">{meta.app_name}</h1>
          <p className="text-sm text-gray-400">{meta.developer}</p>
          <div className="flex items-center gap-4 mt-3 flex-wrap">
            {meta.google_package && (
              <RatingPill
                label={texts["common.platform.google"] || "Google"}
                rating={meta.google_rating}
                color="#4285F4"
              />
            )}
            {meta.apple_app_id && (
              <RatingPill
                label={texts["common.platform.apple"] || "Apple"}
                rating={meta.apple_rating}
                color="#555555"
              />
            )}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-xs text-gray-300">
            {texts["detail.last_snapshot"] || "최근 수집"} {formatDate(meta.last_snapshot_at)}
          </p>
          {meta.pending_ai_trigger && (
            <span className="badge bg-yellow-50 text-yellow-600 mt-1 text-xs">
              {texts["detail.analysis.pending"] || "AI 분석 대기 중"}
            </span>
          )}
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={tab === t.id ? "tab-active" : "tab-inactive"}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      {tab === "rating" && (
        <div className="space-y-6">
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-gray-500 mb-4">
              {texts["detail.rating.title"] || "평점 추이"}
            </h2>
            <RatingChart events={timeline} />
            {/* 차트 범례 설명 */}
            <div className="flex gap-4 mt-3 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <span className="inline-block w-4 h-0.5 bg-indigo-400" />
                {texts["detail.chart.version_line"] || "버전 출시"}
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-4 h-0.5 bg-red-400" />
                {texts["detail.chart.shift_line"] || "평점 급변"}
              </span>
            </div>
            <p className="mt-2 text-xs text-gray-300">
              {texts["detail.chart.subtitle"] || "월별 긍정 리뷰 비율 (rating ≥ 4)"}
            </p>
          </div>
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-gray-500 mb-4">
              {texts["detail.timeline.title"] || "이벤트 타임라인"}
            </h2>
            <TimelineView events={timeline} analyses={analyses} />
          </div>
        </div>
      )}

      {tab === "analysis" && (
        <div className="space-y-4">
          {analyses.length === 0 ? (
            <div className="text-sm text-gray-400 py-10 text-center">
              {meta.ai_approved
                ? texts["detail.analysis.no_data"] || "아직 분석 결과가 없습니다."
                : texts["detail.analysis.not_approved"] || "관리자 AI 분석 승인 대기 중입니다."}
            </div>
          ) : (
            [...analyses]
              .sort((a, b) => (b.created_at > a.created_at ? 1 : -1))
              .map((analysis) => (
                <div key={analysis.analysis_id} className="card p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="badge bg-indigo-50 text-indigo-600">{analysis.period_label}</span>
                    <span className="text-xs text-gray-400">{formatDate(analysis.created_at)}</span>
                  </div>
                  <AnalysisCard analysis={analysis} />
                </div>
              ))
          )}
        </div>
      )}

      {tab === "reviews" && (
        <div className="card p-5">
          <ReviewList googleReviews={google_reviews} appleReviews={apple_reviews} />
        </div>
      )}
    </div>
  );
}

function RatingPill({ label, rating, color }: { label: string; rating: number | null; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs font-medium" style={{ color }}>{label}</span>
      <span className={`text-lg font-bold ${ratingColor(rating)}`}>
        ★ {formatRating(rating)}
      </span>
    </div>
  );
}
