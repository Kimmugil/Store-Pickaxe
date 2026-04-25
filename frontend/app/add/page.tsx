"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Search, CheckCircle, ArrowRight, Plus } from "lucide-react";
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

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{texts["add.title"] || "게임 등록"}</h1>
        <p className="text-sm text-gray-400 mt-1">{texts["add.desc"] || "게임 이름으로 검색하세요."}</p>
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
          {/* 자동 매칭 제안 */}
          {suggestions.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                {texts["add.match.auto_label"] || "자동 매칭 제안"}
              </h2>
              {suggestions.map((s, i) => (
                <div
                  key={i}
                  className="card p-4 flex items-center gap-4 cursor-pointer hover:shadow-md transition"
                  onClick={() => applySuggestion(s)}
                >
                  <AppThumbnail result={s.google} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{s.google.name}</p>
                    <p className="text-xs text-gray-400">{s.google.developer}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <ConfidenceBadge score={s.score} confidence={s.confidence} texts={texts} />
                    <span className="text-gray-300">+</span>
                    <AppThumbnail result={s.apple} small />
                  </div>
                  <Plus size={16} className="text-gray-300 flex-shrink-0" />
                </div>
              ))}
            </div>
          )}

          {/* 결과 두 컬럼 */}
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

          {/* 등록 버튼 */}
          {(selectedGoogle || selectedApple) && (
            <div className="flex items-center justify-between card p-4">
              <div className="text-sm">
                <span className="font-medium">{selectedGoogle?.name || selectedApple?.name}</span>
                <span className="text-gray-400 ml-2 text-xs">
                  {selectedGoogle && selectedApple
                    ? texts["common.platform.both"] || "Google + Apple"
                    : selectedGoogle
                    ? texts["common.platform.google"] || "Google만"
                    : texts["common.platform.apple"] || "Apple만"}
                </span>
              </div>
              <button className="btn-primary" onClick={handleRegister} disabled={registering}>
                {registering ? (texts["common.loading"] || "등록 중...") : (texts["add.register.button"] || "등록")}
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
          const isSelected = selected?.package_name === r.package_name || selected?.app_id === r.app_id;
          return (
            <div
              key={key}
              onClick={() => onSelect(isSelected ? null : r)}
              className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition border ${
                isSelected ? "border-gray-900 bg-gray-50" : "border-transparent hover:bg-gray-50"
              }`}
            >
              <AppThumbnail result={r} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{r.name}</p>
                <p className="text-xs text-gray-400 truncate">{r.developer}</p>
                <p className="text-xs text-gray-400">★ {formatRating(r.rating)}</p>
              </div>
              {isSelected && <CheckCircle size={16} className="text-gray-900 flex-shrink-0" />}
            </div>
          );
        })
      )}
    </div>
  );
}

function AppThumbnail({ result, small = false }: { result: SearchResult; small?: boolean }) {
  const size = small ? 28 : 40;
  return result.icon_url ? (
    <Image src={result.icon_url} alt={result.name} width={size} height={size}
      className="rounded-lg flex-shrink-0" unoptimized />
  ) : (
    <div style={{ width: size, height: size }} className="rounded-lg bg-gray-100 flex-shrink-0" />
  );
}

function ConfidenceBadge({ score, confidence, texts }: { score: number; confidence: string; texts: Record<string, string> }) {
  const colorMap: Record<string, string> = {
    high: "bg-green-50 text-green-600",
    medium: "bg-yellow-50 text-yellow-600",
    low: "bg-gray-50 text-gray-500",
  };
  return (
    <span className={`badge ${colorMap[confidence] || "bg-gray-50 text-gray-500"}`}>
      {score}%
    </span>
  );
}
