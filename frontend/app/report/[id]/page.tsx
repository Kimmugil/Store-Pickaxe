"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { ArrowLeft, X } from "lucide-react";
import type { Analysis, Review, AppMeta, PhaseData } from "@/lib/types";

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
      <Link href={`/${appKey}`} className="inline-flex items-center gap-2 text-sm font-semibold" style={{ color: "#9CA3AF" }}>
        <ArrowLeft size={14} />
        {meta.app_name}
      </Link>

      {/* 리포트 헤더 */}
      <div className="card overflow-hidden">
        <div className="p-5" style={{ borderBottom: "2px solid #1A1A1A" }}>
          <div className="flex items-center gap-4">
            {meta.icon_url && (
              <img src={meta.icon_url} alt={meta.app_name} width={52} height={52}
                className="rounded-xl flex-shrink-0" style={{ border: "2px solid #1A1A1A" }} />
            )}
            <div className="flex-1 min-w-0">
              <h1 className="font-black text-xl" style={{ color: "#1A1A1A", letterSpacing: "-0.02em" }}>{meta.app_name}</h1>
              <p className="text-xs mt-0.5" style={{ color: "#9CA3AF" }}>
                분석 {formatDate(analysis.created_at)} · 샘플 {(analysis.sample_count_google + analysis.sample_count_apple).toLocaleString()}건 · 한국어 리뷰
              </p>
            </div>
          </div>
        </div>
        <div className="px-5 py-4" style={{ background: "#FFFDE7" }}>
          <p className="text-sm leading-relaxed" style={{ color: "#1A1A1A" }}>
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
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full font-black"
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
        <PlatformTab
          analysis={analysis}
          googleReviews={google_reviews}
          appleReviews={apple_reviews}
          onKeywordClick={handleKeywordClick}
        />
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

// ─── 종합 요약 탭 ─────────────────────────────────────────────────

function SummaryTab({
  analysis, googleReviews, appleReviews, onKeywordClick,
}: {
  analysis: Analysis;
  googleReviews: Review[];
  appleReviews: Review[];
  onKeywordClick: (k: string) => void;
}) {
  const allReviews = [...googleReviews, ...appleReviews];
  const hasPhases = analysis.google_phase_launch || analysis.google_phase_growth || analysis.google_phase_stable;

  return (
    <div className="space-y-5">
      {/* 메타데이터 */}
      <div className="flex flex-wrap gap-x-5 gap-y-1 px-4 py-3 rounded-xl text-xs"
        style={{ background: "#F0EFEC", border: "1.5px solid #E2E8F0" }}>
        <span style={{ color: "#9CA3AF" }}>
          <span className="font-semibold" style={{ color: "#6B7280" }}>샘플</span>{" "}
          Google {analysis.sample_count_google}건 + Apple {analysis.sample_count_apple}건
        </span>
        {analysis.sample_date_min && analysis.sample_date_max && (
          <span style={{ color: "#9CA3AF" }}>
            <span className="font-semibold" style={{ color: "#6B7280" }}>기간</span>{" "}
            {analysis.sample_date_min} ~ {analysis.sample_date_max}
          </span>
        )}
        <span style={{ color: "#9CA3AF" }}>
          <span className="font-semibold" style={{ color: "#6B7280" }}>수집 대상</span>{" "}
          한국어 리뷰 · App Store 최근 ~500건 / Google Play 전체
        </span>
      </div>

      {/* 주요 불만 + 주요 칭찬 2분할 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {analysis.main_praises.length > 0 && (
          <section className="space-y-3">
            <h3 className="text-sm font-bold" style={{ color: "#1A1A1A" }}>주요 칭찬</h3>
            <div className="space-y-3">
              {analysis.main_praises.map((p, i) => (
                <ComplaintPraiseItem key={i} text={p} type="praise" allReviews={allReviews} />
              ))}
            </div>
          </section>
        )}

        {analysis.main_complaints.length > 0 && (
          <section className="space-y-3">
            <h3 className="text-sm font-bold" style={{ color: "#1A1A1A" }}>주요 불만</h3>
            <div className="space-y-3">
              {analysis.main_complaints.map((c, i) => (
                <ComplaintPraiseItem key={i} text={c} type="complaint" allReviews={allReviews} />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* 시기별 분석 (출시일 설정 시) */}
      {hasPhases && (
        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-bold" style={{ color: "#1A1A1A" }}>Google Play 시기별 트렌드</h3>
            <p className="text-xs mt-0.5" style={{ color: "#9CA3AF" }}>
              Google Play는 전체 리뷰 수집이 가능해 시기별 분석이 지원됩니다. App Store는 최근 ~500건만 수집되어 해당 분석에서 제외됩니다.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <PhaseCard phase={analysis.google_phase_launch} label="출시 초반" subtitle="0~90일" color="#4285F4" />
            <PhaseCard phase={analysis.google_phase_growth} label="성장기" subtitle="91~365일" color="#34A853" />
            <PhaseCard phase={analysis.google_phase_stable} label="안정기" subtitle="365일+" color="#9CA3AF" />
          </div>
        </section>
      )}
    </div>
  );
}

// ─── 시기별 카드 ──────────────────────────────────────────────────

function PhaseCard({
  phase, label, subtitle, color,
}: {
  phase: PhaseData | null | undefined;
  label: string;
  subtitle: string;
  color: string;
}) {
  if (!phase) {
    return (
      <div className="rounded-xl p-4" style={{ background: "#F9F9F7", border: "1.5px solid #E2E8F0" }}>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-bold" style={{ color }}>{label}</span>
          <span className="text-xs" style={{ color: "#C4C4C4" }}>{subtitle}</span>
        </div>
        <p className="text-xs" style={{ color: "#C4C4C4" }}>데이터 없음</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl p-4 space-y-2" style={{ background: "#FFFFFF", border: "1.5px solid #E2E8F0" }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold" style={{ color }}>{label}</span>
          <span className="text-xs" style={{ color: "#C4C4C4" }}>{subtitle}</span>
        </div>
        <span className="text-xs" style={{ color: "#9CA3AF" }}>{phase.count.toLocaleString()}건</span>
      </div>
      {phase.date_from && (
        <p className="text-xs" style={{ color: "#C4C4C4" }}>{phase.date_from} ~ {phase.date_to}</p>
      )}
      <p className="text-xs leading-relaxed" style={{ color: "#4A4A4A" }}>{phase.summary}</p>
    </div>
  );
}

// ─── 불만/칭찬 + 관련 리뷰 인용 ──────────────────────────────────

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
  const accentColor = type === "complaint" ? "#EF4444" : "#10B981";

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        <span className="flex-shrink-0 font-bold text-sm mt-0.5" style={{ color: accentColor }}>
          {type === "complaint" ? "—" : "✓"}
        </span>
        <span className="text-sm font-semibold leading-snug" style={{ color: "#1A1A1A" }}>{text}</span>
      </div>
      {related.length > 0 && (
        <div className="ml-4 space-y-1.5">
          {related.map((r) => (
            <div key={r.review_id} className="pl-3" style={{ borderLeft: `2px solid ${accentColor}30` }}>
              <div className="flex items-center gap-2 mb-1">
                <StarRating rating={r.rating} size="xs" />
                {r.reviewed_at && (
                  <span className="text-xs" style={{ color: "#C4C4C4" }}>{formatDate(r.reviewed_at)}</span>
                )}
              </div>
              <p className="text-xs leading-relaxed" style={{ color: "#6B7280" }}>
                {r.content.slice(0, 130)}{r.content.length > 130 ? "…" : ""}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── 플랫폼 비교 탭 ──────────────────────────────────────────────

function PlatformTab({
  analysis, googleReviews, appleReviews, onKeywordClick,
}: {
  analysis: Analysis;
  googleReviews: Review[];
  appleReviews: Review[];
  onKeywordClick: (k: string) => void;
}) {
  return (
    <div className="space-y-5">
      {/* 평점 분포 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {googleReviews.length > 0 && (
          <RatingDistribution reviews={googleReviews} color="#4285F4" label="Google Play 평점 분포" />
        )}
        {appleReviews.length > 0 && (
          <RatingDistribution reviews={appleReviews} color="#1A1A1A" label="App Store 평점 분포" />
        )}
      </div>

      {/* 긍정도 + 키워드 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {analysis.google_sentiment !== null && (
          <SentimentCard
            label="Google Play 긍정도"
            score={analysis.google_sentiment}
            sampleCount={analysis.sample_count_google}
            keywords={analysis.keywords_google}
            color="#4285F4"
            onKeywordClick={onKeywordClick}
          />
        )}
        {analysis.apple_sentiment !== null && (
          <SentimentCard
            label="App Store 긍정도"
            score={analysis.apple_sentiment}
            sampleCount={analysis.sample_count_apple}
            keywords={analysis.keywords_apple}
            color="#1A1A1A"
            onKeywordClick={onKeywordClick}
          />
        )}
      </div>

      {/* 플랫폼 간 주요 차이 */}
      {analysis.platform_diff && analysis.platform_diff.trim() && (
        <div className="rounded-xl p-5 space-y-2" style={{ background: "#FFFFFF", border: "1.5px solid #E2E8F0" }}>
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-bold" style={{ color: "#1A1A1A" }}>플랫폼 간 주요 차이</h3>
            <span className="text-xs flex-shrink-0 px-2 py-0.5 rounded-full font-medium"
              style={{ background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE" }}>
              동기간 비교
            </span>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: "#9CA3AF" }}>
            App Store 수집 기간({analysis.sample_date_min} ~ {analysis.sample_date_max})과 동일 기간의 Google Play 리뷰를 대상으로 비교한 결과입니다.
          </p>
          <p className="text-sm leading-relaxed" style={{ color: "#4A4A4A" }}>{analysis.platform_diff}</p>
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
    <div className="rounded-xl p-5 space-y-2.5" style={{ background: "#FFFFFF", border: "1.5px solid #E2E8F0" }}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "#9CA3AF" }}>{label}</span>
        <span className="text-xs font-medium" style={{ color: "#9CA3AF" }}>{total.toLocaleString()}건</span>
      </div>
      {counts.map(({ star, count }) => {
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        return (
          <div key={star} className="flex items-center gap-3">
            <span className="text-xs font-medium w-5 flex-shrink-0 text-right" style={{ color: "#9CA3AF" }}>★{star}</span>
            <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "#F0EFEC" }}>
              <div className="h-full rounded-full"
                style={{ width: `${(count / max) * 100}%`, background: color }} />
            </div>
            <div className="flex-shrink-0 flex items-center gap-1" style={{ minWidth: 72, justifyContent: "flex-end" }}>
              <span className="text-xs font-semibold" style={{ color: "#4A4A4A" }}>{count.toLocaleString()}</span>
              <span className="text-xs" style={{ color: "#C4C4C4" }}>({pct}%)</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── 긍정도 카드 ─────────────────────────────────────────────────

function SentimentCard({
  label, score, sampleCount, keywords, color, onKeywordClick,
}: {
  label: string;
  score: number;
  sampleCount: number;
  keywords: string[];
  color: string;
  onKeywordClick: (k: string) => void;
}) {
  const sentimentClass = score >= 60 ? "sentiment-pos" : score >= 40 ? "sentiment-mixed" : "sentiment-neg";
  return (
    <div className="rounded-xl p-5 space-y-3" style={{ background: "#FFFFFF", border: "1.5px solid #E2E8F0" }}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "#9CA3AF" }}>{label}</span>
        <span className={sentimentClass}>{score}%</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: "#F0EFEC" }}>
        <div className="h-full rounded-full" style={{ width: `${score}%`, background: color }} />
      </div>
      <p className="text-xs" style={{ color: "#C4C4C4" }}>샘플 {sampleCount.toLocaleString()}건 기반</p>
      {keywords.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {keywords.map((k, i) => (
            <button key={i} onClick={() => onKeywordClick(k)}
              title="클릭하면 관련 리뷰 보기"
              className="text-xs font-medium px-2.5 py-0.5 rounded-full hover:opacity-75 transition-opacity"
              style={{ background: "#F0EFEC", border: "1px solid #E2E8F0", color: "#4A4A4A", cursor: "pointer" }}>
              {k}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── 리뷰 목록 탭 ─────────────────────────────────────────────────

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
              className="px-4 py-2 text-xs font-bold transition-colors"
              style={{
                background: platform === p ? "#1A1A1A" : "#FFFFFF",
                color: platform === p ? "#FFFFFF" : "#1A1A1A",
                borderRight: p === "google" ? "1px solid #1A1A1A" : undefined,
              }}>
              {p === "google" ? "Google Play" : "App Store"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {[0, 1, 2, 3, 4, 5].map((r) => (
            <button key={r} onClick={() => setMinRating(r)}
              className="px-2.5 py-1 text-xs font-medium rounded-full"
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
        <span className="text-xs flex-shrink-0 font-medium" style={{ color: "#9CA3AF" }}>
          {filtered.length.toLocaleString()}건
        </span>
      </div>

      {/* 리뷰 리스트 */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: "#9CA3AF" }}>해당하는 리뷰가 없습니다</p>
        ) : (
          filtered.slice(0, 50).map((review) => (
            <div key={review.review_id} className="rounded-xl p-4 space-y-2"
              style={{ background: "#FFFFFF", border: "1.5px solid #E2E8F0" }}>
              <div className="flex items-center justify-between gap-2">
                <StarRating rating={review.rating} size="sm" />
                <span className="text-xs" style={{ color: "#C4C4C4" }}>
                  {review.app_version && `v${review.app_version} · `}{formatDate(review.reviewed_at)}
                </span>
              </div>
              {review.title && (
                <p className="font-semibold text-sm" style={{ color: "#1A1A1A" }}>{review.title}</p>
              )}
              <p className="text-sm leading-relaxed" style={{ color: "#4A4A4A" }}>
                {highlightKeyword(review.content, keywordFilter)}
              </p>
              {(review.thumbs_up ?? 0) > 0 && (
                <p className="text-xs" style={{ color: "#C4C4C4" }}>도움됨 {review.thumbs_up}</p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── 공통 컴포넌트 ────────────────────────────────────────────────

function StarRating({ rating, size }: { rating: number; size: "xs" | "sm" }) {
  const starSize = size === "xs" ? 11 : 13;
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center" style={{ gap: 1 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <span key={i} style={{ color: i < rating ? "#FFD600" : "#D1D5DB", fontSize: starSize }}>★</span>
        ))}
      </div>
      <span className="font-semibold" style={{ color: "#9CA3AF", fontSize: size === "xs" ? 10 : 11 }}>{rating}점</span>
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
      {highlightKeyword(text.slice(idx + keyword.length), keyword)}
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
      <div className="skeleton h-10 w-full rounded-xl" />
      <div className="grid grid-cols-2 gap-4">
        <div className="skeleton h-48 rounded-2xl" />
        <div className="skeleton h-48 rounded-2xl" />
      </div>
    </div>
  );
}
