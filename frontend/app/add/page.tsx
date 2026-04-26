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

  // ── 완료 화면 ──
  if (step === "done") {
    return (
      <div className="max-w-md mx-auto text-center py-16 space-y-4">
        <CheckCircle size={48} className="mx-auto text-positive" />
        <h2 className="text-xl font-bold">{texts["add.success.title"] || "등록 완료!"}</h2>
        <p className="text-sm text-gray-500">{texts["add.success.desc"] || "게임이 등록되었습니다."}</p>
        <p className="text-xs text-gray-400 bg-yellow-50 rounded-xl px-4 py-3">
          {texts["add.pending_ai.notice"] || "AI 분석은 관리자 승인 후 자동으로 진행됩니다."}
        </p>
        <button onClick={() => router.push(`/${registeredKey}`)} className="btn-primary mt-4">
          {texts["common.view"] || "상세 보기"} <ArrowRight size={14} />
        </button>
      </div>
    );
  }

  const hasSelection = selectedGoogle || selectedApple;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{texts["add.title"] || "게임 등록"}</h1>
        <p className="text-sm text-gray-400 mt-1">
          {texts["add.desc"] || "구글 플레이 또는 앱스토어에서 게임을 검색하세요."}
        </p>
      </div>

      {/* 검색창 */}
      <div className="flex gap-2">
        <input
          className="input"
          placeholder={texts["add.search.placeholder"] || "게임 이름 입력..."}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        />
        <button className="btn-primary flex-shrink-0" onClick={handleSearch} disabled={loading}>
          <Search size={16} />
          {loading ? (texts["common.loading"] || "검색 중...") : (texts["add.search.button"] || "검색")}
        </button>
      </div>

      {error && <p className="text-sm text-negative">{error}</p>}

      {step === "confirm" && (
        <>
          {/* ── 자동 매칭 제안 ── */}
          {suggestions.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Zap size={15} className="text-indigo-500" />
                <h2 className="text-sm font-semibold text-gray-700">
                  {texts["add.match.auto_label"] || "자동 매칭 제안"}
                </h2>
                <span className="text-xs text-gray-400">— 클릭하면 구글 + 애플 동시 선택됩니다</span>
              </div>
              {suggestions.map((s, i) => {
                const isActive =
                  selectedGoogle?.package_name === s.google.package_name &&
                  selectedApple?.app_id === s.apple.app_id;
                return (
                  <div
                    key={i}
                    onClick={() => applySuggestion(s)}
                    className={`card p-4 flex items-center gap-4 cursor-pointer transition border-2 ${
                      isActive
                        ? "border-gray-900 bg-gray-50"
                        : "border-transparent hover:border-gray-200"
                    }`}
                  >
                    <AppThumbnail result={s.google} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{s.google.name}</p>
                      <p className="text-xs text-gray-400">{s.google.developer}</p>
                    </div>
                    {/* 구글 + 애플 아이콘 나란히 */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 bg-blue-50 rounded-lg px-2 py-1">
                        <AppThumbnail result={s.google} small />
                        <span className="text-xs text-blue-500 font-medium">G</span>
                      </div>
                      <span className="text-gray-300 text-sm">+</span>
                      <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-2 py-1">
                        <AppThumbnail result={s.apple} small />
                        <span className="text-xs text-gray-500 font-medium">A</span>
                      </div>
                      <ConfidenceBadge score={s.score} confidence={s.confidence} />
                    </div>
                    {isActive
                      ? <CheckCircle size={18} className="text-gray-900 flex-shrink-0" />
                      : <div className="w-[18px] h-[18px] rounded-full border-2 border-gray-200 flex-shrink-0" />
                    }
                  </div>
                );
              })}
            </div>
          )}

          {/* ── 수동 선택 (두 컬럼) ── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-sm font-semibold text-gray-700">
                {suggestions.length > 0
                  ? "직접 선택하기 (선택 사항)"
                  : "검색 결과"}
              </h2>
              <span className="text-xs text-gray-400">
                — 구글·애플 목록에서 각각 클릭하여 선택하세요
              </span>
            </div>
            <div className="grid grid-cols-2 gap-6">
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
                color="#555555"
              />
            </div>
          </div>

          {/* ── 등록 버튼 바 ── */}
          {hasSelection && (
            <div className="sticky bottom-4 flex items-center justify-between card p-4 shadow-lg border border-gray-200">
              <div className="text-sm">
                <span className="font-semibold">{selectedGoogle?.name || selectedApple?.name}</span>
                <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                  {selectedGoogle && selectedApple
                    ? "Google + Apple"
                    : selectedGoogle
                    ? "Google만"
                    : "Apple만"}
                </span>
              </div>
              <button className="btn-primary" onClick={handleRegister} disabled={registering}>
                {registering
                  ? (texts["common.loading"] || "등록 중...")
                  : (texts["add.register.button"] || "등록하기")}
                <ArrowRight size={14} />
              </button>
            </div>
          )}
        </>
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
      <h3 className="text-sm font-semibold" style={{ color }}>{title}</h3>
      {results.length === 0 ? (
        <p className="text-xs text-gray-400 py-4 text-center">{emptyText}</p>
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
              className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition border-2 ${
                isSelected
                  ? "border-gray-900 bg-gray-50"
                  : "border-transparent hover:bg-gray-50 hover:border-gray-100"
              }`}
            >
              <AppThumbnail result={r} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{r.name}</p>
                <p className="text-xs text-gray-400 truncate">{r.developer}</p>
                <p className="text-xs text-gray-400">★ {formatRating(r.rating)}</p>
              </div>
              {isSelected
                ? <CheckCircle size={16} className="text-gray-900 flex-shrink-0" />
                : <div className="w-4 h-4 rounded-full border-2 border-gray-200 flex-shrink-0" />
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
      className="rounded-lg flex-shrink-0"
      unoptimized
    />
  ) : (
    <div style={{ width: size, height: size }} className="rounded-lg bg-gray-100 flex-shrink-0" />
  );
}

function ConfidenceBadge({ score, confidence }: { score: number; confidence: string }) {
  const colorMap: Record<string, string> = {
    high: "bg-green-50 text-green-600",
    medium: "bg-yellow-50 text-yellow-600",
    low: "bg-gray-50 text-gray-500",
  };
  return (
    <span className={`badge text-xs px-2 py-0.5 rounded-full ${colorMap[confidence] || "bg-gray-50 text-gray-500"}`}>
      {score}%
    </span>
  );
}
