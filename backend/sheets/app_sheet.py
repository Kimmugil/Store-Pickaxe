"""
앱별 스프레드시트 CRUD
탭: INFO / SNAPSHOTS / GOOGLE_REVIEWS / APPLE_REVIEWS / TIMELINE / ANALYSIS
"""
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

SNAPSHOT_HEADERS = [
    "date", "google_rating", "apple_rating",
    "google_review_count", "apple_review_count",
    "google_version", "apple_version",
]
GOOGLE_REVIEW_HEADERS = [
    "review_id", "rating", "content",
    "app_version", "reviewed_at", "thumbs_up", "collected_at",
]
APPLE_REVIEW_HEADERS = [
    "review_id", "rating", "title", "content",
    "app_version", "reviewed_at", "collected_at",
]
TIMELINE_HEADERS = [
    "event_id", "event_date", "event_type",
    "version",
    "google_rating_before", "google_rating_after",
    "apple_rating_before", "apple_rating_after",
    "review_count", "summary", "analysis_id",
]
ANALYSIS_HEADERS = [
    "analysis_id", "created_at", "trigger_type", "period_label",
    "overall_summary", "main_complaints", "main_praises",
    "google_sentiment", "apple_sentiment",
    "keywords_google", "keywords_apple",
    "platform_diff",
    "sample_count_google", "sample_count_apple",
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
    """앱 스프레드시트에 필요한 시트를 모두 생성한다."""
    ss = _open(spreadsheet_id)

    _ensure(ss, "SNAPSHOTS", SNAPSHOT_HEADERS)
    _ensure(ss, "GOOGLE_REVIEWS", GOOGLE_REVIEW_HEADERS)
    _ensure(ss, "APPLE_REVIEWS", APPLE_REVIEW_HEADERS)
    _ensure(ss, "TIMELINE", TIMELINE_HEADERS)
    _ensure(ss, "ANALYSIS", ANALYSIS_HEADERS)

    # GAS가 만든 기본 Sheet1 제거
    try:
        ws = ss.worksheet("Sheet1")
        if len(ss.worksheets()) > 1:
            ss.del_worksheet(ws)
    except gspread.WorksheetNotFound:
        pass


# ─── 스냅샷 ─────────────────────────────────────────────────────

def save_snapshot(spreadsheet_id: str, snapshot: dict) -> None:
    ss = _open(spreadsheet_id)
    ws = _ensure(ss, "SNAPSHOTS", SNAPSHOT_HEADERS)

    today = snapshot.get("date", _today())
    existing_dates = ws.col_values(1)[1:]  # 헤더 제외
    if today in existing_dates:
        # 이미 오늘 스냅샷 존재 → 덮어쓰기
        idx = existing_dates.index(today) + 2
        ws.update(
            f"A{idx}:G{idx}",
            [[
                today,
                snapshot.get("google_rating", ""),
                snapshot.get("apple_rating", ""),
                snapshot.get("google_review_count", ""),
                snapshot.get("apple_review_count", ""),
                snapshot.get("google_version", ""),
                snapshot.get("apple_version", ""),
            ]],
        )
    else:
        ws.append_row([
            today,
            snapshot.get("google_rating", ""),
            snapshot.get("apple_rating", ""),
            snapshot.get("google_review_count", ""),
            snapshot.get("apple_review_count", ""),
            snapshot.get("google_version", ""),
            snapshot.get("apple_version", ""),
        ], value_input_option="USER_ENTERED")


def get_snapshots(spreadsheet_id: str) -> list[dict]:
    ss = _open(spreadsheet_id)
    ws = _ensure(ss, "SNAPSHOTS", SNAPSHOT_HEADERS)
    return ws.get_all_records()


def get_latest_snapshot(spreadsheet_id: str) -> Optional[dict]:
    snaps = get_snapshots(spreadsheet_id)
    if not snaps:
        return None
    return sorted(snaps, key=lambda s: s.get("date", ""))[-1]


# ─── 리뷰 저장 ──────────────────────────────────────────────────

def get_existing_review_ids(spreadsheet_id: str, platform: str) -> set[str]:
    sheet_name = "GOOGLE_REVIEWS" if platform == "google" else "APPLE_REVIEWS"
    ss = _open(spreadsheet_id)
    ws = _ensure(ss, sheet_name,
                 GOOGLE_REVIEW_HEADERS if platform == "google" else APPLE_REVIEW_HEADERS)
    ids = ws.col_values(1)[1:]
    return set(ids)


def save_google_reviews(spreadsheet_id: str, reviews: list[dict]) -> int:
    if not reviews:
        return 0
    ss = _open(spreadsheet_id)
    ws = _ensure(ss, "GOOGLE_REVIEWS", GOOGLE_REVIEW_HEADERS)
    now = _now()
    rows = []
    for r in reviews:
        rows.append([
            r.get("review_id", ""),
            r.get("rating", ""),
            r.get("content", ""),
            r.get("app_version", ""),
            r.get("reviewed_at", ""),
            r.get("thumbs_up", 0),
            now,
        ])
    if rows:
        ws.append_rows(rows, value_input_option="USER_ENTERED")
    return len(rows)


def save_apple_reviews(spreadsheet_id: str, reviews: list[dict]) -> int:
    if not reviews:
        return 0
    ss = _open(spreadsheet_id)
    ws = _ensure(ss, "APPLE_REVIEWS", APPLE_REVIEW_HEADERS)
    now = _now()
    rows = []
    for r in reviews:
        rows.append([
            r.get("review_id", ""),
            r.get("rating", ""),
            r.get("title", ""),
            r.get("content", ""),
            r.get("app_version", ""),
            r.get("reviewed_at", ""),
            now,
        ])
    if rows:
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


# ─── 타임라인 ────────────────────────────────────────────────────

def save_timeline_event(spreadsheet_id: str, event: dict) -> str:
    ss = _open(spreadsheet_id)
    ws = _ensure(ss, "TIMELINE", TIMELINE_HEADERS)

    event_id = event.get("event_id") or f"evt_{uuid.uuid4().hex[:8]}"
    ws.append_row([
        event_id,
        event.get("event_date", ""),
        event.get("event_type", ""),
        event.get("version", ""),
        event.get("google_rating_before", ""),
        event.get("google_rating_after", ""),
        event.get("apple_rating_before", ""),
        event.get("apple_rating_after", ""),
        event.get("review_count", ""),
        event.get("summary", ""),
        event.get("analysis_id", ""),
    ], value_input_option="USER_ENTERED")
    return event_id


def get_timeline(spreadsheet_id: str) -> list[dict]:
    ss = _open(spreadsheet_id)
    ws = _ensure(ss, "TIMELINE", TIMELINE_HEADERS)
    return ws.get_all_records()


def get_existing_event_dates(spreadsheet_id: str) -> set[str]:
    events = get_timeline(spreadsheet_id)
    return {e.get("event_date", "") for e in events}


def link_analysis_to_event(spreadsheet_id: str, event_id: str, analysis_id: str) -> None:
    ss = _open(spreadsheet_id)
    ws = _ensure(ss, "TIMELINE", TIMELINE_HEADERS)
    event_ids = ws.col_values(1)[1:]
    if event_id in event_ids:
        row_idx = event_ids.index(event_id) + 2
        ws.update_cell(row_idx, 11, analysis_id)  # analysis_id 컬럼


# ─── 분석 결과 ───────────────────────────────────────────────────

def save_analysis(spreadsheet_id: str, result: dict) -> str:
    ss = _open(spreadsheet_id)
    ws = _ensure(ss, "ANALYSIS", ANALYSIS_HEADERS)

    analysis_id = result.get("analysis_id") or f"anl_{uuid.uuid4().hex[:8]}"
    ws.append_row([
        analysis_id,
        result.get("created_at", _now()),
        result.get("trigger_type", ""),
        result.get("period_label", ""),
        result.get("overall_summary", ""),
        str(result.get("main_complaints", [])),
        str(result.get("main_praises", [])),
        result.get("google_sentiment", ""),
        result.get("apple_sentiment", ""),
        str(result.get("keywords_google", [])),
        str(result.get("keywords_apple", [])),
        result.get("platform_diff", ""),
        result.get("sample_count_google", 0),
        result.get("sample_count_apple", 0),
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


# ─── 헬퍼 ──────────────────────────────────────────────────────

def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

def _today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")
