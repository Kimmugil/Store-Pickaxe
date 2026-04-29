"""
애플 앱스토어 수집기

수집 전략 (우선순위 순):
1. AMP API (amp-api.apps.apple.com) — Playwright로 Bearer 토큰 추출 후 공식 API 호출
   - 가장 안정적. 최대 500개 수집.
2. RSS 폴백 (itunes.apple.com/rss) — Playwright 없거나 AMP 실패 시
   - Apple CDN 상태에 따라 불안정. 최대 500개.
"""
import time
import logging as _logging
import requests
from datetime import datetime, timezone
from typing import Optional

from backend.config import collect_delay

_SEARCH_URL  = "https://itunes.apple.com/search"
_LOOKUP_URL  = "https://itunes.apple.com/lookup"
_RSS_URL     = "https://itunes.apple.com/{country}/rss/customerreviews/page={page}/id={app_id}/sortby=mostrecent/json"
_AMP_REVIEWS = "https://amp-api.apps.apple.com/v1/catalog/{country}/apps/{app_id}/reviews"

_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)
_HEADERS = {"User-Agent": _UA}

_log = _logging.getLogger(__name__)


# ── 공개 API (평점/검색) ───────────────────────────────────────────

def search_apps(query: str, n: int = 10, country: str = "kr") -> list[dict]:
    params = {"term": query, "entity": "software", "country": country, "limit": n}
    try:
        resp = requests.get(_SEARCH_URL, params=params, headers=_HEADERS, timeout=10)
        resp.raise_for_status()
        return [_normalize_search_result(r) for r in resp.json().get("results", [])]
    except Exception:
        return []


def get_app_detail(app_id: str, country: str = "kr") -> Optional[dict]:
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
    detail = get_app_detail(app_id, country=country)
    if detail:
        return {
            "rating": detail["rating"],
            "review_count": detail["review_count"],
            "version": detail["current_version"],
        }
    return {"rating": None, "review_count": None, "version": None}


# ── 리뷰 수집 진입점 ──────────────────────────────────────────────

def collect_reviews(
    app_id: str,
    existing_ids: set[str],
    max_reviews: int = 500,
    country: str = "kr",
) -> list[dict]:
    """
    AMP API(Playwright 토큰) → RSS 순서로 시도.
    existing_ids에 없는 신규 리뷰만 반환.
    """
    # 1차: AMP API
    token = _get_amp_token(app_id, country)
    if token:
        result = _collect_via_amp(app_id, existing_ids, token, max_reviews, country)
        if result or len(existing_ids) > 0:
            # 수집 성공 or 기존 리뷰 있어서 정상 종료
            return result
        _log.warning(f"[apple] AMP API 결과 0개 — RSS로 폴백 (app_id={app_id})")

    # 2차: RSS 폴백
    return _collect_via_rss(app_id, existing_ids, max_pages=10, country=country)


# ── AMP API (Playwright 토큰) ──────────────────────────────────────

def _get_amp_token(app_id: str, country: str = "kr") -> str:
    """
    Playwright로 App Store 페이지를 열어 AMP API 요청에서 Bearer 토큰 추출.
    playwright 미설치 시 빈 문자열 반환 (RSS 폴백).
    """
    try:
        from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout
    except ImportError:
        _log.info("[apple] playwright 미설치 — RSS 폴백 사용")
        return ""

    token = ""
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True)
            ctx = browser.new_context(user_agent=_UA)
            page = ctx.new_page()

            def _on_request(req):
                nonlocal token
                if token:
                    return
                auth = req.headers.get("authorization", "")
                if auth.startswith("Bearer ") and "amp-api" in req.url:
                    token = auth[7:]
                    _log.info("[apple] Playwright: AMP 토큰 캡처 성공")

            page.on("request", _on_request)
            try:
                page.goto(
                    f"https://apps.apple.com/{country}/app/id{app_id}",
                    wait_until="networkidle",
                    timeout=30_000,
                )
            except PWTimeout:
                pass  # 타임아웃이어도 토큰을 이미 캡처했을 수 있음
            except Exception as e:
                _log.warning(f"[apple] Playwright 페이지 로드 오류: {e}")
            finally:
                browser.close()
    except Exception as e:
        _log.warning(f"[apple] Playwright 토큰 추출 실패: {e}")

    if not token:
        _log.warning(f"[apple] AMP 토큰 미캡처 (app_id={app_id}) — RSS 폴백 사용")
    return token


def _collect_via_amp(
    app_id: str,
    existing_ids: set[str],
    token: str,
    max_reviews: int,
    country: str,
) -> list[dict]:
    """AMP API로 리뷰 수집. offset 기반 페이지네이션."""
    headers = {
        "Authorization": f"Bearer {token}",
        "Origin": "https://apps.apple.com",
        "User-Agent": _UA,
    }
    collected = []
    offset = 0
    limit = 20

    while len(collected) < max_reviews:
        try:
            resp = requests.get(
                _AMP_REVIEWS.format(country=country, app_id=app_id),
                params={"l": "ko", "offset": offset, "limit": limit, "platform": "web"},
                headers=headers,
                timeout=15,
            )
            if resp.status_code == 401:
                _log.warning("[apple] AMP API 401 — 토큰 만료")
                break
            resp.raise_for_status()
        except Exception as e:
            _log.warning(f"[apple] AMP API 오류 (offset={offset}): {e}")
            break

        data = resp.json()
        reviews = data.get("data", [])
        if not reviews:
            break

        page_new = 0
        for r in reviews:
            rid = str(r.get("id", ""))
            if not rid or rid in existing_ids:
                continue
            attr = r.get("attributes", {})
            review = _normalize_amp_review(rid, attr)
            if review:
                collected.append(review)
                existing_ids.add(rid)
                page_new += 1

        _log.info(f"[apple] AMP offset={offset} — 신규 {page_new}개 (누적 {len(collected)}개)")

        if page_new == 0:
            break  # 더 이상 새 리뷰 없음

        # next 링크가 없으면 마지막 페이지
        if not data.get("next"):
            break

        offset += limit
        time.sleep(collect_delay())

    return collected


def _normalize_amp_review(rid: str, attr: dict) -> Optional[dict]:
    raw_date = attr.get("date", "")
    try:
        reviewed_at = datetime.fromisoformat(
            raw_date.replace("Z", "+00:00")
        ).strftime("%Y-%m-%dT%H:%M:%SZ")
    except Exception:
        reviewed_at = raw_date

    return {
        "review_id": rid,
        "rating": int(attr.get("rating", 0)),
        "title": attr.get("title", ""),
        "content": attr.get("body", ""),
        "app_version": attr.get("appVersionString", ""),
        "reviewed_at": reviewed_at,
    }


# ── RSS 폴백 ──────────────────────────────────────────────────────

def _collect_via_rss(
    app_id: str,
    existing_ids: set[str],
    max_pages: int = 10,
    country: str = "kr",
) -> list[dict]:
    collected = []

    for page in range(1, max_pages + 1):
        url = _RSS_URL.format(country=country, page=page, app_id=app_id)
        entries = None

        for attempt in range(3):
            try:
                resp = requests.get(url, headers=_HEADERS, timeout=15)
                resp.raise_for_status()
                entries = resp.json().get("feed", {}).get("entry", [])
                break
            except Exception as exc:
                if attempt < 2:
                    time.sleep(2 ** attempt)
                else:
                    _log.warning(f"[apple:rss] 페이지 {page} 실패 (app_id={app_id}): {exc}")

        if not entries:
            _log.info(f"[apple:rss] 페이지 {page} — entries 없음, 종료")
            break

        if isinstance(entries, dict):
            entries = [entries]

        # 첫 entry는 앱 메타이므로 건너뜀
        if page == 1 and entries and "im:name" in entries[0]:
            entries = entries[1:]

        _log.info(f"[apple:rss] 페이지 {page} — {len(entries)}개")

        page_new = 0
        for entry in entries:
            rid = _extract_id(entry)
            if not rid or rid in existing_ids:
                continue
            review = _normalize_rss_review(entry, rid)
            if review:
                collected.append(review)
                existing_ids.add(rid)
                page_new += 1

        if page_new == 0:
            break

        time.sleep(collect_delay())

    return collected


# ── RSS 파싱 헬퍼 ─────────────────────────────────────────────────

def _extract_id(entry: dict) -> str:
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


def _normalize_rss_review(entry: dict, rid: str = "") -> Optional[dict]:
    if not rid:
        rid = _extract_id(entry)
    if not rid:
        return None

    updated = _extract(entry, "updated", "label")
    try:
        reviewed_at = datetime.fromisoformat(
            updated.replace("Z", "+00:00")
        ).strftime("%Y-%m-%dT%H:%M:%SZ")
    except Exception:
        reviewed_at = updated

    try:
        rating = int(_extract(entry, "im:rating", "label") or "0")
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
