/**
 * Google Sheets 읽기 유틸리티 (서버 사이드 전용)
 * Next.js 서버 컴포넌트 / API 라우트에서만 사용
 */
import { google } from "googleapis";
import { unstable_cache } from "next/cache";
import type { AppMeta, Snapshot, TimelineEvent, Analysis, Review } from "./types";

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
  { revalidate: 120 }
);

export const getTexts = unstable_cache(
  async (): Promise<Record<string, string>> => {
    try {
      const rows = await readRange(MASTER_ID(), "UI_TEXTS!A:B");
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
  { revalidate: 3600 }
);

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

export const getAppSnapshots = unstable_cache(
  async (spreadsheetId: string): Promise<Snapshot[]> => {
    try {
      const rows = await readRange(spreadsheetId, "SNAPSHOTS!A:G");
      return rowsToRecords<Record<string, string>>(rows).map(normalizeSnapshot);
    } catch {
      return [];
    }
  },
  ["app-snapshots"],
  { revalidate: 300 }
);

export const getAppTimeline = unstable_cache(
  async (spreadsheetId: string): Promise<TimelineEvent[]> => {
    try {
      const rows = await readRange(spreadsheetId, "TIMELINE!A:K");
      return rowsToRecords<Record<string, string>>(rows).map(normalizeEvent);
    } catch {
      return [];
    }
  },
  ["app-timeline"],
  { revalidate: 300 }
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
  { revalidate: 300 }
);

export const getAppReviews = unstable_cache(
  async (
    spreadsheetId: string,
    platform: "google" | "apple",
    limit = 50
  ): Promise<Review[]> => {
    try {
      const sheet = platform === "google" ? "GOOGLE_REVIEWS" : "APPLE_REVIEWS";
      const rows = await readRange(spreadsheetId, `${sheet}!A:G`);
      const records = rowsToRecords<Record<string, string>>(rows) as unknown as Review[];
      return records
        .sort((a, b) => (b.reviewed_at > a.reviewed_at ? 1 : -1))
        .slice(0, limit);
    } catch {
      return [];
    }
  },
  ["app-reviews"],
  { revalidate: 600 }
);

// ── 쓰기 (API 라우트 전용) ──────────────────────────────────────

export async function registerAppToMaster(app: {
  app_key: string;
  app_name: string;
  developer: string;
  google_package: string;
  apple_app_id: string;
  icon_url: string;
  spreadsheet_id: string;
}): Promise<void> {
  const now = new Date().toISOString();
  await appendRow(MASTER_ID(), "MASTER!A:Q", [
    app.app_key, app.app_name, app.developer,
    app.google_package, app.apple_app_id, app.icon_url,
    "", "", "medium", "pending", "FALSE",
    app.spreadsheet_id, now, "", "", "", "",
  ]);
}

export async function updateAppField(
  appKey: string,
  field: string,
  value: string
): Promise<void> {
  const rows = await readRange(MASTER_ID(), "MASTER!A:Q");
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
    ...r,
    google_rating: parseFloat(r.google_rating) || null,
    apple_rating: parseFloat(r.apple_rating) || null,
    ai_approved: r.ai_approved?.toUpperCase() === "TRUE",
  } as unknown as AppMeta;
}

function normalizeSnapshot(r: Record<string, string>): Snapshot {
  return {
    ...r,
    google_rating: parseFloat(r.google_rating) || null,
    apple_rating: parseFloat(r.apple_rating) || null,
    google_review_count: parseInt(r.google_review_count) || null,
    apple_review_count: parseInt(r.apple_review_count) || null,
  } as Snapshot;
}

function normalizeEvent(r: Record<string, string>): TimelineEvent {
  return {
    ...r,
    google_rating_before: parseFloat(r.google_rating_before) || null,
    google_rating_after: parseFloat(r.google_rating_after) || null,
    apple_rating_before: parseFloat(r.apple_rating_before) || null,
    apple_rating_after: parseFloat(r.apple_rating_after) || null,
    review_count: parseInt(r.review_count) || null,
  } as TimelineEvent;
}

function normalizeAnalysis(r: Record<string, string>): Analysis {
  const safeParse = (s: string) => {
    try { return JSON.parse(s.replace(/'/g, '"')); } catch { return []; }
  };
  return {
    ...r,
    main_complaints: safeParse(r.main_complaints),
    main_praises: safeParse(r.main_praises),
    keywords_google: safeParse(r.keywords_google),
    keywords_apple: safeParse(r.keywords_apple),
    google_sentiment: parseFloat(r.google_sentiment) || null,
    apple_sentiment: parseFloat(r.apple_sentiment) || null,
    sample_count_google: parseInt(r.sample_count_google) || 0,
    sample_count_apple: parseInt(r.sample_count_apple) || 0,
  } as Analysis;
}
