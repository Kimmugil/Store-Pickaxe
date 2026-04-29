"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import { ArrowLeft, Clock, Sparkles } from "lucide-react";
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
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-center space-y-3">
          <div
            className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center text-2xl animate-bounce"
            style={{ background: "#FFD600", border: "2px solid #1A1A1A" }}
          >
            ⛏
          </div>
          <p className="text-sm font-bold text-[#9CA3AF]">
            {texts["common.loading"] || "로딩 중..."}
          </p>
        </div>
      </div>
    );
  }
  if (!data?.meta) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-center space-y-3">
          <p className="text-sm font-bold" style={{ color: "#FF6B6B" }}>
            {texts["common.error"] || "앱을 찾을 수 없습니다."}
          </p>
          <Link href="/" className="neo-button-secondary text-sm">
            <ArrowLeft size={14} /> 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  const { meta, timeline, analyses, google_reviews, apple_reviews } = data;
  const tabs = [
    { id: "rating" as const, label: texts["detail.tab.rating"] || "평점 추이" },
    { id: "analysis" as const, label: texts["detail.tab.analysis"] || "AI 분석" },
    { id: "reviews" as const, label: texts["detail.tab.reviews"] || "리뷰" },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back link */}
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm font-bold text-[#9CA3AF] hover:text-[#1A1A1A] transition-colors"
      >
        <ArrowLeft size={14} />
        {texts["common.back"] || "목록으로"}
      </Link>

      {/* App header card */}
      <div className="neo-card-static p-6">
        <div className="flex items-start gap-5">
          {meta.icon_url ? (
            <Image
              src={meta.icon_url}
              alt={meta.app_name}
              width={72}
              height={72}
              className="rounded-2xl flex-shrink-0"
              style={{ border: "2px solid #1A1A1A" }}
              unoptimized
            />
          ) : (
            <div
              className="w-[72px] h-[72px] rounded-2xl flex-shrink-0 flex items-center justify-center text-3xl"
              style={{ background: "#FFD600", border: "2px solid #1A1A1A" }}
            >
              🎮
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="font-black text-3xl text-[#1A1A1A] leading-tight">{meta.app_name}</h1>
            <p className="text-sm text-[#9CA3AF] mt-1 font-medium">{meta.developer}</p>
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
                  color="#1A1A1A"
                />
              )}
            </div>
          </div>
          <div className="text-right flex-shrink-0 space-y-2">
            <p className="text-xs text-[#9CA3AF] flex items-center gap-1 justify-end">
              <Clock size={10} />
              {texts["detail.last_snapshot"] || "최근 수집"} {formatDate(meta.last_snapshot_at)}
            </p>
            {meta.pending_ai_trigger && (
              <span
                className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full"
                style={{ background: "#FFFDE7", color: "#B7960A", border: "1.5px solid #B7960A" }}
              >
                <Sparkles size={10} />
                {texts["detail.analysis.pending"] || "AI 분석 대기 중"}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
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

      {/* Tab content */}
      {tab === "rating" && (
        <div className="space-y-5">
          {/* Chart card */}
          <div className="neo-card-static p-6">
            <h2 className="font-black text-sm text-[#4A4A4A] mb-4 uppercase tracking-wider">
              {texts["detail.rating.title"] || "평점 추이"}
            </h2>
            <RatingChart events={timeline} />
            {/* Legend */}
            <div className="flex gap-4 mt-4 text-xs text-[#9CA3AF]">
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block w-4 h-0.5 rounded"
                  style={{ background: "#6366f1" }}
                />
                {texts["detail.chart.version_line"] || "버전 출시"}
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block w-4 h-0.5 rounded"
                  style={{ background: "#FF6B6B" }}
                />
                {texts["detail.chart.shift_line"] || "평점 급변"}
              </span>
            </div>
            <p className="mt-2 text-xs text-[#9CA3AF] font-medium">
              {texts["detail.chart.subtitle"] || "월별 긍정 리뷰 비율 (rating ≥ 4)"}
            </p>
          </div>

          {/* Timeline card */}
          <div className="neo-card-static p-6">
            <h2 className="font-black text-sm text-[#4A4A4A] mb-4 uppercase tracking-wider">
              {texts["detail.timeline.title"] || "이벤트 타임라인"}
            </h2>
            <TimelineView events={timeline} analyses={analyses} />
          </div>
        </div>
      )}

      {tab === "analysis" && (
        <div className="space-y-4">
          {analyses.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-16 rounded-2xl gap-3"
              style={{ border: "2px dashed #1A1A1A", background: "#FFFFFF" }}
            >
              <Sparkles size={32} color="#9CA3AF" />
              <p className="text-sm font-bold text-[#9CA3AF] text-center">
                {meta.ai_approved
                  ? texts["detail.analysis.no_data"] || "아직 분석 결과가 없습니다."
                  : texts["detail.analysis.not_approved"] || "관리자 AI 분석 승인 대기 중입니다."}
              </p>
            </div>
          ) : (
            [...analyses]
              .sort((a, b) => (b.created_at > a.created_at ? 1 : -1))
              .map((analysis) => (
                <div key={analysis.analysis_id} className="neo-card-static p-6">
                  <div className="flex items-center justify-between mb-4">
                    <span
                      className="text-xs font-black px-3 py-1 rounded-full"
                      style={{ background: "#EEF2FF", color: "#4338CA", border: "1.5px solid #4338CA" }}
                    >
                      {analysis.period_label}
                    </span>
                    <span className="text-xs text-[#9CA3AF] font-medium">
                      {formatDate(analysis.created_at)}
                    </span>
                  </div>
                  <AnalysisCard analysis={analysis} />
                </div>
              ))
          )}
        </div>
      )}

      {tab === "reviews" && (
        <div className="neo-card-static p-6">
          <ReviewList googleReviews={google_reviews} appleReviews={apple_reviews} />
        </div>
      )}
    </div>
  );
}

function RatingPill({ label, rating, color }: { label: string; rating: number | null; color: string }) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 rounded-full"
      style={{ border: "2px solid #1A1A1A", background: "#F0EFEC" }}
    >
      <span className="text-xs font-black" style={{ color }}>{label}</span>
      <span className={`text-base font-black ${ratingColor(rating)}`}>
        ★ {formatRating(rating)}
      </span>
    </div>
  );
}
