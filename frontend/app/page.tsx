import { getAllApps, getTexts, getAppSnapshots, getAppAnalyses } from "@/lib/sheets";
import AppCard from "@/components/AppCard";
import Link from "next/link";
import { Plus } from "lucide-react";

export const revalidate = 120;

export default async function HomePage() {
  const [apps, texts] = await Promise.all([getAllApps(), getTexts()]);

  // active + pending 모두 표시 (pending은 관리자 승인 대기 배지 표시)
  const activeApps = apps.filter((a) => a.status === "active" || a.status === "pending");

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
    <div className="space-y-10">
      {/* Hero section */}
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-black text-4xl text-[#1A1A1A] leading-tight">
              {texts["home.title"]
                ? texts["home.title"]
                : (
                  <>
                    모바일 게임{" "}
                    <span
                      className="px-2 py-0.5 rounded-xl"
                      style={{ background: "#FFD600", border: "2px solid #1A1A1A" }}
                    >
                      리뷰 분석
                    </span>
                  </>
                )
              }
            </h1>
            <p className="text-[#9CA3AF] mt-2 text-base font-medium">
              {texts["home.subtitle"] || "Google Play & App Store 리뷰를 한 번에"}
            </p>
          </div>

          <Link
            href="/add"
            className="neo-button-primary text-sm flex-shrink-0"
          >
            <Plus size={15} />
            {texts["nav.add"] || "게임 등록"}
          </Link>
        </div>

        {/* Stats bar */}
        {appData.length > 0 && (
          <div className="flex items-center gap-6 flex-wrap">
            <StatPill label="등록 게임" value={String(appData.length)} />
            <StatPill
              label="AI 분석 완료"
              value={String(appData.filter((d) => d.hasAnalysis).length)}
              accent
            />
          </div>
        )}
      </div>

      {/* App grid */}
      {appData.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-20 rounded-2xl gap-4"
          style={{
            border: "2.5px dashed #1A1A1A",
            background: "#FFFFFF",
          }}
        >
          <span className="text-5xl">⛏</span>
          <div className="text-center">
            <p className="font-black text-lg text-[#1A1A1A]">
              {texts["home.empty.title"] || "등록된 게임이 없습니다"}
            </p>
            <p className="text-sm text-[#9CA3AF] mt-1">
              {texts["home.empty.desc"] || "게임 등록 페이지에서 추가해보세요."}
            </p>
          </div>
          <Link href="/add" className="neo-button-primary mt-2">
            <Plus size={14} />
            첫 게임 등록하기
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {appData.map(({ app, snapshots, hasAnalysis, lastAnalysisDate }, i) => (
            <div
              key={app.app_key}
              className="animate-slide-up"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <AppCard
                app={app}
                snapshots={snapshots}
                hasAnalysis={hasAnalysis}
                lastAnalysisDate={lastAnalysisDate}
                texts={texts}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatPill({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="font-black text-2xl"
        style={{ color: accent ? "#1A1A1A" : "#1A1A1A" }}
      >
        <span
          className="px-1.5 py-0.5 rounded-lg font-black text-lg"
          style={
            accent
              ? { background: "#FFD600", border: "2px solid #1A1A1A" }
              : { background: "#F0EFEC", border: "2px solid #1A1A1A" }
          }
        >
          {value}
        </span>
      </span>
      <span className="text-sm font-medium text-[#4A4A4A]">{label}</span>
    </div>
  );
}
