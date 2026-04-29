"""
리뷰 기반 월간 긍정률 집계
rating >= 4 → 긍정으로 분류 (Steam의 voted_up=True 에 대응)
"""
from datetime import date

MIN_REVIEWS_FOR_RATE = 3  # 월별 최소 리뷰 수 (미달 시 해당 월 제외)


def calc_monthly_positive_rates(
    google_reviews: list[dict],
    apple_reviews: list[dict],
) -> list[dict]:
    """
    월별 긍정률 계산.
    Returns: [{"year_month": "2025-04", "google_positive_rate": 72.5, ...}, ...]
    """
    g_by_month: dict[str, list[bool]] = {}
    a_by_month: dict[str, list[bool]] = {}

    for r in google_reviews:
        ym = _ym(r.get("reviewed_at", ""))
        if ym:
            g_by_month.setdefault(ym, []).append(_is_positive(r.get("rating")))

    for r in apple_reviews:
        ym = _ym(r.get("reviewed_at", ""))
        if ym:
            a_by_month.setdefault(ym, []).append(_is_positive(r.get("rating")))

    all_months = sorted(set(g_by_month) | set(a_by_month))

    result = []
    for ym in all_months:
        g_list = g_by_month.get(ym, [])
        a_list = a_by_month.get(ym, [])

        g_rate = _rate(g_list) if len(g_list) >= MIN_REVIEWS_FOR_RATE else None
        a_rate = _rate(a_list) if len(a_list) >= MIN_REVIEWS_FOR_RATE else None

        if g_rate is None and a_rate is None:
            continue

        result.append({
            "year_month": ym,
            "google_positive_rate": g_rate,
            "apple_positive_rate": a_rate,
            "review_count_google": len(g_list),
            "review_count_apple": len(a_list),
        })

    return result


def reviews_in_quarter(reviews: list[dict], year: int, quarter: int) -> list[dict]:
    """분기에 해당하는 리뷰 필터링."""
    months = _quarter_months(quarter)
    prefix_set = {f"{year}-{m:02d}" for m in months}
    return [r for r in reviews if _ym(r.get("reviewed_at", "")) in prefix_set]


def prev_quarter(year: int, month: int) -> tuple[int, int]:
    """현재 월 기준 이전 분기 (year, quarter) 반환."""
    current_q = (month - 1) // 3 + 1
    if current_q == 1:
        return year - 1, 4
    return year, current_q - 1


def quarter_label(year: int, quarter: int) -> str:
    return f"{year}-Q{quarter}"


def _ym(date_str: str) -> str:
    """ISO datetime 또는 date 문자열에서 'YYYY-MM' 추출."""
    if not date_str or len(date_str) < 7:
        return ""
    return date_str[:7]


def _is_positive(rating) -> bool:
    try:
        return int(rating) >= 4
    except (TypeError, ValueError):
        return False


def _rate(bools: list[bool]) -> float:
    if not bools:
        return 0.0
    return round(sum(bools) / len(bools) * 100, 1)


def _quarter_months(quarter: int) -> list[int]:
    return [quarter * 3 - 2, quarter * 3 - 1, quarter * 3]
