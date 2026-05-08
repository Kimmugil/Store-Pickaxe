import { NextRequest, NextResponse } from "next/server";
import { getAppByKeyDirect, getGoogleReviewsByDateRange } from "@/lib/sheets";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const appKey = searchParams.get("app_key") || "";
  const dateFrom = searchParams.get("date_from") || "";
  const dateTo = searchParams.get("date_to") || "";

  if (!appKey || !dateFrom || !dateTo) {
    return NextResponse.json({ error: "app_key, date_from, date_to 필수" }, { status: 400 });
  }

  try {
    const meta = await getAppByKeyDirect(appKey);
    if (!meta) return NextResponse.json({ error: "앱을 찾을 수 없습니다." }, { status: 404 });

    const ssId = meta.spreadsheet_id;
    if (!ssId) return NextResponse.json({ error: "스프레드시트 없음" }, { status: 404 });

    const reviews = await getGoogleReviewsByDateRange(ssId, dateFrom, dateTo, 5);
    return NextResponse.json({ reviews });
  } catch (e) {
    console.error("[phase_reviews]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
