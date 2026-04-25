import { NextResponse } from "next/server";
import { getAllApps } from "@/lib/sheets";

export async function GET() {
  try {
    const apps = await getAllApps();
    const visible = apps.filter((a) => a.status === "active" || a.status === "pending");
    return NextResponse.json(visible);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
