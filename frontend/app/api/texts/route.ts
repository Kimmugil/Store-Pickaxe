import { NextResponse } from "next/server";
import { getTexts } from "@/lib/sheets";

export async function GET() {
  try {
    const texts = await getTexts();
    return NextResponse.json(texts, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
