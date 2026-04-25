"use client";
import { useState, useEffect } from "react";
import { Lock, CheckCircle, XCircle, Play, Wrench, Pause, RefreshCw } from "lucide-react";
import { useTexts } from "@/components/TextsProvider";
import type { AppMeta } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export default function AdminPage() {
  const texts = useTexts();
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [authError, setAuthError] = useState("");
  const [apps, setApps] = useState<AppMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState("");

  async function handleLogin() {
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "verify", password }),
    });
    const data = await res.json();
    if (data.ok) {
      setAuthenticated(true);
      setAuthError("");
      loadApps();
    } else {
      setAuthError(texts["admin.login.error"] || "비밀번호가 올바르지 않습니다.");
    }
  }

  async function loadApps() {
    setLoading(true);
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "get_apps", password }),
    });
    const data = await res.json();
    setApps(data.apps || []);
    setLoading(false);
  }

  async function doAction(action: string, app_key: string, label: string) {
    setActionMsg("");
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, app_key, password }),
    });
    const data = await res.json();
    if (data.ok) {
      setActionMsg(`✓ ${label} 완료`);
      loadApps();
    } else {
      setActionMsg(`✗ ${data.error}`);
    }
  }

  if (!authenticated) {
    return (
      <div className="max-w-sm mx-auto py-16 space-y-4">
        <div className="flex items-center gap-2 text-xl font-bold">
          <Lock size={20} />
          {texts["admin.title"] || "관리자"}
        </div>
        <input
          type="password"
          className="input"
          placeholder={texts["admin.login.password_placeholder"] || "비밀번호"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLogin()}
        />
        {authError && <p className="text-sm text-negative">{authError}</p>}
        <button className="btn-primary w-full" onClick={handleLogin}>
          {texts["admin.login.button"] || "로그인"}
        </button>
      </div>
    );
  }

  const pendingAI = apps.filter((a) => !a.ai_approved && a.status !== "paused");
  const activeApps = apps.filter((a) => a.status === "active" || a.status === "pending");

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Lock size={20} /> {texts["admin.title"] || "관리자 패널"}
        </h1>
        <button className="btn-secondary" onClick={loadApps} disabled={loading}>
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          {texts["common.retry"] || "새로고침"}
        </button>
      </div>

      {actionMsg && (
        <div className="text-sm bg-gray-50 rounded-xl px-4 py-3 text-gray-700">{actionMsg}</div>
      )}

      {/* AI 승인 대기 */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          {texts["admin.section.pending"] || "AI 분석 승인 대기"} ({pendingAI.length})
        </h2>
        {pendingAI.length === 0 ? (
          <p className="text-sm text-gray-400">{texts["admin.pending.empty"] || "대기 중인 앱이 없습니다."}</p>
        ) : (
          pendingAI.map((app) => (
            <div key={app.app_key} className="card p-4 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{app.app_name}</p>
                <p className="text-xs text-gray-400">{app.developer} · 등록 {formatDate(app.registered_at)}</p>
              </div>
              <div className="flex gap-2">
                <button
                  className="btn-primary text-xs"
                  onClick={() => doAction("approve_ai", app.app_key, `${app.app_name} AI 승인`)}
                >
                  <CheckCircle size={13} /> {texts["admin.pending.approve"] || "AI 승인"}
                </button>
                <button
                  className="btn-secondary text-xs"
                  onClick={() => doAction("reject_ai", app.app_key, `${app.app_name} 거부`)}
                >
                  <XCircle size={13} /> {texts["admin.pending.reject"] || "거부"}
                </button>
              </div>
            </div>
          ))
        )}
      </section>

      {/* 앱 관리 */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          {texts["admin.section.apps"] || "앱 관리"} ({activeApps.length})
        </h2>
        {activeApps.map((app) => (
          <div key={app.app_key} className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-sm">{app.app_name}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <StatusBadge status={app.status} texts={texts} />
                  <span className="text-xs text-gray-400">
                    AI {app.ai_approved ? "✓" : "✗"} · 수집 {app.collect_frequency}
                  </span>
                  {app.pending_ai_trigger && (
                    <span className="badge bg-yellow-50 text-yellow-600 text-xs">
                      AI 대기: {app.pending_ai_trigger}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-1.5 flex-wrap justify-end">
                <button
                  title={texts["admin.app.trigger_analysis"] || "AI 분석 트리거"}
                  className="btn-secondary text-xs px-2"
                  onClick={() => doAction("trigger_analysis", app.app_key, "AI 트리거")}
                >
                  <Play size={12} /> AI
                </button>
                <button
                  title={texts["admin.app.mark_patch"] || "주요 패치 마킹"}
                  className="btn-secondary text-xs px-2"
                  onClick={() => doAction("mark_patch", app.app_key, "패치 마킹")}
                >
                  <Wrench size={12} />
                </button>
                {app.status === "active" ? (
                  <button
                    className="btn-secondary text-xs px-2"
                    onClick={() => doAction("pause", app.app_key, "일시 중지")}
                  >
                    <Pause size={12} />
                  </button>
                ) : (
                  <button
                    className="btn-primary text-xs px-2"
                    onClick={() => doAction("activate", app.app_key, "활성화")}
                  >
                    <Play size={12} />
                  </button>
                )}
              </div>
            </div>
            <div className="flex gap-4 mt-2 text-xs text-gray-400 flex-wrap">
              <span>구글 ★{app.google_rating?.toFixed(1) ?? "—"}</span>
              <span>애플 ★{app.apple_rating?.toFixed(1) ?? "—"}</span>
              <span>수집 {formatDate(app.last_collected_at) || "—"}</span>
              <span>분석 {formatDate(app.last_analyzed_at) || "—"}</span>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

function StatusBadge({ status, texts }: { status: string; texts: Record<string, string> }) {
  const map: Record<string, string> = {
    active: "bg-green-50 text-green-600",
    paused: "bg-gray-100 text-gray-500",
    pending: "bg-yellow-50 text-yellow-600",
  };
  const labels: Record<string, string> = {
    active: texts["admin.app.status.active"] || "활성",
    paused: texts["admin.app.status.paused"] || "일시 중지",
    pending: texts["admin.app.status.pending"] || "대기",
  };
  return <span className={`badge ${map[status] || "bg-gray-100 text-gray-500"}`}>{labels[status] || status}</span>;
}
