"use client";
import { useState } from "react";
import {
  Lock, CheckCircle, XCircle, Play, Wrench, Pause,
  RefreshCw, Trash2, AlertTriangle, Sparkles, Shield,
} from "lucide-react";
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
  const [actionMsg, setActionMsg] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

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
    setActionMsg(null);
    setBusyKey(app_key);
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, app_key, password }),
    });
    const data = await res.json();
    setBusyKey(null);
    if (data.ok) {
      setActionMsg({ type: "ok", text: `${label} 완료` });
      loadApps();
    } else {
      setActionMsg({ type: "error", text: data.error || "오류가 발생했습니다." });
    }
  }

  async function doDelete(app_key: string, app_name: string) {
    setDeleteConfirm(null);
    await doAction("delete_app", app_key, `'${app_name}' 삭제`);
  }

  if (!authenticated) {
    return (
      <div className="max-w-sm mx-auto py-20 space-y-4">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-9 h-9 bg-gray-900 rounded-xl flex items-center justify-center">
            <Lock size={16} className="text-white" />
          </div>
          <span className="text-xl font-bold">{texts["admin.title"] || "관리자 패널"}</span>
        </div>
        <input
          type="password"
          className="input"
          placeholder={texts["admin.login.password_placeholder"] || "비밀번호를 입력하세요"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          autoFocus
        />
        {authError && (
          <p className="text-sm text-red-500 flex items-center gap-1.5">
            <XCircle size={14} /> {authError}
          </p>
        )}
        <button className="btn-primary w-full justify-center" onClick={handleLogin}>
          {texts["admin.login.button"] || "로그인"}
        </button>
      </div>
    );
  }

  const pendingAI = apps.filter((a) => !a.ai_approved && a.status !== "paused");
  const allManagedApps = apps.filter(
    (a) => a.status === "active" || a.status === "pending" || a.status === "paused"
  );

  return (
    <div className="max-w-3xl mx-auto space-y-8">

      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-gray-900 rounded-xl flex items-center justify-center">
            <Shield size={16} className="text-white" />
          </div>
          <h1 className="text-xl font-bold">{texts["admin.title"] || "관리자 패널"}</h1>
        </div>
        <button className="btn-secondary" onClick={loadApps} disabled={loading}>
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          새로고침
        </button>
      </div>

      {/* 액션 결과 메시지 */}
      {actionMsg && (
        <div
          className={`flex items-center gap-2 text-sm rounded-xl px-4 py-3 ${
            actionMsg.type === "ok"
              ? "bg-green-50 text-green-700"
              : "bg-red-50 text-red-600"
          }`}
        >
          {actionMsg.type === "ok" ? <CheckCircle size={15} /> : <XCircle size={15} />}
          {actionMsg.text}
          <button
            className="ml-auto text-xs opacity-60 hover:opacity-100"
            onClick={() => setActionMsg(null)}
          >
            닫기
          </button>
        </div>
      )}

      {/* ── AI 분석 승인 대기 ───────────────────────────────────── */}
      <section className="space-y-3">
        <SectionHeader
          icon={<Sparkles size={15} />}
          title={`AI 분석 승인 대기 (${pendingAI.length})`}
          desc="아래 게임의 AI 분석 활성화 여부를 결정해주세요."
        />
        {pendingAI.length === 0 ? (
          <EmptyState text="대기 중인 게임이 없습니다." />
        ) : (
          pendingAI.map((app) => (
            <div key={app.app_key} className="card p-5 flex items-center gap-4">
              {app.icon_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={app.icon_url} alt={app.app_name} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold">{app.app_name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {app.developer} · 등록 {formatDate(app.registered_at) || "—"}
                </p>
                {(app.google_package || app.apple_app_id) && (
                  <p className="text-xs text-gray-400 mt-0.5 font-mono">
                    {app.google_package && `Google: ${app.google_package}`}
                    {app.google_package && app.apple_app_id && " · "}
                    {app.apple_app_id && `Apple: ${app.apple_app_id}`}
                  </p>
                )}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  className="btn-primary text-xs"
                  disabled={busyKey === app.app_key}
                  onClick={() => doAction("approve_ai", app.app_key, `'${app.app_name}' AI 승인`)}
                >
                  <CheckCircle size={13} /> AI 승인
                </button>
                <button
                  className="btn-secondary text-xs"
                  disabled={busyKey === app.app_key}
                  onClick={() => doAction("reject_ai", app.app_key, `'${app.app_name}' 거부`)}
                >
                  <XCircle size={13} /> 거부
                </button>
              </div>
            </div>
          ))
        )}
      </section>

      {/* ── 앱 관리 ─────────────────────────────────────────────── */}
      <section className="space-y-3">
        <SectionHeader
          icon={<Wrench size={15} />}
          title={`등록된 게임 관리 (${allManagedApps.length})`}
          desc="각 게임의 수집·분석 상태를 관리합니다."
        />
        {allManagedApps.length === 0 ? (
          <EmptyState text="등록된 게임이 없습니다." />
        ) : (
          allManagedApps.map((app) => {
            const isBusy = busyKey === app.app_key;
            const isDeleteConfirming = deleteConfirm === app.app_key;
            return (
              <div key={app.app_key} className="card p-5 space-y-4">

                {/* 앱 기본 정보 */}
                <div className="flex items-start gap-4">
                  {app.icon_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={app.icon_url}
                      alt={app.app_name}
                      className="w-12 h-12 rounded-xl object-cover flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{app.app_name}</span>
                      <StatusBadge status={app.status} />
                      {app.ai_approved && (
                        <span className="badge bg-blue-50 text-blue-600">AI 승인됨</span>
                      )}
                      <span className="badge bg-gray-100 text-gray-500">
                        수집 {app.collect_frequency === "high" ? "고빈도" : app.collect_frequency === "medium" ? "중빈도" : "저빈도"}
                      </span>
                      {app.pending_ai_trigger && (
                        <span className="badge bg-amber-50 text-amber-600">
                          <AlertTriangle size={10} /> AI 대기: {app.pending_ai_trigger}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{app.developer}</p>
                    {(app.google_package || app.apple_app_id) && (
                      <p className="text-xs text-gray-400 font-mono mt-0.5">
                        {app.google_package && `Google: ${app.google_package}`}
                        {app.google_package && app.apple_app_id && " · "}
                        {app.apple_app_id && `Apple ID: ${app.apple_app_id}`}
                      </p>
                    )}
                  </div>
                </div>

                {/* 통계 정보 */}
                <div className="grid grid-cols-4 gap-2 text-center">
                  <InfoCell label="구글 평점" value={app.google_rating ? `★ ${app.google_rating.toFixed(1)}` : "—"} />
                  <InfoCell label="애플 평점" value={app.apple_rating ? `★ ${app.apple_rating.toFixed(1)}` : "—"} />
                  <InfoCell label="마지막 수집" value={formatDate(app.last_collected_at) || "—"} />
                  <InfoCell label="마지막 분석" value={formatDate(app.last_analyzed_at) || "—"} />
                </div>

                {/* 액션 버튼 */}
                <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-50">
                  {/* AI 분석 수동 트리거 */}
                  <ActionButton
                    icon={<Play size={13} />}
                    label="AI 분석 실행"
                    tooltip="AI 분석을 수동으로 예약합니다 (다음 analyze.yml 실행 시 처리)"
                    disabled={isBusy || !app.ai_approved}
                    disabledReason={!app.ai_approved ? "AI 미승인 상태" : undefined}
                    onClick={() => doAction("trigger_analysis", app.app_key, `'${app.app_name}' AI 트리거`)}
                  />

                  {/* 주요 패치 마킹 */}
                  <ActionButton
                    icon={<Wrench size={13} />}
                    label="패치 마킹"
                    tooltip="해당 시점을 주요 패치로 표시하고 AI 분석을 예약합니다"
                    disabled={isBusy}
                    onClick={() => doAction("mark_patch", app.app_key, `'${app.app_name}' 패치 마킹`)}
                  />

                  {/* 수집 일시 중지 / 활성화 */}
                  {app.status === "active" ? (
                    <ActionButton
                      icon={<Pause size={13} />}
                      label="수집 중지"
                      tooltip="이 게임의 데이터 수집을 일시 중지합니다"
                      disabled={isBusy}
                      onClick={() => doAction("pause", app.app_key, `'${app.app_name}' 수집 중지`)}
                    />
                  ) : (
                    <ActionButton
                      icon={<Play size={13} />}
                      label="수집 활성화"
                      tooltip="이 게임의 데이터 수집을 재개합니다"
                      disabled={isBusy}
                      variant="primary"
                      onClick={() => doAction("activate", app.app_key, `'${app.app_name}' 활성화`)}
                    />
                  )}

                  {/* 삭제 버튼 (오른쪽 끝) */}
                  <div className="ml-auto">
                    {isDeleteConfirming ? (
                      <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-1.5">
                        <AlertTriangle size={13} className="text-red-500 flex-shrink-0" />
                        <span className="text-xs text-red-600 font-medium whitespace-nowrap">
                          &apos;{app.app_name}&apos; 을 삭제할까요?
                        </span>
                        <button
                          className="btn-danger text-xs py-1 px-2.5"
                          onClick={() => doDelete(app.app_key, app.app_name)}
                        >
                          삭제
                        </button>
                        <button
                          className="btn-secondary text-xs py-1 px-2.5"
                          onClick={() => setDeleteConfirm(null)}
                        >
                          취소
                        </button>
                      </div>
                    ) : (
                      <button
                        className="btn-secondary text-xs text-red-500 border-red-200 hover:bg-red-50"
                        disabled={isBusy}
                        onClick={() => setDeleteConfirm(app.app_key)}
                      >
                        <Trash2 size={13} /> 삭제
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}

// ── 하위 컴포넌트 ──────────────────────────────────────────────────

function SectionHeader({
  icon, title, desc,
}: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 text-gray-600">
        {icon}
      </div>
      <div>
        <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
        <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="card p-6 text-center text-sm text-gray-400">{text}</div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-green-50 text-green-700",
    paused: "bg-gray-100 text-gray-500",
    pending: "bg-amber-50 text-amber-600",
  };
  const labels: Record<string, string> = {
    active: "활성",
    paused: "수집 중지",
    pending: "승인 대기",
  };
  return (
    <span className={`badge ${map[status] || "bg-gray-100 text-gray-500"}`}>
      {labels[status] || status}
    </span>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-xl py-2 px-1">
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-gray-700">{value}</p>
    </div>
  );
}

function ActionButton({
  icon, label, tooltip, disabled, disabledReason, variant = "secondary", onClick,
}: {
  icon: React.ReactNode;
  label: string;
  tooltip: string;
  disabled?: boolean;
  disabledReason?: string;
  variant?: "primary" | "secondary";
  onClick: () => void;
}) {
  return (
    <button
      title={disabled && disabledReason ? disabledReason : tooltip}
      className={`${variant === "primary" ? "btn-primary" : "btn-secondary"} text-xs`}
      disabled={disabled}
      onClick={onClick}
    >
      {icon} {label}
    </button>
  );
}
