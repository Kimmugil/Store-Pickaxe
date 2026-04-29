"""
애플 앱스토어 수집기
iTunes Search API + Customer Reviews RSS API 사용 (공식, 인증 불필요)
RSS는 최대 500개 제한 — 수집 빈도로 보완
"""
import time
import requests
from datetime import datetime, timezone
from typing import Optional

from backend.config import collect_delay

_SEARCH_URL = "https://itunes.apple.com/search"
_LOOKUP_URL = "https://itunes.apple.com/lookup"
_REVIEWS_URL = "https://itunes.apple.com/{country}/rss/customerreviews/page={page}/id={app_id}/sortby=mostrecent/json"

_HEADERS = {"User-Agent": "Store-Pickaxe/1.0"}


def search_apps(query: str, n: int = 10, country: str = "kr") -> list[dict]:
    """앱 검색. 결과를 표준 형식으로 반환."""
    params = {
        "term": query,
        "entity": "software",
        "country": country,
        "limit": n,
    }
    try:
        resp = requests.get(_SEARCH_URL, params=params, headers=_HEADERS, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        return [_normalize_search_result(r) for r in data.get("results", [])]
    except Exception:
        return []


def get_app_detail(app_id: str, country: str = "kr") -> Optional[dict]:
    """앱 상세 정보 조회."""
    params = {"id": app_id, "country": country, "entity": "software"}
    try:
        resp = requests.get(_LOOKUP_URL, params=params, headers=_HEADERS, timeout=10)
        resp.raise_for_status()
        results = resp.json().get("results", [])
        if not results:
            return None
        r = results[0]
        return {
            "app_id": str(app_id),
            "name": r.get("trackName", ""),
            "developer": r.get("artistName", ""),
            "icon_url": r.get("artworkUrl512") or r.get("artworkUrl100", ""),
            "rating": r.get("averageUserRating", 0),
            "review_count": r.get("userRatingCount", 0),
            "current_version": r.get("version", ""),
            "description": r.get("description", ""),
        }
    except Exception:
        return None


def get_current_rating(app_id: str, country: str = "kr") -> dict:
    """현재 평점과 버전만 빠르게 조회."""
    detail = get_app_detail(app_id, country=country)
    if detail:
        return {
            "rating": detail["rating"],
            "review_count": detail["review_count"],
            "version": detail["current_version"],
        }
    return {"rating": None, "review_count": None, "version": None}


import logging as _logging
_log = _logging.getLogger(__name__)

_MAX_RETRY_PER_PAGE = 2  # 페이지당 최대 재시도 횟수


def collect_reviews(
    app_id: str,
    existing_ids: set[str],
    max_pages: int = 10,
    country: str = "kr",
) -> list[dict]:
    """
    RSS에서 최신 리뷰 수집 (최대 10페이지 × 50개 = 500개).
    existing_ids에 없는 것만 반환.
    기존 리뷰가 페이지 전체를 차지하면 조기 종료.
    """
    collected = []

    for page in range(1, max_pages + 1):
        url = _REVIEWS_URL.format(country=country, page=page, app_id=app_id)
        entries = None

        for attempt in range(_MAX_RETRY_PER_PAGE + 1):
            try:
                resp = requests.get(url, headers=_HEADERS, timeout=15)
                resp.raise_for_status()
                feed = resp.json().get("feed", {})
                entries = feed.get("entry", [])
                break
            except Exception as exc:
                if attempt < _MAX_RETRY_PER_PAGE:
                    time.sleep(2 ** attempt)
                else:
                    _log.warning(f"[apple] 페이지 {page} 수집 실패 (app_id={app_id}): {exc}")

        if entries is None:
            break

        if not entries:
            break

        # Apple RSS가 단일 리뷰일 때 dict로 반환하는 경우 대응
        if isinstance(entries, dict):
            entries = [entries]

        # 첫 entry는 앱 메타이므로 건너뜀
        if page == 1 and entries and "im:name" in entries[0]:
            entries = entries[1:]

        # DEBUG: 첫 페이지 첫 entry 구조 출력
        if page == 1 and entries:
            import json
            _log.warning(f"[apple][DEBUG] entry 샘플: {json.dumps(entries[0], ensure_ascii=False)[:500]}")

        page_new = 0
        for entry in entries:
            rid = _extract_id(entry)
            if rid and rid not in existing_ids:
                review = _normalize_review(entry, rid)
                if review:
                    collected.append(review)
                    existing_ids.add(rid)  # 같은 수집 배치 내 중복 방지
                    page_new += 1

        # 이 페이지에 새 리뷰가 하나도 없으면 조기 종료
        # existing_ids가 비어도 page_new==0이면 읽을 리뷰가 없는 것
        if page_new == 0:
            break

        # 마지막 페이지까지 소진한 경우 경고
        if page == max_pages:
            _log.warning(
                f"[apple] RSS 최대 페이지({max_pages}페이지, ~{max_pages * 50}개)를 모두 소진했습니다 "
                f"(app_id={app_id}). 수집 빈도 증가를 검토하세요."
            )

        time.sleep(collect_delay())

    return collected


def _extract_id(entry: dict) -> str:
    """Apple RSS entry에서 review ID를 추출. 포맷이 다양해 robust하게 처리."""
    id_node = entry.get("id", {})
    if isinstance(id_node, dict):
        val = id_node.get("label", "")
    else:
        val = str(id_node) if id_node else ""
    return val.strip()


def _extract(entry: dict, *keys, default="") -> str:
    node = entry
    for k in keys:
        if not isinstance(node, dict):
            return default
        node = node.get(k, {})
    return str(node) if node else default


def _normalize_search_result(r: dict) -> dict:
    return {
        "platform": "apple",
        "app_id": str(r.get("trackId", "")),
        "name": r.get("trackName", ""),
        "developer": r.get("artistName", ""),
        "icon_url": r.get("artworkUrl512") or r.get("artworkUrl100", ""),
        "rating": r.get("averageUserRating", 0),
        "review_count": r.get("userRatingCount", 0),
    }


def _normalize_review(entry: dict, rid: str = "") -> Optional[dict]:
    if not rid:
        rid = _extract_id(entry)
    if not rid:
        return None

    updated = _extract(entry, "updated", "label")
    try:
        reviewed_at = datetime.fromisoformat(updated.replace("Z", "+00:00")).strftime(
            "%Y-%m-%dT%H:%M:%SZ"
        )
    except Exception:
        reviewed_at = updated

    try:
        rating = int(_extract(entry, "im:rating", "label", "0"))
    except ValueError:
        rating = 0

    return {
        "review_id": rid,
        "rating": rating,
        "title": _extract(entry, "title", "label"),
        "content": _extract(entry, "content", "label"),
        "app_version": _extract(entry, "im:version", "label"),
        "reviewed_at": reviewed_at,
    }
