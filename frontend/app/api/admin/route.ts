import { NextRequest, NextResponse } from "next/server";
import { getAllApps, getAdminPassword, updateAppField } from "@/lib/sheets";

async function verifyPassword(req: NextRequest, body: Record<string, string>): Promise<boolean> {
  const submitted = body.password || req.headers.get("x-admin-password") || "";
  const correct = await getAdminPassword();
  return submitted === correct && correct !== "";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    // 비밀번호 검증이 필요 없는 액션
    if (action === "verify") {
      const ok = await verifyPassword(req, body);
      return NextResponse.json({ ok });
    }

    // 이하 모든 액션은 비밀번호 필요
    const isAdmin = await verifyPassword(req, body);
    if (!isAdmin) {
      return NextResponse.json({ error: "인증 실패" }, { status: 401 });
    }

    const { app_key } = body;

    switch (action) {
      case "approve_ai": {
        // ai_approved + status 두 필드를 순서대로 업데이트
        await updateAppField(app_key, "ai_approved", "TRUE");
        await updateAppField(app_key, "status", "active");
        return NextResponse.json({ ok: true });
      }

      case "reject_ai": {
        await updateAppField(app_key, "ai_approved", "FALSE");
        return NextResponse.json({ ok: true });
      }

      case "activate": {
        await updateAppField(app_key, "status", "active");
        return NextResponse.json({ ok: true });
      }

      case "pause": {
        await updateAppField(app_key, "status", "paused");
        return NextResponse.json({ ok: true });
      }

      case "trigger_analysis": {
        await updateAppField(app_key, "pending_ai_trigger", "manual");
        return NextResponse.json({ ok: true });
      }

      case "mark_patch": {
        // 관리자가 특정 앱을 "주요 패치"로 마킹 → AI 분석 트리거
        await updateAppField(app_key, "pending_ai_trigger", "manual");
        return NextResponse.json({ ok: true });
      }

      case "get_apps": {
        const apps = await getAllApps();
        return NextResponse.json({ apps });
      }

      default:
        return NextResponse.json({ error: "알 수 없는 액션" }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
