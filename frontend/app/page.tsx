import { getAllApps, getTexts, getAppSnapshots, getAppAnalyses } from "@/lib/sheets";
import AppCard from "@/components/AppCard";

export const revalidate = 120;

export default async function HomePage() {
  const [apps, texts] = await Promise.all([getAllApps(), getTexts()]);

  const activeApps = apps.filter((a) => a.status === "active");

  // 각 앱의 스냅샷 + 분석 여부 병렬 로드
  const appData = await Promise.all(
    activeApps.map(async (app) => {
      if (!app.spreadsheet_id) return { app, snapshots: [], hasAnalysis: false };
      const [snapshots, analyses] = await Promise.all([
        getAppSnapshots(app.spreadsheet_id).catch(() => []),
        getAppAnalyses(app.spreadsheet_id).catch(() => []),
      ]);
      return {
        app,
        snapshots,
        hasAnalysis: analyses.length > 0,
        lastAnalysisDate: analyses.at(-1)?.created_at,
      };
    })
  );

  return (
    <div className="space-y-8">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {texts["home.title"] || "Store-Pickaxe"}
        </h1>
        <p className="text-gray-400 mt-1 text-sm">
          {texts["home.subtitle"] || "모바일 게임 리뷰 분석 대시보드"}
        </p>
      </div>

      {/* 앱 그리드 */}
      {appData.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg font-medium">{texts["home.empty.title"] || "등록된 게임이 없습니다"}</p>
          <p className="text-sm mt-1">{texts["home.empty.desc"] || "게임 등록 페이지에서 추가해보세요."}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {appData.map(({ app, snapshots, hasAnalysis, lastAnalysisDate }) => (
            <AppCard
              key={app.app_key}
              app={app}
              snapshots={snapshots}
              hasAnalysis={hasAnalysis}
              lastAnalysisDate={lastAnalysisDate}
              texts={texts}
            />
          ))}
        </div>
      )}
    </div>
  );
}
