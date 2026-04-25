"""
리뷰 샘플링
최신 60% + 무작위 40% 혼합 방식
"""
import random
from backend.config import sample_google_count, sample_apple_count


def sample_reviews(reviews: list[dict], target: int) -> list[dict]:
    """
    reviews를 최신순으로 정렬 후 target 개수만큼 샘플링.
    최신 60% + 나머지 중 무작위 40%.
    """
    if not reviews:
        return []

    sorted_reviews = sorted(
        reviews,
        key=lambda r: r.get("reviewed_at", ""),
        reverse=True,
    )

    if len(sorted_reviews) <= target:
        return sorted_reviews

    recent_n = int(target * 0.6)
    random_n = target - recent_n

    recent = sorted_reviews[:recent_n]
    remaining = sorted_reviews[recent_n:]
    random_pick = random.sample(remaining, min(random_n, len(remaining)))

    return recent + random_pick


def sample_for_analysis(
    google_reviews: list[dict],
    apple_reviews: list[dict],
    period_filter_fn=None,
) -> tuple[list[dict], list[dict]]:
    """
    분석용 샘플 추출.
    period_filter_fn: lambda review -> bool (해당 기간 필터, None이면 전체)
    Returns: (google_sample, apple_sample)
    """
    if period_filter_fn:
        google_reviews = [r for r in google_reviews if period_filter_fn(r)]
        apple_reviews = [r for r in apple_reviews if period_filter_fn(r)]

    g_sample = sample_reviews(google_reviews, sample_google_count())
    a_sample = sample_reviews(apple_reviews, sample_apple_count())

    return g_sample, a_sample


def reviews_for_version(reviews: list[dict], version: str) -> list[dict]:
    """특정 버전 리뷰만 필터링."""
    return [r for r in reviews if r.get("app_version", "") == version]


def reviews_in_date_range(reviews: list[dict], start: str, end: str) -> list[dict]:
    """날짜 범위 필터 (ISO 문자열 비교)."""
    return [r for r in reviews if start <= r.get("reviewed_at", "") <= end]
