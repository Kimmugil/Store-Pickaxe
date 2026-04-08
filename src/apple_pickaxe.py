"""
애플 앱스토어 스크래퍼.
- 검색/앱 정보: iTunes Search API (공식, 무료, 인증 불필요)
- 리뷰 수집: iTunes Customer Reviews RSS API (공식, 무료, 인증 불필요)
  외부 라이브러리 의존 없이 requests 만으로 동작합니다.
"""
import time
from datetime import datetime, timezone, timedelta

import requests

KST = timezone(timedelta(hours=9))
DEFAULT_COUNTRY = "kr"
ITUNES_SEARCH_URL = "https://itunes.apple.com/search"
ITUNES_LOOKUP_URL = "https://itunes.apple.com/lookup"
ITUNES_REVIEWS_URL = "https://itunes.apple.com/rss/customerreviews/id={app_id}/sortBy=mostRecent/page={page}/json"
REQUEST_TIMEOUT = 15
REQUEST_DELAY = 0.5
MAX_REVIEW_PAGES = 10  # iTunes RSS 최대 10페이지 × 50개 = 500개


def _fmt_dt(value: str) -> str:
    if not value:
        return ""
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return dt.strftime("%Y-%m-%d %H:%M:%S")
    except Exception:
        return str(value)[:19]


def _now_kst() -> str:
    return datetime.now(KST).strftime("%Y-%m-%d %H:%M:%S")


class ApplePickaxe:
    def __init__(self, country: str = DEFAULT_COUNTRY):
        self.country = country
        self._session = requests.Session()
        self._session.headers.update({
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
        })

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
        resp = self._session.get(ITUNES_SEARCH_URL, params=params, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        results = resp.json().get("results", [])
        return [self._parse_search_result(r) for r in results]

    def get_app_detail(self, app_id: str | int) -> dict:
        """앱 ID로 앱스토어 상세 정보를 가져옵니다."""
        params = {"id": str(app_id), "country": self.country, "lang": "ko_kr"}
        resp = self._session.get(ITUNES_LOOKUP_URL, params=params, timeout=REQUEST_TIMEOUT)
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
        }

    # ------------------------------------------------------------------ #
    #  리뷰 수집 (iTunes Customer Reviews RSS API)
    # ------------------------------------------------------------------ #

    def collect_all_reviews(
        self, app_id: str | int, app_name: str = "", how_many: int = 500
    ) -> list[dict]:
        """iTunes RSS API로 최초 전체 수집합니다. 최대 500개."""
        all_reviews = []
        max_pages = min(MAX_REVIEW_PAGES, (how_many + 49) // 50)

        for page in range(1, max_pages + 1):
            batch = self._fetch_review_page(str(app_id), page)
            if not batch:
                break
            all_reviews.extend(batch)
            if len(all_reviews) >= how_many:
                break
            time.sleep(REQUEST_DELAY)

        return all_reviews[:how_many]

    def collect_new_reviews(
        self,
        app_id: str | int,
        app_name: str,
        existing_ids: set,
        how_many: int = 200,
    ) -> list[dict]:
        """
        기존 리뷰 ID 집합을 기준으로 신규 리뷰만 반환합니다.
        iTunes RSS는 최신순으로 반환하므로 아는 ID를 만나면 중단합니다.
        """
        new_reviews = []
        max_pages = min(MAX_REVIEW_PAGES, (how_many + 49) // 50)

        for page in range(1, max_pages + 1):
            batch = self._fetch_review_page(str(app_id), page)
            if not batch:
                break

            stop = False
            for r in batch:
                if r["review_id"] in existing_ids:
                    stop = True
                    break
                new_reviews.append(r)

            if stop:
                break
            time.sleep(REQUEST_DELAY)

        return new_reviews

    def _fetch_review_page(self, app_id: str, page: int) -> list[dict]:
        """iTunes RSS API에서 특정 페이지의 리뷰를 가져옵니다."""
        url = ITUNES_REVIEWS_URL.format(app_id=app_id, page=page)
        try:
            resp = self._session.get(url, timeout=REQUEST_TIMEOUT)
            resp.raise_for_status()
            data = resp.json()
        except Exception:
            return []

        entries = data.get("feed", {}).get("entry", [])
        if not entries:
            return []

        reviews = []
        for entry in entries:
            if not isinstance(entry, dict):
                continue
            # 첫 번째 entry는 앱 정보일 수 있음 — im:rating 없으면 건너뜀
            rating_raw = entry.get("im:rating", {}).get("label", "")
            if not rating_raw:
                continue

            review_id = entry.get("id", {}).get("label", "")
            if not review_id:
                continue

            reviews.append(self._parse_rss_entry(entry))

        return reviews

    def _parse_rss_entry(self, entry: dict) -> dict:
        def _label(key: str) -> str:
            return entry.get(key, {}).get("label", "")

        return {
            "review_id": _label("id"),
            "user_name": entry.get("author", {}).get("name", {}).get("label", ""),
            "rating": _label("im:rating"),
            "title": _label("title"),
            "content": _label("content"),
            "app_version": _label("im:version"),
            "reviewed_at": _fmt_dt(_label("updated")),
            "language": self.country,
            "collected_at": _now_kst(),
        }
