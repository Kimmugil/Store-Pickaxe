import { NextRequest, NextResponse } from "next/server";
import {
  getAllApps,
  getAppSnapshots,
  getAppTimeline,
  getAppAnalyses,
  getAppReviews,
} from "@/lib/sheets";
import type { AppDetail } from "@/lib/types";

export async function GET(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;

  try {
    const apps = await getAllApps();
    const meta = apps.find((a) => a.app_key === key);
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
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
