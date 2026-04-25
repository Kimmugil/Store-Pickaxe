import { NextRequest, NextResponse } from "next/server";
import { getAllApps, registerAppToMaster } from "@/lib/sheets";
import { slugify } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { app_name, developer, google_package, apple_app_id, icon_url } = body;

    if (!app_name) return NextResponse.json({ error: "app_name 필수" }, { status: 400 });
    if (!google_package && !apple_app_id)
      return NextResponse.json({ error: "구글 패키지 또는 애플 ID 중 하나는 필수" }, { status: 400 });

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

    const gasResp = await fetch(gasUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        folderId,
        fileName: `Store-Pickaxe | ${app_name} (${app_key})`,
        serviceAccountEmail: creds.client_email,
      }),
    });

    const gasData = await gasResp.json();
    if (!gasData.ok) {
      return NextResponse.json({ error: `스프레드시트 생성 실패: ${gasData.error}` }, { status: 500 });
    }

    const spreadsheet_id = gasData.spreadsheetId;

    // MASTER 시트에 등록
    await registerAppToMaster({
      app_key,
      app_name,
      developer: developer || "",
      google_package: google_package || "",
      apple_app_id: String(apple_app_id || ""),
      icon_url: icon_url || "",
      spreadsheet_id,
    });

    return NextResponse.json({ ok: true, app_key, spreadsheet_id }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
