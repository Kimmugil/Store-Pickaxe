"""
Google Sheets CRUD 매니저.
마스터 스프레드시트 하나에 앱별 워크시트를 생성해 관리합니다.
서비스 계정은 파일을 **생성하지 않고** 사용자가 만든 시트만 편집합니다.
→ 서비스 계정 Drive 저장 공간(quota) 문제를 완전히 회피합니다.
"""
import hashlib
import json
import uuid
from datetime import datetime, timezone, timedelta

import gspread

from src.config import get_google_credentials, get_gdrive_folder_id, get_master_spreadsheet_id

KST = timezone(timedelta(hours=9))

MASTER_SHEET_NAME = "Store-Pickaxe-Master"
MASTER_WORKSHEET = "앱목록"

MASTER_HEADERS = [
    "app_key", "app_name", "app_name_en", "developer",
    "google_package", "apple_app_id", "category",
    "icon_url", "google_rating", "apple_rating",
    "registered_at", "last_pickaxe_run",
    "total_google", "total_apple",
    "spreadsheet_id", "status",
]

GOOGLE_REVIEW_HEADERS = [
    "review_id", "user_name", "rating", "content",
    "app_version", "thumbs_up", "reviewed_at",
    "reply_content", "replied_at", "language", "collected_at",
]

APPLE_REVIEW_HEADERS = [
    "review_id", "user_name", "rating", "title", "content",
    "app_version", "reviewed_at", "language", "collected_at",
]

TIMELINE_HEADERS = [
    "event_id", "version", "date", "period_end",
    "type", "type_label",
    "google_sentiment_pct", "apple_sentiment_pct",
    "google_review_count", "apple_review_count",
    "key_issues", "kr_summary",
    "user_edited", "created_at", "updated_at",
]

ANALYSIS_HISTORY_HEADERS = [
    "analysis_id", "created_at", "platforms",
    "google_review_count", "apple_review_count",
    "model_used", "overall_summary",
    "google_insights", "apple_insights", "platform_diff",
    "top_keywords_google", "top_keywords_apple",
    "google_sentiment_score", "apple_sentiment_score",
    "raw_json",
]


def _now_kst() -> str:
    return datetime.now(KST).strftime("%Y-%m-%d %H:%M:%S")


class SheetsManager:
    def __init__(self):
        creds = get_google_credentials()
        if creds is None:
            raise RuntimeError("Google 자격증명이 설정되지 않았습니다.")
        self._gc = gspread.authorize(creds)
        self._folder_id = get_gdrive_folder_id()
        self._master: gspread.Spreadsheet | None = None

    # ------------------------------------------------------------------ #
    #  내부 헬퍼
    # ------------------------------------------------------------------ #

    @staticmethod
    def _ws_prefix(app_key: str) -> str:
        """앱별 워크시트 접두사 (MD5 해시 8자리)."""
        return hashlib.md5(app_key.encode()).hexdigest()[:8]

    def _ws_name(self, app_key: str, ws_type: str) -> str:
        """앱별 워크시트 이름. ws_type: google, apple, timeline, analysis"""
        return f"{self._ws_prefix(app_key)}_{ws_type}"

    def _get_or_create_master(self) -> gspread.Spreadsheet:
        """마스터 스프레드시트를 Sheets API(open_by_key)로만 엽니다.
        Drive API를 절대 호출하지 않으므로 서비스 계정 quota와 무관합니다."""
        if self._master:
            return self._master

        master_id = get_master_spreadsheet_id()
        if not master_id:
            raise RuntimeError(
                "MASTER_SPREADSHEET_ID가 설정되지 않았습니다. "
                "Streamlit Secrets에 MASTER_SPREADSHEET_ID = \"스프레드시트ID\" 를 추가하세요."
            )

        self._master = self._gc.open_by_key(master_id.strip())
        return self._master

    def _get_master_ws(self) -> gspread.Worksheet:
        ss = self._get_or_create_master()
        try:
            return ss.worksheet(MASTER_WORKSHEET)
        except gspread.WorksheetNotFound:
            ws = ss.add_worksheet(MASTER_WORKSHEET, rows=1000, cols=len(MASTER_HEADERS))
            ws.append_row(MASTER_HEADERS)
            return ws

    def _ensure_worksheet(
        self, ss: gspread.Spreadsheet, title: str, headers: list[str]
    ) -> gspread.Worksheet:
        try:
            return ss.worksheet(title)
        except gspread.WorksheetNotFound:
            ws = ss.add_worksheet(title, rows=10000, cols=len(headers))
            ws.append_row(headers)
            return ws

    # ------------------------------------------------------------------ #
    #  앱 목록 관리
    # ------------------------------------------------------------------ #

    def get_all_apps(self) -> list[dict]:
        """마스터 시트의 전체 앱 목록을 반환합니다."""
        ws = self._get_master_ws()
        return ws.get_all_records()

    def get_active_apps(self) -> list[dict]:
        """status = 'active' 인 앱만 반환합니다."""
        return [a for a in self.get_all_apps() if a.get("status") == "active"]

    def get_app_by_key(self, app_key: str) -> dict | None:
        for app in self.get_all_apps():
            if app.get("app_key") == app_key:
                return app
        return None

    def register_app(self, app_info: dict) -> str:
        """
        새 앱을 마스터 시트에 등록하고 워크시트들을 생성합니다.
        파일을 새로 만들지 않고 마스터 시트 안에 워크시트를 추가합니다.
        반환: 마스터 spreadsheet_id
        """
        app_key = app_info["app_key"]
        if self.get_app_by_key(app_key):
            raise ValueError(f"이미 등록된 앱입니다: {app_key}")

        master = self._get_or_create_master()

        # 앱별 워크시트 초기화 (마스터 시트 안에 생성)
        self._ensure_worksheet(master, self._ws_name(app_key, "google"), GOOGLE_REVIEW_HEADERS)
        self._ensure_worksheet(master, self._ws_name(app_key, "apple"), APPLE_REVIEW_HEADERS)
        self._ensure_worksheet(master, self._ws_name(app_key, "timeline"), TIMELINE_HEADERS)
        self._ensure_worksheet(master, self._ws_name(app_key, "analysis"), ANALYSIS_HISTORY_HEADERS)

        # 마스터 시트에 행 추가
        row = [
            app_key,
            app_info.get("app_name", ""),
            app_info.get("app_name_en", ""),
            app_info.get("developer", ""),
            app_info.get("google_package", ""),
            app_info.get("apple_app_id", ""),
            app_info.get("category", ""),
            app_info.get("icon_url", ""),
            app_info.get("google_rating", ""),
            app_info.get("apple_rating", ""),
            _now_kst(),
            "",
            0,
            0,
            master.id,
            "active",
        ]
        self._get_master_ws().append_row(row)
        return master.id

    def update_app_meta(self, app_key: str, updates: dict):
        """마스터 시트에서 특정 앱의 필드를 업데이트합니다."""
        ws = self._get_master_ws()
        records = ws.get_all_records()
        for i, row in enumerate(records, start=2):
            if row.get("app_key") == app_key:
                for field, value in updates.items():
                    if field in MASTER_HEADERS:
                        col = MASTER_HEADERS.index(field) + 1
                        ws.update_cell(i, col, value)
                return
        raise KeyError(f"앱을 찾을 수 없습니다: {app_key}")

    # ------------------------------------------------------------------ #
    #  리뷰 CRUD
    # ------------------------------------------------------------------ #

    def _save_reviews(
        self, app_key: str, ws_type: str,
        headers: list[str], reviews: list[dict]
    ) -> int:
        if not reviews:
            return 0
        master = self._get_or_create_master()
        ws = self._ensure_worksheet(master, self._ws_name(app_key, ws_type), headers)

        existing_ids = set()
        try:
            id_col = ws.col_values(1)[1:]  # 헤더 제외
            existing_ids = set(id_col)
        except Exception:
            pass

        new_rows = []
        for r in reviews:
            if str(r.get("review_id", "")) not in existing_ids:
                row = [str(r.get(h, "")) for h in headers]
                new_rows.append(row)

        if new_rows:
            ws.append_rows(new_rows, value_input_option="USER_ENTERED")
        return len(new_rows)

    def save_google_reviews(self, app_key: str, reviews: list[dict]) -> int:
        app = self.get_app_by_key(app_key)
        if not app:
            raise KeyError(f"앱을 찾을 수 없습니다: {app_key}")
        added = self._save_reviews(app_key, "google", GOOGLE_REVIEW_HEADERS, reviews)
        if added > 0:
            new_total = int(app.get("total_google", 0)) + added
            self.update_app_meta(app_key, {
                "total_google": new_total,
                "last_pickaxe_run": _now_kst(),
            })
        return added

    def save_apple_reviews(self, app_key: str, reviews: list[dict]) -> int:
        app = self.get_app_by_key(app_key)
        if not app:
            raise KeyError(f"앱을 찾을 수 없습니다: {app_key}")
        added = self._save_reviews(app_key, "apple", APPLE_REVIEW_HEADERS, reviews)
        if added > 0:
            new_total = int(app.get("total_apple", 0)) + added
            self.update_app_meta(app_key, {
                "total_apple": new_total,
                "last_pickaxe_run": _now_kst(),
            })
        return added

    def load_reviews(
        self, app_key: str, platform: str,
        since: str | None = None, limit: int | None = None
    ) -> list[dict]:
        """
        platform: 'google' 또는 'apple'
        since: 'YYYY-MM-DD HH:MM:SS' 이후 리뷰만 반환
        """
        master = self._get_or_create_master()
        ws_type = "google" if platform == "google" else "apple"
        try:
            ws = master.worksheet(self._ws_name(app_key, ws_type))
            records = ws.get_all_records()
        except Exception:
            return []

        if since:
            records = [r for r in records if str(r.get("reviewed_at", "")) >= since]
        if limit:
            records = records[-limit:]
        return records

    def get_existing_review_ids(self, app_key: str, platform: str) -> set:
        """이미 적재된 리뷰 ID 집합을 반환합니다 (중복 방지용)."""
        master = self._get_or_create_master()
        ws_type = "google" if platform == "google" else "apple"
        try:
            ws = master.worksheet(self._ws_name(app_key, ws_type))
            ids = ws.col_values(1)[1:]
            return set(ids)
        except Exception:
            return set()

    # ------------------------------------------------------------------ #
    #  타임라인 CRUD
    # ------------------------------------------------------------------ #

    def load_timeline(self, app_key: str) -> list[dict]:
        master = self._get_or_create_master()
        try:
            ws = master.worksheet(self._ws_name(app_key, "timeline"))
            return ws.get_all_records()
        except Exception:
            return []

    def save_timeline_event(self, app_key: str, event: dict):
        """event_id 기준으로 upsert합니다."""
        master = self._get_or_create_master()
        ws = self._ensure_worksheet(
            master, self._ws_name(app_key, "timeline"), TIMELINE_HEADERS
        )

        event_id = event.get("event_id") or str(uuid.uuid4())[:8]
        event["event_id"] = event_id
        event.setdefault("created_at", _now_kst())
        event["updated_at"] = _now_kst()

        records = ws.get_all_records()
        for i, row in enumerate(records, start=2):
            if row.get("event_id") == event_id:
                ws.update(
                    f"A{i}:{chr(64 + len(TIMELINE_HEADERS))}{i}",
                    [[str(event.get(h, "")) for h in TIMELINE_HEADERS]]
                )
                return

        ws.append_row([str(event.get(h, "")) for h in TIMELINE_HEADERS])

    # ------------------------------------------------------------------ #
    #  분석 이력 CRUD
    # ------------------------------------------------------------------ #

    def save_analysis(self, app_key: str, analysis: dict) -> str:
        """
        분석 결과를 analysis 시트에 추가합니다.
        매 분석마다 새 행이 추가되며 덮어쓰지 않습니다.
        반환: analysis_id
        """
        master = self._get_or_create_master()
        ws = self._ensure_worksheet(
            master, self._ws_name(app_key, "analysis"), ANALYSIS_HISTORY_HEADERS
        )

        analysis_id = str(uuid.uuid4())
        analysis["analysis_id"] = analysis_id
        analysis["created_at"] = _now_kst()

        row = [str(analysis.get(h, "")) for h in ANALYSIS_HISTORY_HEADERS]
        ws.append_row(row)
        return analysis_id

    def get_latest_analysis(self, app_key: str) -> dict | None:
        """가장 최근 분석 결과를 반환합니다."""
        master = self._get_or_create_master()
        try:
            ws = master.worksheet(self._ws_name(app_key, "analysis"))
            records = ws.get_all_records()
            if records:
                return records[-1]
        except Exception:
            pass
        return None

    def get_analysis_history(self, app_key: str) -> list[dict]:
        """모든 분석 이력을 최신순으로 반환합니다."""
        master = self._get_or_create_master()
        try:
            ws = master.worksheet(self._ws_name(app_key, "analysis"))
            records = ws.get_all_records()
            return list(reversed(records))
        except Exception:
            return []
