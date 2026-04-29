"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTexts } from "./TextsProvider";
import { cn } from "@/lib/utils";

export default function NavBar() {
  const texts = useTexts();
  const path = usePathname();

  const mainLinks = [
    { href: "/", label: texts["nav.home"] || "홈" },
    { href: "/add", label: texts["nav.add"] || "게임 등록" },
    { href: "/guide", label: texts["nav.guide"] || "가이드" },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-white border-b-2 border-[#1A1A1A]">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="font-black text-lg tracking-tight text-[#1A1A1A] flex items-center gap-2">
          <span
            className="inline-block px-2 py-0.5 rounded-lg"
            style={{ background: "#FFD600", border: "2px solid #1A1A1A" }}
          >
            ⛏
          </span>
          {texts["site.title"] || "Store-Pickaxe"}
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-1">
          {mainLinks.map(({ href, label }) => {
            const isActive = path === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "relative px-4 py-1.5 text-sm transition-all",
                  isActive
                    ? "font-black text-[#1A1A1A]"
                    : "font-medium text-[#9CA3AF] hover:text-[#1A1A1A]"
                )}
              >
                {label}
                {isActive && (
                  <span
                    className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[3px] w-4/5 rounded-full"
                    style={{ background: "#FFD600" }}
                  />
                )}
              </Link>
            );
          })}

          {/* Admin link — subtle, not neo-button */}
          <Link
            href="/admin"
            className={cn(
              "ml-2 text-xs transition-colors",
              path === "/admin"
                ? "text-[#4A4A4A] font-bold"
                : "text-[#B0B0B0] hover:text-[#4A4A4A]"
            )}
          >
            {texts["nav.admin"] || "관리자"}
          </Link>
        </div>
      </div>
    </nav>
  );
}
