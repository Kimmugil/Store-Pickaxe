/**
 * 앱 검색 API
 * Google Play: google-play-scraper npm 패키지 (서버사이드 Node.js)
 * Apple App Store: iTunes Search API (공식, 인증 불필요)
 */
import { NextRequest, NextResponse } from "next/server";
import type { SearchResult, MatchSuggestion } from "@/lib/types";

// ── Google Play 검색 ─────────────────────────────────────────────
async function searchGoogle(query: string): Promise<SearchResult[]> {
  try {
    // google-play-scraper는 서버사이드(Node.js)에서만 동작
    const gps = await import("google-play-scraper");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results: any[] = await gps.search({
      term: query,
      num: 8,
      country: "kr",
      lang: "ko",
    });
    return results.map((r) => ({
      platform: "google" as const,
      package_name: String(r.appId ?? ""),
      name: String(r.title ?? ""),
      developer: String(r.developer ?? ""),
      icon_url: String(r.icon ?? ""),
      rating: Number(r.score) || 0,
      review_count: Number(r.reviews) || 0,
    }));
  } catch {
    // 검색 실패 시 빈 배열 (차단 등)
    return [];
  }
}

// ── Apple App Store 검색 ─────────────────────────────────────────
async function searchApple(query: string): Promise<SearchResult[]> {
  try {
    const url = new URL("https://itunes.apple.com/search");
    url.searchParams.set("term", query);
    url.searchParams.set("entity", "software");
    url.searchParams.set("country", "kr");
    url.searchParams.set("limit", "8");

    const resp = await fetch(url.toString(), { next: { revalidate: 0 } });
    const data = await resp.json();
    return (data.results ?? []).map((r: Record<string, unknown>) => ({
      platform: "apple" as const,
      app_id: String(r.trackId ?? ""),
      name: String(r.trackName ?? ""),
      developer: String(r.artistName ?? ""),
      icon_url: String(r.artworkUrl512 ?? r.artworkUrl100 ?? ""),
      rating: Number(r.averageUserRating) || 0,
      review_count: Number(r.userRatingCount) || 0,
    }));
  } catch {
    return [];
  }
}

// ── 매칭 점수 계산 (Levenshtein 기반) ───────────────────────────
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][n];
}

function strSimilarity(s1: string, s2: string): number {
  const a = s1.toLowerCase().trim();
  const b = s2.toLowerCase().trim();
  if (!a || !b) return 0;
  const longer = a.length >= b.length ? a : b;
  const shorter = a.length < b.length ? a : b;
  const dist = levenshtein(longer, shorter);
  return Math.round((1 - dist / longer.length) * 100);
}

function matchScore(g: SearchResult, a: SearchResult): number {
  const nameScore = strSimilarity(g.name, a.name) * 0.6;
  const devScore = strSimilarity(g.developer, a.developer) * 0.4;
  return Math.round(nameScore + devScore);
}

// ── 핸들러 ──────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ error: "검색어가 없습니다." }, { status: 400 });

  const [googleResults, appleResults] = await Promise.allSettled([
    searchGoogle(q),
    searchApple(q),
  ]);

  const google = googleResults.status === "fulfilled" ? googleResults.value : [];
  const apple = appleResults.status === "fulfilled" ? appleResults.value : [];

  // 자동 매칭 제안 생성
  const suggestions: MatchSuggestion[] = [];
  const usedAppleIds = new Set<string>();

  for (const g of google) {
    let bestApple: SearchResult | null = null;
    let bestScore = 0;

    for (const a of apple) {
      if (usedAppleIds.has(a.app_id ?? "")) continue;
      const score = matchScore(g, a);
      if (score > bestScore) { bestScore = score; bestApple = a; }
    }

    if (bestApple && bestScore >= 70) {
      usedAppleIds.add(bestApple.app_id ?? "");
      suggestions.push({
        google: g,
        apple: bestApple,
        score: bestScore,
        confidence: bestScore >= 90 ? "high" : "medium",
      });
    }
  }

  return NextResponse.json({ google, apple, suggestions });
}
