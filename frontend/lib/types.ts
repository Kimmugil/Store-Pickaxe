// ───────────────────────────────────────────────
// 공통 타입 정의
// ───────────────────────────────────────────────

export interface AppMeta {
  app_key: string;
  app_name: string;
  developer: string;
  google_package: string;
  apple_app_id: string;
  icon_url: string;
  google_rating: number | null;
  apple_rating: number | null;
  collect_frequency: "high" | "medium" | "low";
  status: "active" | "paused" | "pending";
  ai_approved: boolean;
  spreadsheet_id: string;
  registered_at: string;
  last_snapshot_at: string;
  last_collected_at: string;
  last_analyzed_at: string;
  pending_ai_trigger: string;
}

export interface Snapshot {
  date: string;
  google_rating: number | null;
  apple_rating: number | null;
  google_review_count: number | null;
  apple_review_count: number | null;
  google_version: string;
  apple_version: string;
}

export interface TimelineEvent {
  event_id: string;
  event_date: string;
  event_type: "version_release" | "sentiment_shift" | "review_surge" | "admin_patch" | "monthly_summary";
  version: string;
  google_rating_before: number | null;
  google_rating_after: number | null;
  apple_rating_before: number | null;
  apple_rating_after: number | null;
  review_count: number | null;
  summary: string;
  analysis_id: string;
  google_positive_rate: number | null;
  apple_positive_rate: number | null;
}

export interface Analysis {
  analysis_id: string;
  created_at: string;
  trigger_type: string;
  period_label: string;
  overall_summary: string;
  main_complaints: string[];
  main_praises: string[];
  google_sentiment: number | null;
  apple_sentiment: number | null;
  keywords_google: string[];
  keywords_apple: string[];
  platform_diff: string;
  sample_count_google: number;
  sample_count_apple: number;
}

export interface Review {
  review_id: string;
  rating: number;
  title?: string;
  content: string;
  app_version: string;
  reviewed_at: string;
  thumbs_up?: number;
}

export interface AppDetail {
  meta: AppMeta;
  snapshots: Snapshot[];
  timeline: TimelineEvent[];
  analyses: Analysis[];
  google_reviews: Review[];
  apple_reviews: Review[];
}

export interface SearchResult {
  platform: "google" | "apple";
  package_name?: string;
  app_id?: string;
  name: string;
  developer: string;
  icon_url: string;
  rating: number;
  review_count: number;
}

export interface MatchSuggestion {
  google: SearchResult;
  apple: SearchResult;
  score: number;
  confidence: "high" | "medium" | "low";
}

export type Texts = Record<string, string>;
