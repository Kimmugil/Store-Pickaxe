import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getAllAppsDirect, getAdminPassword, updateAppField, deleteAppFromMaster } from "@/lib/sheets";

async function verifyPassword(body: Record<string, unknown>): Promise<boolean> {
  const submitted = String(body.password ?? "");
  const correct = await getAdminPassword();
  return submitted === correct && correct !== "";
}

async function triggerGitHubWorkflow(workflow: string, inputs: Record<string, string>): Promise<void> {
  const token = process.env.GITHUB_PAT;
  const repo = process.env.GITHUB_REPO; // e.g. "owner/repo"
  if (!token || !repo) throw new Error("GITHUB_PAT 또는 GITHUB_REPO 환경변수가 없습니다.");

  const res = await fetch(
    `https://api.github.com/repos/${repo}/actions/workflows/${workflow}/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ref: "master", inputs }),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API 오류 ${res.status}: ${text}`);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, unknown>;
    const { action } = body;

    if (action === "verify") {
      return NextResponse.json({ ok: await verifyPassword(body) });
    }

    const isAdmin = await verifyPassword(body);
    if (!isAdmin) return NextResponse.json({ error: "인증 실패" }, { status: 401 });

    const app_key = String(body.app_key ?? "");

    switch (action) {
      case "get_apps": {
        const apps = await getAllAppsDirect();
        return NextResponse.json({ apps });
      }

      case "approve_analysis": {
        await triggerGitHubWorkflow("analyze.yml", { app_key });
        revalidateTag("all-apps");
        return NextResponse.json({ ok: true });
      }

      case "reanalyze": {
        // pending_analysis 건드리지 않고 force=true로 전체 기반 재분석
        await triggerGitHubWorkflow("analyze.yml", { app_key, force: "true" });
        return NextResponse.json({ ok: true });
      }

      case "collect": {
        await triggerGitHubWorkflow("collect.yml", { app_key, mode: "update" });
        return NextResponse.json({ ok: true });
      }

      case "collect_full": {
        await triggerGitHubWorkflow("collect.yml", { app_key, mode: "onboarding" });
        return NextResponse.json({ ok: true });
      }

      case "delete_app": {
        await deleteAppFromMaster(app_key);
        revalidateTag("all-apps");
        return NextResponse.json({ ok: true });
      }

      default:
        return NextResponse.json({ error: "알 수 없는 액션" }, { status: 400 });
    }
  } catch (e) {
    console.error("[admin]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
