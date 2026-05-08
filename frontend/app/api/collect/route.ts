import { NextRequest, NextResponse } from "next/server";

async function triggerCollect(app_key: string, mode: "onboarding" | "update") {
  const token = process.env.GITHUB_PAT;
  const repo = process.env.GITHUB_REPO;
  if (!token || !repo) throw new Error("GITHUB_PAT 또는 GITHUB_REPO 환경변수가 없습니다.");

  const res = await fetch(
    `https://api.github.com/repos/${repo}/actions/workflows/collect.yml/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ref: "master", inputs: { app_key, mode } }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API 오류 ${res.status}: ${text}`);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { app_key?: string; mode?: string };
    const app_key = body.app_key?.trim();
    const mode = body.mode === "onboarding" ? "onboarding" : "update";

    if (!app_key) {
      return NextResponse.json({ error: "app_key가 필요합니다." }, { status: 400 });
    }

    await triggerCollect(app_key, mode);
    return NextResponse.json({ ok: true, message: `수집 워크플로우를 트리거했습니다. (${mode})` });
  } catch (e) {
    console.error("[collect]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
