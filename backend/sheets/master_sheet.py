"""
마스터 스프레드시트 CRUD
탭: MASTER / CONFIG / UI_TEXTS
"""
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

MASTER_HEADERS = [
    "app_key", "app_name", "developer",
    "google_package", "apple_app_id", "icon_url",
    "google_rating", "apple_rating",
    "google_review_count", "apple_review_count",
    "status",           # active | paused
    "spreadsheet_id",
    "registered_at", "last_collected_at", "last_analyzed_at",
    "pending_analysis", # TRUE | FALSE
]


@lru_cache(maxsize=1)
def _client() -> gspread.Client:
    creds = Credentials.from_service_account_info(
        get_google_credentials(), scopes=_SCOPES
    )
    return gspread.authorize(creds)


def _master_ss() -> gspread.Spreadsheet:
    return _client().open_by_key(get_env("MASTER_SPREADSHEET_ID", required=True))


def _ensure_sheet(ss: gspread.Spreadsheet, title: str, headers: list[str]) -> gspread.Worksheet:
    try:
        return ss.worksheet(title)
    except gspread.WorksheetNotFound:
        ws = ss.add_worksheet(title, rows=2000, cols=max(len(headers), 10))
        ws.append_row(headers)
        return ws


# ─── 앱 목록 ────────────────────────────────────────────────────

def get_all_apps() -> list[dict]:
    ss = _master_ss()
    ws = _ensure_sheet(ss, "MASTER", MASTER_HEADERS)
    rows = ws.get_all_values()
    if not rows:
        return []
    headers = rows[0] if rows[0][0] == "app_key" else MASTER_HEADERS
    data_rows = rows[1:] if rows[0][0] == "app_key" else rows
    result = []
    for row in data_rows:
        if not any(row):
            continue
        record = {headers[i] if i < len(headers) else "extra": (row[i] if i < len(row) else "")
                  for i in range(len(headers))}
        result.append(record)
    return result


def get_active_apps() -> list[dict]:
    return [a for a in get_all_apps() if a.get("status") == "active"]


def get_app(app_key: str) -> Optional[dict]:
    for app in get_all_apps():
        if app.get("app_key") == app_key:
            return app
    return None


# ─── 앱 등록 ────────────────────────────────────────────────────

def register_app(info: dict) -> None:
    """앱을 MASTER 시트에 추가. 이미 존재하면 무시."""
    ss = _master_ss()
    ws = _ensure_sheet(ss, "MASTER", MASTER_HEADERS)

    existing = ws.col_values(1)
    if info["app_key"] in existing:
        return

    row = [
        info.get("app_key", ""),
        info.get("app_name", ""),
        info.get("developer", ""),
        info.get("google_package", ""),
        info.get("apple_app_id", ""),
        info.get("icon_url", ""),
        "",         # google_rating
        "",         # apple_rating
        "",         # google_review_count
        "",         # apple_review_count
        "active",   # status
        info.get("spreadsheet_id", ""),
        _now(), "", "", "FALSE",
    ]
    ws.append_row(row, value_input_option="USER_ENTERED")


# ─── 필드 갱신 ──────────────────────────────────────────────────

def update_app(app_key: str, fields: dict) -> None:
    ss = _master_ss()
    ws = _ensure_sheet(ss, "MASTER", MASTER_HEADERS)
    headers = ws.row_values(1)
    all_rows = ws.get_all_values()

    for i, row in enumerate(all_rows[1:], start=2):
        if row[0] == app_key:
            updates = []
            for field, value in fields.items():
                if field in headers:
                    col = headers.index(field) + 1
                    updates.append({
                        "range": gspread.utils.rowcol_to_a1(i, col),
                        "values": [[str(value)]],
                    })
            if updates:
                ws.batch_update(updates, value_input_option="USER_ENTERED")
            return
    raise ValueError(f"앱 '{app_key}'를 찾을 수 없습니다.")


def set_pending_analysis(app_key: str, pending: bool) -> None:
    update_app(app_key, {"pending_analysis": "TRUE" if pending else "FALSE"})


def delete_app(app_key: str) -> None:
    ss = _master_ss()
    ws = _ensure_sheet(ss, "MASTER", MASTER_HEADERS)
    all_rows = ws.get_all_values()
    for i, row in enumerate(all_rows[1:], start=2):
        if row[0] == app_key:
            ws.delete_rows(i)
            return


# ─── CONFIG / UI_TEXTS ──────────────────────────────────────────

def get_ui_texts() -> dict[str, str]:
    ss = _master_ss()
    try:
        ws = ss.worksheet("UI_TEXTS")
        rows = ws.get_all_values()
    except gspread.WorksheetNotFound:
        return {}
    result = {}
    for row in rows[1:]:
        if len(row) >= 2 and row[0].strip():
            result[row[0].strip()] = row[1].strip()
    return result


def get_config_values() -> dict[str, str]:
    ss = _master_ss()
    try:
        ws = ss.worksheet("CONFIG")
        rows = ws.get_all_values()
    except gspread.WorksheetNotFound:
        return {}
    result = {}
    for row in rows[1:]:
        if len(row) >= 2 and row[0].strip():
            result[row[0].strip()] = row[1].strip()
    return result


def get_admin_password() -> str:
    return get_config_values().get("ADMIN_PASSWORD", "")


# ─── 헬퍼 ───────────────────────────────────────────────────────

def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
