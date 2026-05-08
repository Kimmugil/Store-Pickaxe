"use client";

import Link from "next/link";
import { useTexts } from "@/components/TextsProvider";

export function NavLogo() {
  const { texts } = useTexts();
  return (
    <Link href="/" className="font-black text-base" style={{ color: "#1A1A1A", letterSpacing: "-0.02em" }}>
      {texts["site.name"] || "Store Pickaxe"}
    </Link>
  );
}
