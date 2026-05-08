"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";
import type { AppMeta, CollectionLog, Analysis } from "@/lib/types";

interface AppDetailData {
  meta: AppMeta;
  logs: CollectionLog[];
  analyses: Analysis[];
}

export default function AppDetailPage() {
  const params = useParams();
  const appKey = params.app_key as string;

  const [data, setData] = useState<AppDetailData | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch(`/api/apps/${appKey}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, [appKey]);

  if (loading) return <SkeletonDetail />;
  if (!data) return (
    <div className="text-center py-20">
      <p className="font-bold text-lg" style={{ color: "#1A1A1A" }}>앱을 찾을 수 없습니다</p>
      <Link href="/" className="neo-button mt-4 inline-flex">← 목록으로</Link>
    </div>
  );

  const { meta, logs, analyses } = data;
  const sortedAnalyses = [...analyses].sort((a, b) => (b.created_at > a.created_at ? 1 : -1));

  return (
    <div className="space-y-6">
      {/* 뒤로 가기 */}
      <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold" style={{ color: "#9CA3AF" }}>
        <ArrowLeft size={14} />
        목록으로
      </Link>

      {/* 앱 정보 카드 */}
      <div className="card p-6">
        <div className="flex items-start gap-5">
          {meta.icon_url ? (
            <img
              src={meta.icon_url}
              alt={meta.app_name}
              width={72}
              height={72}
              className="rounded-2xl flex-shrink-0"
              style={{ border: "2px solid #1A1A1A" }}
            />
          ) : (
            <div
              className="flex-shrink-0 rounded-2xl flex items-center justify-center font-black text-2xl"
              style={{ width: 72, height: 72, background: "#F0EFEC", border: "2px solid #1A1A1A" }}
            >
              {meta.app_name.charAt(0)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="font-black text-2xl" style={{ color: "#1A1A1A", letterSpacing: "-0.02em" }}>
                {meta.app_name}
              </h1>
              {meta.pending_analysis && (
                <span
                  className="text-xs font-bold px-2.5 py-1 rounded-full"
                  style={{ background: "#FEF9C3", border: "1.5px solid #FDE047", color: "#854D0E" }}
                >
                  분석 대기중
                </span>
              )}
            </div>
            <p className="text-sm mt-1" style={{ color: "#9CA3AF" }}>{meta.developer}</p>
            <div className="flex items-center gap-4 mt-3 flex-wrap">
              {meta.google_rating && (
                <span className="text-sm font-bold" style={{ color: "#4285F4" }}>
                  Google ★{Number(meta.google_rating).toFixed(1)}
                </span>
              )}
              {meta.apple_rating && (
                <span className="text-sm font-bold" style={{ color: "#1A1A1A" }}>
                  Apple ★{Number(meta.apple_rating).toFixed(1)}
                </span>
              )}
              {(meta.google_review_count ?? 0) > 0 && (
                <span className="text-xs" style={{ color: "#9CA3AF" }}>
                  수집된 리뷰 Google {(meta.google_review_count ?? 0).toLocaleString()} · Apple {(meta.apple_review_count ?? 0).toLocaleString()}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 수집 이력 */}
      {logs.length > 0 && (
        <div className="card p-6 space-y-4">
          <h2 className="font-black text-base" style={{ color: "#1A1A1A" }}>수집 이력</h2>
          <div className="space-y-2">
            {[...logs].reverse().slice(0, 5).map((log, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-4 py-2 rounded-xl text-sm"
                style={{ background: "#F0EFEC", border: "1.5px solid #E2E8F0" }}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="text-xs font-black px-2 py-0.5 rounded-full"
                    style={{
                      background: log.mode === "onboarding" ? "#1A1A1A" : "#E2E8F0",
                      color: log.mode === "onboarding" ? "#FFFFFF" : "#4A4A4A",
                    }}
                  >
                    {log.mode === "onboarding" ? "전체" : "신규"}
                  </span>
                  <span style={{ color: "#4A4A4A" }}>
                    Google +{log.google_added} · Apple +{log.apple_added}
                  </span>
                </div>
                <span className="text-xs" style={{ color: "#9CA3AF" }}>
                  {formatDate(log.collected_at)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 분석 리포트 목록 */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-black text-base" style={{ color: "#1A1A1A" }}>AI 분석 리포트</h2>
          {meta.pending_analysis && (
            <span className="text-xs" style={{ color: "#9CA3AF" }}>
              관리자 승인 후 분석이 시작됩니다
            </span>
          )}
        </div>

        {sortedAnalyses.length === 0 ? (
          <div
            className="py-10 text-center rounded-xl"
            style={{ background: "#F0EFEC", border: "1.5px solid #E2E8F0" }}
          >
            <p className="text-sm" style={{ color: "#9CA3AF" }}>
              {meta.pending_analysis
                ? "분석 승인 대기중입니다"
                : (meta.google_review_count ?? 0) + (meta.apple_review_count ?? 0) > 0
                ? "리뷰가 수집되었습니다 — 관리자가 분석을 승인하면 결과가 표시됩니다"
                : "아직 수집된 리뷰가 없습니다"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedAnalyses.map((analysis) => (
              <Link
                key={analysis.analysis_id}
                href={`/report/${analysis.analysis_id}?app_key=${appKey}`}
                className="block card-hover p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span
                        className="text-xs font-black px-2 py-0.5 rounded-full"
                        style={{ background: "#F0EFEC", border: "1.5px solid #1A1A1A", color: "#1A1A1A" }}
                      >
                        {analysis.mode === "onboarding" ? "전체 분석" : "업데이트"}
                      </span>
                      <span className="text-xs" style={{ color: "#9CA3AF" }}>
                        {analysis.review_scope}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: "#4A4A4A" }}>
                      {analysis.overall_summary}
                    </p>
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      {analysis.google_sentiment !== null && (
                        <span className="text-xs font-bold" style={{ color: "#4285F4" }}>
                          Google {analysis.google_sentiment}%
                        </span>
                      )}
                      {analysis.apple_sentiment !== null && (
                        <span className="text-xs font-bold" style={{ color: "#1A1A1A" }}>
                          Apple {analysis.apple_sentiment}%
                        </span>
                      )}
                      <span className="text-xs" style={{ color: "#9CA3AF" }}>
                        샘플 {analysis.sample_count_google + analysis.sample_count_apple}건
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <span className="text-xs" style={{ color: "#9CA3AF" }}>
                      {formatDate(analysis.created_at)}
                    </span>
                    <ChevronRight size={16} style={{ color: "#9CA3AF" }} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function formatDate(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function SkeletonDetail() {
  return (
    <div className="space-y-6">
      <div className="skeleton h-5 w-24 rounded-full" />
      <div className="skeleton h-40 w-full rounded-2xl" />
      <div className="skeleton h-32 w-full rounded-2xl" />
      <div className="skeleton h-48 w-full rounded-2xl" />
    </div>
  );
}
