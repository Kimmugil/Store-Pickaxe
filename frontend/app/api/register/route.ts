import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getAllApps, registerAppToMaster } from "@/lib/sheets";
import { slugify } from "@/lib/utils";

async function triggerCollectWorkflow(appKey: string): Promise<void> {
  const token = process.env.GITHUB_PAT;
  const repo = process.env.GITHUB_REPO; // e.g. "Kimmugil/Store-Pickaxe"

  if (!token) throw new Error("GITHUB_PAT 환경변수 미설정");
  if (!repo) throw new Error("GITHUB_REPO 환경변수 미설정");

  console.log(`[register] GitHub Actions 트리거 시도: repo=${repo}, app_key=${appKey}`);

  const res = await fetch(
    `https://api.github.com/repos/${repo}/actions/workflows/collect.yml/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        ref: "master",
        inputs: { target_app_key: appKey },
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    let hint = "";
    if (res.status === 401) hint = " — PAT이 만료되었거나 잘못됨";
    else if (res.status === 403) hint = " — PAT에 Actions:write 권한 없음 (GitHub → Settings → Developer settings → PAT → Actions:Read&Write 필요)";
    else if (res.status === 404) hint = " — repo 이름이 잘못되었거나 PAT이 해당 repo에 접근 불가";
    else if (res.status === 422) hint = " — ref(브랜치) 오류 또는 workflow_dispatch 설정 문제";
    throw new Error(`GitHub API ${res.status}${hint}: ${text}`);
  }

  console.log(`[register] GitHub Actions 트리거 성공 (204): ${repo}/collect.yml → ${appKey}`);
}

function serverError(e: unknown, context: string): NextResponse {
  console.error(`[register] ${context}:`, e);
  return NextResponse.json({ error: "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요." }, { status: 500 });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { app_name, developer, google_package, apple_app_id, icon_url } = body;

    if (!app_name) return NextResponse.json({ error: "app_name 필수" }, { status: 400 });
    if (!google_package && !apple_app_id)
      return NextResponse.json({ error: "구글 패키지 또는 애플 ID 중 하나는 필수" }, { status: 400 });
    console.log("[register] 수신:", { app_name, google_package, apple_app_id });

    // 중복 확인
    const apps = await getAllApps();
    if (google_package && apps.some((a) => a.google_package === google_package)) {
      return NextResponse.json({ error: "이미 등록된 구글 패키지입니다.", code: "DUPLICATE" }, { status: 409 });
    }
    if (apple_app_id && apps.some((a) => a.apple_app_id === String(apple_app_id))) {
      return NextResponse.json({ error: "이미 등록된 애플 앱 ID입니다.", code: "DUPLICATE" }, { status: 409 });
    }

    // app_key 생성 (중복 방지)
    let app_key = slugify(app_name);
    const existingKeys = new Set(apps.map((a) => a.app_key));
    if (existingKeys.has(app_key)) {
      app_key = `${app_key}_${Date.now().toString(36)}`;
    }

    // GAS로 스프레드시트 생성
    const gasUrl = process.env.GAS_WEB_APP_URL!;
    const folderId = process.env.GDRIVE_FOLDER_ID!;
    const credsRaw = process.env.GOOGLE_CREDENTIALS_JSON!;
    const creds = JSON.parse(credsRaw);

    let gasData: { ok: boolean; spreadsheetId?: string; error?: string };
    try {
      const gasResp = await fetch(gasUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folderId,
          fileName: `Store-Pickaxe | ${app_name} (${app_key})`,
          serviceAccountEmail: creds.client_email,
        }),
      });
      gasData = await gasResp.json();
    } catch (e) {
      return serverError(e, "GAS fetch 실패");
    }

    if (!gasData.ok) {
      console.error("[register] GAS 오류:", gasData.error);
      return NextResponse.json({ error: "스프레드시트 생성에 실패했습니다. 설정을 확인해주세요." }, { status: 500 });
    }

    const spreadsheet_id = gasData.spreadsheetId!;

    // MASTER 시트에 등록
    try {
      await registerAppToMaster({
        app_key,
        app_name,
        developer: developer || "",
        google_package: google_package || "",
        apple_app_id: String(apple_app_id || ""),
        icon_url: icon_url || "",
        spreadsheet_id,
      });
    } catch (e) {
      return serverError(e, "MASTER 시트 등록 실패");
    }

    // 캐시 무효화 — 상세 페이지에서 바로 조회 가능하도록
    revalidateTag("all-apps");

    // 등록 직후 즉시 수집 트리거 (GitHub Actions workflow_dispatch)
    let collectTriggered = false;
    let collectError: string | null = null;
    try {
      await triggerCollectWorkflow(app_key);
      collectTriggered = true;
    } catch (e) {
      collectError = String(e);
      console.error("[register] 워크플로우 트리거 실패:", e);
    }

    return NextResponse.json({ ok: true, app_key, spreadsheet_id, collectTriggered, collectError, _debug: { google_package: google_package || "", apple_app_id: String(apple_app_id || "") } }, { status: 201 });
  } catch (e) {
    return serverError(e, "예상치 못한 오류");
  }
}
