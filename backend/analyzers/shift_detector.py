"""
평점 급변 감지 + 리뷰 급증 감지
Steam-Pickaxe의 알고리즘을 모바일 스토어 특성에 맞게 조정.

[평점 급변 공식]
  - 일별 스냅샷에서 7일 롤링 평균 vs 30일 기준선 비교
  - 변화폭 > threshold AND 해당 기간 리뷰 수 >= min_count → 이벤트 생성

[리뷰 급증 공식]
  - 최근 7일 리뷰 수 > 30일 평균의 surge_multiplier배 → 이벤트 생성

[임계값 — CONFIG에서 덮어씀]
  앱 주간 리뷰 수 기준:
  >= 50 (high)   : ±0.5점, 최소 20개
  10~49 (medium) : ±0.7점, 최소 15개
  < 10  (low)    : ±1.0점, 최소 10개
"""
from datetime import datetime, timedelta, timezone
from collections import defaultdict

from backend.config import shift_threshold, surge_multiplier


def detect_rating_shifts(
    snapshots: list[dict],
    existing_event_dates: set[str],
    velocity_level: str = "medium",
) -> list[dict]:
    """
    스냅샷 목록에서 평점 급변 이벤트를 감지한다.
    Returns: 새 이벤트 dict 목록
    """
    if len(snapshots) < 10:
        return []

    threshold = shift_threshold(velocity_level)
    min_days = {"high": 5, "medium": 5, "low": 3}.get(velocity_level, 5)

    sorted_snaps = sorted(snapshots, key=lambda s: s.get("date", ""))

    events = []

    for i in range(7, len(sorted_snaps)):
        date = sorted_snaps[i]["date"]
        if date in existing_event_dates:
            continue

        window_7 = sorted_snaps[max(0, i - 6): i + 1]
        window_30 = sorted_snaps[max(0, i - 29): i + 1]

        for platform in ("google", "apple"):
            key = f"{platform}_rating"
            vals_7 = [_to_float(s.get(key)) for s in window_7 if s.get(key)]
            vals_30 = [_to_float(s.get(key)) for s in window_30 if s.get(key)]

            if len(vals_7) < min_days or len(vals_30) < 7:
                continue

            avg_7 = sum(vals_7) / len(vals_7)
            avg_30 = sum(vals_30) / len(vals_30)
            delta = avg_7 - avg_30

            if abs(delta) >= threshold:
                before_snap = sorted_snaps[i - 7] if i >= 7 else sorted_snaps[0]
                events.append({
                    "event_date": date,
                    "event_type": "sentiment_shift",
                    "version": sorted_snaps[i].get(f"{platform}_version", ""),
                    f"{platform}_rating_before": _to_float(before_snap.get(key)),
                    f"{platform}_rating_after": _to_float(sorted_snaps[i].get(key)),
                    "review_count": "",
                    "summary": f"{platform} 평점 {'상승' if delta > 0 else '하락'} ({delta:+.2f}점)",
                    "analysis_id": "",
                })
                existing_event_dates.add(date)
                break  # 같은 날짜에 두 플랫폼 동시 등록 방지

    return _deduplicate(events)


def detect_review_surge(
    snapshots: list[dict],
    existing_event_dates: set[str],
) -> list[dict]:
    """
    리뷰 급증 이벤트 감지.
    [공식] 최근 7일 합계 > 30일 평균 × surge_multiplier
    """
    if len(snapshots) < 8:
        return []

    multiplier = surge_multiplier()
    sorted_snaps = sorted(snapshots, key=lambda s: s.get("date", ""))
    events = []

    for i in range(7, len(sorted_snaps)):
        date = sorted_snaps[i]["date"]
        if date in existing_event_dates:
            continue

        for platform in ("google", "apple"):
            count_key = f"{platform}_review_count"
            recent_7 = [_to_int(s.get(count_key)) for s in sorted_snaps[i - 6: i + 1]]
            recent_30 = [_to_int(s.get(count_key)) for s in sorted_snaps[max(0, i - 29): i + 1]]

            if not recent_7 or not recent_30:
                continue

            # 누적 값이므로 일별 증가량으로 변환
            def daily_delta(counts):
                return [max(0, counts[j] - counts[j - 1]) for j in range(1, len(counts))]

            delta_7 = daily_delta(recent_7)
            delta_30 = daily_delta(recent_30)

            if not delta_7 or not delta_30:
                continue

            avg_7 = sum(delta_7) / len(delta_7)
            avg_30 = sum(delta_30) / len(delta_30)

            if avg_30 > 0 and avg_7 >= avg_30 * multiplier:
                events.append({
                    "event_date": date,
                    "event_type": "review_surge",
                    "version": sorted_snaps[i].get(f"{platform}_version", ""),
                    "review_count": int(avg_7),
                    "summary": f"{platform} 리뷰 급증 (평균의 {avg_7 / avg_30:.1f}배)",
                    "analysis_id": "",
                })
                existing_event_dates.add(date)
                break

    return events


def detect_version_change(
    snapshots: list[dict],
    existing_event_dates: set[str],
) -> list[dict]:
    """
    버전 변경 감지.
    스냅샷에서 이전 날짜와 버전이 달라지면 이벤트 생성.
    """
    if len(snapshots) < 2:
        return []

    sorted_snaps = sorted(snapshots, key=lambda s: s.get("date", ""))
    events = []

    for i in range(1, len(sorted_snaps)):
        date = sorted_snaps[i]["date"]
        if date in existing_event_dates:
            continue

        for platform in ("google", "apple"):
            ver_key = f"{platform}_version"
            prev_ver = sorted_snaps[i - 1].get(ver_key, "")
            curr_ver = sorted_snaps[i].get(ver_key, "")

            if prev_ver and curr_ver and prev_ver != curr_ver:
                rating_key = f"{platform}_rating"
                events.append({
                    "event_date": date,
                    "event_type": "version_release",
                    "version": curr_ver,
                    f"{platform}_rating_before": _to_float(sorted_snaps[i - 1].get(rating_key)),
                    f"{platform}_rating_after": _to_float(sorted_snaps[i].get(rating_key)),
                    "review_count": "",
                    "summary": f"{platform} {curr_ver} 출시",
                    "analysis_id": "",
                })
                existing_event_dates.add(date)
                break

    return events


def classify_velocity(avg_weekly_reviews: float) -> str:
    """weekly review count → high | medium | low"""
    if avg_weekly_reviews >= 50:
        return "high"
    if avg_weekly_reviews >= 10:
        return "medium"
    return "low"


def _to_float(val, default: float = 0.0) -> float:
    try:
        return float(val)
    except (TypeError, ValueError):
        return default


def _to_int(val, default: int = 0) -> int:
    try:
        return int(val)
    except (TypeError, ValueError):
        return default


def _deduplicate(events: list[dict]) -> list[dict]:
    seen = set()
    result = []
    for e in events:
        key = (e["event_date"], e["event_type"])
        if key not in seen:
            seen.add(key)
            result.append(e)
    return result
