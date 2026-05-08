import { NextResponse } from "next/server";
import { getAllApps } from "@/lib/sheets";

export async function GET() {
  try {
    const apps = await getAllApps();
    return NextResponse.json(apps.filter((a) => a.status === "active"));
  } catch (e) {
    console.error("[apps] 목록 조회 실패:", e);
    return NextResponse.json({ error: "앱 목록을 불러올 수 없습니다." }, { status: 500 });
  }
}
