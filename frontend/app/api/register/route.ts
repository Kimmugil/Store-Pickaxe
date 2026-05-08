import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getAllAppsDirect, registerAppToMaster } from "@/lib/sheets";
import { slugify } from "@/lib/utils";

async function triggerOnboarding(appKey: string): Promise<void> {
  const token = process.env.GITHUB_PAT;
  const repo = process.env.GITHUB_REPO;
  if (!token || !repo) throw new Error("GITHUB_PAT 또는 GITHUB_REPO 환경변수 미설정");

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
      body: JSON.stringify({ ref: "master", inputs: { app_key: appKey, mode: "onboarding" } }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API ${res.status}: ${text}`);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, string>;
    const { app_name, developer, google_package, apple_app_id, icon_url } = body;

    if (!app_name) return NextResponse.json({ error: "app_name 필수" }, { status: 400 });
    if (!google_package && !apple_app_id)
      return NextResponse.json({ error: "구글 패키지 또는 애플 ID 중 하나는 필수" }, { status: 400 });

    const apps = await getAllAppsDirect();
    if (google_package && apps.some((a) => a.google_package === google_package))
      return NextResponse.json({ error: "이미 등록된 구글 패키지입니다.", code: "DUPLICATE" }, { status: 409 });
    if (apple_app_id && apps.some((a) => a.apple_app_id === String(apple_app_id)))
      return NextResponse.json({ error: "이미 등록된 애플 앱 ID입니다.", code: "DUPLICATE" }, { status: 409 });

    let app_key = slugify(app_name);
    const existingKeys = new Set(apps.map((a) => a.app_key));
    if (existingKeys.has(app_key)) app_key = `${app_key}_${Date.now().toString(36)}`;

    // GAS로 앱별 스프레드시트 생성
    const gasUrl = process.env.GAS_WEB_APP_URL!;
    const folderId = process.env.GDRIVE_FOLDER_ID!;
    const creds = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON!);

    const gasResp = await fetch(gasUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        folderId,
        fileName: `Store-Pickaxe | ${app_name} (${app_key})`,
        serviceAccountEmail: creds.client_email,
      }),
    });
    const gasData = await gasResp.json() as { ok: boolean; spreadsheetId?: string; error?: string };

    if (!gasData.ok) {
      return NextResponse.json({ error: "스프레드시트 생성 실패: " + gasData.error }, { status: 500 });
    }

    const spreadsheet_id = gasData.spreadsheetId!;

    await registerAppToMaster({
      app_key, app_name,
      developer: developer || "",
      google_package: google_package || "",
      apple_app_id: String(apple_app_id || ""),
      icon_url: icon_url || "",
      spreadsheet_id,
    });

    revalidateTag("all-apps");

    // 등록 직후 자동으로 onboarding 수집 트리거
    let collectTriggered = false;
    try {
      await triggerOnboarding(app_key);
      collectTriggered = true;
    } catch (e) {
      console.error("[register] 수집 트리거 실패:", e);
    }

    return NextResponse.json({ ok: true, app_key, spreadsheet_id, collectTriggered }, { status: 201 });
  } catch (e) {
    console.error("[register]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
