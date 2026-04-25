"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTexts } from "./TextsProvider";
import { cn } from "@/lib/utils";

export default function NavBar() {
  const texts = useTexts();
  const path = usePathname();

  const links = [
    { href: "/", label: texts["nav.home"] || "홈" },
    { href: "/add", label: texts["nav.add"] || "게임 등록" },
    { href: "/guide", label: texts["nav.guide"] || "가이드" },
    { href: "/admin", label: texts["nav.admin"] || "관리자" },
  ];

  return (
    <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-bold text-lg tracking-tight text-gray-900">
          {texts["site.title"] || "Store-Pickaxe"}
        </Link>

        <div className="flex items-center gap-1">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                path === href
                  ? "bg-gray-900 text-white"
                  : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
              )}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
