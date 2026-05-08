"""
분석용 리뷰 샘플링
- 20자 미만 단순 리뷰 제외
- 평점 분포 균형 유지 (저평점 40% / 고평점 40% / 중간 20%)
- thumbs_up 가중치 적용 (Google)
- 최신 우선
"""
import random
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
        # thumbs_up 내림차순 정렬 후 상위 절반 우선, 나머지 무작위
        sorted_pool = sorted(pool, key=lambda r: (r.get("thumbs_up") or 0), reverse=True)
        priority = sorted_pool[:max(1, len(sorted_pool) // 2)]
        rest = sorted_pool[max(1, len(sorted_pool) // 2):]
        if len(priority) >= n:
            return priority[:n]
        remaining = n - len(priority)
        extra = random.sample(rest, min(remaining, len(rest)))
        return priority + extra

    sampled = pick(low, n_low) + pick(mid, n_mid) + pick(high, n_high)

    # 부족한 경우 남은 리뷰에서 채움
    sampled_ids = {id(r) for r in sampled}
    leftovers = [r for r in reviews if id(r) not in sampled_ids]
    if len(sampled) < target and leftovers:
        extra = random.sample(leftovers, min(target - len(sampled), len(leftovers)))
        sampled += extra

    return sampled


def sample_for_analysis(
    google_reviews: list[dict],
    apple_reviews: list[dict],
) -> tuple[list[dict], list[dict]]:
    """전체 수집 리뷰에서 평점 분포 균형 샘플 추출."""
    google_reviews = _filter_reviews(google_reviews)
    apple_reviews = _filter_reviews(apple_reviews)

    g_sample = _weighted_sample(google_reviews, sample_google_count())
    a_sample = _weighted_sample(apple_reviews, sample_apple_count())

    return g_sample, a_sample
