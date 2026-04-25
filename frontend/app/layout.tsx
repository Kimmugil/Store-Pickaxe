import type { Metadata } from "next";
import "./globals.css";
import { getTexts } from "@/lib/sheets";
import { TextsProvider } from "@/components/TextsProvider";
import NavBar from "@/components/NavBar";

export async function generateMetadata(): Promise<Metadata> {
  const texts = await getTexts();
  return {
    title: texts["site.title"] || "Store-Pickaxe",
    description: texts["site.description"] || "모바일 게임 리뷰 분석 대시보드",
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const texts = await getTexts();

  return (
    <html lang="ko">
      <body>
        <TextsProvider texts={texts}>
          <NavBar />
          <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
        </TextsProvider>
      </body>
    </html>
  );
}
