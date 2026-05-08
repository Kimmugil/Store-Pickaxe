"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Search, CheckCircle, ArrowRight, Zap, ChevronRight } from "lucide-react";
import type { SearchResult, MatchSuggestion, AppMeta, Analysis } from "@/lib/types";
import { formatRating } from "@/lib/utils";

type Step = "idle" | "loading" | "confirm" | "done";
type EnrichedApp = { app: AppMeta; latestAnalysis: Analysis | null };

export default function HomePage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("idle");
  const [query, setQuery] = useState("");
  const [recentApps, setRecentApps] = useState<EnrichedApp[]>([]);

  const [googleResults, setGoogleResults] = useState<SearchResult[]>([]);
  const [appleResults, setAppleResults] = useState<SearchResult[]>([]);
  const [suggestions, setSuggestions] = useState<MatchSuggestion[]>([]);
  const [selectedGoogle, setSelectedGoogle] = useState<SearchResult | null>(null);
  const [selectedApple, setSelectedApple] = useState<SearchResult | null>(null);

  const [registering, setRegistering] = useState(false);
  const [registeredKey, setRegisteredKey] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/apps")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setRecentApps(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  async function handleSearch() {
    if (!query.trim()) return;
    setStep("loading");
    setError("");
    setSelectedGoogle(null);
    setSelectedApple(null);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setGoogleResults(data.google || []);
      setAppleResults(data.apple || []);
      setSuggestions(data.suggestions || []);
      setStep("confirm");
    } catch {
      setError("검색 중 오류가 발생했습니다.");
      setStep("idle");
    }
  }

  async function handleRegister() {
    const name = selectedGoogle?.name || selectedApple?.name || "";
    if (!name) return;
    setRegistering(true);
    setError("");
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          app_name: name,
          developer: selectedGoogle?.developer || selectedApple?.developer || "",
          google_package: selectedGoogle?.package_name || "",
          apple_app_id: selectedApple?.app_id || "",
          icon_url: selectedGoogle?.icon_url || selectedApple?.icon_url || "",
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setRegisteredKey(data.app_key);
      setStep("done");
    } catch (e) {
      setError(String(e));
      setRegistering(false);
    }
  }

  if (step === "done") {
    return (
      <div className="max-w-md mx-auto text-center py-24 space-y-6">
        <div
          className="w-16 h-16 rounded-2xl mx-auto"
          style={{ background: "#FFD600", border: "2px solid #1A1A1A" }}
        />
        <div>
          <h2 className="font-black text-2xl" style={{ color: "#1A1A1A" }}>등록 완료!</h2>
          <p className="text-sm mt-2" style={{ color: "#4A4A4A" }}>
            게임이 등록되었습니다. 리뷰 수집이 곧 시작됩니다.
          </p>
        </div>
        <div
          className="text-xs text-left px-5 py-4 rounded-2xl"
          style={{ background: "#FFFDE7", border: "2px solid #1A1A1A", color: "#4A4A4A" }}
        >
          AI 분석은 관리자 승인 후 자동으로 진행됩니다.
        </div>
        <button onClick={() => router.push(`/${registeredKey}`)} className="neo-button-primary">
          상세 보기 <ArrowRight size={14} />
        </button>
      </div>
    );
  }

  const hasSelection = selectedGoogle || selectedApple;

  return (
    <div className="pb-28">
      {/* ── 히어로 + 검색 (뷰포트 중앙) ─────────────────────────── */}
      <div
        className="flex flex-col items-center justify-center text-center gap-5"
        style={{ minHeight: "calc(100vh - 56px - 320px)" }}
      >
        <div className="space-y-3">
          <h1 className="font-black text-4xl sm:text-5xl" style={{ color: "#1A1A1A", letterSpacing: "-0.04em" }}>
            모바일 게임 리뷰{" "}
            <span style={{ background: "#FFD600" }}>한눈에</span>
          </h1>
          <p className="text-base font-medium" style={{ color: "#9CA3AF" }}>
            Google Play & App Store 리뷰를 수집하고 AI로 분석합니다
          </p>
        </div>

        {/* 검색창 */}
        <div className="w-full max-w-xl">
          <div className="neo-input-wrap">
            <Search size={16} color="#9CA3AF" />
            <input
              placeholder="게임 이름으로 검색 (예: 브롤스타즈)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              autoFocus
            />
            <button
              className="neo-button-dark text-sm py-1.5 px-4 flex-shrink-0"
              onClick={handleSearch}
              disabled={step === "loading"}
              style={{ border: "none", boxShadow: "none" }}
            >
              {step === "loading" ? "검색 중..." : "검색"}
            </button>
          </div>
          {error && (
            <p
              className="mt-3 text-sm font-bold px-4 py-2 rounded-xl text-left"
              style={{ color: "#FF6B6B", background: "#FFF5F5", border: "2px solid #FF6B6B" }}
            >
              {error}
            </p>
          )}
          <p className="mt-2 text-xs" style={{ color: "#9CA3AF" }}>
            수집과 분석에 수 분이 소요됩니다
          </p>
        </div>
      </div>

      {/* ── 검색 결과 ────────────────────────────────────────────── */}
      {step === "confirm" && (
        <div className="max-w-4xl mx-auto space-y-6 mt-4">
          {suggestions.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded-lg flex items-center justify-center"
                  style={{ background: "#FFD600", border: "2px solid #1A1A1A" }}
                >
                  <Zap size={13} color="#1A1A1A" />
                </div>
                <h2 className="font-black text-sm" style={{ color: "#1A1A1A" }}>자동 매칭 제안</h2>
                <span className="text-xs" style={{ color: "#9CA3AF" }}>— 클릭하면 구글 + 애플 동시 선택</span>
              </div>
              {suggestions.map((s, i) => {
                const isActive =
                  selectedGoogle?.package_name === s.google.package_name &&
                  selectedApple?.app_id === s.apple.app_id;
                return (
                  <div
                    key={i}
                    onClick={() => { setSelectedGoogle(s.google); setSelectedApple(s.apple); }}
                    className="card p-4 flex items-center gap-4 cursor-pointer"
                    style={isActive ? { background: "#FFFDE7" } : {}}
                  >
                    <AppThumbnail result={s.google} />
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-sm" style={{ color: "#1A1A1A" }}>{s.google.name}</p>
                      <p className="text-xs" style={{ color: "#9CA3AF" }}>{s.google.developer}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 rounded-lg px-2 py-1"
                        style={{ background: "#EBF3FF", border: "1.5px solid #4285F4" }}>
                        <AppThumbnail result={s.google} small />
                        <span className="text-xs font-bold" style={{ color: "#4285F4" }}>G</span>
                      </div>
                      <span className="text-sm font-bold" style={{ color: "#9CA3AF" }}>+</span>
                      <div className="flex items-center gap-1.5 rounded-lg px-2 py-1"
                        style={{ background: "#F0EFEC", border: "1.5px solid #1A1A1A" }}>
                        <AppThumbnail result={s.apple} small />
                        <span className="text-xs font-bold" style={{ color: "#1A1A1A" }}>A</span>
                      </div>
                      <ConfidenceBadge score={s.score} confidence={s.confidence} />
                    </div>
                    {isActive
                      ? <CheckCircle size={18} color="#1A1A1A" className="flex-shrink-0" />
                      : <div className="w-[18px] h-[18px] rounded-full flex-shrink-0" style={{ border: "2px solid #E2E8F0" }} />
                    }
                  </div>
                );
              })}
            </div>
          )}

          <div>
            <div className="flex items-center gap-2 mb-4">
              <h2 className="font-black text-sm" style={{ color: "#1A1A1A" }}>
                {suggestions.length > 0 ? "직접 선택하기 (선택 사항)" : "검색 결과"}
              </h2>
              <span className="text-xs" style={{ color: "#9CA3AF" }}>
                — 구글·애플 목록에서 각각 클릭하여 선택
              </span>
            </div>
            <div className="grid grid-cols-2 gap-5">
              <ResultColumn title="구글 플레이" results={googleResults} platform="google"
                selected={selectedGoogle} onSelect={setSelectedGoogle} color="#4285F4" />
              <ResultColumn title="앱 스토어" results={appleResults} platform="apple"
                selected={selectedApple} onSelect={setSelectedApple} color="#1A1A1A" />
            </div>
          </div>
        </div>
      )}

      {/* ── 최근 등록 게임 카로셀 (idle 상태) ───────────────────── */}
      {step === "idle" && recentApps.length > 0 && (
        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-black text-base" style={{ color: "#1A1A1A" }}>
              최근 등록된 게임{" "}
              <span
                className="px-2 py-0.5 rounded-xl text-sm"
                style={{ background: "#FFD600", border: "2px solid #1A1A1A" }}
              >
                {recentApps.length}
              </span>
            </h2>
            <Link href="/dashboard" className="neo-button text-xs">
              전체 보기 <ChevronRight size={12} />
            </Link>
          </div>

          {/* 가로 스크롤 카로셀 */}
          <div
            className="flex gap-4 overflow-x-auto pb-4"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {recentApps.map(({ app, latestAnalysis }) => (
              <RecentCard key={app.app_key} app={app} analysis={latestAnalysis} />
            ))}
          </div>
        </div>
      )}

      {/* ── 등록 바 ──────────────────────────────────────────────── */}
      {hasSelection && (
        <div className="fixed bottom-0 left-0 right-0 z-40 p-4">
          <div
            className="max-w-4xl mx-auto flex items-center justify-between gap-4 rounded-2xl px-5 py-4"
            style={{ background: "#FFFFFF", border: "2px solid #1A1A1A", boxShadow: "4px 4px 0px 0px #1A1A1A" }}
          >
            <div className="flex items-center gap-3 min-w-0">
              {(selectedGoogle?.icon_url || selectedApple?.icon_url) && (
                <Image
                  src={selectedGoogle?.icon_url || selectedApple?.icon_url || ""}
                  alt="" width={36} height={36}
                  className="rounded-xl flex-shrink-0"
                  style={{ border: "1.5px solid #1A1A1A" }} unoptimized
                />
              )}
              <div className="min-w-0">
                <p className="font-black text-sm truncate" style={{ color: "#1A1A1A" }}>
                  {selectedGoogle?.name || selectedApple?.name}
                </p>
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: "#F0EFEC", border: "1.5px solid #1A1A1A", color: "#4A4A4A" }}
                >
                  {selectedGoogle && selectedApple ? "Google + Apple" : selectedGoogle ? "Google만" : "Apple만"}
                </span>
              </div>
            </div>
            <button
              className="neo-button-primary flex-shrink-0"
              onClick={handleRegister}
              disabled={registering}
            >
              {registering ? "등록 중..." : "등록하기"} <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 카로셀 카드 ───────────────────────────────────────────────────

function RecentCard({ app, analysis }: { app: AppMeta; analysis: Analysis | null }) {
  const sentiment = analysis
    ? Math.round(((analysis.google_sentiment ?? 0) + (analysis.apple_sentiment ?? 0)) /
        ([analysis.google_sentiment, analysis.apple_sentiment].filter((v) => v !== null).length || 1))
    : null;

  return (
    <Link
      href={`/${app.app_key}`}
      className="flex-shrink-0 card-hover overflow-hidden"
      style={{ width: 260 }}
    >
      {/* 헤더 */}
      <div className="p-4" style={{ borderBottom: "2px solid #1A1A1A" }}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            {app.icon_url ? (
              <img
                src={app.icon_url} alt={app.app_name} width={44} height={44}
                className="rounded-xl flex-shrink-0" style={{ border: "2px solid #1A1A1A" }}
              />
            ) : (
              <div
                className="flex-shrink-0 rounded-xl flex items-center justify-center font-black text-lg"
                style={{ width: 44, height: 44, background: "#F0EFEC", border: "2px solid #1A1A1A" }}
              >
                {app.app_name.charAt(0)}
              </div>
            )}
            <div className="min-w-0">
              <p className="font-black text-sm truncate" style={{ color: "#1A1A1A" }}>{app.app_name}</p>
              <p className="text-xs truncate" style={{ color: "#9CA3AF" }}>{app.developer}</p>
            </div>
          </div>
          {sentiment !== null && (
            <span
              className={`text-xs font-black px-2 py-0.5 rounded-full flex-shrink-0 ${
                sentiment >= 60 ? "sentiment-pos" : sentiment >= 40 ? "sentiment-mixed" : "sentiment-neg"
              }`}
            >
              {sentiment >= 60 ? "긍정적" : sentiment >= 40 ? "보통" : "부정적"}
            </span>
          )}
        </div>
      </div>

      {/* 요약 */}
      <div className="px-4 py-3" style={{ minHeight: 72 }}>
        {analysis?.overall_summary ? (
          <p
            className="text-xs leading-relaxed"
            style={{
              color: "#4A4A4A",
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {analysis.overall_summary}
          </p>
        ) : (
          <p className="text-xs" style={{ color: "#9CA3AF" }}>
            {app.pending_analysis ? "분석 대기중" : "아직 분석 결과가 없습니다"}
          </p>
        )}
      </div>

      {/* 하단 */}
      <div
        className="flex items-center justify-between px-4 py-2"
        style={{ borderTop: "2px solid #1A1A1A", background: "#FAFAFA" }}
      >
        <div className="flex gap-2">
          {app.google_rating && (
            <span className="text-xs font-bold" style={{ color: "#4285F4" }}>
              G ★{Number(app.google_rating).toFixed(1)}
            </span>
          )}
          {app.apple_rating && (
            <span className="text-xs font-bold" style={{ color: "#1A1A1A" }}>
              A ★{Number(app.apple_rating).toFixed(1)}
            </span>
          )}
        </div>
        {analysis?.created_at && (
          <span className="text-xs" style={{ color: "#9CA3AF" }}>
            {formatDate(analysis.created_at)}
          </span>
        )}
      </div>
    </Link>
  );
}

// ── 서브 컴포넌트 ─────────────────────────────────────────────────

function ResultColumn({
  title, results, platform, selected, onSelect, color,
}: {
  title: string;
  results: SearchResult[];
  platform: "google" | "apple";
  selected: SearchResult | null;
  onSelect: (r: SearchResult | null) => void;
  color: string;
}) {
  return (
    <div className="space-y-2">
      <h3 className="font-black text-sm" style={{ color }}>{title}</h3>
      {results.length === 0 ? (
        <div className="flex items-center justify-center py-10 rounded-2xl"
          style={{ border: "2px dashed #E2E8F0", background: "#FAFAFA" }}>
          <p className="text-xs font-medium" style={{ color: "#9CA3AF" }}>결과 없음</p>
        </div>
      ) : (
        results.map((r) => {
          const key = r.package_name || r.app_id || r.name;
          const isSelected = platform === "google"
            ? selected?.package_name === r.package_name
            : selected?.app_id === r.app_id;
          return (
            <div
              key={key}
              onClick={() => onSelect(isSelected ? null : r)}
              className="flex items-center gap-3 p-3 rounded-xl cursor-pointer"
              style={
                isSelected
                  ? { background: "#FFFDE7", border: "2px solid #1A1A1A", boxShadow: "2px 2px 0px 0px #1A1A1A" }
                  : { background: "#FFFFFF", border: "2px solid #E2E8F0" }
              }
            >
              <AppThumbnail result={r} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black truncate" style={{ color: "#1A1A1A" }}>{r.name}</p>
                <p className="text-xs truncate" style={{ color: "#9CA3AF" }}>{r.developer}</p>
                <p className="text-xs font-bold" style={{ color: "#9CA3AF" }}>★ {formatRating(r.rating)}</p>
              </div>
              {isSelected
                ? <CheckCircle size={16} color="#1A1A1A" className="flex-shrink-0" />
                : <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ border: "2px solid #E2E8F0" }} />
              }
            </div>
          );
        })
      )}
    </div>
  );
}

function AppThumbnail({ result, small = false }: { result: SearchResult; small?: boolean }) {
  const size = small ? 24 : 40;
  return result.icon_url ? (
    <Image src={result.icon_url} alt={result.name} width={size} height={size}
      className="rounded-xl flex-shrink-0" style={{ border: "1.5px solid #1A1A1A" }} unoptimized />
  ) : (
    <div style={{ width: size, height: size, background: "#F0EFEC", border: "1.5px solid #1A1A1A" }}
      className="rounded-xl flex-shrink-0" />
  );
}

function ConfidenceBadge({ score, confidence }: { score: number; confidence: string }) {
  const styleMap: Record<string, { background: string; color: string; border: string }> = {
    high:   { background: "#F0FFF4", color: "#16A34A", border: "1.5px solid #16A34A" },
    medium: { background: "#FFFDE7", color: "#B7960A", border: "1.5px solid #B7960A" },
    low:    { background: "#F0EFEC", color: "#9CA3AF", border: "1.5px solid #9CA3AF" },
  };
  return (
    <span className="text-xs font-black px-2 py-0.5 rounded-full"
      style={styleMap[confidence] || styleMap.low}>
      {score}%
    </span>
  );
}

function formatDate(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}
