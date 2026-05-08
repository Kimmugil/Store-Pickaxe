/**
 * Google Sheets 읽기/쓰기 유틸리티 (서버 사이드 전용)
 * Next.js 서버 컴포넌트 / API 라우트에서만 사용
 */
import { google } from "googleapis";
import { unstable_cache } from "next/cache";
import type { AppMeta, CollectionLog, Analysis, Review } from "./types";

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

// MASTER 헤더 (새 스키마)
const MASTER_HEADERS = [
  "app_key", "app_name", "developer",
  "google_package", "apple_app_id", "icon_url",
  "google_rating", "apple_rating",
  "google_review_count", "apple_review_count",
  "status", "spreadsheet_id",
  "registered_at", "last_collected_at", "last_analyzed_at",
  "pending_analysis",
];

export const getAllApps = unstable_cache(
  async (): Promise<AppMeta[]> => {
    try {
      const rows = await readRange(MASTER_ID(), "MASTER!A:P");
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
    const rows = await readRange(MASTER_ID(), "MASTER!A:P");
    return rowsToRecords<Record<string, string>>(rows).map(normalizeApp);
  } catch {
    return [];
  }
}

export async function getAppByKeyDirect(appKey: string): Promise<AppMeta | null> {
  const all = await getAllAppsDirect();
  return all.find((a) => a.app_key === appKey) ?? null;
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
      const rows = await readRange(spreadsheetId, "ANALYSIS!A:N");
      return rowsToRecords<Record<string, string>>(rows).map(normalizeAnalysis);
    } catch {
      return [];
    }
  },
  ["app-analyses"],
  { revalidate: 120, tags: ["app-analyses"] }
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
      await writeRange(MASTER_ID(), `MASTER!A1:P1`, [MASTER_HEADERS]);
    }
  } catch {
    // MASTER 탭 없는 경우 무시
  }

  const now = new Date().toISOString();
  await appendRow(MASTER_ID(), "MASTER!A:P", [
    app.app_key, app.app_name, app.developer,
    app.google_package, app.apple_app_id, app.icon_url,
    "", "", "", "",       // ratings + review_counts
    "active",             // status
    app.spreadsheet_id,
    now, "", "", "FALSE", // timestamps + pending_analysis
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
  const rows = await readRange(MASTER_ID(), "MASTER!A:P");
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
  const safeParse = (s: string): string[] => {
    try { return JSON.parse(s.replace(/'/g, '"')); } catch { return []; }
  };
  return {
    analysis_id: r.analysis_id ?? "",
    created_at: r.created_at ?? "",
    mode: (r.mode as Analysis["mode"]) || "onboarding",
    review_scope: r.review_scope ?? "",
    overall_summary: r.overall_summary ?? "",
    main_complaints: safeParse(r.main_complaints),
    main_praises: safeParse(r.main_praises),
    google_sentiment: r.google_sentiment !== "" ? parseFloat(r.google_sentiment) || null : null,
    apple_sentiment: r.apple_sentiment !== "" ? parseFloat(r.apple_sentiment) || null : null,
    keywords_google: safeParse(r.keywords_google),
    keywords_apple: safeParse(r.keywords_apple),
    platform_diff: r.platform_diff ?? "",
    sample_count_google: parseInt(r.sample_count_google) || 0,
    sample_count_apple: parseInt(r.sample_count_apple) || 0,
  };
}
