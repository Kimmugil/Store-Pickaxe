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
  status?: string;
  spreadsheet_id: string;
  registered_at: string;
  last_collected_at: string;
  last_analyzed_at: string;
  pending_analysis: boolean;
  release_date?: string;
}

export interface CollectionLog {
  collected_at: string;
  mode: "onboarding" | "update";
  google_added: number;
  apple_added: number;
  google_rating: string;
  apple_rating: string;
}

export interface PhaseData {
  summary: string;
  count: number;
  date_from: string;
  date_to: string;
  sentiment?: number | null;  // 해당 시기 전체 리뷰 기반 긍정률
}

export interface ComplaintPraise {
  title: string;
  description: string;
}

export interface Analysis {
  analysis_id: string;
  created_at: string;
  mode: "onboarding" | "update";
  review_scope: string;
  overall_summary: string;
  main_complaints: ComplaintPraise[];
  main_praises: ComplaintPraise[];
  google_sentiment: number | null;
  apple_sentiment: number | null;
  keywords_google: string[];
  keywords_apple: string[];
  platform_diff: string;
  sample_count_google: number;
  sample_count_apple: number;
  sample_date_min?: string;
  sample_date_max?: string;
  google_phase_launch?: PhaseData | null;
  google_phase_growth?: PhaseData | null;
  google_phase_stable?: PhaseData | null;
  google_rating_dist?: Record<string, number>;  // 전체 수집 리뷰 평점 분포
  apple_rating_dist?: Record<string, number>;
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
