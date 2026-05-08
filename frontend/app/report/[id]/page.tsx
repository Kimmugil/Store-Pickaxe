"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Analysis, Review, AppMeta } from "@/lib/types";

interface ReportData {
  analysis: Analysis;
  meta: AppMeta;
  google_reviews: Review[];
  apple_reviews: Review[];
}

type Tab = "summary" | "platform" | "reviews";

function ReportContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const analysisId = params.id as string;
  const appKey = searchParams.get("app_key") || "";

  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("summary");
  const [reviewPlatform, setReviewPlatform] = useState<"google" | "apple">("google");

  useEffect(() => {
    if (!appKey || !analysisId) return;
    fetch(`/api/report?app_key=${appKey}&analysis_id=${analysisId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { setData(d); setLoading(false); });
  }, [appKey, analysisId]);

  if (loading) return <SkeletonReport />;
  if (!data) return (
    <div className="text-center py-20">
      <p className="font-bold" style={{ color: "#1A1A1A" }}>리포트를 불러올 수 없습니다</p>
      <Link href={appKey ? `/${appKey}` : "/"} className="neo-button mt-4 inline-flex">
        ← 돌아가기
      </Link>
    </div>
  );

  const { analysis, meta, google_reviews, apple_reviews } = data;

  return (
    <div className="space-y-6">
      {/* 뒤로 가기 */}
      <Link href={`/${appKey}`} className="inline-flex items-center gap-2 text-sm font-bold" style={{ color: "#9CA3AF" }}>
        <ArrowLeft size={14} />
        {meta.app_name}
      </Link>

      {/* 리포트 헤더 */}
      <div className="card overflow-hidden">
        <div className="p-6" style={{ borderBottom: "2px solid #1A1A1A" }}>
          <div className="flex items-start gap-4">
            {meta.icon_url && (
              <img
                src={meta.icon_url}
                alt={meta.app_name}
                width={56}
                height={56}
                className="rounded-xl flex-shrink-0"
                style={{ border: "2px solid #1A1A1A" }}
              />
            )}
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="font-black text-xl" style={{ color: "#1A1A1A" }}>{meta.app_name}</h1>
                <span
                  className="text-xs font-black px-2 py-0.5 rounded-full"
                  style={{ background: "#F0EFEC", border: "1.5px solid #1A1A1A" }}
                >
                  {analysis.mode === "onboarding" ? "전체 분석" : "업데이트 분석"}
                </span>
              </div>
              <p className="text-sm mt-1" style={{ color: "#9CA3AF" }}>
                {analysis.review_scope} · 샘플 {analysis.sample_count_google + analysis.sample_count_apple}건 ·{" "}
                {formatDate(analysis.created_at)}
              </p>
            </div>
          </div>
        </div>
        {/* AI 한줄평 */}
        <div className="px-6 py-4" style={{ background: "#FFFDE7" }}>
          <p className="text-sm italic leading-relaxed" style={{ color: "#1A1A1A" }}>
            {analysis.overall_summary}
          </p>
        </div>
      </div>

      {/* 탭 */}
      <div className="tab-nav">
        {([["summary", "종합 요약"], ["platform", "플랫폼 비교"], ["reviews", "리뷰 목록"]] as [Tab, string][]).map(([tab, label]) => (
          <button
            key={tab}
            className={`tab-item ${activeTab === tab ? "active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      {activeTab === "summary" && <SummaryTab analysis={analysis} />}
      {activeTab === "platform" && <PlatformTab analysis={analysis} />}
      {activeTab === "reviews" && (
        <ReviewsTab
          google_reviews={google_reviews}
          apple_reviews={apple_reviews}
          platform={reviewPlatform}
          onPlatformChange={setReviewPlatform}
        />
      )}
    </div>
  );
}

export default function ReportPage() {
  return (
    <Suspense fallback={<SkeletonReport />}>
      <ReportContent />
    </Suspense>
  );
}

// ─── 탭 컴포넌트 ─────────────────────────────────────────────────

function SummaryTab({ analysis }: { analysis: Analysis }) {
  return (
    <div className="space-y-5">
      {/* 긍정도 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {analysis.google_sentiment !== null && (
          <SentimentCard
            label="Google Play 긍정도"
            score={analysis.google_sentiment}
            keywords={analysis.keywords_google}
            color="#4285F4"
          />
        )}
        {analysis.apple_sentiment !== null && (
          <SentimentCard
            label="App Store 긍정도"
            score={analysis.apple_sentiment}
            keywords={analysis.keywords_apple}
            color="#1A1A1A"
          />
        )}
      </div>

      {/* 주요 불만 */}
      {analysis.main_complaints.length > 0 && (
        <div className="card p-5 space-y-3">
          <h3 className="font-black text-sm uppercase tracking-wide" style={{ color: "#1A1A1A" }}>
            주요 불만
          </h3>
          <ul className="space-y-2">
            {analysis.main_complaints.map((c, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="flex-shrink-0 font-black text-base" style={{ color: "#FF6B6B" }}>✗</span>
                <span style={{ color: "#4A4A4A" }}>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 주요 칭찬 */}
      {analysis.main_praises.length > 0 && (
        <div className="card p-5 space-y-3">
          <h3 className="font-black text-sm uppercase tracking-wide" style={{ color: "#1A1A1A" }}>
            주요 칭찬
          </h3>
          <ul className="space-y-2">
            {analysis.main_praises.map((p, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="flex-shrink-0 font-black text-base" style={{ color: "#56D0A0" }}>✓</span>
                <span style={{ color: "#4A4A4A" }}>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function SentimentCard({
  label, score, keywords, color,
}: { label: string; score: number; keywords: string[]; color: string }) {
  const sentimentClass = score >= 60 ? "sentiment-pos" : score >= 40 ? "sentiment-mixed" : "sentiment-neg";
  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-black uppercase tracking-wide" style={{ color: "#9CA3AF" }}>{label}</span>
        <span className={sentimentClass}>{score}%</span>
      </div>
      {/* 진행 바 */}
      <div className="h-2 rounded-full overflow-hidden" style={{ background: "#F0EFEC", border: "1.5px solid #E2E8F0" }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${score}%`, background: color }}
        />
      </div>
      {keywords.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {keywords.map((k, i) => (
            <span
              key={i}
              className="text-xs font-bold px-2.5 py-0.5 rounded-full"
              style={{ background: "#F0EFEC", border: "1.5px solid #E2E8F0", color: "#4A4A4A" }}
            >
              {k}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function PlatformTab({ analysis }: { analysis: Analysis }) {
  const hasDiff = analysis.platform_diff && analysis.platform_diff.trim();
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Google */}
        <div className="card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="font-black text-sm" style={{ color: "#4285F4" }}>Google Play</span>
            {analysis.google_sentiment !== null && (
              <span className={analysis.google_sentiment >= 60 ? "sentiment-pos" : analysis.google_sentiment >= 40 ? "sentiment-mixed" : "sentiment-neg"}>
                {analysis.google_sentiment}%
              </span>
            )}
          </div>
          <p className="text-xs" style={{ color: "#9CA3AF" }}>샘플 {analysis.sample_count_google}건</p>
          <div className="flex flex-wrap gap-1.5">
            {analysis.keywords_google.map((k, i) => (
              <span key={i} className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#EFF6FF", border: "1.5px solid #BFDBFE", color: "#1D4ED8" }}>
                {k}
              </span>
            ))}
          </div>
        </div>

        {/* Apple */}
        <div className="card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="font-black text-sm" style={{ color: "#1A1A1A" }}>App Store</span>
            {analysis.apple_sentiment !== null && (
              <span className={analysis.apple_sentiment >= 60 ? "sentiment-pos" : analysis.apple_sentiment >= 40 ? "sentiment-mixed" : "sentiment-neg"}>
                {analysis.apple_sentiment}%
              </span>
            )}
          </div>
          <p className="text-xs" style={{ color: "#9CA3AF" }}>샘플 {analysis.sample_count_apple}건</p>
          <div className="flex flex-wrap gap-1.5">
            {analysis.keywords_apple.map((k, i) => (
              <span key={i} className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#F0EFEC", border: "1.5px solid #D1D5DB", color: "#4A4A4A" }}>
                {k}
              </span>
            ))}
          </div>
        </div>
      </div>

      {hasDiff && (
        <div className="card p-5">
          <h3 className="font-black text-sm mb-2" style={{ color: "#1A1A1A" }}>플랫폼 간 주요 차이</h3>
          <p className="text-sm leading-relaxed" style={{ color: "#4A4A4A" }}>{analysis.platform_diff}</p>
        </div>
      )}
    </div>
  );
}

function ReviewsTab({
  google_reviews, apple_reviews, platform, onPlatformChange,
}: {
  google_reviews: Review[];
  apple_reviews: Review[];
  platform: "google" | "apple";
  onPlatformChange: (p: "google" | "apple") => void;
}) {
  const reviews = platform === "google" ? google_reviews : apple_reviews;
  const [minRating, setMinRating] = useState(0);
  const filtered = minRating > 0 ? reviews.filter((r) => r.rating === minRating) : reviews;

  return (
    <div className="space-y-4">
      {/* 필터 */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex rounded-xl overflow-hidden" style={{ border: "2px solid #1A1A1A" }}>
          {(["google", "apple"] as const).map((p) => (
            <button
              key={p}
              onClick={() => onPlatformChange(p)}
              className="px-4 py-2 text-sm font-bold transition-colors"
              style={{
                background: platform === p ? "#1A1A1A" : "#FFFFFF",
                color: platform === p ? "#FFFFFF" : "#1A1A1A",
                borderRight: p === "google" ? "1px solid #1A1A1A" : undefined,
              }}
            >
              {p === "google" ? "Google Play" : "App Store"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          {[0, 1, 2, 3, 4, 5].map((r) => (
            <button
              key={r}
              onClick={() => setMinRating(r)}
              className="px-2.5 py-1 text-xs font-bold rounded-full"
              style={{
                background: minRating === r ? "#FFD600" : "#F0EFEC",
                border: "1.5px solid #1A1A1A",
                color: "#1A1A1A",
              }}
            >
              {r === 0 ? "전체" : `★${r}`}
            </button>
          ))}
        </div>
      </div>

      {/* 리뷰 리스트 */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: "#9CA3AF" }}>해당하는 리뷰가 없습니다</p>
        ) : (
          filtered.slice(0, 50).map((review) => (
            <div key={review.review_id} className="card p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span key={i} style={{ color: i < review.rating ? "#FFD600" : "#E2E8F0", fontSize: 14 }}>★</span>
                  ))}
                </div>
                <span className="text-xs" style={{ color: "#9CA3AF" }}>
                  {review.app_version && `v${review.app_version} · `}{formatDate(review.reviewed_at)}
                </span>
              </div>
              {review.title && (
                <p className="font-bold text-sm" style={{ color: "#1A1A1A" }}>{review.title}</p>
              )}
              <p className="text-sm leading-relaxed" style={{ color: "#4A4A4A" }}>{review.content}</p>
              {(review.thumbs_up ?? 0) > 0 && (
                <p className="text-xs" style={{ color: "#9CA3AF" }}>도움됨 {review.thumbs_up}</p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── 헬퍼 ────────────────────────────────────────────────────────

function formatDate(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function SkeletonReport() {
  return (
    <div className="space-y-6">
      <div className="skeleton h-5 w-24 rounded-full" />
      <div className="skeleton h-36 w-full rounded-2xl" />
      <div className="skeleton h-8 w-72 rounded-full" />
      <div className="skeleton h-48 w-full rounded-2xl" />
    </div>
  );
}
