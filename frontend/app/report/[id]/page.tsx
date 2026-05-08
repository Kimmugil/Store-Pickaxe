"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { ArrowLeft, X, ChevronDown, ChevronUp, Info } from "lucide-react";
import type { Analysis, Review, AppMeta, PhaseData, ComplaintPraise } from "@/lib/types";

interface ReportData {
  analysis: Analysis;
  meta: AppMeta;
  google_reviews: Review[];
  apple_reviews: Review[];
}

type Tab = "summary" | "platform" | "phases" | "reviews";
type TaggedReview = Review & { _platform: "google" | "apple" };

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

  // 플랫폼 태그를 붙인 통합 리뷰
  const taggedGoogle: TaggedReview[] = google_reviews.map((r) => ({ ...r, _platform: "google" as const }));
  const taggedApple: TaggedReview[] = apple_reviews.map((r) => ({ ...r, _platform: "apple" as const }));
  const allTagged: TaggedReview[] = [...taggedGoogle, ...taggedApple];

  const hasPhases = !!(analysis.google_phase_launch || analysis.google_phase_growth || analysis.google_phase_stable);

  const tabs: [Tab, string][] = [
    ["summary", "종합 요약"],
    ["platform", "플랫폼 비교"],
    ...(hasPhases ? [["phases", "시기별 트렌드"] as [Tab, string]] : []),
    ["reviews", "리뷰 목록"],
  ];

  return (
    <div className="space-y-6">
      <Link href={`/${appKey}`} className="inline-flex items-center gap-2 text-sm font-semibold" style={{ color: "#9CA3AF" }}>
        <ArrowLeft size={14} />
        {meta.app_name}
      </Link>

      {/* 리포트 헤더 */}
      <div className="card overflow-hidden">
        <div className="p-5" style={{ borderBottom: "1.5px solid #E2E8F0" }}>
          <div className="flex items-center gap-4">
            {meta.icon_url && (
              <img src={meta.icon_url} alt={meta.app_name} width={52} height={52}
                className="rounded-xl flex-shrink-0" style={{ border: "2px solid #1A1A1A" }} />
            )}
            <div className="flex-1 min-w-0">
              <h1 className="font-black text-xl" style={{ color: "#1A1A1A", letterSpacing: "-0.02em" }}>{meta.app_name}</h1>
              <p className="text-xs mt-0.5 flex flex-wrap gap-x-3" style={{ color: "#9CA3AF" }}>
                <span>분석 {formatDate(analysis.created_at)}</span>
                <span>샘플 {(analysis.sample_count_google + analysis.sample_count_apple).toLocaleString()}건</span>
                {meta.release_date && <span>출시 {meta.release_date}</span>}
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
        {tabs.map(([tab, label]) => (
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
        <SummaryTab analysis={analysis} allReviews={allTagged} onKeywordClick={handleKeywordClick} />
      )}
      {activeTab === "platform" && (
        <PlatformTab
          analysis={analysis}
          googleReviews={taggedGoogle}
          appleReviews={taggedApple}
          onKeywordClick={handleKeywordClick}
        />
      )}
      {activeTab === "phases" && hasPhases && (
        <PhasesTab analysis={analysis} />
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

// ─── 분석 기준 안내 ──────────────────────────────────────────────

function MethodologyNote({ items }: { items: { label: string; value: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #E2E8F0" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-medium"
        style={{ background: "#F9F9F7", color: "#9CA3AF" }}
      >
        <Info size={12} />
        분석 기준 안내
        {open ? <ChevronUp size={12} className="ml-auto" /> : <ChevronDown size={12} className="ml-auto" />}
      </button>
      {open && (
        <div className="px-4 py-3 space-y-1.5" style={{ background: "#FFFFFF" }}>
          {items.map((item, i) => (
            <div key={i} className="flex gap-2 text-xs">
              <span className="font-semibold flex-shrink-0" style={{ color: "#6B7280" }}>{item.label}</span>
              <span style={{ color: "#9CA3AF" }}>{item.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── 종합 요약 탭 ─────────────────────────────────────────────────

function SummaryTab({
  analysis, allReviews, onKeywordClick,
}: {
  analysis: Analysis;
  allReviews: TaggedReview[];
  onKeywordClick: (k: string) => void;
}) {
  return (
    <div className="space-y-5">
      <MethodologyNote items={[
        { label: "샘플링", value: "실제 평점 분포 비례 + 저평점(1~2★) 1.5배 가중 (게임마다 자동 적용)" },
        { label: "긍정도", value: "전체 수집 리뷰 기반 실제 평점 분포 (5★=100% · 4★=75% · 3★=50% · 2★=25% · 1★=0%)" },
        { label: "수집 대상", value: "한국어 리뷰 · App Store 최근 ~500건 / Google Play 전체 이력" },
      ]} />

      {/* 주요 긍정 + 주요 부정 2분할 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {analysis.main_praises.length > 0 && (
          <section className="space-y-3">
            <h3 className="text-sm font-black" style={{ color: "#10B981" }}>주요 긍정 리뷰</h3>
            <div className="space-y-3">
              {analysis.main_praises.map((p, i) => (
                <ComplaintPraiseItem key={i} item={p} type="praise" allReviews={allReviews} />
              ))}
            </div>
          </section>
        )}

        {analysis.main_complaints.length > 0 && (
          <section className="space-y-3">
            <h3 className="text-sm font-black" style={{ color: "#EF4444" }}>주요 부정 리뷰</h3>
            <div className="space-y-3">
              {analysis.main_complaints.map((c, i) => (
                <ComplaintPraiseItem key={i} item={c} type="complaint" allReviews={allReviews} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

// ─── 주제 + 설명 + 관련 리뷰 토글 ───────────────────────────────

function findRelatedReviews(item: ComplaintPraise, reviews: TaggedReview[], max = 3): TaggedReview[] {
  const searchText = `${item.title} ${item.description}`;

  // 1순위: 제목 전체 포함
  const exactMatches = reviews.filter((r) =>
    (r.content || "").toLowerCase().includes(item.title.toLowerCase())
  );
  if (exactMatches.length >= max) {
    return exactMatches.slice(0, max);
  }

  // 2순위: 단어 2개 이상 일치
  const words = searchText
    .split(/[\s\/,·]+/)
    .map((w) => w.replace(/['"''""\[\]()]/g, "").trim())
    .filter((w) => w.length >= 2);

  if (words.length === 0) return exactMatches.slice(0, max);

  const wordMatches = reviews
    .filter((r) => !exactMatches.includes(r))
    .map((r) => {
      const content = (r.content || "").toLowerCase();
      const matches = words.filter((w) => content.includes(w.toLowerCase())).length;
      return { review: r, matches };
    })
    .filter(({ matches }) => matches >= 2)
    .sort((a, b) => b.matches - a.matches)
    .slice(0, max - exactMatches.length)
    .map(({ review }) => review);

  return [...exactMatches, ...wordMatches].slice(0, max);
}

function ComplaintPraiseItem({
  item, type, allReviews,
}: {
  item: ComplaintPraise;
  type: "complaint" | "praise";
  allReviews: TaggedReview[];
}) {
  const [open, setOpen] = useState(false);
  const accentColor = type === "complaint" ? "#EF4444" : "#10B981";

  // 플랫폼별 리뷰 분리 검색
  const googleReviews = allReviews.filter((r) => r._platform === "google");
  const appleReviews = allReviews.filter((r) => r._platform === "apple");
  const related = [
    ...findRelatedReviews(item, googleReviews, 2),
    ...findRelatedReviews(item, appleReviews, 1),
  ].slice(0, 3);

  return (
    <div className="rounded-xl p-4 space-y-2.5" style={{ background: "#FFFFFF", border: "1.5px solid #E2E8F0" }}>
      {/* 제목 */}
      <div className="flex items-start gap-2">
        <span className="flex-shrink-0 font-bold text-sm mt-0.5" style={{ color: accentColor }}>
          {type === "complaint" ? "—" : "✓"}
        </span>
        <span className="text-sm font-black leading-snug" style={{ color: "#1A1A1A" }}>{item.title}</span>
      </div>

      {/* 설명 */}
      {item.description && (
        <p className="text-xs leading-relaxed pl-4" style={{ color: "#6B7280" }}>{item.description}</p>
      )}

      {/* 관련 리뷰 토글 */}
      {related.length > 0 && (
        <div className="pl-4">
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1 text-xs font-medium"
            style={{ color: accentColor }}
          >
            관련 리뷰 {related.length}건
            {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>
          {open && (
            <div className="mt-2 space-y-2">
              {related.map((r) => (
                <div key={r.review_id} className="pl-3 py-2 space-y-1" style={{ borderLeft: `2px solid ${accentColor}30` }}>
                  <div className="flex items-center gap-2">
                    <StarRating rating={r.rating} size="xs" />
                    <span
                      className="text-xs font-bold px-1.5 py-0.5 rounded-full"
                      style={{
                        background: r._platform === "google" ? "#EBF3FF" : "#F0EFEC",
                        color: r._platform === "google" ? "#4285F4" : "#1A1A1A",
                      }}
                    >
                      {r._platform === "google" ? "Google" : "Apple"}
                    </span>
                    {r.reviewed_at && (
                      <span className="text-xs" style={{ color: "#C4C4C4" }}>{formatDate(r.reviewed_at)}</span>
                    )}
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: "#6B7280" }}>
                    {r.content}
                  </p>
                </div>
              ))}
            </div>
          )}
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
  googleReviews: TaggedReview[];
  appleReviews: TaggedReview[];
  onKeywordClick: (k: string) => void;
}) {
  const googleDist = analysis.google_rating_dist && Object.keys(analysis.google_rating_dist).length > 0
    ? analysis.google_rating_dist
    : buildDistFromReviews(googleReviews);
  const appleDist = analysis.apple_rating_dist && Object.keys(analysis.apple_rating_dist).length > 0
    ? analysis.apple_rating_dist
    : buildDistFromReviews(appleReviews);

  const googleTotal = Object.values(googleDist).reduce((a, b) => a + b, 0);
  const appleTotal = Object.values(appleDist).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-5">
      {/* 분석 기준 안내 */}
      <MethodologyNote items={[
        { label: "평점 분포", value: "AI 분석 시점 전체 수집 리뷰 기반 집계 (샘플 아님)" },
        { label: "긍정도", value: "전체 수집 리뷰 기반 실제 평점 분포 가중 계산" },
        { label: "플랫폼 비교", value: "App Store 수집 기간과 동일한 Google Play 리뷰만 사용 (공정 비교)" },
      ]} />

      {/* 플랫폼 간 주요 이슈 — 첫 번째 */}
      <PlatformDiffCard
        platformDiff={analysis.platform_diff}
        googleReviews={googleReviews}
        appleReviews={appleReviews}
        sampleDateMin={analysis.sample_date_min}
        sampleDateMax={analysis.sample_date_max}
      />

      {/* 통합 플랫폼 카드 (평점 분포 + 긍정도 + 키워드) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {googleTotal > 0 && (
          <PlatformCard
            label="Google Play"
            color="#4285F4"
            sentiment={analysis.google_sentiment}
            ratingDist={googleDist}
            totalReviews={googleTotal}
            keywords={analysis.keywords_google}
            onKeywordClick={onKeywordClick}
          />
        )}
        {appleTotal > 0 && (
          <PlatformCard
            label="App Store"
            color="#1A1A1A"
            sentiment={analysis.apple_sentiment}
            ratingDist={appleDist}
            totalReviews={appleTotal}
            keywords={analysis.keywords_apple}
            onKeywordClick={onKeywordClick}
          />
        )}
      </div>
    </div>
  );
}

function buildDistFromReviews(reviews: TaggedReview[]): Record<string, number> {
  const dist: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
  reviews.forEach((r) => {
    const k = String(r.rating);
    if (k in dist) dist[k]++;
  });
  return dist;
}

// ─── 통합 플랫폼 카드 (평점 분포 + 긍정도 + 키워드) ──────────────

function PlatformCard({
  label, color, sentiment, ratingDist, totalReviews, keywords, onKeywordClick,
}: {
  label: string;
  color: string;
  sentiment: number | null;
  ratingDist: Record<string, number>;
  totalReviews: number;
  keywords: string[];
  onKeywordClick: (k: string) => void;
}) {
  const counts = [5, 4, 3, 2, 1].map((s) => ({
    star: s,
    count: ratingDist[String(s)] ?? 0,
  }));
  const maxCount = Math.max(...counts.map((c) => c.count), 1);

  return (
    <div className="rounded-xl p-5 space-y-4" style={{ background: "#FFFFFF", border: "1.5px solid #E2E8F0" }}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-black" style={{ color }}>{label}</span>
        <span className="text-xs" style={{ color: "#9CA3AF" }}>{totalReviews.toLocaleString()}건</span>
      </div>

      {/* 긍정도 */}
      {sentiment !== null && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium" style={{ color: "#9CA3AF" }}>긍정도</span>
            <span
              className="text-sm font-black"
              style={{ color: sentiment >= 60 ? "#10B981" : sentiment >= 40 ? "#F59E0B" : "#EF4444" }}
            >
              {sentiment}%
            </span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: "#F0EFEC" }}>
            <div className="h-full rounded-full" style={{ width: `${sentiment}%`, background: color }} />
          </div>
        </div>
      )}

      {/* 평점 분포 */}
      <div className="space-y-1.5">
        <span className="text-xs font-medium" style={{ color: "#9CA3AF" }}>평점 분포</span>
        {counts.map(({ star, count }) => {
          const pct = totalReviews > 0 ? Math.round((count / totalReviews) * 100) : 0;
          return (
            <div key={star} className="flex items-center gap-2">
              <span className="text-xs w-4 flex-shrink-0 text-right" style={{ color: "#9CA3AF" }}>★{star}</span>
              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "#F0EFEC" }}>
                <div className="h-full rounded-full"
                  style={{ width: `${(count / maxCount) * 100}%`, background: color }} />
              </div>
              <span className="text-xs flex-shrink-0" style={{ color: "#9CA3AF", minWidth: 52, textAlign: "right" }}>
                {count.toLocaleString()} ({pct}%)
              </span>
            </div>
          );
        })}
      </div>

      {/* 주요 키워드 */}
      {keywords.length > 0 && (
        <div>
          <span className="text-xs font-medium" style={{ color: "#9CA3AF" }}>주요 키워드</span>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {keywords.map((k, i) => (
              <button key={i} onClick={() => onKeywordClick(k)}
                title="클릭하면 관련 리뷰 보기"
                className="text-xs font-medium px-2.5 py-0.5 rounded-full hover:opacity-75 transition-opacity"
                style={{ background: "#F0EFEC", border: "1px solid #E2E8F0", color: "#4A4A4A", cursor: "pointer" }}>
                {k}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 플랫폼 차이 카드 ────────────────────────────────────────────

function PlatformDiffCard({
  platformDiff, googleReviews, appleReviews, sampleDateMin, sampleDateMax,
}: {
  platformDiff: string;
  googleReviews: TaggedReview[];
  appleReviews: TaggedReview[];
  sampleDateMin?: string;
  sampleDateMax?: string;
}) {
  if (!platformDiff?.trim()) return null;

  let structured: { google_specific?: string[]; apple_specific?: string[] } | null = null;
  try {
    const parsed = JSON.parse(platformDiff);
    if (parsed.google_specific !== undefined || parsed.apple_specific !== undefined) {
      structured = parsed;
    }
  } catch { /* 구형 텍스트 처리 */ }

  const hasContent = structured
    ? (structured.google_specific?.length || 0) + (structured.apple_specific?.length || 0) > 0
    : true;

  if (!hasContent) return null;

  return (
    <div className="rounded-xl p-5 space-y-3" style={{ background: "#FFFFFF", border: "1.5px solid #E2E8F0" }}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-black" style={{ color: "#1A1A1A" }}>플랫폼 간 주요 이슈</h3>
        <span className="text-xs flex-shrink-0 px-2 py-0.5 rounded-full font-medium"
          style={{ background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE" }}>
          동기간 비교
        </span>
      </div>
      {sampleDateMin && sampleDateMax && (
        <p className="text-xs" style={{ color: "#C4C4C4" }}>
          {sampleDateMin} ~ {sampleDateMax} 기간 기준
        </p>
      )}
      {structured ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {structured.google_specific && structured.google_specific.length > 0 && (
            <IssueList title="Google Play 주요 이슈" items={structured.google_specific} color="#4285F4" reviews={googleReviews} />
          )}
          {structured.apple_specific && structured.apple_specific.length > 0 && (
            <IssueList title="App Store 주요 이슈" items={structured.apple_specific} color="#1A1A1A" reviews={appleReviews} />
          )}
        </div>
      ) : (
        <p className="text-sm leading-relaxed" style={{ color: "#4A4A4A" }}>{platformDiff}</p>
      )}
    </div>
  );
}

function IssueList({ title, items, color, reviews }: {
  title: string;
  items: string[];
  color: string;
  reviews: TaggedReview[];
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-black" style={{ color }}>{title}</p>
      <div className="space-y-2">
        {items.map((item, i) => (
          <IssueItem key={i} text={item} color={color} reviews={reviews} />
        ))}
      </div>
    </div>
  );
}

function IssueItem({ text, color, reviews }: { text: string; color: string; reviews: TaggedReview[] }) {
  const [open, setOpen] = useState(false);
  const related = findRelatedReviews({ title: text, description: "" }, reviews, 2);

  return (
    <div className="space-y-1">
      <div className="flex items-start gap-1.5 text-xs" style={{ color: "#4A4A4A" }}>
        <span className="flex-shrink-0 mt-0.5" style={{ color }}>—</span>
        <span>{text}</span>
      </div>
      {related.length > 0 && (
        <div className="pl-3">
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1 text-xs"
            style={{ color: "#9CA3AF" }}
          >
            관련 리뷰 {related.length}건
            {open ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </button>
          {open && (
            <div className="mt-1.5 space-y-1.5">
              {related.map((r) => (
                <div key={r.review_id} className="pl-2 py-1.5 space-y-0.5" style={{ borderLeft: `2px solid ${color}30` }}>
                  <div className="flex items-center gap-1.5">
                    <StarRating rating={r.rating} size="xs" />
                    {r.reviewed_at && <span className="text-xs" style={{ color: "#C4C4C4" }}>{formatDate(r.reviewed_at)}</span>}
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: "#6B7280" }}>{r.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── 시기별 트렌드 탭 ────────────────────────────────────────────

function PhasesTab({ analysis }: { analysis: Analysis }) {
  const phases = [
    { key: "launch" as const, label: "출시 초반", subtitle: "0~30일", color: "#4285F4", data: analysis.google_phase_launch },
    { key: "growth" as const, label: "성장기", subtitle: "31~180일", color: "#34A853", data: analysis.google_phase_growth },
    { key: "stable" as const, label: "안정기", subtitle: "181일+", color: "#9CA3AF", data: analysis.google_phase_stable },
  ];

  const sentimentPoints = phases.map((p) => ({
    label: p.label,
    color: p.color,
    sentiment: p.data?.sentiment ?? null,
  }));

  const hasSentimentGraph = sentimentPoints.filter((p) => p.sentiment !== null).length >= 2;

  return (
    <div className="space-y-5">
      <MethodologyNote items={[
        { label: "대상", value: "Google Play 전체 수집 리뷰 (App Store는 최근 ~500건만 수집되어 시기별 분석 불가)" },
        { label: "분석 조건", value: "해당 시기 리뷰 30건 이상인 경우에만 분석 (30건 미만 시기는 생략)" },
        { label: "긍정률 계산", value: "해당 시기 전체 리뷰 기반 (샘플 아님) · 5★=100% · 4★=75% · 3★=50% · 2★=25% · 1★=0%" },
        { label: "시기별 샘플", value: "각 시기에서 최대 40건 샘플링 → Gemini AI 트렌드 요약 (평점 분포 비례 + 저평점 1.5배 가중)" },
      ]} />

      {/* 긍정률 추세 그래프 */}
      {hasSentimentGraph && (
        <div className="rounded-xl p-5 space-y-3" style={{ background: "#FFFFFF", border: "1.5px solid #E2E8F0" }}>
          <h3 className="text-sm font-black" style={{ color: "#1A1A1A" }}>시기별 긍정률 추세</h3>
          <p className="text-xs" style={{ color: "#9CA3AF" }}>각 시기 전체 리뷰의 평점 분포 기반</p>
          <SentimentTrendGraph points={sentimentPoints} />
        </div>
      )}

      {/* 시기별 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {phases.map((p) => (
          <PhaseCard key={p.key} phase={p.data} label={p.label} subtitle={p.subtitle} color={p.color} />
        ))}
      </div>
    </div>
  );
}

// ─── 긍정률 추세 그래프 ──────────────────────────────────────────

function SentimentTrendGraph({ points }: {
  points: { label: string; color: string; sentiment: number | null }[];
}) {
  const W = 400, H = 140, PAD_X = 40, PAD_Y = 28;
  const innerW = W - PAD_X * 2;
  const innerH = H - PAD_Y * 2;
  const xStep = innerW / (points.length - 1);

  const coords = points.map((p, i) => ({
    ...p,
    x: PAD_X + i * xStep,
    y: p.sentiment !== null ? PAD_Y + innerH - (p.sentiment / 100) * innerH : null,
  }));

  const validCoords = coords.filter((c) => c.y !== null);
  const linePath = validCoords.length >= 2
    ? validCoords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ")
    : "";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 140 }}>
      {/* 가로 격자 */}
      {[0, 25, 50, 75, 100].map((pct) => {
        const y = PAD_Y + innerH - (pct / 100) * innerH;
        return (
          <g key={pct}>
            <line x1={PAD_X} x2={W - PAD_X} y1={y} y2={y} stroke="#F0EFEC" strokeWidth={1} />
            <text x={PAD_X - 5} y={y + 3} textAnchor="end" fill="#C4C4C4" fontSize={9}>{pct}%</text>
          </g>
        );
      })}

      {/* 연결선 */}
      {linePath && (
        <path d={linePath} fill="none" stroke="#E2E8F0" strokeWidth={2} strokeDasharray="4 2" />
      )}

      {/* 포인트 */}
      {coords.map((c, i) => (
        c.y !== null ? (
          <g key={i}>
            <circle cx={c.x} cy={c.y!} r={6} fill={c.color} stroke="#FFFFFF" strokeWidth={2} />
            <text x={c.x} y={c.y! - 12} textAnchor="middle" fill={c.color} fontSize={10} fontWeight="bold">
              {c.sentiment}%
            </text>
          </g>
        ) : (
          <g key={i}>
            <circle cx={c.x} cy={PAD_Y + innerH / 2} r={5} fill="#F0EFEC" stroke="#E2E8F0" strokeWidth={1.5} />
            <text x={c.x} y={PAD_Y + innerH / 2 - 10} textAnchor="middle" fill="#C4C4C4" fontSize={9}>데이터 없음</text>
          </g>
        )
      ))}

      {/* X축 레이블 */}
      {coords.map((c, i) => (
        <text key={i} x={c.x} y={H - 4} textAnchor="middle" fill="#9CA3AF" fontSize={9}>{c.label}</text>
      ))}
    </svg>
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
        <p className="text-xs" style={{ color: "#C4C4C4" }}>데이터 없음 (30건 미만)</p>
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
      {phase.sentiment !== null && phase.sentiment !== undefined && (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "#F0EFEC" }}>
            <div className="h-full rounded-full" style={{ width: `${phase.sentiment}%`, background: color }} />
          </div>
          <span className="text-xs font-bold flex-shrink-0" style={{ color }}>
            긍정률 {phase.sentiment}%
          </span>
        </div>
      )}
      {phase.date_from && (
        <p className="text-xs" style={{ color: "#C4C4C4" }}>{phase.date_from} ~ {phase.date_to}</p>
      )}
      <p className="text-xs leading-relaxed" style={{ color: "#4A4A4A" }}>{phase.summary}</p>
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
