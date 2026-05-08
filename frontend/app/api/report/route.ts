import { NextRequest, NextResponse } from "next/server";
import { getAppByKeyDirect, getAppAnalyses, getAppReviews } from "@/lib/sheets";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const appKey = searchParams.get("app_key") || "";
  const analysisId = searchParams.get("analysis_id") || "";

  if (!appKey || !analysisId) {
    return NextResponse.json({ error: "app_key와 analysis_id 필수" }, { status: 400 });
  }

  try {
    const meta = await getAppByKeyDirect(appKey);
    if (!meta) return NextResponse.json({ error: "앱을 찾을 수 없습니다." }, { status: 404 });

    const ssId = meta.spreadsheet_id;
    if (!ssId) return NextResponse.json({ error: "스프레드시트 없음" }, { status: 404 });

    const [analyses, google_reviews, apple_reviews] = await Promise.all([
      getAppAnalyses(ssId),
      getAppReviews(ssId, "google", 1000),
      getAppReviews(ssId, "apple", 500),
    ]);

    const analysis = analyses.find((a) => a.analysis_id === analysisId);
    if (!analysis) return NextResponse.json({ error: "분석 결과를 찾을 수 없습니다." }, { status: 404 });

    return NextResponse.json({ analysis, meta, google_reviews, apple_reviews });
  } catch (e) {
    console.error("[report]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
