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
  google_review_count: number | null;
  apple_review_count: number | null;
  status: "active" | "paused";
  spreadsheet_id: string;
  registered_at: string;
  last_collected_at: string;
  last_analyzed_at: string;
  pending_analysis: boolean;
}

export interface CollectionLog {
  collected_at: string;
  mode: "onboarding" | "update";
  google_added: number;
  apple_added: number;
  google_rating: string;
  apple_rating: string;
}

export interface Analysis {
  analysis_id: string;
  created_at: string;
  mode: "onboarding" | "update";
  review_scope: string;
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
  collected_at?: string;
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
