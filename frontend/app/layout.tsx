import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Store Pickaxe",
  description: "모바일 게임 스토어 리뷰 분석 대시보드",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body style={{ background: "#FAFAFA" }}>
        <nav
          style={{
            position: "sticky",
            top: 0,
            zIndex: 50,
            background: "#FFFFFF",
            borderBottom: "2px solid #1A1A1A",
            height: "56px",
          }}
        >
          <div className="max-w-5xl mx-auto px-4 h-full flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Link href="/" className="font-black text-base" style={{ color: "#1A1A1A", letterSpacing: "-0.02em" }}>
                Store Pickaxe
              </Link>
              <div className="flex items-center gap-4">
                <Link href="/" className="text-sm font-bold" style={{ color: "#1A1A1A" }}>
                  홈
                </Link>
                <Link href="/dashboard" className="text-sm font-bold" style={{ color: "#1A1A1A", opacity: 0.6 }}>
                  리스트
                </Link>
              </div>
            </div>
            <Link href="/admin" className="text-xs font-bold" style={{ color: "#9CA3AF" }}>
              관리자
            </Link>
          </div>
        </nav>
        <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
