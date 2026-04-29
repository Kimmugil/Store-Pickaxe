"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Search, CheckCircle, ArrowRight, Zap } from "lucide-react";
import { useTexts } from "@/components/TextsProvider";
import type { SearchResult, MatchSuggestion } from "@/lib/types";
import { formatRating } from "@/lib/utils";

type Step = "search" | "confirm" | "done";

export default function AddPage() {
  const texts = useTexts();
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<Step>("search");

  const [googleResults, setGoogleResults] = useState<SearchResult[]>([]);
  const [appleResults, setAppleResults] = useState<SearchResult[]>([]);
  const [suggestions, setSuggestions] = useState<MatchSuggestion[]>([]);

  const [selectedGoogle, setSelectedGoogle] = useState<SearchResult | null>(null);
  const [selectedApple, setSelectedApple] = useState<SearchResult | null>(null);

  const [registering, setRegistering] = useState(false);
  const [registeredKey, setRegisteredKey] = useState("");
  const [error, setError] = useState("");

  async function handleSearch() {
    if (!query.trim()) return;
    setLoading(true);
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
      setError(texts["common.error"] || "검색 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
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
    } finally {
      setRegistering(false);
    }
  }

  function applySuggestion(s: MatchSuggestion) {
    setSelectedGoogle(s.google);
    setSelectedApple(s.apple);
  }

  // Done screen
  if (step === "done") {
    return (
      <div className="max-w-md mx-auto text-center py-20 space-y-6">
        <div
          className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center text-3xl"
          style={{ background: "#FFD600", border: "2px solid #1A1A1A" }}
        >
          ✓
        </div>
        <div>
          <h2 className="font-black text-2xl text-[#1A1A1A]">
            {texts["add.success.title"] || "등록 완료!"}
          </h2>
          <p className="text-sm text-[#4A4A4A] mt-2">
            {texts["add.success.desc"] || "게임이 등록되었습니다."}
          </p>
        </div>
        <div
          className="text-xs text-[#4A4A4A] rounded-2xl px-5 py-4 text-left"
          style={{ background: "#FFFDE7", border: "2px solid #1A1A1A" }}
        >
          {texts["add.pending_ai.notice"] || "리뷰 수집이 즉시 시작됩니다. AI 분석은 관리자 승인 후 자동으로 진행됩니다."}
        </div>
        <button
          onClick={() => router.push(`/${registeredKey}`)}
          className="neo-button-primary"
        >
          {texts["common.view"] || "상세 보기"} <ArrowRight size={14} />
        </button>
      </div>
    );
  }

  const hasSelection = selectedGoogle || selectedApple;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-28">
      {/* Header */}
      <div>
        <h1 className="font-black text-3xl text-[#1A1A1A]">
          {texts["add.title"] || "게임 등록"}
        </h1>
        <p className="text-sm text-[#9CA3AF] mt-1 font-medium">
          {texts["add.desc"] || "구글 플레이 또는 앱스토어에서 게임을 검색하세요."}
        </p>
      </div>

      {/* Search bar */}
      <div className="neo-input-wrap">
        <Search size={16} color="#9CA3AF" />
        <input
          placeholder={texts["add.search.placeholder"] || "게임 이름 입력..."}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        />
        <button
          className="neo-button-dark text-sm py-1.5 px-4 flex-shrink-0"
          onClick={handleSearch}
          disabled={loading}
          style={{ border: "none", boxShadow: "none" }}
        >
          {loading ? (texts["common.loading"] || "검색 중...") : (texts["add.search.button"] || "검색")}
        </button>
      </div>

      {error && (
        <p
          className="text-sm font-bold px-4 py-3 rounded-xl"
          style={{ color: "#FF6B6B", background: "#FFF5F5", border: "2px solid #FF6B6B" }}
        >
          {error}
        </p>
      )}

      {step === "confirm" && (
        <>
          {/* Auto-match suggestions */}
          {suggestions.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded-lg flex items-center justify-center"
                  style={{ background: "#FFD600", border: "2px solid #1A1A1A" }}
                >
                  <Zap size={13} color="#1A1A1A" />
                </div>
                <h2 className="font-black text-sm text-[#1A1A1A]">
                  {texts["add.match.auto_label"] || "자동 매칭 제안"}
                </h2>
                <span className="text-xs text-[#9CA3AF]">— 클릭하면 구글 + 애플 동시 선택</span>
              </div>

              {suggestions.map((s, i) => {
                const isActive =
                  selectedGoogle?.package_name === s.google.package_name &&
                  selectedApple?.app_id === s.apple.app_id;
                return (
                  <div
                    key={i}
                    onClick={() => applySuggestion(s)}
                    className="neo-card p-4 flex items-center gap-4"
                    style={
                      isActive
                        ? { background: "#FFFDE7", borderColor: "#1A1A1A" }
                        : {}
                    }
                  >
                    <AppThumbnail result={s.google} />
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-sm text-[#1A1A1A]">{s.google.name}</p>
                      <p className="text-xs text-[#9CA3AF]">{s.google.developer}</p>
                    </div>
                    {/* Platform badges */}
                    <div className="flex items-center gap-2">
                      <div
                        className="flex items-center gap-1.5 rounded-lg px-2 py-1"
                        style={{ background: "#EBF3FF", border: "1.5px solid #4285F4" }}
                      >
                        <AppThumbnail result={s.google} small />
                        <span className="text-xs font-bold" style={{ color: "#4285F4" }}>G</span>
                      </div>
                      <span className="text-[#9CA3AF] text-sm font-bold">+</span>
                      <div
                        className="flex items-center gap-1.5 rounded-lg px-2 py-1"
                        style={{ background: "#F0EFEC", border: "1.5px solid #1A1A1A" }}
                      >
                        <AppThumbnail result={s.apple} small />
                        <span className="text-xs font-bold text-[#1A1A1A]">A</span>
                      </div>
                      <ConfidenceBadge score={s.score} confidence={s.confidence} />
                    </div>
                    {isActive
                      ? <CheckCircle size={18} color="#1A1A1A" className="flex-shrink-0" />
                      : (
                        <div
                          className="w-[18px] h-[18px] rounded-full flex-shrink-0"
                          style={{ border: "2px solid #E2E8F0" }}
                        />
                      )
                    }
                  </div>
                );
              })}
            </div>
          )}

          {/* Manual selection */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <h2 className="font-black text-sm text-[#1A1A1A]">
                {suggestions.length > 0
                  ? "직접 선택하기 (선택 사항)"
                  : "검색 결과"}
              </h2>
              <span className="text-xs text-[#9CA3AF]">
                — 구글·애플 목록에서 각각 클릭하여 선택
              </span>
            </div>
            <div className="grid grid-cols-2 gap-5">
              <ResultColumn
                title={texts["add.tab.google"] || "구글 플레이"}
                results={googleResults}
                platform="google"
                selected={selectedGoogle}
                onSelect={setSelectedGoogle}
                emptyText={texts["add.no_results.google"] || "결과 없음"}
                color="#4285F4"
              />
              <ResultColumn
                title={texts["add.tab.apple"] || "앱 스토어"}
                results={appleResults}
                platform="apple"
                selected={selectedApple}
                onSelect={setSelectedApple}
                emptyText={texts["add.no_results.apple"] || "결과 없음"}
                color="#1A1A1A"
              />
            </div>
          </div>
        </>
      )}

      {/* Sticky bottom action bar */}
      {hasSelection && (
        <div
          className="fixed bottom-0 left-0 right-0 z-40 p-4"
          style={{ background: "transparent" }}
        >
          <div
            className="max-w-4xl mx-auto flex items-center justify-between gap-4 rounded-2xl px-5 py-4"
            style={{
              background: "#FFFFFF",
              border: "2px solid #1A1A1A",
              boxShadow: "4px 4px 0px 0px #1A1A1A",
            }}
          >
            <div className="flex items-center gap-3 min-w-0">
              {(selectedGoogle?.icon_url || selectedApple?.icon_url) && (
                <Image
                  src={selectedGoogle?.icon_url || selectedApple?.icon_url || ""}
                  alt=""
                  width={36}
                  height={36}
                  className="rounded-xl flex-shrink-0"
                  style={{ border: "1.5px solid #1A1A1A" }}
                  unoptimized
                />
              )}
              <div className="min-w-0">
                <p className="font-black text-sm text-[#1A1A1A] truncate">
                  {selectedGoogle?.name || selectedApple?.name}
                </p>
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: "#F0EFEC", border: "1.5px solid #1A1A1A", color: "#4A4A4A" }}
                >
                  {selectedGoogle && selectedApple
                    ? "Google + Apple"
                    : selectedGoogle
                    ? "Google만"
                    : "Apple만"}
                </span>
              </div>
            </div>
            <button
              className="neo-button-primary flex-shrink-0"
              onClick={handleRegister}
              disabled={registering}
            >
              {registering
                ? (texts["common.loading"] || "등록 중...")
                : (texts["add.register.button"] || "등록하기")}
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ResultColumn({
  title, results, platform, selected, onSelect, emptyText, color,
}: {
  title: string;
  results: SearchResult[];
  platform: "google" | "apple";
  selected: SearchResult | null;
  onSelect: (r: SearchResult | null) => void;
  emptyText: string;
  color: string;
}) {
  return (
    <div className="space-y-2">
      <h3 className="font-black text-sm" style={{ color }}>{title}</h3>
      {results.length === 0 ? (
        <div
          className="flex items-center justify-center py-10 rounded-2xl"
          style={{ border: "2px dashed #E2E8F0", background: "#FAFAFA" }}
        >
          <p className="text-xs text-[#9CA3AF] font-medium">{emptyText}</p>
        </div>
      ) : (
        results.map((r) => {
          const key = r.package_name || r.app_id || r.name;
          const isSelected =
            platform === "google"
              ? selected?.package_name === r.package_name
              : selected?.app_id === r.app_id;
          return (
            <div
              key={key}
              onClick={() => onSelect(isSelected ? null : r)}
              className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all"
              style={
                isSelected
                  ? {
                      background: "#FFFDE7",
                      border: "2px solid #1A1A1A",
                      boxShadow: "2px 2px 0px 0px #1A1A1A",
                    }
                  : {
                      background: "#FFFFFF",
                      border: "2px solid #E2E8F0",
                    }
              }
            >
              <AppThumbnail result={r} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black truncate text-[#1A1A1A]">{r.name}</p>
                <p className="text-xs text-[#9CA3AF] truncate">{r.developer}</p>
                <p className="text-xs font-bold text-[#9CA3AF]">★ {formatRating(r.rating)}</p>
              </div>
              {isSelected
                ? <CheckCircle size={16} color="#1A1A1A" className="flex-shrink-0" />
                : (
                  <div
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ border: "2px solid #E2E8F0" }}
                  />
                )
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
    <Image
      src={result.icon_url}
      alt={result.name}
      width={size}
      height={size}
      className="rounded-xl flex-shrink-0"
      style={{ border: "1.5px solid #1A1A1A" }}
      unoptimized
    />
  ) : (
    <div
      style={{ width: size, height: size, background: "#F0EFEC", border: "1.5px solid #1A1A1A" }}
      className="rounded-xl flex-shrink-0"
    />
  );
}

function ConfidenceBadge({ score, confidence }: { score: number; confidence: string }) {
  const styleMap: Record<string, { background: string; color: string; border: string }> = {
    high:   { background: "#F0FFF4", color: "#16A34A", border: "1.5px solid #16A34A" },
    medium: { background: "#FFFDE7", color: "#B7960A", border: "1.5px solid #B7960A" },
    low:    { background: "#F0EFEC", color: "#9CA3AF", border: "1.5px solid #9CA3AF" },
  };
  const s = styleMap[confidence] || styleMap.low;
  return (
    <span
      className="text-xs font-black px-2 py-0.5 rounded-full"
      style={s}
    >
      {score}%
    </span>
  );
}
