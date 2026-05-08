import { NextResponse } from "next/server";
import { getUITexts } from "@/lib/sheets";

export async function GET() {
  try {
    const texts = await getUITexts();
    return NextResponse.json(texts, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return NextResponse.json({}, { status: 500 });
  }
}
