import { getAllApps, getAppAnalyses, getCollectionLogs } from "@/lib/sheets";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { AppMeta, Analysis, CollectionLog } from "@/lib/types";

export const revalidate = 60;

export default async function DashboardPage() {
  const apps = await getAllApps();

  const appData = await Promise.all(
    apps.map(async (app) => {
      if (!app.spreadsheet_id) return { app, latestAnalysis: null, logs: [] };
      const [analyses, logs] = await Promise.all([
        getAppAnalyses(app.spreadsheet_id).catch(() => [] as Analysis[]),
        getCollectionLogs(app.spreadsheet_id).catch(() => [] as CollectionLog[]),
      ]);
      const sorted = [...analyses].sort((a, b) => (b.created_at > a.created_at ? 1 : -1));
      return { app, latestAnalysis: sorted[0] ?? null, logs };
    })
  );

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-black text-3xl" style={{ color: "#1A1A1A", letterSpacing: "-0.03em" }}>
            등록된 게임{" "}
            <span
              className="px-2 py-0.5 rounded-xl text-2xl"
              style={{ background: "#FFD600", border: "2px solid #1A1A1A" }}
            >
              {apps.length}
            </span>
          </h1>
          <p className="mt-1 text-sm font-medium" style={{ color: "#9CA3AF" }}>
            Google Play & App Store 리뷰 분석
          </p>
        </div>
      </div>

      {appData.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-24 rounded-2xl gap-4"
          style={{ border: "2px dashed #1A1A1A", background: "#FFFFFF" }}
        >

          <div className="text-center">
            <p className="font-black text-lg" style={{ color: "#1A1A1A" }}>등록된 게임이 없습니다</p>
            <p className="text-sm mt-1" style={{ color: "#9CA3AF" }}>홈에서 게임을 검색해 추가하세요</p>
          </div>
          <Link href="/" className="neo-button-primary mt-2">홈으로 가서 추가하기</Link>
        </div>
      ) : (
        <div
          className="grid gap-5"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}
        >
          {appData.map(({ app, latestAnalysis, logs }, i) => (
            <div key={app.app_key} className="animate-slide-up" style={{ animationDelay: `${i * 50}ms` }}>
              <AppCard app={app} latestAnalysis={latestAnalysis} logs={logs} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function computeAvgFromDist(dist: Record<string, number> | undefined): number | null {
  if (!dist) return null;
  const entries = Object.entries(dist);
  if (entries.length === 0) return null;
  let total = 0, count = 0;
  for (const [star, cnt] of entries) { total += Number(star) * cnt; count += cnt; }
  return count > 0 ? Math.round(total / count * 10) / 10 : null;
}

function AppCard({
  app, latestAnalysis, logs,
}: {
  app: AppMeta;
  latestAnalysis: Analysis | null;
  logs: CollectionLog[];
}) {
  const totalReviews = (app.google_review_count ?? 0) + (app.apple_review_count ?? 0);
  const lastLog = logs.at(-1);
  const reportHref = latestAnalysis?.analysis_id
    ? `/report/${latestAnalysis.analysis_id}?app_key=${app.app_key}`
    : `/${app.app_key}`;

  const gCollected = computeAvgFromDist(latestAnalysis?.google_rating_dist);
  const aCollected = computeAvgFromDist(latestAnalysis?.apple_rating_dist);

  return (
    <div className="card overflow-hidden" style={{ display: "flex", flexDirection: "column" }}>
      <div className="flex items-start gap-4 p-5" style={{ borderBottom: "1px solid #E2E8F0" }}>
        {app.icon_url ? (
          <img
            src={app.icon_url} alt={app.app_name} width={56} height={56}
            className="rounded-xl flex-shrink-0" style={{ border: "2px solid #1A1A1A" }}
          />
        ) : (
          <div
            className="flex-shrink-0 rounded-xl flex items-center justify-center font-black text-xl"
            style={{ width: 56, height: 56, background: "#F0EFEC", border: "2px solid #1A1A1A" }}
          >
            {app.app_name.charAt(0)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-black text-base truncate" style={{ color: "#1A1A1A" }}>
              {app.app_name}
            </span>
            {app.pending_analysis && (
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                style={{ background: "#FEF9C3", border: "1.5px solid #FDE047", color: "#854D0E" }}
              >
                분석 대기
              </span>
            )}
          </div>
          <p className="text-sm mt-0.5 truncate" style={{ color: "#9CA3AF" }}>{app.developer}</p>

          {/* 이중 평점: 스토어 공식 + 수집 평균 */}
          <div className="space-y-1 mt-2">
            {(app.google_rating || gCollected) && (
              <div className="flex items-center gap-2 flex-wrap">
                <span style={{
                  fontSize: 10, fontWeight: 800, color: "#4285F4",
                  background: "#EBF3FF", padding: "1px 6px", borderRadius: 4,
                }}>Google</span>
                {app.google_rating && (
                  <span className="text-xs" style={{ color: "#4285F4" }}>스토어 ★{Number(app.google_rating).toFixed(1)}</span>
                )}
                {gCollected !== null && (
                  <span className="text-xs" style={{ color: "#9CA3AF" }}>수집 ★{gCollected.toFixed(1)}</span>
                )}
              </div>
            )}
            {(app.apple_rating || aCollected) && (
              <div className="flex items-center gap-2 flex-wrap">
                <span style={{
                  fontSize: 10, fontWeight: 800, color: "#4A4A4A",
                  background: "#F0EFEC", padding: "1px 6px", borderRadius: 4,
                }}>Apple</span>
                {app.apple_rating && (
                  <span className="text-xs" style={{ color: "#4A4A4A" }}>스토어 ★{Number(app.apple_rating).toFixed(1)}</span>
                )}
                {aCollected !== null && (
                  <span className="text-xs" style={{ color: "#9CA3AF" }}>수집 ★{aCollected.toFixed(1)}</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-5 py-4" style={{ minHeight: 72 }}>
        {latestAnalysis ? (
          <p className="text-sm leading-relaxed" style={{ color: "#4A4A4A" }}>
            {latestAnalysis.overall_summary}
          </p>
        ) : (
          <p className="text-sm" style={{ color: "#9CA3AF" }}>
            {lastLog ? "리뷰 수집 완료 — 분석 대기중" : "아직 수집된 리뷰가 없습니다"}
          </p>
        )}
      </div>

      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ borderTop: "1px solid #E2E8F0", background: "#FAFAFA", marginTop: "auto" }}
      >
        <span className="text-xs font-bold" style={{ color: "#9CA3AF" }}>
          리뷰 {totalReviews.toLocaleString()}건
        </span>
        <Link
          href={reportHref}
          className="neo-button"
          style={{ padding: "6px 14px", fontSize: 12 }}
        >
          리포트 확인하기 <ChevronRight size={12} />
        </Link>
      </div>
    </div>
  );
}
