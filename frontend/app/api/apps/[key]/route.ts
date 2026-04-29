import { NextRequest, NextResponse } from "next/server";
import {
  getAppByKeyDirect,
  getAppSnapshots,
  getAppTimeline,
  getAppAnalyses,
  getAppReviews,
} from "@/lib/sheets";
import type { AppDetail } from "@/lib/types";

export async function GET(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;

  try {
    // 캐시 없이 직접 조회 — 등록 직후에도 즉시 반영됨
    const meta = await getAppByKeyDirect(key);
    if (!meta) return NextResponse.json({ error: "앱을 찾을 수 없습니다." }, { status: 404 });

    const ssId = meta.spreadsheet_id;
    if (!ssId) {
      return NextResponse.json({ meta, snapshots: [], timeline: [], analyses: [], google_reviews: [], apple_reviews: [] });
    }

    const [snapshots, timeline, analyses, googleReviews, appleReviews] = await Promise.all([
      getAppSnapshots(ssId),
      getAppTimeline(ssId),
      getAppAnalyses(ssId),
      getAppReviews(ssId, "google", 50),
      getAppReviews(ssId, "apple", 50),
    ]);

    const detail: AppDetail = {
      meta,
      snapshots,
      timeline,
      analyses,
      google_reviews: googleReviews,
      apple_reviews: appleReviews,
    };

    return NextResponse.json(detail);
  } catch (e) {
    console.error(`[apps/${key}] 상세 조회 실패:`, e);
    return NextResponse.json({ error: "앱 정보를 불러올 수 없습니다." }, { status: 500 });
  }
}
