import { NextResponse } from "next/server";
import { getAllApps, getAppAnalyses } from "@/lib/sheets";
import type { Analysis } from "@/lib/types";

export async function GET() {
  try {
    const apps = (await getAllApps()).filter((a) => a.status === "active");

    const enriched = await Promise.all(
      apps.map(async (app) => {
        if (!app.spreadsheet_id) return { app, latestAnalysis: null };
        const analyses = await getAppAnalyses(app.spreadsheet_id).catch(() => [] as Analysis[]);
        const sorted = [...analyses].sort((a, b) => (b.created_at > a.created_at ? 1 : -1));
        return { app, latestAnalysis: sorted[0] ?? null };
      })
    );

    return NextResponse.json(enriched);
  } catch (e) {
    console.error("[apps]", e);
    return NextResponse.json({ error: "앱 목록을 불러올 수 없습니다." }, { status: 500 });
  }
}
