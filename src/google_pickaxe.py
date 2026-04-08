"""
구글 플레이 스토어 스크래퍼.
google-play-scraper 라이브러리를 사용합니다.
"""
import time
from datetime import datetime, timezone, timedelta

from google_play_scraper import app as gp_app
from google_play_scraper import reviews as gp_reviews
from google_play_scraper import search as gp_search
from google_play_scraper import Sort

KST = timezone(timedelta(hours=9))
DEFAULT_LANG = "ko"
DEFAULT_COUNTRY = "kr"
REQUEST_DELAY = 0.5  # 초, 요청 간 대기 시간


def _fmt_dt(dt) -> str:
    if dt is None:
        return ""
    if isinstance(dt, datetime):
        return dt.strftime("%Y-%m-%d %H:%M:%S")
    return str(dt)


def _now_kst() -> str:
    return datetime.now(KST).strftime("%Y-%m-%d %H:%M:%S")


class GooglePickaxe:
    def __init__(self, lang: str = DEFAULT_LANG, country: str = DEFAULT_COUNTRY):
        self.lang = lang
        self.country = country

    # ------------------------------------------------------------------ #
    #  검색 / 앱 정보
    # ------------------------------------------------------------------ #

    def search_apps(self, query: str, n_hits: int = 20) -> list[dict]:
        """앱 이름으로 구글 플레이를 검색합니다."""
        results = gp_search(
            query,
            lang=self.lang,
            country=self.country,
            n_hits=n_hits,
        )
        return [self._parse_search_result(r) for r in results]

    def get_app_detail(self, package_name: str) -> dict:
        """패키지명으로 앱 상세 정보를 가져옵니다."""
        result = gp_app(package_name, lang=self.lang, country=self.country)
        return self._parse_app_detail(result)

    def _parse_search_result(self, raw: dict) -> dict:
        return {
            "platform": "google",
            "package_name": raw.get("appId", ""),
            "app_name": raw.get("title", ""),
            "developer": raw.get("developer", ""),
            "icon_url": raw.get("icon", ""),
            "rating": raw.get("score"),
            "ratings_count": raw.get("ratings"),
            "price": raw.get("price", 0),
            "free": raw.get("free", True),
            "genre": raw.get("genre", ""),
        }

    def _parse_app_detail(self, raw: dict) -> dict:
        return {
            "platform": "google",
            "package_name": raw.get("appId", ""),
            "app_name": raw.get("title", ""),
            "app_name_en": raw.get("title", ""),
            "developer": raw.get("developer", ""),
            "developer_id": raw.get("developerId", ""),
            "icon_url": raw.get("icon", ""),
            "screenshots": raw.get("screenshots", []),
            "description": raw.get("description", ""),
            "rating": raw.get("score"),
            "ratings_count": raw.get("ratings"),
            "reviews_count": raw.get("reviews"),
            "installs": raw.get("installs", ""),
            "current_version": raw.get("version", ""),
            "released_at": _fmt_dt(raw.get("released")),
            "last_updated_at": _fmt_dt(raw.get("lastUpdatedOn")),
            "content_rating": raw.get("contentRating", ""),
            "genre": raw.get("genre", ""),
            "price": raw.get("price", 0),
            "free": raw.get("free", True),
        }

    # ------------------------------------------------------------------ #
    #  리뷰 수집
    # ------------------------------------------------------------------ #

    def collect_all_reviews(
        self, package_name: str, max_count: int = 5000
    ) -> list[dict]:
        """최초 전체 수집 — 최대 max_count개의 리뷰를 가져옵니다."""
        all_reviews = []
        continuation_token = None
        batch_size = 200

        while len(all_reviews) < max_count:
            result, continuation_token = gp_reviews(
                package_name,
                lang=self.lang,
                country=self.country,
                sort=Sort.NEWEST,
                count=min(batch_size, max_count - len(all_reviews)),
                continuation_token=continuation_token,
            )
            if not result:
                break
            all_reviews.extend([self._parse_review(r) for r in result])
            if not continuation_token:
                break
            time.sleep(REQUEST_DELAY)

        return all_reviews

    def collect_new_reviews(
        self, package_name: str, existing_ids: set, max_count: int = 2000
    ) -> list[dict]:
        """
        기존 리뷰 ID 집합을 기준으로 신규 리뷰만 수집합니다.
        최신순 정렬이므로 이미 아는 ID를 만나면 수집을 중단합니다.
        """
        new_reviews = []
        continuation_token = None
        batch_size = 200

        while len(new_reviews) < max_count:
            result, continuation_token = gp_reviews(
                package_name,
                lang=self.lang,
                country=self.country,
                sort=Sort.NEWEST,
                count=batch_size,
                continuation_token=continuation_token,
            )
            if not result:
                break

            stop = False
            for r in result:
                if str(r.get("reviewId", "")) in existing_ids:
                    stop = True
                    break
                new_reviews.append(self._parse_review(r))

            if stop or not continuation_token:
                break
            time.sleep(REQUEST_DELAY)

        return new_reviews

    def _parse_review(self, raw: dict) -> dict:
        return {
            "review_id": raw.get("reviewId", ""),
            "user_name": raw.get("userName", ""),
            "rating": raw.get("score", ""),
            "content": raw.get("content", ""),
            "app_version": raw.get("reviewCreatedVersion", ""),
            "thumbs_up": raw.get("thumbsUpCount", 0),
            "reviewed_at": _fmt_dt(raw.get("at")),
            "reply_content": raw.get("replyContent", ""),
            "replied_at": _fmt_dt(raw.get("repliedAt")),
            "language": self.lang,
            "collected_at": _now_kst(),
        }
