/**
 * Google Sheets 읽기/쓰기 유틸리티 (서버 사이드 전용)
 * Next.js 서버 컴포넌트 / API 라우트에서만 사용
 */
import { google } from "googleapis";
import { unstable_cache } from "next/cache";
import type { AppMeta, CollectionLog, Analysis, Review, ComplaintPraise } from "./types";

function getAuth() {
  const raw = process.env.GOOGLE_CREDENTIALS_JSON;
  if (!raw) throw new Error("GOOGLE_CREDENTIALS_JSON 환경변수가 설정되지 않았습니다.");
  const credentials = JSON.parse(raw);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

async function readRange(spreadsheetId: string, range: string): Promise<string[][]> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  return (res.data.values as string[][]) || [];
}

async function writeRange(spreadsheetId: string, range: string, values: string[][]): Promise<void> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });
}

async function appendRow(spreadsheetId: string, range: string, values: string[]): Promise<void> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [values] },
  });
}

function rowsToRecords<T>(rows: string[][]): T[] {
  if (rows.length < 2) return [];
  const headers = rows[0];
  return rows.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = row[i] ?? ""; });
    return obj as T;
  });
}

// ── 마스터 시트 ──────────────────────────────────────────────────

const MASTER_ID = () => process.env.MASTER_SPREADSHEET_ID!;

// MASTER 헤더 (A:Q, 17컬럼)
const MASTER_HEADERS = [
  "app_key", "app_name", "developer",
  "google_package", "apple_app_id", "icon_url",
  "google_rating", "apple_rating",
  "google_review_count", "apple_review_count",
  "status", "spreadsheet_id",
  "registered_at", "last_collected_at", "last_analyzed_at",
  "pending_analysis", "release_date",
];

export const getAllApps = unstable_cache(
  async (): Promise<AppMeta[]> => {
    try {
      const rows = await readRange(MASTER_ID(), "MASTER!A:Q");
      return rowsToRecords<Record<string, string>>(rows).map(normalizeApp);
    } catch {
      return [];
    }
  },
  ["all-apps"],
  { revalidate: 60, tags: ["all-apps"] }
);

export async function getAllAppsDirect(): Promise<AppMeta[]> {
  try {
    const rows = await readRange(MASTER_ID(), "MASTER!A:Q");
    return rowsToRecords<Record<string, string>>(rows).map(normalizeApp);
  } catch {
    return [];
  }
}

export async function getAppByKeyDirect(appKey: string): Promise<AppMeta | null> {
  const all = await getAllAppsDirect();
  return all.find((a) => a.app_key === appKey) ?? null;
}

export async function updateReleaseDateInMaster(appKey: string, releaseDate: string): Promise<void> {
  await updateAppField(appKey, "release_date", releaseDate);
}

export const getConfigValues = unstable_cache(
  async (): Promise<Record<string, string>> => {
    try {
      const rows = await readRange(MASTER_ID(), "CONFIG!A:B");
      const config: Record<string, string> = {};
      for (const row of rows.slice(1)) {
        if (row[0]) config[row[0]] = row[1] ?? "";
      }
      return config;
    } catch {
      return {};
    }
  },
  ["config-values"],
  { revalidate: 300 }
);

export async function getAdminPassword(): Promise<string> {
  const config = await getConfigValues();
  return config["ADMIN_PASSWORD"] ?? "";
}

/** 캐시 없이 CONFIG 전체 읽기 (관리자 패널 실시간 조회용) */
export async function getConfigValuesDirect(): Promise<Record<string, string>> {
  try {
    const rows = await readRange(MASTER_ID(), "CONFIG!A:B");
    const config: Record<string, string> = {};
    for (const row of rows.slice(1)) {
      if (row[0]) config[row[0]] = row[1] ?? "";
    }
    return config;
  } catch {
    return {};
  }
}

/** CONFIG 탭에서 key 행을 찾아 값 갱신. 없으면 새 행 추가. */
export async function setConfigValueDirect(key: string, value: string): Promise<void> {
  const rows = await readRange(MASTER_ID(), "CONFIG!A:B");
  const rowIdx = rows.findIndex((r, i) => i > 0 && r[0] === key);
  if (rowIdx < 0) {
    await appendRow(MASTER_ID(), "CONFIG!A:B", [key, value]);
  } else {
    await writeRange(MASTER_ID(), `CONFIG!B${rowIdx + 1}`, [[value]]);
  }
}

/** 오늘 날짜(UTC)와 AI 분석 사용 횟수/한도를 반환 */
export async function getDailyAiUsageDirect(): Promise<{ date: string; count: number; limit: number }> {
  const config = await getConfigValuesDirect();
  const today = new Date().toISOString().slice(0, 10);
  const storedDate = config["AI_DAILY_DATE"] ?? "";
  const count = storedDate === today ? (parseInt(config["AI_DAILY_COUNT"] ?? "0") || 0) : 0;
  const limit = parseInt(config["AI_DAILY_LIMIT"] ?? "30") || 30;
  return { date: today, count, limit };
}

export const getUITexts = unstable_cache(
  async (): Promise<Record<string, string>> => {
    try {
      const rows = await readRange(MASTER_ID(), "UI_TEXT!A:B");
      const texts: Record<string, string> = {};
      for (const row of rows.slice(1)) {
        if (row[0]) texts[row[0]] = row[1] ?? "";
      }
      return texts;
    } catch {
      return {};
    }
  },
  ["ui-texts"],
  { revalidate: 60, tags: ["ui-texts"] }
);

// ── 앱별 시트 ────────────────────────────────────────────────────

export const getCollectionLogs = unstable_cache(
  async (spreadsheetId: string): Promise<CollectionLog[]> => {
    try {
      const rows = await readRange(spreadsheetId, "COLLECTION_LOG!A:F");
      return rowsToRecords<Record<string, string>>(rows).map(normalizeLog);
    } catch {
      return [];
    }
  },
  ["collection-logs"],
  { revalidate: 60, tags: ["collection-logs"] }
);

export const getAppAnalyses = unstable_cache(
  async (spreadsheetId: string): Promise<Analysis[]> => {
    try {
      const rows = await readRange(spreadsheetId, "ANALYSIS!A:U");  // A:U (21컬럼)
      return rowsToRecords<Record<string, string>>(rows).map(normalizeAnalysis);
    } catch {
      return [];
    }
  },
  ["app-analyses"],
  { revalidate: 30, tags: ["app-analyses"] }
);

export const getAppReviews = unstable_cache(
  async (spreadsheetId: string, platform: "google" | "apple", limit = 100): Promise<Review[]> => {
    try {
      const sheet = platform === "google" ? "GOOGLE_REVIEWS" : "APPLE_REVIEWS";
      const rows = await readRange(spreadsheetId, `${sheet}!A:G`);
      const records = rowsToRecords<Record<string, string>>(rows).map((r) =>
        platform === "google"
          ? {
              review_id: r.review_id ?? "",
              rating: parseInt(r.rating) || 0,
              content: r.content ?? "",
              app_version: r.app_version ?? "",
              reviewed_at: r.reviewed_at ?? "",
              thumbs_up: parseInt(r.thumbs_up) || 0,
              collected_at: r.collected_at ?? "",
            } as Review
          : {
              review_id: r.review_id ?? "",
              rating: parseInt(r.rating) || 0,
              title: r.title ?? "",
              content: r.content ?? "",
              app_version: r.app_version ?? "",
              reviewed_at: r.reviewed_at ?? "",
              collected_at: r.collected_at ?? "",
            } as Review
      );
      return records.sort((a, b) => (b.reviewed_at > a.reviewed_at ? 1 : -1)).slice(0, limit);
    } catch {
      return [];
    }
  },
  ["app-reviews"],
  { revalidate: 300, tags: ["app-reviews"] }
);

export async function getAppReviewsOldest(spreadsheetId: string, limit = 200): Promise<Review[]> {
  try {
    const rows = await readRange(spreadsheetId, "GOOGLE_REVIEWS!A:G");
    if (rows.length < 2) return [];
    const records = rowsToRecords<Record<string, string>>(rows);
    return records.slice(0, limit).map((r) => ({
      review_id: r.review_id ?? "",
      rating: parseInt(r.rating) || 0,
      content: r.content ?? "",
      app_version: r.app_version ?? "",
      reviewed_at: r.reviewed_at ?? "",
      thumbs_up: parseInt(r.thumbs_up) || 0,
      collected_at: r.collected_at ?? "",
    }) as Review);
  } catch {
    return [];
  }
}

export async function getGoogleReviewsByDateRange(
  spreadsheetId: string,
  dateFrom: string,
  dateTo: string,
  limit = 5,
): Promise<Review[]> {
  try {
    const rows = await readRange(spreadsheetId, "GOOGLE_REVIEWS!A:G");
    if (rows.length < 2) return [];
    const records = rowsToRecords<Record<string, string>>(rows);
    return records
      .filter((r) => {
        const d = (r.reviewed_at || "").slice(0, 10);
        return d >= dateFrom && d <= dateTo && (r.content || "").length >= 20;
      })
      .map((r) => ({
        review_id: r.review_id ?? "",
        rating: parseInt(r.rating) || 0,
        content: r.content ?? "",
        app_version: r.app_version ?? "",
        reviewed_at: r.reviewed_at ?? "",
        thumbs_up: parseInt(r.thumbs_up) || 0,
        collected_at: r.collected_at ?? "",
      }) as Review)
      .sort((a, b) => {
        const thumbsDiff = (b.thumbs_up ?? 0) - (a.thumbs_up ?? 0);
        if (thumbsDiff !== 0) return thumbsDiff;
        return (b.content || "").length - (a.content || "").length;
      })
      .slice(0, limit);
  } catch {
    return [];
  }
}

export async function getGoogleRatingRows(spreadsheetId: string): Promise<{ rating: number; reviewed_at: string }[]> {
  try {
    const rows = await readRange(spreadsheetId, "GOOGLE_REVIEWS!A:G");
    if (rows.length < 2) return [];
    const records = rowsToRecords<Record<string, string>>(rows);
    return records
      .map((r) => ({ rating: parseInt(r.rating) || 0, reviewed_at: r.reviewed_at ?? "" }))
      .filter((r) => r.rating > 0 && r.reviewed_at);
  } catch {
    return [];
  }
}

// ── 쓰기 ─────────────────────────────────────────────────────────

export async function registerAppToMaster(app: {
  app_key: string;
  app_name: string;
  developer: string;
  google_package: string;
  apple_app_id: string;
  icon_url: string;
  spreadsheet_id: string;
}): Promise<void> {
  try {
    const headerCheck = await readRange(MASTER_ID(), "MASTER!A1:A1");
    if (!headerCheck.length || headerCheck[0]?.[0] !== "app_key") {
      await writeRange(MASTER_ID(), `MASTER!A1:Q1`, [MASTER_HEADERS]);
    }
  } catch {
    // MASTER 탭 없는 경우 무시
  }

  const now = new Date().toISOString();
  await appendRow(MASTER_ID(), "MASTER!A:Q", [
    app.app_key, app.app_name, app.developer,
    app.google_package, app.apple_app_id, app.icon_url,
    "", "", "", "",       // ratings + review_counts
    "active",             // status
    app.spreadsheet_id,
    now, "", "", "FALSE", // timestamps + pending_analysis
    "",                   // release_date
  ]);
}

export async function deleteAppFromMaster(appKey: string): Promise<void> {
  const rows = await readRange(MASTER_ID(), "MASTER!A:A");
  const rowIdx = rows.findIndex((r) => r[0] === appKey);
  if (rowIdx < 0) throw new Error(`앱 '${appKey}'를 찾을 수 없습니다.`);

  const auth = getAuth();
  const sheetsApi = google.sheets({ version: "v4", auth });
  const spreadsheet = await sheetsApi.spreadsheets.get({ spreadsheetId: MASTER_ID() });
  const masterSheet = spreadsheet.data.sheets?.find((s) => s.properties?.title === "MASTER");
  const sheetId = masterSheet?.properties?.sheetId ?? 0;

  await sheetsApi.spreadsheets.batchUpdate({
    spreadsheetId: MASTER_ID(),
    requestBody: {
      requests: [{
        deleteDimension: {
          range: { sheetId, dimension: "ROWS", startIndex: rowIdx, endIndex: rowIdx + 1 },
        },
      }],
    },
  });
}

export async function updateAppField(appKey: string, field: string, value: string): Promise<void> {
  const rows = await readRange(MASTER_ID(), "MASTER!A:Q");  // A:Q (17컬럼, release_date 포함)
  if (rows.length < 2) return;
  const headers = rows[0];
  const colIdx = headers.indexOf(field);
  if (colIdx < 0) return;
  const rowIdx = rows.slice(1).findIndex((r) => r[0] === appKey);
  if (rowIdx < 0) return;

  const rowNum = rowIdx + 2;
  const colLetter = String.fromCharCode(65 + colIdx);
  await writeRange(MASTER_ID(), `MASTER!${colLetter}${rowNum}`, [[value]]);
}

// ── 노말라이저 ──────────────────────────────────────────────────

function normalizeApp(r: Record<string, string>): AppMeta {
  return {
    app_key: r.app_key ?? "",
    app_name: r.app_name ?? "",
    developer: r.developer ?? "",
    google_package: r.google_package ?? "",
    apple_app_id: r.apple_app_id ?? "",
    icon_url: r.icon_url ?? "",
    google_rating: parseFloat(r.google_rating) || null,
    apple_rating: parseFloat(r.apple_rating) || null,
    google_review_count: parseInt(r.google_review_count) || null,
    apple_review_count: parseInt(r.apple_review_count) || null,
    status: (r.status as AppMeta["status"]) || "active",
    spreadsheet_id: r.spreadsheet_id ?? "",
    registered_at: r.registered_at ?? "",
    last_collected_at: r.last_collected_at ?? "",
    last_analyzed_at: r.last_analyzed_at ?? "",
    pending_analysis: r.pending_analysis?.toUpperCase() === "TRUE",
    release_date: r.release_date ?? "",
  };
}

function normalizeLog(r: Record<string, string>): CollectionLog {
  return {
    collected_at: r.collected_at ?? "",
    mode: (r.mode as CollectionLog["mode"]) || "update",
    google_added: parseInt(r.google_added) || 0,
    apple_added: parseInt(r.apple_added) || 0,
    google_rating: r.google_rating ?? "",
    apple_rating: r.apple_rating ?? "",
  };
}

function normalizeAnalysis(r: Record<string, string>): Analysis {
  // 구형(string[]) 또는 신형({title,description}[]) 모두 처리
  // 한국어 작은따옴표('소환 레벨' 등)가 포함된 경우 replace('/g 적용 시 JSON 파싱 오류 발생
  // → 원본 그대로 파싱 우선 시도, 실패 시 legacy fallback
  const safeParseItems = (s: string): ComplaintPraise[] => {
    const parse = (str: string) => {
      const parsed = JSON.parse(str);
      if (!Array.isArray(parsed)) return [];
      return parsed.map((item) =>
        typeof item === "string"
          ? { title: item, description: "" }
          : { title: String(item.title ?? ""), description: String(item.description ?? "") }
      );
    };
    try { return parse(s); } catch {}
    try { return parse(s.replace(/'/g, '"')); } catch {}
    return [];
  };
  const safeParse = (s: string): string[] => {
    try { return JSON.parse(s); } catch {}
    try { return JSON.parse(s.replace(/'/g, '"')); } catch {}
    return [];
  };
  const safeParsePhase = (s: string) => {
    if (!s) return null;
    try { return JSON.parse(s); } catch { return null; }
  };
  const safeParseRatingDist = (s: string): Record<string, number> => {
    if (!s) return {};
    try {
      const parsed = JSON.parse(s);
      return (parsed && typeof parsed === "object" && !Array.isArray(parsed)) ? parsed : {};
    } catch { return {}; }
  };

  return {
    analysis_id: r.analysis_id ?? "",
    created_at: r.created_at ?? "",
    mode: (r.mode as Analysis["mode"]) || "onboarding",
    review_scope: r.review_scope ?? "",
    overall_summary: r.overall_summary ?? "",
    main_complaints: safeParseItems(r.main_complaints),
    main_praises: safeParseItems(r.main_praises),
    google_sentiment: r.google_sentiment !== "" ? parseFloat(r.google_sentiment) || null : null,
    apple_sentiment: r.apple_sentiment !== "" ? parseFloat(r.apple_sentiment) || null : null,
    keywords_google: safeParse(r.keywords_google),
    keywords_apple: safeParse(r.keywords_apple),
    platform_diff: r.platform_diff ?? "",
    sample_count_google: parseInt(r.sample_count_google) || 0,
    sample_count_apple: parseInt(r.sample_count_apple) || 0,
    sample_date_min: r.sample_date_min ?? "",
    sample_date_max: r.sample_date_max ?? "",
    google_phase_launch: safeParsePhase(r.google_phase_launch),
    google_phase_growth: safeParsePhase(r.google_phase_growth),
    google_phase_stable: safeParsePhase(r.google_phase_stable),
    google_rating_dist: safeParseRatingDist(r.google_rating_dist),
    apple_rating_dist: safeParseRatingDist(r.apple_rating_dist),
  };
}
