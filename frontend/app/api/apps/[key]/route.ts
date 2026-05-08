import { NextRequest, NextResponse } from "next/server";
import { getAppByKeyDirect, getCollectionLogs, getAppAnalyses } from "@/lib/sheets";

export async function GET(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;

  try {
    const meta = await getAppByKeyDirect(key);
    if (!meta) return NextResponse.json({ error: "앱을 찾을 수 없습니다." }, { status: 404 });

    const ssId = meta.spreadsheet_id;
    if (!ssId) return NextResponse.json({ meta, logs: [], analyses: [] });

    const [logs, analyses] = await Promise.all([
      getCollectionLogs(ssId),
      getAppAnalyses(ssId),
    ]);

    return NextResponse.json({ meta, logs, analyses });
  } catch (e) {
    console.error(`[apps/${key}]`, e);
    return NextResponse.json({ error: "앱 정보를 불러올 수 없습니다." }, { status: 500 });
  }
}
