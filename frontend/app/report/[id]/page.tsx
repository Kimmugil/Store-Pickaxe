"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { ArrowLeft, X } from "lucide-react";
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
  const [keywordFilter, setKeywordFilter] = useState("");
  const [reviewPlatform, setReviewPlatform] = useState<"google" | "apple">("google");

  useEffect(() => {
    if (!appKey || !analysisId) return;
    fetch(`/api/report?app_key=${appKey}&analysis_id=${analysisId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { setData(d); setLoading(false); });
  }, [appKey, analysisId]);

  function handleKeywordClick(keyword: string) {
    setKeywordFilter(keyword);
    setActiveTab("reviews");
  }

  if (loading) return <SkeletonReport />;
  if (!data) return (
    <div className="text-center py-20">
      <p className="font-bold" style={{ color: "#1A1A1A" }}>리포트를 불러올 수 없습니다</p>
      <Link href={appKey ? `/${appKey}` : "/"} className="neo-button mt-4 inline-flex">← 돌아가기</Link>
    </div>
  );

  const { analysis, meta, google_reviews, apple_reviews } = data;

  return (
    <div className="space-y-6">
      <Link href={`/${appKey}`} className="inline-flex items-center gap-2 text-sm font-bold" style={{ color: "#9CA3AF" }}>
        <ArrowLeft size={14} />
        {meta.app_name}
      </Link>

      {/* 리포트 헤더 */}
      <div className="card overflow-hidden">
        <div className="p-6" style={{ borderBottom: "2px solid #1A1A1A" }}>
          <div className="flex items-start gap-4">
            {meta.icon_url && (
              <img src={meta.icon_url} alt={meta.app_name} width={56} height={56}
                className="rounded-xl flex-shrink-0" style={{ border: "2px solid #1A1A1A" }} />
            )}
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="font-black text-xl" style={{ color: "#1A1A1A" }}>{meta.app_name}</h1>
                <span className="text-xs font-black px-2 py-0.5 rounded-full"
                  style={{ background: "#F0EFEC", border: "1.5px solid #1A1A1A" }}>
                  전체 분석
                </span>
              </div>
              <p className="text-sm mt-1" style={{ color: "#9CA3AF" }}>
                {analysis.review_scope} · 샘플 {analysis.sample_count_google + analysis.sample_count_apple}건 · {formatDate(analysis.created_at)}
              </p>
            </div>
          </div>
        </div>
        <div className="px-6 py-4" style={{ background: "#FFFDE7" }}>
          <p className="text-sm italic leading-relaxed" style={{ color: "#1A1A1A" }}>
            {analysis.overall_summary}
          </p>
        </div>
      </div>

      {/* 탭 */}
      <div className="tab-nav">
        {([["summary", "종합 요약"], ["platform", "플랫폼 비교"], ["reviews", "리뷰 목록"]] as [Tab, string][]).map(([tab, label]) => (
          <button key={tab} className={`tab-item ${activeTab === tab ? "active" : ""}`}
            onClick={() => setActiveTab(tab)}>
            {label}
            {tab === "reviews" && keywordFilter && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs font-black"
                style={{ background: "#FFD600", color: "#1A1A1A", fontSize: 10 }}>
                필터 중
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === "summary" && (
        <SummaryTab
          analysis={analysis}
          googleReviews={google_reviews}
          appleReviews={apple_reviews}
          onKeywordClick={handleKeywordClick}
        />
      )}
      {activeTab === "platform" && (
        <PlatformTab analysis={analysis} onKeywordClick={handleKeywordClick} />
      )}
      {activeTab === "reviews" && (
        <ReviewsTab
          google_reviews={google_reviews}
          apple_reviews={apple_reviews}
          platform={reviewPlatform}
          onPlatformChange={setReviewPlatform}
          keywordFilter={keywordFilter}
          onKeywordFilterChange={setKeywordFilter}
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

// ─── 종합 요약 탭 ────────────────────────────────────────────────

function SummaryTab({
  analysis, googleReviews, appleReviews, onKeywordClick,
}: {
  analysis: Analysis;
  googleReviews: Review[];
  appleReviews: Review[];
  onKeywordClick: (k: string) => void;
}) {
  const allReviews = [...googleReviews, ...appleReviews];
  return (
    <div className="space-y-5">
      {/* 분석 기준 메타데이터 */}
      <div className="rounded-xl px-5 py-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs"
        style={{ background: "#F0EFEC", border: "1.5px solid #E2E8F0" }}>
        <MetaCell label="분석 시점" value={formatDate(analysis.created_at)} />
        <MetaCell label="샘플 수" value={`Google ${analysis.sample_count_google}건 + Apple ${analysis.sample_count_apple}건`} />
        <MetaCell label="샘플 리뷰 기간"
          value={analysis.sample_date_min && analysis.sample_date_max
            ? `${analysis.sample_date_min} ~ ${analysis.sample_date_max}` : "—"} />
        <MetaCell label="샘플링 기준" value="저평점 40% · 고평점 40% · 중간 20%" />
      </div>

      {/* 긍정도 + 평점 분포 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {analysis.google_sentiment !== null && (
          <SentimentCard label="Google Play 긍정도" score={analysis.google_sentiment}
            keywords={analysis.keywords_google} color="#4285F4" onKeywordClick={onKeywordClick} />
        )}
        {analysis.apple_sentiment !== null && (
          <SentimentCard label="App Store 긍정도" score={analysis.apple_sentiment}
            keywords={analysis.keywords_apple} color="#1A1A1A" onKeywordClick={onKeywordClick} />
        )}
      </div>

      {/* 평점 분포 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {googleReviews.length > 0 && (
          <RatingDistribution reviews={googleReviews} color="#4285F4" label="Google Play 평점 분포" />
        )}
        {appleReviews.length > 0 && (
          <RatingDistribution reviews={appleReviews} color="#1A1A1A" label="App Store 평점 분포" />
        )}
      </div>

      {/* 주요 불만 */}
      {analysis.main_complaints.length > 0 && (
        <div className="card p-5 space-y-4">
          <h3 className="font-black text-sm uppercase tracking-wide" style={{ color: "#1A1A1A" }}>주요 불만</h3>
          <div className="space-y-4">
            {analysis.main_complaints.map((c, i) => (
              <ComplaintPraiseItem key={i} text={c} type="complaint" allReviews={allReviews} />
            ))}
          </div>
        </div>
      )}

      {/* 주요 칭찬 */}
      {analysis.main_praises.length > 0 && (
        <div className="card p-5 space-y-4">
          <h3 className="font-black text-sm uppercase tracking-wide" style={{ color: "#1A1A1A" }}>주요 칭찬</h3>
          <div className="space-y-4">
            {analysis.main_praises.map((p, i) => (
              <ComplaintPraiseItem key={i} text={p} type="praise" allReviews={allReviews} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 평점 분포 ────────────────────────────────────────────────────

function RatingDistribution({ reviews, color, label }: { reviews: Review[]; color: string; label: string }) {
  const total = reviews.length;
  const counts = [5, 4, 3, 2, 1].map((r) => ({
    star: r,
    count: reviews.filter((rv) => rv.rating === r).length,
  }));
  const max = Math.max(...counts.map((c) => c.count), 1);

  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-black uppercase tracking-wide" style={{ color: "#9CA3AF" }}>{label}</span>
        <span className="text-xs" style={{ color: "#9CA3AF" }}>{total.toLocaleString()}건</span>
      </div>
      {counts.map(({ star, count }) => {
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        return (
          <div key={star} className="flex items-center gap-2">
            <span className="text-xs font-bold w-5 flex-shrink-0" style={{ color: "#9CA3AF" }}>★{star}</span>
            <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "#F0EFEC" }}>
              <div className="h-full rounded-full transition-all"
                style={{ width: `${(count / max) * 100}%`, background: color }} />
            </div>
            <span className="text-xs w-12 text-right flex-shrink-0" style={{ color: "#9CA3AF" }}>
              {count.toLocaleString()} ({pct}%)
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── 불만/칭찬 + 리뷰 인용 ──────────────────────────────────────

function findRelatedReviews(text: string, reviews: Review[], max = 2): Review[] {
  const words = text
    .split(/[\s\/,·]+/)
    .map((w) => w.replace(/['"''""\[\]()]/g, "").trim())
    .filter((w) => w.length >= 2);
  if (words.length === 0) return [];

  return reviews
    .map((r) => {
      const content = (r.content || "").toLowerCase();
      const matches = words.filter((w) => content.includes(w.toLowerCase())).length;
      return { review: r, matches };
    })
    .filter(({ matches }) => matches > 0)
    .sort((a, b) => b.matches - a.matches)
    .slice(0, max)
    .map(({ review }) => review);
}

function ComplaintPraiseItem({
  text, type, allReviews,
}: {
  text: string;
  type: "complaint" | "praise";
  allReviews: Review[];
}) {
  const related = findRelatedReviews(text, allReviews);
  const accentColor = type === "complaint" ? "#FF6B6B" : "#56D0A0";
  const symbol = type === "complaint" ? "✗" : "✓";

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2 text-sm">
        <span className="flex-shrink-0 font-black text-base" style={{ color: accentColor }}>{symbol}</span>
        <span className="font-bold" style={{ color: "#1A1A1A" }}>{text}</span>
      </div>
      {related.length > 0 && (
        <div className="ml-5 space-y-1.5">
          {related.map((r) => (
            <div key={r.review_id} className="rounded-xl px-3 py-2"
              style={{ background: "#F0EFEC", border: "1.5px solid #E2E8F0" }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold" style={{ color: "#9CA3AF" }}>
                  {"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}
                </span>
                {r.reviewed_at && (
                  <span className="text-xs" style={{ color: "#9CA3AF" }}>{formatDate(r.reviewed_at)}</span>
                )}
              </div>
              <p className="text-xs leading-relaxed line-clamp-2" style={{ color: "#4A4A4A" }}>
                {r.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── 플랫폼 비교 탭 ─────────────────────────────────────────────

function PlatformTab({ analysis, onKeywordClick }: { analysis: Analysis; onKeywordClick: (k: string) => void }) {
  const hasDiff = analysis.platform_diff && analysis.platform_diff.trim();
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <button key={i} onClick={() => onKeywordClick(k)}
                className="text-xs font-bold px-2 py-0.5 rounded-full transition-colors hover:opacity-80"
                style={{ background: "#EFF6FF", border: "1.5px solid #BFDBFE", color: "#1D4ED8", cursor: "pointer" }}>
                {k}
              </button>
            ))}
          </div>
        </div>

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
              <button key={i} onClick={() => onKeywordClick(k)}
                className="text-xs font-bold px-2 py-0.5 rounded-full transition-colors hover:opacity-80"
                style={{ background: "#F0EFEC", border: "1.5px solid #D1D5DB", color: "#4A4A4A", cursor: "pointer" }}>
                {k}
              </button>
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

// ─── 리뷰 목록 탭 ───────────────────────────────────────────────

function ReviewsTab({
  google_reviews, apple_reviews, platform, onPlatformChange, keywordFilter, onKeywordFilterChange,
}: {
  google_reviews: Review[];
  apple_reviews: Review[];
  platform: "google" | "apple";
  onPlatformChange: (p: "google" | "apple") => void;
  keywordFilter: string;
  onKeywordFilterChange: (s: string) => void;
}) {
  const [minRating, setMinRating] = useState(0);
  const reviews = platform === "google" ? google_reviews : apple_reviews;

  const filtered = reviews.filter((r) => {
    const ratingOk = minRating === 0 || r.rating === minRating;
    const keywordOk = !keywordFilter || (r.content || "").includes(keywordFilter);
    return ratingOk && keywordOk;
  });

  return (
    <div className="space-y-4">
      {/* 플랫폼 토글 */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex rounded-xl overflow-hidden" style={{ border: "2px solid #1A1A1A" }}>
          {(["google", "apple"] as const).map((p) => (
            <button key={p} onClick={() => onPlatformChange(p)}
              className="px-4 py-2 text-sm font-bold transition-colors"
              style={{
                background: platform === p ? "#1A1A1A" : "#FFFFFF",
                color: platform === p ? "#FFFFFF" : "#1A1A1A",
                borderRight: p === "google" ? "1px solid #1A1A1A" : undefined,
              }}>
              {p === "google" ? "Google Play" : "App Store"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          {[0, 1, 2, 3, 4, 5].map((r) => (
            <button key={r} onClick={() => setMinRating(r)}
              className="px-2.5 py-1 text-xs font-bold rounded-full"
              style={{
                background: minRating === r ? "#FFD600" : "#F0EFEC",
                border: "1.5px solid #1A1A1A",
                color: "#1A1A1A",
              }}>
              {r === 0 ? "전체" : `★${r}`}
            </button>
          ))}
        </div>
      </div>

      {/* 키워드 필터 */}
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <input
            value={keywordFilter}
            onChange={(e) => onKeywordFilterChange(e.target.value)}
            placeholder="리뷰 내 키워드 검색..."
            className="neo-input w-full pr-8"
          />
          {keywordFilter && (
            <button onClick={() => onKeywordFilterChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2"
              style={{ color: "#9CA3AF" }}>
              <X size={14} />
            </button>
          )}
        </div>
        <span className="text-xs flex-shrink-0" style={{ color: "#9CA3AF" }}>
          {filtered.length.toLocaleString()}건
        </span>
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
              <p className="text-sm leading-relaxed" style={{ color: "#4A4A4A" }}>
                {highlightKeyword(review.content, keywordFilter)}
              </p>
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

// ─── 긍정도 카드 (키워드 클릭 가능) ────────────────────────────

function SentimentCard({
  label, score, keywords, color, onKeywordClick,
}: {
  label: string;
  score: number;
  keywords: string[];
  color: string;
  onKeywordClick: (k: string) => void;
}) {
  const sentimentClass = score >= 60 ? "sentiment-pos" : score >= 40 ? "sentiment-mixed" : "sentiment-neg";
  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-black uppercase tracking-wide" style={{ color: "#9CA3AF" }}>{label}</span>
        <span className={sentimentClass}>{score}%</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: "#F0EFEC", border: "1.5px solid #E2E8F0" }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, background: color }} />
      </div>
      {keywords.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {keywords.map((k, i) => (
            <button key={i} onClick={() => onKeywordClick(k)}
              title="클릭하면 관련 리뷰 보기"
              className="text-xs font-bold px-2.5 py-0.5 rounded-full transition-opacity hover:opacity-70"
              style={{ background: "#F0EFEC", border: "1.5px solid #E2E8F0", color: "#4A4A4A", cursor: "pointer" }}>
              {k}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── 헬퍼 컴포넌트 ──────────────────────────────────────────────

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-black uppercase tracking-wide mb-0.5" style={{ color: "#9CA3AF", fontSize: 10 }}>{label}</p>
      <p className="font-bold leading-snug" style={{ color: "#4A4A4A", fontSize: 12 }}>{value}</p>
    </div>
  );
}

function highlightKeyword(text: string, keyword: string): React.ReactNode {
  if (!keyword || !text) return text;
  const idx = text.indexOf(keyword);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: "#FFD600", color: "#1A1A1A", borderRadius: 2, padding: "0 2px" }}>
        {text.slice(idx, idx + keyword.length)}
      </mark>
      {text.slice(idx + keyword.length)}
    </>
  );
}

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
