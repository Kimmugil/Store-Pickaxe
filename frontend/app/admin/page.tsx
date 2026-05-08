"use client";

import { useState } from "react";
import { Lock, RefreshCw, Trash2, AlertTriangle, Sparkles, Pause, Play, Download } from "lucide-react";
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
        setActionMsg({ ok: true, text: `${label} 완료` });
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
  const allApps = apps.filter((a) => a.status === "active" || a.status === "paused");

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

      {/* ── 분석 승인 대기 ───────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles size={16} style={{ color: "#1A1A1A" }} />
          <h2 className="font-black text-base" style={{ color: "#1A1A1A" }}>
            분석 승인 대기{" "}
            <span
              className="px-2 py-0.5 rounded-xl text-sm"
              style={{ background: pendingApps.length > 0 ? "#FFD600" : "#F0EFEC", border: "2px solid #1A1A1A" }}
            >
              {pendingApps.length}
            </span>
          </h2>
        </div>

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
                    onClick={() => doAction("approve_analysis", app.app_key, `'${app.app_name}' 분석 승인`)}
                  >
                    {busyKey === app.app_key ? (
                      <RefreshCw size={13} className="animate-spin" />
                    ) : (
                      <Sparkles size={13} />
                    )}
                    분석 승인
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
                        <span
                          className="text-xs font-bold px-2 py-0.5 rounded-full"
                          style={{
                            background: app.status === "active" ? "#D1FAE5" : "#F0EFEC",
                            border: "1.5px solid #1A1A1A",
                            color: app.status === "active" ? "#065F46" : "#4A4A4A",
                          }}
                        >
                          {app.status === "active" ? "활성" : "중지"}
                        </span>
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

                    {/* 활성/중지 */}
                    {app.status === "active" ? (
                      <button
                        className="neo-button text-xs"
                        disabled={isBusy}
                        onClick={() => doAction("pause", app.app_key, `'${app.app_name}' 스케줄 중지`)}
                      >
                        <Pause size={12} /> 스케줄 중지
                      </button>
                    ) : (
                      <button
                        className="neo-button text-xs"
                        disabled={isBusy}
                        onClick={() => doAction("activate", app.app_key, `'${app.app_name}' 활성화`)}
                      >
                        <Play size={12} /> 활성화
                      </button>
                    )}

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
