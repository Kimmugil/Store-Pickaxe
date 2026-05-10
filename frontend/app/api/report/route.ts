import { NextRequest, NextResponse } from "next/server";
import { getAppByKeyDirect, getAppAnalyses, getAppReviews, getAppReviewsOldest } from "@/lib/sheets";
import type { Review } from "@/lib/types";

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

    const [analyses, google_recent, google_oldest, apple_reviews] = await Promise.all([
      getAppAnalyses(ssId),
      getAppReviews(ssId, "google", 800),    // 최신 800건
      getAppReviewsOldest(ssId, 200),         // 초기 200건 (출시 초반 리뷰 커버)
      getAppReviews(ssId, "apple", 500),
    ]);

    // 최초 200건 + 최신 800건 병합 (중복 제거)
    const seenIds = new Set<string>();
    const google_reviews: Review[] = [];
    for (const r of [...google_oldest, ...google_recent]) {
      if (!seenIds.has(r.review_id)) {
        seenIds.add(r.review_id);
        google_reviews.push(r);
      }
    }

    const analysis = analyses.find((a) => a.analysis_id === analysisId);
    if (!analysis) return NextResponse.json({ error: "분석 결과를 찾을 수 없습니다." }, { status: 404 });

    // 이전 리포트 목록 (최신순 정렬, 현재 분석 포함)
    const allAnalysesSorted = [...analyses].sort((a, b) => (b.created_at > a.created_at ? 1 : -1));

    return NextResponse.json({ analysis, meta, google_reviews, apple_reviews, all_analyses: allAnalysesSorted });
  } catch (e) {
    console.error("[report]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
