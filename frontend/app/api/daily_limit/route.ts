import { NextResponse } from "next/server";
import { getDailyAiUsageDirect } from "@/lib/sheets";

export async function GET() {
  try {
    const usage = await getDailyAiUsageDirect();
    return NextResponse.json(usage);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
