import { NextRequest, NextResponse } from "next/server";
import { getAppByKeyDirect, getGoogleRatingRows } from "@/lib/sheets";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const appKey = searchParams.get("app_key") || "";

  if (!appKey) {
    return NextResponse.json({ error: "app_key 필수" }, { status: 400 });
  }

  try {
    const meta = await getAppByKeyDirect(appKey);
    if (!meta) return NextResponse.json({ error: "앱을 찾을 수 없습니다." }, { status: 404 });

    const ssId = meta.spreadsheet_id;
    if (!ssId) return NextResponse.json({ error: "스프레드시트 없음" }, { status: 404 });

    const rows = await getGoogleRatingRows(ssId);

    // 월별 평점 집계 (YYYY-MM)
    const byMonth: Record<string, { sum: number; count: number }> = {};
    for (const row of rows) {
      const month = (row.reviewed_at || "").slice(0, 7);
      if (!month || month.length < 7) continue;
      if (!byMonth[month]) byMonth[month] = { sum: 0, count: 0 };
      byMonth[month].sum += row.rating;
      byMonth[month].count += 1;
    }

    const ratings: Record<string, { avg: number; count: number }> = {};
    for (const [month, { sum, count }] of Object.entries(byMonth)) {
      ratings[month] = { avg: Math.round((sum / count) * 100) / 100, count };
    }

    return NextResponse.json({
      ratings,
      release_date: meta.release_date ?? "",
      phase_thresholds: { launch_days: 30, growth_days: 180 },
      total_reviews: rows.length,
    });
  } catch (e) {
    console.error("[monthly_ratings]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
