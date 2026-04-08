"""
애플 앱스토어 스크래퍼.
- 검색/앱 정보: iTunes Search API (공식, 무료, 인증 불필요)
- 리뷰 수집: app-store-scraper 라이브러리
"""
import time
from datetime import datetime, timezone, timedelta

import requests
from app_store_scraper import AppStore

KST = timezone(timedelta(hours=9))
DEFAULT_COUNTRY = "kr"
ITUNES_SEARCH_URL = "https://itunes.apple.com/search"
ITUNES_LOOKUP_URL = "https://itunes.apple.com/lookup"
REQUEST_TIMEOUT = 15
REQUEST_DELAY = 0.5


def _fmt_dt(dt) -> str:
    if dt is None:
        return ""
    if isinstance(dt, datetime):
        return dt.strftime("%Y-%m-%d %H:%M:%S")
    return str(dt)


def _now_kst() -> str:
    return datetime.now(KST).strftime("%Y-%m-%d %H:%M:%S")


class ApplePickaxe:
    def __init__(self, country: str = DEFAULT_COUNTRY):
        self.country = country

    # ------------------------------------------------------------------ #
    #  검색 / 앱 정보 (iTunes Search API)
    # ------------------------------------------------------------------ #

    def search_apps(self, query: str, n_hits: int = 20) -> list[dict]:
        """앱 이름으로 앱스토어를 검색합니다. 한글 검색을 지원합니다."""
        params = {
            "term": query,
            "country": self.country,
            "media": "software",
            "limit": n_hits,
            "lang": "ko_kr",
        }
        resp = requests.get(
            ITUNES_SEARCH_URL, params=params, timeout=REQUEST_TIMEOUT
        )
        resp.raise_for_status()
        results = resp.json().get("results", [])
        return [self._parse_search_result(r) for r in results]

    def get_app_detail(self, app_id: str | int) -> dict:
        """앱 ID로 앱스토어 상세 정보를 가져옵니다."""
        params = {"id": str(app_id), "country": self.country, "lang": "ko_kr"}
        resp = requests.get(
            ITUNES_LOOKUP_URL, params=params, timeout=REQUEST_TIMEOUT
        )
        resp.raise_for_status()
        results = resp.json().get("results", [])
        if not results:
            raise ValueError(f"앱을 찾을 수 없습니다: {app_id}")
        return self._parse_app_detail(results[0])

    def _parse_search_result(self, raw: dict) -> dict:
        return {
            "platform": "apple",
            "apple_app_id": str(raw.get("trackId", "")),
            "app_name": raw.get("trackName", ""),
            "developer": raw.get("artistName", ""),
            "icon_url": raw.get("artworkUrl100", raw.get("artworkUrl60", "")),
            "rating": raw.get("averageUserRating"),
            "ratings_count": raw.get("userRatingCount"),
            "price": raw.get("price", 0),
            "free": raw.get("price", 0) == 0,
            "genre": raw.get("primaryGenreName", ""),
            "bundle_id": raw.get("bundleId", ""),
        }

    def _parse_app_detail(self, raw: dict) -> dict:
        return {
            "platform": "apple",
            "apple_app_id": str(raw.get("trackId", "")),
            "app_name": raw.get("trackName", ""),
            "app_name_en": raw.get("trackName", ""),
            "developer": raw.get("artistName", ""),
            "developer_id": str(raw.get("artistId", "")),
            "icon_url": raw.get("artworkUrl100", ""),
            "description": raw.get("description", ""),
            "rating": raw.get("averageUserRating"),
            "ratings_count": raw.get("userRatingCount"),
            "current_version": raw.get("version", ""),
            "released_at": raw.get("releaseDate", "")[:10] if raw.get("releaseDate") else "",
            "last_updated_at": raw.get("currentVersionReleaseDate", "")[:10]
            if raw.get("currentVersionReleaseDate") else "",
            "content_rating": raw.get("contentAdvisoryRating", ""),
            "genre": raw.get("primaryGenreName", ""),
            "price": raw.get("price", 0),
            "free": raw.get("price", 0) == 0,
            "bundle_id": raw.get("bundleId", ""),
            "file_size_bytes": raw.get("fileSizeBytes", ""),
            "minimum_os": raw.get("minimumOsVersion", ""),
            "supported_devices": raw.get("supportedDevices", []),
        }

    # ------------------------------------------------------------------ #
    #  리뷰 수집 (app-store-scraper)
    # ------------------------------------------------------------------ #

    def collect_all_reviews(
        self, app_id: str | int, app_name: str, how_many: int = 2000
    ) -> list[dict]:
        """최초 전체 수집."""
        app = AppStore(country=self.country, app_name=app_name, app_id=str(app_id))
        app.review(how_many=how_many, sleep=REQUEST_DELAY)
        return [self._parse_review(r) for r in (app.reviews or [])]

    def collect_new_reviews(
        self,
        app_id: str | int,
        app_name: str,
        existing_ids: set,
        how_many: int = 500,
    ) -> list[dict]:
        """
        기존 리뷰 ID 집합을 기준으로 신규 리뷰만 반환합니다.
        app-store-scraper는 최신순 수집이므로 아는 ID 이후는 건너뜁니다.
        """
        app = AppStore(country=self.country, app_name=app_name, app_id=str(app_id))
        app.review(how_many=how_many, sleep=REQUEST_DELAY)

        new_reviews = []
        for r in app.reviews or []:
            r_id = str(r.get("id", ""))
            if r_id and r_id not in existing_ids:
                new_reviews.append(self._parse_review(r))

        return new_reviews

    def _parse_review(self, raw: dict) -> dict:
        return {
            "review_id": str(raw.get("id", "")),
            "user_name": raw.get("userName", ""),
            "rating": raw.get("rating", ""),
            "title": raw.get("title", ""),
            "content": raw.get("review", ""),
            "app_version": raw.get("version", ""),
            "reviewed_at": _fmt_dt(raw.get("date")),
            "language": self.country,
            "collected_at": _now_kst(),
        }
