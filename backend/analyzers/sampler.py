"""
분석용 리뷰 샘플링
- 20자 미만 단순 리뷰 제외
- 평점 분포 균형 유지 (저평점 40% / 고평점 40% / 중간 20%)
- thumbs_up 가중치 적용 (Google)
- 최신 우선
"""
import random
from datetime import date as _date
from backend.config import sample_google_count, sample_apple_count


def _filter_reviews(reviews: list[dict]) -> list[dict]:
    """20자 미만 내용 제거."""
    return [r for r in reviews if len((r.get("content") or "").strip()) >= 20]


def _weighted_sample(reviews: list[dict], target: int) -> list[dict]:
    """
    평점 분포를 균형 있게 유지하면서 target개 샘플링.
    저평점(1-2★): 40%, 고평점(4-5★): 40%, 중간(3★): 20%
    thumbs_up이 있으면 같은 그룹 내에서 우선 선택.
    """
    if not reviews or target <= 0:
        return []

    if len(reviews) <= target:
        return sorted(reviews, key=lambda r: r.get("reviewed_at", ""), reverse=True)

    low = [r for r in reviews if int(r.get("rating", 3)) <= 2]
    mid = [r for r in reviews if int(r.get("rating", 3)) == 3]
    high = [r for r in reviews if int(r.get("rating", 3)) >= 4]

    n_low = int(target * 0.4)
    n_high = int(target * 0.4)
    n_mid = target - n_low - n_high

    def pick(pool: list[dict], n: int) -> list[dict]:
        if not pool:
            return []
        sorted_pool = sorted(pool, key=lambda r: (r.get("thumbs_up") or 0), reverse=True)
        priority = sorted_pool[:max(1, len(sorted_pool) // 2)]
        rest = sorted_pool[max(1, len(sorted_pool) // 2):]
        if len(priority) >= n:
            return priority[:n]
        remaining = n - len(priority)
        extra = random.sample(rest, min(remaining, len(rest)))
        return priority + extra

    sampled = pick(low, n_low) + pick(mid, n_mid) + pick(high, n_high)

    sampled_ids = {id(r) for r in sampled}
    leftovers = [r for r in reviews if id(r) not in sampled_ids]
    if len(sampled) < target and leftovers:
        extra = random.sample(leftovers, min(target - len(sampled), len(leftovers)))
        sampled += extra

    return sampled


def calc_sentiment(reviews: list[dict]) -> int | None:
    """
    실제 평점 분포 기반 긍정도 (0-100). AI 추측 대신 하드 데이터 사용.
    5★=1.0 / 4★=0.75 / 3★=0.5 / 2★=0.25 / 1★=0.0 가중 평균.
    """
    if not reviews:
        return None
    weights = {5: 1.0, 4: 0.75, 3: 0.5, 2: 0.25, 1: 0.0}
    total = sum(weights.get(int(r.get("rating", 3)), 0.5) for r in reviews)
    return round(total / len(reviews) * 100)


def sample_for_analysis(
    google_reviews: list[dict],
    apple_reviews: list[dict],
) -> tuple[list[dict], list[dict], str, str]:
    """
    전체 수집 리뷰에서 평점 분포 균형 샘플 추출.
    Returns: (g_sample, a_sample, sample_date_min, sample_date_max)
    """
    google_reviews = _filter_reviews(google_reviews)
    apple_reviews = _filter_reviews(apple_reviews)

    g_sample = _weighted_sample(google_reviews, sample_google_count())
    a_sample = _weighted_sample(apple_reviews, sample_apple_count())

    all_dates = [
        r.get("reviewed_at", "")
        for r in g_sample + a_sample
        if r.get("reviewed_at", "")
    ]
    date_min = min(all_dates)[:10] if all_dates else ""
    date_max = max(all_dates)[:10] if all_dates else ""

    return g_sample, a_sample, date_min, date_max


def get_apple_date_range(apple_reviews: list[dict]) -> tuple[str, str]:
    """Apple 리뷰의 날짜 범위 반환."""
    dates = [r.get("reviewed_at", "")[:10] for r in apple_reviews if r.get("reviewed_at", "")]
    if not dates:
        return "", ""
    return min(dates), max(dates)


def sample_platform_comparison(
    google_reviews: list[dict],
    apple_reviews: list[dict],
) -> tuple[list[dict], str, str]:
    """
    Apple과 동기간 Google 리뷰 샘플링 (플랫폼 비교용).
    App Store는 최근 ~500개만 수집되므로, Google도 같은 기간으로 제한해야 공정한 비교가 가능.
    Returns: (same_period_google_sample, apple_date_from, apple_date_to)
    """
    apple_date_from, apple_date_to = get_apple_date_range(apple_reviews)
    if not apple_date_from:
        return [], "", ""

    filtered_google = _filter_reviews(google_reviews)
    same_period = [
        r for r in filtered_google
        if apple_date_from <= (r.get("reviewed_at", "") or "")[:10] <= apple_date_to
    ]
    sample = _weighted_sample(same_period, sample_google_count())
    return sample, apple_date_from, apple_date_to


_PHASE_MIN_REVIEWS = 30   # 단계당 최소 리뷰 수. 미달 시 해당 단계 분석 스킵.
_PHASE_LAUNCH_DAYS = 30   # 출시 초반: 0~30일
_PHASE_GROWTH_DAYS = 180  # 성장기: 31~180일 / 안정기: 181일+


def sample_phases(
    google_reviews: list[dict],
    release_date: str,
    max_per_phase: int = 40,
) -> dict[str, dict]:
    """
    출시일 기준 Google 리뷰 3단계 분할 샘플링.
    - 출시 초반: 0~30일
    - 성장기: 31~180일
    - 안정기: 181일+
    각 단계 30건 미만이면 스킵 (의미 없는 분석 방지).
    Returns: {
      "launch": {"reviews": [...], "count": N, "date_from": str, "date_to": str},
      "growth": {...},
      "stable": {...},
    }
    """
    if not release_date:
        return {}

    try:
        release = _date.fromisoformat(release_date[:10])
    except ValueError:
        return {}

    filtered = _filter_reviews(google_reviews)
    buckets: dict[str, list[dict]] = {"launch": [], "growth": [], "stable": []}

    for r in filtered:
        rv_str = (r.get("reviewed_at", "") or "")[:10]
        if not rv_str:
            continue
        try:
            rv_date = _date.fromisoformat(rv_str)
        except ValueError:
            continue
        days = (rv_date - release).days
        if days < 0:
            continue
        elif days <= _PHASE_LAUNCH_DAYS:
            buckets["launch"].append(r)
        elif days <= _PHASE_GROWTH_DAYS:
            buckets["growth"].append(r)
        else:
            buckets["stable"].append(r)

    result = {}
    for phase, reviews in buckets.items():
        if len(reviews) < _PHASE_MIN_REVIEWS:
            continue  # 데이터 부족 — 스킵
        dates = [r.get("reviewed_at", "")[:10] for r in reviews if r.get("reviewed_at", "")]
        result[phase] = {
            "reviews": _weighted_sample(reviews, max_per_phase),
            "count": len(reviews),
            "date_from": min(dates)[:10] if dates else "",
            "date_to": max(dates)[:10] if dates else "",
        }
    return result
