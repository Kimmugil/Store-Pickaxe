"""
앱별 스프레드시트 CRUD
탭: COLLECTION_LOG / GOOGLE_REVIEWS / APPLE_REVIEWS / ANALYSIS
"""
import json
import uuid
from datetime import datetime, timezone
from functools import lru_cache
from typing import Optional

import gspread
from google.oauth2.service_account import Credentials

from backend.config import get_env, get_google_credentials

_SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]

COLLECTION_LOG_HEADERS = [
    "collected_at", "mode",
    "google_added", "apple_added",
    "google_rating", "apple_rating",
]
GOOGLE_REVIEW_HEADERS = [
    "review_id", "rating", "content",
    "app_version", "reviewed_at", "thumbs_up", "collected_at",
]
APPLE_REVIEW_HEADERS = [
    "review_id", "rating", "title", "content",
    "app_version", "reviewed_at", "collected_at",
]
ANALYSIS_HEADERS = [
    "analysis_id", "created_at", "mode", "review_scope",
    "overall_summary", "main_complaints", "main_praises",
    "google_sentiment", "apple_sentiment",
    "keywords_google", "keywords_apple",
    "platform_diff",
    "sample_count_google", "sample_count_apple",
    "sample_date_min", "sample_date_max",
    "google_phase_launch", "google_phase_growth", "google_phase_stable",
    "google_rating_dist", "apple_rating_dist",   # 전체 수집 리뷰 평점 분포
]


@lru_cache(maxsize=1)
def _client() -> gspread.Client:
    creds = Credentials.from_service_account_info(
        get_google_credentials(), scopes=_SCOPES
    )
    return gspread.authorize(creds)


def _open(spreadsheet_id: str) -> gspread.Spreadsheet:
    return _client().open_by_key(spreadsheet_id)


def _ensure(ss: gspread.Spreadsheet, title: str, headers: list[str]) -> gspread.Worksheet:
    try:
        return ss.worksheet(title)
    except gspread.WorksheetNotFound:
        ws = ss.add_worksheet(title, rows=50000, cols=max(len(headers), 10))
        ws.append_row(headers)
        return ws


# ─── 스프레드시트 초기화 ─────────────────────────────────────────

def setup_spreadsheet(spreadsheet_id: str) -> None:
    ss = _open(spreadsheet_id)
    _ensure(ss, "COLLECTION_LOG", COLLECTION_LOG_HEADERS)
    _ensure(ss, "GOOGLE_REVIEWS", GOOGLE_REVIEW_HEADERS)
    _ensure(ss, "APPLE_REVIEWS", APPLE_REVIEW_HEADERS)
    _ensure(ss, "ANALYSIS", ANALYSIS_HEADERS)

    # GAS가 만든 기본 Sheet1 제거
    try:
        ws = ss.worksheet("Sheet1")
        if len(ss.worksheets()) > 1:
            ss.del_worksheet(ws)
    except gspread.WorksheetNotFound:
        pass


# ─── 수집 로그 ───────────────────────────────────────────────────

def save_collection_log(
    spreadsheet_id: str,
    mode: str,
    google_added: int,
    apple_added: int,
    google_rating: str = "",
    apple_rating: str = "",
) -> None:
    ss = _open(spreadsheet_id)
    ws = _ensure(ss, "COLLECTION_LOG", COLLECTION_LOG_HEADERS)
    ws.append_row([
        _now(), mode,
        google_added, apple_added,
        google_rating, apple_rating,
    ], value_input_option="USER_ENTERED")


def get_collection_logs(spreadsheet_id: str) -> list[dict]:
    ss = _open(spreadsheet_id)
    ws = _ensure(ss, "COLLECTION_LOG", COLLECTION_LOG_HEADERS)
    return ws.get_all_records()


# ─── 리뷰 ID 조회 ────────────────────────────────────────────────

def get_existing_review_ids(spreadsheet_id: str, platform: str) -> set[str]:
    sheet_name = "GOOGLE_REVIEWS" if platform == "google" else "APPLE_REVIEWS"
    headers = GOOGLE_REVIEW_HEADERS if platform == "google" else APPLE_REVIEW_HEADERS
    ss = _open(spreadsheet_id)
    ws = _ensure(ss, sheet_name, headers)
    ids = ws.col_values(1)[1:]
    return set(ids)


# ─── 리뷰 저장 ──────────────────────────────────────────────────

def save_google_reviews(spreadsheet_id: str, reviews: list[dict]) -> int:
    if not reviews:
        return 0
    ss = _open(spreadsheet_id)
    ws = _ensure(ss, "GOOGLE_REVIEWS", GOOGLE_REVIEW_HEADERS)
    now = _now()
    rows = [
        [
            r.get("review_id", ""),
            r.get("rating", ""),
            r.get("content", ""),
            r.get("app_version", ""),
            r.get("reviewed_at", ""),
            r.get("thumbs_up", 0),
            now,
        ]
        for r in reviews
    ]
    ws.append_rows(rows, value_input_option="USER_ENTERED")
    return len(rows)


def save_apple_reviews(spreadsheet_id: str, reviews: list[dict]) -> int:
    if not reviews:
        return 0
    ss = _open(spreadsheet_id)
    ws = _ensure(ss, "APPLE_REVIEWS", APPLE_REVIEW_HEADERS)
    now = _now()
    rows = [
        [
            r.get("review_id", ""),
            r.get("rating", ""),
            r.get("title", ""),
            r.get("content", ""),
            r.get("app_version", ""),
            r.get("reviewed_at", ""),
            now,
        ]
        for r in reviews
    ]
    ws.append_rows(rows, value_input_option="USER_ENTERED")
    return len(rows)


def get_google_reviews(spreadsheet_id: str) -> list[dict]:
    ss = _open(spreadsheet_id)
    ws = _ensure(ss, "GOOGLE_REVIEWS", GOOGLE_REVIEW_HEADERS)
    return ws.get_all_records()


def get_apple_reviews(spreadsheet_id: str) -> list[dict]:
    ss = _open(spreadsheet_id)
    ws = _ensure(ss, "APPLE_REVIEWS", APPLE_REVIEW_HEADERS)
    return ws.get_all_records()


# ─── 분석 결과 ───────────────────────────────────────────────────

def save_analysis(spreadsheet_id: str, result: dict) -> str:
    ss = _open(spreadsheet_id)
    ws = _ensure(ss, "ANALYSIS", ANALYSIS_HEADERS)

    # 시트가 비어있으면 (헤더 삭제된 경우) 헤더 재작성
    if not ws.row_values(1):
        ws.append_row(ANALYSIS_HEADERS, value_input_option="USER_ENTERED")

    analysis_id = result.get("analysis_id") or f"anl_{uuid.uuid4().hex[:8]}"
    ws.append_row([
        analysis_id,
        result.get("created_at", _now()),
        result.get("mode", ""),
        result.get("review_scope", ""),
        result.get("overall_summary", ""),
        json.dumps(result.get("main_complaints", []), ensure_ascii=False),
        json.dumps(result.get("main_praises", []), ensure_ascii=False),
        result.get("google_sentiment", ""),
        result.get("apple_sentiment", ""),
        json.dumps(result.get("keywords_google", []), ensure_ascii=False),
        json.dumps(result.get("keywords_apple", []), ensure_ascii=False),
        result.get("platform_diff", ""),
        result.get("sample_count_google", 0),
        result.get("sample_count_apple", 0),
        result.get("sample_date_min", ""),
        result.get("sample_date_max", ""),
        result.get("google_phase_launch", ""),
        result.get("google_phase_growth", ""),
        result.get("google_phase_stable", ""),
        json.dumps(result.get("google_rating_dist", {}), ensure_ascii=False),
        json.dumps(result.get("apple_rating_dist", {}), ensure_ascii=False),
    ], value_input_option="USER_ENTERED")
    return analysis_id


def get_analyses(spreadsheet_id: str) -> list[dict]:
    ss = _open(spreadsheet_id)
    ws = _ensure(ss, "ANALYSIS", ANALYSIS_HEADERS)
    return ws.get_all_records()


def get_latest_analysis(spreadsheet_id: str) -> Optional[dict]:
    analyses = get_analyses(spreadsheet_id)
    if not analyses:
        return None
    return sorted(analyses, key=lambda a: a.get("created_at", ""))[-1]


# ─── 헬퍼 ───────────────────────────────────────────────────────

def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
