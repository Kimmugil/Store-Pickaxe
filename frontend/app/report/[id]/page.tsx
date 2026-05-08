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

interface MonthlyRatings {
  ratings: Record<string, { avg: number; count: number }>;
  release_date: string;
  phase_thresholds: { launch_days: number; growth_days: number };
  total_reviews: number;
}

// platform_diff 항목은 구형(string)과 신형({title, description}) 모두 지원
type PlatformIssue = string | { title: string; description: string };

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
        <PhasesTab analysis={analysis} appKey={appKey} />
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

// ─── 샘플 정보 칩 ────────────────────────────────────────────────

function SampleInfoChip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs flex-wrap"
      style={{ background: "#F0EFEC", border: "1px solid #E2E8F0", color: "#6B7280" }}>
      {children}
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
      {/* #1 — 샘플 정보 가시화 */}
      <SampleInfoChip>
        <span className="font-bold" style={{ color: "#1A1A1A" }}>Gemini Call #1 · 종합 요약</span>
        <span>Google {analysis.sample_count_google.toLocaleString()}건 + Apple {analysis.sample_count_apple.toLocaleString()}건</span>
        {analysis.sample_date_min && (
          <span style={{ color: "#9CA3AF" }}>{analysis.sample_date_min} ~ {analysis.sample_date_max}</span>
        )}
      </SampleInfoChip>

      <MethodologyNote items={[
        { label: "분석 방식", value: `Gemini Call #1 — 평점 분포 비례 + 저평점(1~2★) 1.5배 가중 샘플 · Google ${analysis.sample_count_google}건 + Apple ${analysis.sample_count_apple}건` },
        { label: "이슈 선정", value: "AI가 반복 등장 테마를 영향도 기준으로 그룹화하여 상위 3개 선정 (단순 빈도가 아닌 영향도 기준)" },
        { label: "수집 대상", value: "한국어 리뷰 · App Store 최근 ~500건 / Google Play 전체 이력" },
        { label: "주의", value: "별점과 리뷰 내용이 불일치하는 경우가 있습니다 (예: 5★에 불만 내용). AI 분석은 리뷰 텍스트 기준이며 별점은 별도 평점 분포로 확인하세요." },
      ]} />

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
    </div>
  );
}

// ─── 관련 리뷰 검색 ───────────────────────────────────────────────

function findRelatedReviews(title: string, description: string, reviews: TaggedReview[], max = 3): TaggedReview[] {
  const lowerTitle = title.toLowerCase();

  // 1순위: 제목 전체 포함
  const exactMatches = reviews.filter((r) =>
    (r.content || "").toLowerCase().includes(lowerTitle)
  );
  if (exactMatches.length >= max) return exactMatches.slice(0, max);

  const remaining = reviews.filter((r) => !exactMatches.includes(r));

  // 제목에서 3자 이상 단어 추출 (AI 요약어 단위)
  const splitPattern = /[\s\/,·•]+/;
  const cleanWord = (w: string) => w.replace(/['"‘’“”\[\]()]/g, "").trim().toLowerCase();
  const titleWords = title.split(splitPattern).map(cleanWord).filter((w) => w.length >= 3);

  // 제목 단어를 2자 연속 서브스트링으로 분해
  // 예: "강제접속" → ["강제","제접","접속"] — 리뷰에 "강제 접속"으로 써도 매칭
  const titleFrags = new Set<string>();
  for (const word of titleWords) {
    for (let i = 0; i <= word.length - 2; i++) {
      titleFrags.add(word.slice(i, i + 2));
    }
  }
  const titleFragArr = [...titleFrags];

  // 설명에서 2자 이상 단어 (보조 신호)
  const descWords = description.split(splitPattern).map(cleanWord).filter((w) => w.length >= 2);

  const scored = remaining.map((r) => {
    const content = (r.content || "").toLowerCase();
    const titleWordHits = titleWords.filter((w) => content.includes(w)).length;
    const titleFragHits = titleFragArr.filter((f) => content.includes(f)).length;
    const descHits = descWords.filter((w) => content.includes(w)).length;
    return {
      review: r,
      score: titleWordHits * 10 + titleFragHits * 2 + descHits,
      qualifies: titleWordHits >= 1 || titleFragHits >= 2 || descHits >= 3,
    };
  });

  const candidates = scored
    .filter((s) => s.qualifies)
    .sort((a, b) => b.score - a.score)
    .slice(0, max - exactMatches.length)
    .map((s) => s.review);

  return [...exactMatches, ...candidates].slice(0, max);
}

// ─── 주제 카드 (종합 요약용) ─────────────────────────────────────

function ComplaintPraiseItem({
  item, type, allReviews,
}: {
  item: ComplaintPraise;
  type: "complaint" | "praise";
  allReviews: TaggedReview[];
}) {
  const [open, setOpen] = useState(false);
  const accentColor = type === "complaint" ? "#EF4444" : "#10B981";

  const googleReviews = allReviews.filter((r) => r._platform === "google");
  const appleReviews = allReviews.filter((r) => r._platform === "apple");
  const related = [
    ...findRelatedReviews(item.title, item.description, googleReviews, 3),
    ...findRelatedReviews(item.title, item.description, appleReviews, 2),
  ].slice(0, 5);

  return (
    <div className="rounded-xl p-4 space-y-2.5" style={{ background: "#FFFFFF", border: "1.5px solid #E2E8F0" }}>
      <div className="flex items-start gap-2">
        <span className="flex-shrink-0 font-bold text-sm mt-0.5" style={{ color: accentColor }}>
          {type === "complaint" ? "—" : "✓"}
        </span>
        <span className="text-sm font-black leading-snug" style={{ color: "#1A1A1A" }}>{item.title}</span>
      </div>

      {item.description && (
        <p className="text-xs leading-relaxed pl-4" style={{ color: "#6B7280" }}>{item.description}</p>
      )}

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
                    <span className="text-xs font-bold px-1.5 py-0.5 rounded-full"
                      style={{
                        background: r._platform === "google" ? "#EBF3FF" : "#F0EFEC",
                        color: r._platform === "google" ? "#4285F4" : "#1A1A1A",
                      }}>
                      {r._platform === "google" ? "G" : "A"}
                    </span>
                    {r.reviewed_at && (
                      <span className="text-xs" style={{ color: "#C4C4C4" }}>{formatDate(r.reviewed_at)}</span>
                    )}
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

  // #3 — Apple 실제 수집 날짜 범위 계산
  const appleDatesSorted = appleReviews
    .map((r) => r.reviewed_at?.slice(0, 10))
    .filter(Boolean)
    .sort() as string[];
  const appleDateFrom = appleDatesSorted[0] || "";
  const appleDateTo = appleDatesSorted[appleDatesSorted.length - 1] || "";

  return (
    <div className="space-y-5">
      {/* #1 — 샘플 정보 가시화 */}
      <SampleInfoChip>
        <span className="font-bold" style={{ color: "#1A1A1A" }}>Gemini Call #2 · 플랫폼 비교</span>
        <span>Apple 수집기간 내 동기간 비교</span>
        {appleDateFrom && (
          <span style={{ color: "#9CA3AF" }}>{appleDateFrom} ~ {appleDateTo}</span>
        )}
      </SampleInfoChip>

      <MethodologyNote items={[
        { label: "분석 방식", value: `Gemini Call #2 — Apple 수집기간(${appleDateFrom || "?"}~${appleDateTo || "?"}) 내 동기간 Google + Apple 비교 샘플` },
        { label: "평점 분포", value: "AI 분석 시점 전체 수집 리뷰 기반 집계 (샘플 아님)" },
        { label: "주의", value: "별점과 리뷰 내용이 불일치하는 경우가 있습니다. 평점 분포는 별점 기준, 주요 이슈는 리뷰 텍스트 기준입니다." },
      ]} />

      {/* 플랫폼 간 주요 이슈 + 주요 키워드 통합 카드 */}
      <PlatformDiffCard
        platformDiff={analysis.platform_diff}
        googleReviews={googleReviews}
        appleReviews={appleReviews}
        appleDateFrom={appleDateFrom}
        appleDateTo={appleDateTo}
        keywordsGoogle={analysis.keywords_google}
        keywordsApple={analysis.keywords_apple}
        sampleCountGoogle={analysis.sample_count_google}
        sampleCountApple={analysis.sample_count_apple}
        onKeywordClick={onKeywordClick}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {googleTotal > 0 && (
          <PlatformCard
            label="Google Play"
            color="#4285F4"
            ratingDist={googleDist}
            totalReviews={googleTotal}
          />
        )}
        {appleTotal > 0 && (
          <PlatformCard
            label="App Store"
            color="#1A1A1A"
            ratingDist={appleDist}
            totalReviews={appleTotal}
          />
        )}
      </div>
    </div>
  );
}

function buildDistFromReviews(reviews: TaggedReview[]): Record<string, number> {
  const dist: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
  reviews.forEach((r) => { const k = String(r.rating); if (k in dist) dist[k]++; });
  return dist;
}

// ─── 평점 분포 카드 (키워드 제거) ───────────────────────────────

function PlatformCard({
  label, color, ratingDist, totalReviews,
}: {
  label: string;
  color: string;
  ratingDist: Record<string, number>;
  totalReviews: number;
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

      <div className="space-y-1.5">
        <span className="text-xs font-medium" style={{ color: "#9CA3AF" }}>평점 분포</span>
        {counts.map(({ star, count }) => {
          const pct = totalReviews > 0 ? Math.round((count / totalReviews) * 100) : 0;
          return (
            <div key={star} className="flex items-center gap-2">
              <span className="text-xs flex-shrink-0 text-right" style={{ color: "#9CA3AF", width: 20 }}>★{star}</span>
              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "#F0EFEC" }}>
                <div className="h-full rounded-full"
                  style={{ width: `${(count / maxCount) * 100}%`, background: color }} />
              </div>
              <span className="text-xs flex-shrink-0 text-right" style={{ color: "#9CA3AF", width: 96 }}>
                {count.toLocaleString()} ({pct}%)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── 플랫폼 차이 + 키워드 통합 카드 ────────────────────────────

function PlatformDiffCard({
  platformDiff, googleReviews, appleReviews, appleDateFrom, appleDateTo,
  keywordsGoogle, keywordsApple, sampleCountGoogle, sampleCountApple, onKeywordClick,
}: {
  platformDiff: string;
  googleReviews: TaggedReview[];
  appleReviews: TaggedReview[];
  appleDateFrom?: string;
  appleDateTo?: string;
  keywordsGoogle: string[];
  keywordsApple: string[];
  sampleCountGoogle: number;
  sampleCountApple: number;
  onKeywordClick: (k: string) => void;
}) {
  let structured: { google_specific?: PlatformIssue[]; apple_specific?: PlatformIssue[] } | null = null;
  try {
    const parsed = JSON.parse(platformDiff);
    if (parsed.google_specific !== undefined || parsed.apple_specific !== undefined) {
      structured = parsed;
    }
  } catch { /* 구형 텍스트 */ }

  const hasDiff = platformDiff?.trim() && (
    structured
      ? (structured.google_specific?.length || 0) + (structured.apple_specific?.length || 0) > 0
      : true
  );
  const hasKeywords = keywordsGoogle.length > 0 || keywordsApple.length > 0;

  if (!hasDiff && !hasKeywords) return null;

  return (
    <div className="rounded-xl p-5 space-y-4" style={{ background: "#FFFFFF", border: "1.5px solid #E2E8F0" }}>
      {/* 플랫폼 간 주요 이슈 */}
      {hasDiff && (
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-black" style={{ color: "#1A1A1A" }}>플랫폼 간 주요 이슈</h3>
            <span className="text-xs flex-shrink-0 px-2 py-0.5 rounded-full font-medium"
              style={{ background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE" }}>
              동기간 비교
            </span>
          </div>
          {appleDateFrom && appleDateTo && (
            <p className="text-xs" style={{ color: "#C4C4C4" }}>
              App Store 수집기간 기준 · {appleDateFrom} ~ {appleDateTo}
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
      )}

      {/* 주요 키워드 — 구분선 후 동일 카드 내 배치 */}
      {hasKeywords && (
        <div className={hasDiff ? "pt-4 space-y-3" : "space-y-3"} style={hasDiff ? { borderTop: "1px solid #E2E8F0" } : {}}>
          <div>
            <h3 className="text-sm font-black" style={{ color: "#1A1A1A" }}>주요 키워드</h3>
            <p className="text-xs mt-0.5" style={{ color: "#9CA3AF" }}>
              각 플랫폼 전체 수집 비례 샘플 기반 · Google {sampleCountGoogle.toLocaleString()}건 + Apple {sampleCountApple.toLocaleString()}건
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {keywordsGoogle.length > 0 && (
              <div>
                <p className="text-xs font-black mb-2" style={{ color: "#4285F4" }}>Google Play</p>
                <div className="flex flex-wrap gap-1.5">
                  {keywordsGoogle.map((k, i) => (
                    <button key={i} onClick={() => onKeywordClick(k)}
                      title="클릭하면 관련 리뷰 보기"
                      className="text-xs font-medium px-2.5 py-0.5 rounded-full hover:opacity-75 transition-opacity"
                      style={{ background: "#EBF3FF", border: "1px solid #BFDBFE", color: "#4285F4", cursor: "pointer" }}>
                      {k}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {keywordsApple.length > 0 && (
              <div>
                <p className="text-xs font-black mb-2" style={{ color: "#1A1A1A" }}>App Store</p>
                <div className="flex flex-wrap gap-1.5">
                  {keywordsApple.map((k, i) => (
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
        </div>
      )}
    </div>
  );
}

function IssueList({ title, items, color, reviews }: {
  title: string;
  items: PlatformIssue[];
  color: string;
  reviews: TaggedReview[];
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-black" style={{ color }}>{title}</p>
      <div className="space-y-2">
        {items.map((item, i) => (
          <IssueItem key={i} issue={item} color={color} reviews={reviews} />
        ))}
      </div>
    </div>
  );
}

function IssueItem({ issue, color, reviews }: { issue: PlatformIssue; color: string; reviews: TaggedReview[] }) {
  const [open, setOpen] = useState(false);

  const title = typeof issue === "string" ? issue : issue.title;
  const description = typeof issue === "string" ? "" : (issue.description || "");
  const related = findRelatedReviews(title, description, reviews, 3);

  return (
    <div className="space-y-1">
      <div className="flex items-start gap-1.5 text-xs" style={{ color: "#4A4A4A" }}>
        <span className="flex-shrink-0 mt-0.5" style={{ color }}>—</span>
        <div className="space-y-0.5">
          <span className="font-medium">{title}</span>
          {description && (
            <p style={{ color: "#9CA3AF" }}>{description}</p>
          )}
        </div>
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

function PhasesTab({
  analysis, appKey,
}: {
  analysis: Analysis;
  appKey: string;
}) {
  const [monthlyData, setMonthlyData] = useState<MonthlyRatings | null>(null);

  useEffect(() => {
    if (!appKey) return;
    fetch(`/api/monthly_ratings?app_key=${appKey}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setMonthlyData(d));
  }, [appKey]);

  const phases = [
    { key: "launch" as const, label: "출시 초반", subtitle: "0~30일", color: "#4285F4", data: analysis.google_phase_launch },
    { key: "growth" as const, label: "성장기", subtitle: "31~180일", color: "#34A853", data: analysis.google_phase_growth },
    { key: "stable" as const, label: "안정기", subtitle: "181일+", color: "#9CA3AF", data: analysis.google_phase_stable },
  ];

  return (
    <div className="space-y-5">
      {/* #1 — 샘플 정보 가시화 */}
      <SampleInfoChip>
        <span className="font-bold" style={{ color: "#1A1A1A" }}>Gemini Call #3 · 시기별 트렌드</span>
        <span>시기별 독립 샘플 (출시초반 / 성장기 / 안정기 각 최대 150건)</span>
      </SampleInfoChip>

      <MethodologyNote items={[
        { label: "분석 방식", value: "Gemini Call #3 — 시기별 독립 샘플 (출시초반/성장기/안정기 각각 최대 150건 · 평점 분포 비례 + 저평점 1.5배 가중)" },
        { label: "대상", value: "Google Play 전체 수집 리뷰 (App Store는 최근 ~500건만 수집되어 시기별 분석 불가)" },
        { label: "분석 조건", value: "해당 시기 리뷰 30건 이상인 경우에만 분석 (30건 미만 시기는 생략)" },
        { label: "평균 평점", value: "해당 시기 전체 리뷰 기반 (샘플 아님, 내용 길이와 무관하게 전체 평점 반영) — 별점 단순 평균" },
        { label: "월별 추이", value: "전체 수집 Google 리뷰 기반 월별 평점 평균 (출시 후 365일 이내, 월 10건 이상 기준)" },
        { label: "주의", value: "별점과 리뷰 내용이 불일치하는 경우가 있습니다. 평점은 별점 기준, 트렌드 요약은 리뷰 텍스트 기준입니다." },
      ]} />

      {/* 월별 평점 추이 그래프 */}
      <div className="rounded-xl p-5 space-y-3" style={{ background: "#FFFFFF", border: "1.5px solid #E2E8F0" }}>
        <div>
          <h3 className="text-sm font-black" style={{ color: "#1A1A1A" }}>월별 평점 추이</h3>
          <p className="text-xs mt-0.5" style={{ color: "#9CA3AF" }}>
            Google Play 전체 수집 리뷰 기반 · 출시 후 365일 이내 · 월 10건 이상
            {monthlyData && ` (${monthlyData.total_reviews.toLocaleString()}건)`}
          </p>
        </div>
        {monthlyData ? (
          <MonthlyRatingChart data={monthlyData} />
        ) : (
          <div className="h-56 rounded-lg animate-pulse" style={{ background: "#F0EFEC" }} />
        )}
      </div>

      {/* 시기별 카드 */}
      <div className="space-y-3">
        {phases.map((p) => (
          <PhaseCard
            key={p.key}
            phase={p.data}
            label={p.label}
            subtitle={p.subtitle}
            color={p.color}
            appKey={appKey}
          />
        ))}
      </div>
    </div>
  );
}

// ─── 월별 평점 추이 그래프 ──────────────────────────────────────

function MonthlyRatingChart({ data }: { data: MonthlyRatings }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const { ratings, release_date, phase_thresholds } = data;

  const allMonths = Object.keys(ratings).sort();

  // #6 — 출시 후 180일 이내 + 월 10건 이상 필터
  let sortedMonths = allMonths;
  if (release_date) {
    const cutoffDate = new Date(release_date);
    cutoffDate.setDate(cutoffDate.getDate() + 365);
    const cutoffMonth = cutoffDate.toISOString().slice(0, 7);
    sortedMonths = allMonths
      .filter((m) => m <= cutoffMonth)
      .filter((m) => ratings[m].count >= 10);
  } else {
    sortedMonths = allMonths.filter((m) => ratings[m].count >= 10);
  }

  if (sortedMonths.length < 2) {
    return <p className="text-xs text-center py-8" style={{ color: "#9CA3AF" }}>데이터가 충분하지 않습니다</p>;
  }

  const W = 520, H = 220, PAD_L = 36, PAD_R = 16, PAD_T = 24, PAD_B = 36;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  function toX(i: number) { return PAD_L + (i / (sortedMonths.length - 1)) * innerW; }
  function toY(rating: number) { return PAD_T + innerH - ((rating - 1) / 4) * innerH; }

  // 시기 zone 배경
  const phaseZones: { x1: number; x2: number; fill: string; label: string; labelColor: string }[] = [];
  if (release_date) {
    const releaseTime = new Date(release_date).getTime();
    const launchEndMonth = new Date(releaseTime + phase_thresholds.launch_days * 86400000).toISOString().slice(0, 7);
    const growthEndMonth = new Date(releaseTime + phase_thresholds.growth_days * 86400000).toISOString().slice(0, 7);
    const releaseMonth = release_date.slice(0, 7);
    const lastMonth = sortedMonths[sortedMonths.length - 1];

    const zoneDefs = [
      { from: releaseMonth, to: launchEndMonth, fill: "#DBEAFE", label: "출시 초반", labelColor: "#4285F4" },
      { from: launchEndMonth, to: growthEndMonth, fill: "#DCFCE7", label: "성장기", labelColor: "#34A853" },
      { from: growthEndMonth, to: lastMonth, fill: "#F3F4F6", label: "안정기", labelColor: "#9CA3AF" },
    ];

    for (const zone of zoneDefs) {
      const iFrom = sortedMonths.findIndex((m) => m >= zone.from);
      const iTo = sortedMonths.findIndex((m) => m > zone.to);
      if (iFrom < 0) continue;
      const x1 = toX(iFrom);
      const x2 = iTo < 0 ? PAD_L + innerW : toX(iTo);
      if (x2 > x1) phaseZones.push({ x1, x2, fill: zone.fill, label: zone.label, labelColor: zone.labelColor });
    }
  }

  const points = sortedMonths.map((m, i) => ({
    month: m,
    avg: ratings[m].avg,
    count: ratings[m].count,
    x: toX(i),
    y: toY(ratings[m].avg),
  }));

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  const labelStep = Math.ceil(sortedMonths.length / 12);
  const labelIndices = sortedMonths
    .map((_, i) => i)
    .filter((i) => i % labelStep === 0 || i === sortedMonths.length - 1);

  const hp = hoveredIdx !== null ? points[hoveredIdx] : null;
  const TW = 120, TH = 40;

  return (
    <div>
      {/* #5 — height: "auto" 로 컨테이너 너비에 맞게 확장 */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", display: "block" }}
        onMouseLeave={() => setHoveredIdx(null)}
      >
        {/* 시기 zone 배경 */}
        {phaseZones.map((zone, i) => (
          <rect key={i} x={zone.x1} y={PAD_T} width={zone.x2 - zone.x1} height={innerH}
            fill={zone.fill} opacity={0.7} />
        ))}

        {/* Y축 격자 + 레이블 */}
        {[1, 2, 3, 4, 5].map((rating) => {
          const y = toY(rating);
          return (
            <g key={rating}>
              <line x1={PAD_L} x2={PAD_L + innerW} y1={y} y2={y} stroke="#E2E8F0" strokeWidth={0.5} />
              <text x={PAD_L - 5} y={y + 3} textAnchor="end" fill="#C4C4C4" fontSize={9}>★{rating}</text>
            </g>
          );
        })}

        {/* 추이선 */}
        <path d={linePath} fill="none" stroke="#4285F4" strokeWidth={2} strokeLinejoin="round" />

        {/* 데이터 포인트 */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x} cy={p.y} r={hoveredIdx === i ? 6 : 4}
            fill={hoveredIdx === i ? "#1A1A1A" : "#4285F4"}
            stroke="#FFFFFF" strokeWidth={1.5}
            style={{ cursor: "pointer" }}
            onMouseEnter={() => setHoveredIdx(i)}
          />
        ))}

        {/* X축 레이블 */}
        {labelIndices.map((i) => (
          <text key={i} x={points[i].x} y={H - 6} textAnchor="middle" fill="#9CA3AF" fontSize={8}>
            {points[i].month.slice(2)}
          </text>
        ))}

        {/* 툴팁 */}
        {hp !== null && (() => {
          const tx = Math.min(hp.x + 8, W - TW - 4);
          const ty = Math.max(hp.y - TH - 8, PAD_T + 2);
          return (
            <g>
              <rect x={tx} y={ty} width={TW} height={TH} rx={5} fill="#1A1A1A" opacity={0.88} />
              <text x={tx + 8} y={ty + 14} fill="#FFFFFF" fontSize={9} fontWeight="bold">
                {hp.month.replace("-", "년 ")}월
              </text>
              <text x={tx + 8} y={ty + 28} fill="#FFD600" fontSize={9}>
                ★{hp.avg.toFixed(2)} · {hp.count.toLocaleString()}건
              </text>
            </g>
          );
        })()}
      </svg>

      {/* 리뷰 볼륨 막대 그래프 — 평점 추이와 x축 정렬 */}
      {(() => {
        const BAR_H = 44;
        const maxCount = Math.max(...points.map((p) => p.count), 1);
        const barW = points.length > 1
          ? Math.max(3, (innerW / (points.length - 1)) * 0.5)
          : 8;
        return (
          <div style={{ marginTop: 2 }}>
            <p className="text-xs" style={{ color: "#C4C4C4", paddingLeft: PAD_L }}>리뷰 볼륨 (참고)</p>
            <svg
              viewBox={`0 0 ${W} ${BAR_H}`}
              style={{ width: "100%", height: "auto", display: "block" }}
            >
              {points.map((p, i) => {
                const barHeight = Math.max(1, (p.count / maxCount) * (BAR_H - 4));
                return (
                  <rect
                    key={i}
                    x={p.x - barW / 2}
                    y={BAR_H - barHeight}
                    width={barW}
                    height={barHeight}
                    fill="#4285F4"
                    opacity={0.18}
                    rx={1}
                  />
                );
              })}
            </svg>
          </div>
        );
      })()}

      {/* 범례 */}
      {phaseZones.length > 0 && (
        <div className="flex items-center gap-4 mt-1 justify-center flex-wrap">
          {phaseZones.map((zone, i) => (
            <span key={i} className="flex items-center gap-1 text-xs" style={{ color: zone.labelColor }}>
              <span className="inline-block w-3 h-3 rounded-sm flex-shrink-0"
                style={{ background: zone.fill, border: `1px solid ${zone.labelColor}60` }} />
              {zone.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── 시기별 카드 ──────────────────────────────────────────────────

function PhaseCard({
  phase, label, subtitle, color, appKey,
}: {
  phase: PhaseData | null | undefined;
  label: string;
  subtitle: string;
  color: string;
  appKey: string;
}) {
  const [reviewsOpen, setReviewsOpen] = useState(false);
  const [phaseReviews, setPhaseReviews] = useState<Review[] | null>(null);
  const [reviewsLoading, setReviewsLoading] = useState(false);

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

  // #7 — on-demand fetch from /api/phase_reviews (date-range filter, all reviews)
  function handleToggle() {
    if (!phase) return;
    if (!reviewsOpen && phaseReviews === null && !reviewsLoading) {
      setReviewsLoading(true);
      fetch(
        `/api/phase_reviews?app_key=${encodeURIComponent(appKey)}&date_from=${phase.date_from}&date_to=${phase.date_to}`
      )
        .then((r) => r.ok ? r.json() : null)
        .then((d) => {
          setPhaseReviews(d?.reviews ?? []);
          setReviewsLoading(false);
        })
        .catch(() => {
          setPhaseReviews([]);
          setReviewsLoading(false);
        });
    }
    setReviewsOpen((v) => !v);
  }

  return (
    <div className="rounded-xl p-4 space-y-3" style={{ background: "#FFFFFF", border: "1.5px solid #E2E8F0" }}>
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold" style={{ color }}>{label}</span>
          <span className="text-xs" style={{ color: "#C4C4C4" }}>{subtitle}</span>
        </div>
        <div className="flex items-center gap-3">
          {phase.avg_rating !== null && phase.avg_rating !== undefined && (
            <span className="text-sm font-black" style={{ color }}>★{phase.avg_rating.toFixed(2)}</span>
          )}
          <span className="text-xs" style={{ color: "#9CA3AF" }}>{phase.count.toLocaleString()}건</span>
        </div>
      </div>

      {/* 날짜 */}
      {phase.date_from && (
        <p className="text-xs" style={{ color: "#C4C4C4" }}>{phase.date_from} ~ {phase.date_to}</p>
      )}

      {/* 트렌드 요약 */}
      <p className="text-xs leading-relaxed" style={{ color: "#4A4A4A" }}>{phase.summary}</p>

      {/* 키워드 */}
      {phase.keywords && phase.keywords.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {phase.keywords.map((k, i) => (
            <span key={i} className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: "#F0EFEC", border: "1px solid #E2E8F0", color: "#4A4A4A" }}>
              {k}
            </span>
          ))}
        </div>
      )}

      {/* 이 시기 리뷰 — on-demand fetch */}
      <div>
        <button
          onClick={handleToggle}
          className="flex items-center gap-1 text-xs font-medium"
          style={{ color }}
        >
          이 시기 리뷰{phaseReviews !== null ? ` ${phaseReviews.length}건` : ""}
          {reviewsLoading
            ? <span className="ml-1" style={{ color: "#9CA3AF" }}>로딩중...</span>
            : reviewsOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />
          }
        </button>

        {reviewsOpen && (
          <div className="mt-2">
            {reviewsLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-14 rounded-lg animate-pulse" style={{ background: "#F0EFEC" }} />
                ))}
              </div>
            ) : phaseReviews && phaseReviews.length > 0 ? (
              <div className="space-y-2">
                {phaseReviews.map((r) => (
                  <div key={r.review_id} className="pl-3 py-2 space-y-1" style={{ borderLeft: `2px solid ${color}30` }}>
                    <div className="flex items-center gap-2">
                      <StarRating rating={r.rating} size="xs" />
                      {r.reviewed_at && (
                        <span className="text-xs" style={{ color: "#C4C4C4" }}>{formatDate(r.reviewed_at)}</span>
                      )}
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: "#6B7280" }}>{r.content}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs" style={{ color: "#C4C4C4" }}>이 시기 리뷰를 찾을 수 없습니다</p>
            )}
          </div>
        )}
      </div>
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
      <div className="flex items-center gap-3 flex-wrap justify-between">
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
        <span className="text-xs font-medium" style={{ color: "#9CA3AF" }}>
          최근 {reviews.length.toLocaleString()}건 기준
        </span>
      </div>

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
