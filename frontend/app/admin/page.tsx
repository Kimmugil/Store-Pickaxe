"use client";

import { useState, useEffect } from "react";
import { Lock, RefreshCw, Trash2, AlertTriangle, Sparkles, Download, RotateCcw, Calendar, Check, Gauge } from "lucide-react";
import type { AppMeta } from "@/lib/types";

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [authError, setAuthError] = useState("");
  const [apps, setApps] = useState<AppMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [releaseDateEditing, setReleaseDateEditing] = useState<string | null>(null);
  const [releaseDateValue, setReleaseDateValue] = useState("");
  const [dailyUsage, setDailyUsage] = useState<{ count: number; limit: number } | null>(null);
  const [newLimitValue, setNewLimitValue] = useState("");

  async function handleLogin() {
    setAuthError("");
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "verify", password }),
    });
    const data = await res.json();
    if (data.ok) {
      setAuthenticated(true);
      loadApps();
    } else {
      setAuthError("비밀번호가 올바르지 않습니다.");
    }
  }

  async function loadApps() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_apps", password }),
      });
      const data = await res.json();
      setApps(data.apps || []);
    } finally {
      setLoading(false);
    }
  }

  async function loadDailyUsage() {
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_daily_limit", password }),
      });
      const data = await res.json();
      if (data.ok) setDailyUsage({ count: data.count, limit: data.limit });
    } catch { /* ignore */ }
  }

  async function resetDailyLimit() {
    setBusyKey("__daily__");
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset_daily_limit", password }),
      });
      const data = await res.json();
      if (data.ok) {
        setActionMsg({ ok: true, text: "일일 AI 분석 횟수가 초기화되었습니다." });
        loadDailyUsage();
      } else {
        setActionMsg({ ok: false, text: data.error || "초기화 실패" });
      }
    } catch {
      setActionMsg({ ok: false, text: "네트워크 오류" });
    } finally {
      setBusyKey(null);
    }
  }

  async function saveDailyLimit() {
    const val = parseInt(newLimitValue);
    if (!val || val < 1) return;
    setBusyKey("__daily__");
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_daily_limit", limit: val, password }),
      });
      const data = await res.json();
      if (data.ok) {
        setActionMsg({ ok: true, text: `일일 AI 분석 한도가 ${val}회로 변경되었습니다.` });
        setNewLimitValue("");
        loadDailyUsage();
      } else {
        setActionMsg({ ok: false, text: data.error || "변경 실패" });
      }
    } catch {
      setActionMsg({ ok: false, text: "네트워크 오류" });
    } finally {
      setBusyKey(null);
    }
  }

  async function saveReleaseDate(app_key: string) {
    setBusyKey(app_key);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_release_date", app_key, release_date: releaseDateValue, password }),
      });
      const data = await res.json();
      if (data.ok) {
        setActionMsg({ ok: true, text: "출시일이 저장되었습니다." });
        setReleaseDateEditing(null);
        loadApps();
      } else {
        setActionMsg({ ok: false, text: data.error || "저장 실패" });
      }
    } catch {
      setActionMsg({ ok: false, text: "네트워크 오류" });
    } finally {
      setBusyKey(null);
    }
  }

  async function doAction(action: string, app_key: string, label: string) {
    setActionMsg(null);
    setBusyKey(app_key);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, app_key, password }),
      });
      const data = await res.json();
      if (data.ok) {
        const isAsync = ["collect", "collect_full", "reanalyze", "approve_analysis"].includes(action);
        setActionMsg({ ok: true, text: isAsync ? `${label} — 워크플로우를 시작했습니다 (수 분 소요)` : `${label} 완료` });
        loadApps();
      } else {
        setActionMsg({ ok: false, text: data.error || "오류가 발생했습니다." });
      }
    } catch {
      setActionMsg({ ok: false, text: "네트워크 오류" });
    } finally {
      setBusyKey(null);
    }
  }

  useEffect(() => {
    if (authenticated) {
      loadDailyUsage();
    }
  }, [authenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!authenticated) {
    return (
      <div className="max-w-xs mx-auto py-24 space-y-4">
        <div className="flex items-center gap-3 mb-8">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "#1A1A1A" }}
          >
            <Lock size={16} color="#FFFFFF" />
          </div>
          <h1 className="font-black text-xl" style={{ color: "#1A1A1A" }}>관리자 패널</h1>
        </div>

        <input
          type="password"
          className="neo-input w-full"
          placeholder="비밀번호를 입력하세요"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          autoFocus
        />

        {authError && (
          <p className="text-sm font-bold" style={{ color: "#EF4444" }}>
            {authError}
          </p>
        )}

        <button className="neo-button-primary w-full justify-center" onClick={handleLogin}>
          로그인
        </button>
      </div>
    );
  }

  const pendingApps = apps.filter((a) => a.pending_analysis);
  const allApps = apps;

  return (
    <div className="space-y-8">
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-black text-2xl" style={{ color: "#1A1A1A", letterSpacing: "-0.02em" }}>
          관리자 패널
        </h1>
        <button className="neo-button" onClick={loadApps} disabled={loading}>
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          새로고침
        </button>
      </div>

      {/* 액션 결과 메시지 */}
      {actionMsg && (
        <div
          className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-sm font-bold"
          style={{
            background: actionMsg.ok ? "#D1FAE5" : "#FEE2E2",
            border: `1.5px solid ${actionMsg.ok ? "#6EE7B7" : "#FCA5A5"}`,
            color: actionMsg.ok ? "#065F46" : "#991B1B",
          }}
        >
          <span>{actionMsg.text}</span>
          <button
            className="text-xs opacity-60 hover:opacity-100"
            onClick={() => setActionMsg(null)}
          >
            닫기
          </button>
        </div>
      )}

      {/* ── AI 일일 분석 한도 ───────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Gauge size={16} style={{ color: "#1A1A1A" }} />
          <h2 className="font-black text-base" style={{ color: "#1A1A1A" }}>AI 일일 분석 한도</h2>
          <button
            className="ml-auto neo-button text-xs"
            onClick={loadDailyUsage}
            disabled={busyKey === "__daily__"}
          >
            <RefreshCw size={12} />
            새로고침
          </button>
        </div>

        <div className="card p-5 space-y-4">
          {dailyUsage ? (
            <>
              {/* 사용량 표시 */}
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-end gap-1 mb-1">
                    <span className="font-black text-2xl" style={{ color: dailyUsage.count >= dailyUsage.limit ? "#EF4444" : "#1A1A1A" }}>
                      {dailyUsage.count}
                    </span>
                    <span className="text-sm font-medium mb-1" style={{ color: "#9CA3AF" }}>
                      / {dailyUsage.limit}회 사용
                    </span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: "#F0EFEC", border: "1px solid #E2E8F0" }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, (dailyUsage.count / dailyUsage.limit) * 100)}%`,
                        background: dailyUsage.count >= dailyUsage.limit ? "#EF4444" : "#1A1A1A",
                      }}
                    />
                  </div>
                  <p className="text-xs mt-1" style={{ color: "#9CA3AF" }}>
                    {dailyUsage.limit - dailyUsage.count > 0
                      ? `오늘 ${dailyUsage.limit - dailyUsage.count}회 남음 (UTC 기준 자정에 초기화)`
                      : "오늘 한도 소진 — 아래에서 초기화하거나 내일 자동 초기화됩니다"}
                  </p>
                </div>
                <button
                  className="neo-button text-xs flex-shrink-0"
                  disabled={busyKey === "__daily__"}
                  onClick={resetDailyLimit}
                >
                  <RotateCcw size={12} />
                  횟수 초기화
                </button>
              </div>

              {/* 한도 변경 */}
              <div
                className="flex items-center gap-2 pt-3"
                style={{ borderTop: "1px solid #E2E8F0" }}
              >
                <span className="text-xs font-medium flex-shrink-0" style={{ color: "#9CA3AF" }}>한도 변경</span>
                <input
                  type="number"
                  min={1}
                  max={200}
                  className="neo-input text-xs py-1"
                  style={{ width: 80 }}
                  placeholder={String(dailyUsage.limit)}
                  value={newLimitValue}
                  onChange={(e) => setNewLimitValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveDailyLimit()}
                />
                <span className="text-xs" style={{ color: "#9CA3AF" }}>회</span>
                <button
                  className="neo-button text-xs"
                  style={{ background: "#1A1A1A", color: "#FFFFFF" }}
                  disabled={busyKey === "__daily__" || !newLimitValue}
                  onClick={saveDailyLimit}
                >
                  <Check size={12} /> 저장
                </button>
              </div>
            </>
          ) : (
            <div className="h-16 rounded-xl animate-pulse" style={{ background: "#F0EFEC" }} />
          )}
        </div>
      </section>

      {/* ── 수동 분석 대기 (일 한도 초과) ────────── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles size={16} style={{ color: "#1A1A1A" }} />
          <h2 className="font-black text-base" style={{ color: "#1A1A1A" }}>
            수동 분석 대기{" "}
            <span
              className="px-2 py-0.5 rounded-xl text-sm"
              style={{ background: pendingApps.length > 0 ? "#FFD600" : "#F0EFEC", border: "2px solid #1A1A1A" }}
            >
              {pendingApps.length}
            </span>
          </h2>
        </div>
        <p className="text-xs" style={{ color: "#9CA3AF" }}>
          일일 한도 초과로 자동 분석이 보류된 앱입니다. 즉시 분석 버튼을 누르면 한도와 무관하게 바로 실행됩니다.
        </p>

        {pendingApps.length === 0 ? (
          <div
            className="py-8 text-center rounded-xl text-sm"
            style={{ background: "#F0EFEC", border: "1.5px solid #E2E8F0", color: "#9CA3AF" }}
          >
            승인 대기 중인 앱이 없습니다
          </div>
        ) : (
          <div className="space-y-3">
            {pendingApps.map((app) => (
              <div key={app.app_key} className="card p-5">
                <div className="flex items-center gap-4">
                  {app.icon_url ? (
                    <img
                      src={app.icon_url}
                      alt={app.app_name}
                      width={48}
                      height={48}
                      className="rounded-xl flex-shrink-0"
                      style={{ border: "2px solid #1A1A1A" }}
                    />
                  ) : (
                    <div
                      className="flex-shrink-0 rounded-xl flex items-center justify-center font-black"
                      style={{ width: 48, height: 48, background: "#F0EFEC", border: "2px solid #1A1A1A" }}
                    >
                      {app.app_name.charAt(0)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-black" style={{ color: "#1A1A1A" }}>{app.app_name}</p>
                    <p className="text-xs mt-0.5" style={{ color: "#9CA3AF" }}>
                      {app.developer}
                      {app.last_collected_at && ` · 수집: ${formatDate(app.last_collected_at)}`}
                    </p>
                    <div className="flex gap-3 mt-1">
                      {app.google_review_count !== null && (
                        <span className="text-xs font-bold" style={{ color: "#4285F4" }}>
                          Google {(app.google_review_count ?? 0).toLocaleString()}건
                        </span>
                      )}
                      {app.apple_review_count !== null && (
                        <span className="text-xs font-bold" style={{ color: "#1A1A1A" }}>
                          Apple {(app.apple_review_count ?? 0).toLocaleString()}건
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    className="neo-button-primary flex-shrink-0"
                    disabled={busyKey === app.app_key}
                    onClick={() => doAction("approve_analysis", app.app_key, `'${app.app_name}' 즉시 분석`)}
                  >
                    {busyKey === app.app_key ? (
                      <RefreshCw size={13} className="animate-spin" />
                    ) : (
                      <Sparkles size={13} />
                    )}
                    즉시 분석
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── 앱 관리 ─────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="font-black text-base" style={{ color: "#1A1A1A" }}>
          등록된 게임 관리{" "}
          <span
            className="px-2 py-0.5 rounded-xl text-sm"
            style={{ background: "#F0EFEC", border: "2px solid #1A1A1A", color: "#4A4A4A" }}
          >
            {allApps.length}
          </span>
        </h2>

        {allApps.length === 0 ? (
          <div
            className="py-8 text-center rounded-xl text-sm"
            style={{ background: "#F0EFEC", border: "1.5px solid #E2E8F0", color: "#9CA3AF" }}
          >
            등록된 게임이 없습니다
          </div>
        ) : (
          <div className="space-y-3">
            {allApps.map((app) => {
              const isBusy = busyKey === app.app_key;
              const isDeleting = deleteConfirm === app.app_key;
              return (
                <div key={app.app_key} className="card p-5 space-y-4">
                  <div className="flex items-start gap-4">
                    {app.icon_url ? (
                      <img
                        src={app.icon_url}
                        alt={app.app_name}
                        width={48}
                        height={48}
                        className="rounded-xl flex-shrink-0"
                        style={{ border: "2px solid #1A1A1A" }}
                      />
                    ) : (
                      <div
                        className="flex-shrink-0 rounded-xl flex items-center justify-center font-black"
                        style={{ width: 48, height: 48, background: "#F0EFEC", border: "2px solid #1A1A1A" }}
                      >
                        {app.app_name.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black" style={{ color: "#1A1A1A" }}>{app.app_name}</span>
                        {app.pending_analysis && (
                          <span
                            className="text-xs font-bold px-2 py-0.5 rounded-full"
                            style={{ background: "#FEF9C3", border: "1.5px solid #FDE047", color: "#854D0E" }}
                          >
                            분석 대기
                          </span>
                        )}
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: "#9CA3AF" }}>{app.developer}</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                        <InfoCell label="Google 평점" value={app.google_rating ? `★ ${Number(app.google_rating).toFixed(1)}` : "—"} />
                        <InfoCell label="Apple 평점" value={app.apple_rating ? `★ ${Number(app.apple_rating).toFixed(1)}` : "—"} />
                        <InfoCell label="마지막 수집" value={formatDate(app.last_collected_at) || "—"} />
                        <InfoCell label="마지막 분석" value={formatDate(app.last_analyzed_at) || "—"} />
                      </div>

                      {/* 출시일 */}
                      <div className="mt-3 flex items-center gap-2">
                        <Calendar size={12} style={{ color: "#9CA3AF", flexShrink: 0 }} />
                        {releaseDateEditing === app.app_key ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="date"
                              className="neo-input text-xs py-1"
                              value={releaseDateValue}
                              onChange={(e) => setReleaseDateValue(e.target.value)}
                            />
                            <button
                              className="neo-button text-xs"
                              style={{ background: "#1A1A1A", color: "#FFFFFF" }}
                              disabled={isBusy}
                              onClick={() => saveReleaseDate(app.app_key)}
                            >
                              <Check size={12} /> 저장
                            </button>
                            <button
                              className="neo-button text-xs"
                              onClick={() => setReleaseDateEditing(null)}
                            >
                              취소
                            </button>
                          </div>
                        ) : (
                          <button
                            className="text-xs hover:underline"
                            style={{ color: "#9CA3AF" }}
                            onClick={() => {
                              setReleaseDateEditing(app.app_key);
                              setReleaseDateValue(app.release_date || "");
                            }}
                          >
                            출시일: {app.release_date ? formatDate(app.release_date) : "수집 미완료 (클릭하여 수동 입력)"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 액션 버튼 */}
                  <div
                    className="flex items-center gap-2 flex-wrap pt-3"
                    style={{ borderTop: "1.5px solid #E2E8F0" }}
                  >
                    {/* 수집 버튼 */}
                    <button
                      className="neo-button text-xs"
                      disabled={isBusy}
                      onClick={() => doAction(
                        "collect",
                        app.app_key,
                        `'${app.app_name}' 수집 시작`,
                      )}
                      title={(app.google_review_count ?? 0) + (app.apple_review_count ?? 0) > 0 ? "신규 리뷰만 수집" : "전체 수집 (첫 실행)"}
                    >
                      <Download size={12} />
                      {(app.google_review_count ?? 0) + (app.apple_review_count ?? 0) > 0 ? "신규 수집" : "전체 수집"}
                    </button>
                    {(app.google_review_count ?? 0) + (app.apple_review_count ?? 0) > 0 && (
                      <button
                        className="neo-button text-xs"
                        disabled={isBusy}
                        onClick={() => doAction("collect_full", app.app_key, `'${app.app_name}' 전체 재수집`)}
                        title="전체 재수집"
                      >
                        <RefreshCw size={12} /> 전체 재수집
                      </button>
                    )}

                    {/* AI 재분석 */}
                    <button
                      className="neo-button text-xs"
                      disabled={isBusy}
                      onClick={() => doAction("reanalyze", app.app_key, `'${app.app_name}' AI 재분석`)}
                      title="분석 실패 시 재실행 — 새로운 항목으로 추가됩니다"
                    >
                      <RotateCcw size={12} /> AI 재분석
                    </button>


                    <div className="ml-auto">
                      {isDeleting ? (
                        <div
                          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
                          style={{ background: "#FEE2E2", border: "1.5px solid #FCA5A5" }}
                        >
                          <AlertTriangle size={12} style={{ color: "#EF4444" }} />
                          <span style={{ color: "#991B1B" }}>정말 삭제할까요?</span>
                          <button
                            className="neo-button text-xs"
                            style={{ background: "#EF4444", color: "#FFFFFF", borderColor: "#DC2626" }}
                            onClick={() => {
                              setDeleteConfirm(null);
                              doAction("delete_app", app.app_key, `'${app.app_name}' 삭제`);
                            }}
                          >
                            삭제
                          </button>
                          <button
                            className="neo-button text-xs"
                            onClick={() => setDeleteConfirm(null)}
                          >
                            취소
                          </button>
                        </div>
                      ) : (
                        <button
                          className="neo-button text-xs"
                          style={{ color: "#EF4444", borderColor: "#EF4444" }}
                          disabled={isBusy}
                          onClick={() => setDeleteConfirm(app.app_key)}
                        >
                          <Trash2 size={12} /> 삭제
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl px-3 py-2" style={{ background: "#F0EFEC", border: "1.5px solid #E2E8F0" }}>
      <p className="text-xs" style={{ color: "#9CA3AF" }}>{label}</p>
      <p className="text-sm font-bold mt-0.5" style={{ color: "#1A1A1A" }}>{value}</p>
    </div>
  );
}

function formatDate(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}
