"""
구글 플레이 스토어 수집기
google-play-scraper 라이브러리 사용
"""
import logging
import time
from datetime import datetime, timezone
from typing import Optional

from google_play_scraper import app as gp_app
from google_play_scraper import search as gp_search
from google_play_scraper import reviews as gp_reviews
from google_play_scraper import Sort

from backend.config import collect_delay

log = logging.getLogger(__name__)


def search_apps(query: str, n: int = 10, country: str = "kr", lang: str = "ko") -> list[dict]:
    """앱 검색. 결과를 표준 형식으로 반환."""
    try:
        results = gp_search(query, n_hits=n, country=country, lang=lang)
        return [_normalize_search_result(r) for r in results]
    except Exception:
        # 한국 결과 없으면 글로벌로 재시도
        try:
            results = gp_search(query, n_hits=n, country="us", lang="en")
            return [_normalize_search_result(r) for r in results]
        except Exception:
            return []


def get_app_detail(package_name: str, country: str = "kr", lang: str = "ko") -> Optional[dict]:
    """앱 상세 정보 조회."""
    try:
        data = gp_app(package_name, country=country, lang=lang)
        return {
            "package_name": package_name,
            "name": data.get("title", ""),
            "developer": data.get("developer", ""),
            "icon_url": data.get("icon", ""),
            "rating": data.get("score", 0),
            "review_count": data.get("reviews", 0),
            "current_version": data.get("version", ""),
            "description": data.get("description", ""),
        }
    except Exception:
        return None


def get_current_rating(package_name: str, country: str = "kr") -> dict:
    """현재 평점과 버전만 빠르게 조회."""
    detail = get_app_detail(package_name, country=country)
    if detail:
        return {
            "rating": detail["rating"],
            "review_count": detail["review_count"],
            "version": detail["current_version"],
        }
    return {"rating": None, "review_count": None, "version": None}


def collect_reviews(
    package_name: str,
    existing_ids: set[str],
    max_count: int = 3000,
    country: str = "kr",
    lang: str = "ko",
) -> list[dict]:
    """
    신규 리뷰만 수집한다.
    existing_ids에 없는 review_id만 반환.
    기존 리뷰가 연속으로 나오면 조기 종료.
    """
    collected = []
    continuation_token = None
    consecutive_known = 0
    EARLY_STOP_THRESHOLD = 40   # 연속 기존 리뷰 40개 → 종료
    MAX_PAGES = 50              # 무한루프 방지: 최대 50페이지(200개씩 = 최대 1만개)
    page_count = 0

    while len(collected) < max_count and page_count < MAX_PAGES:
        try:
            result, continuation_token = gp_reviews(
                package_name,
                lang=lang,
                country=country,
                sort=Sort.NEWEST,
                count=200,
                continuation_token=continuation_token,
            )
        except Exception as exc:
            log.warning(f"[google] 리뷰 수집 중단 (pkg={package_name}): {exc}")
            break

        page_count += 1

        if not result:
            break

        for r in result:
            rid = r.get("reviewId", "")
            if rid in existing_ids:
                consecutive_known += 1
            else:
                consecutive_known = 0
                collected.append(_normalize_review(r))

        if consecutive_known >= EARLY_STOP_THRESHOLD:
            break

        if continuation_token is None:
            break

        time.sleep(collect_delay())

    if page_count >= MAX_PAGES:
        log.warning(f"[google] 최대 페이지({MAX_PAGES}페이지) 도달 — 루프 강제 종료 (pkg={package_name})")

    return collected


def _normalize_search_result(r: dict) -> dict:
    return {
        "platform": "google",
        "package_name": r.get("appId", ""),
        "name": r.get("title", ""),
        "developer": r.get("developer", ""),
        "icon_url": r.get("icon", ""),
        "rating": r.get("score", 0),
        "review_count": r.get("reviews", 0),
    }


def _normalize_review(r: dict) -> dict:
    at = r.get("at")
    if isinstance(at, datetime):
        reviewed_at = at.strftime("%Y-%m-%dT%H:%M:%SZ")
    else:
        reviewed_at = str(at) if at else ""

    return {
        "review_id": r.get("reviewId", ""),
        "rating": r.get("score", 0),
        "content": r.get("content", ""),
        "app_version": r.get("reviewCreatedVersion", ""),
        "reviewed_at": reviewed_at,
        "thumbs_up": r.get("thumbsUpCount", 0),
    }
