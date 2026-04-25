"""
구글 플레이 ↔ 앱스토어 앱 자동 매칭
rapidfuzz 라이브러리로 문자열 유사도 계산
"""
from rapidfuzz import fuzz


def match_score(google_app: dict, apple_app: dict) -> float:
    """
    두 앱이 같은 앱일 확률을 0~100 점수로 반환.
    - 70점 이상: 매칭 제안
    - 90점 이상: 높은 신뢰도
    """
    g_name = google_app.get("name", "").lower().strip()
    a_name = apple_app.get("name", "").lower().strip()
    g_dev = google_app.get("developer", "").lower().strip()
    a_dev = apple_app.get("developer", "").lower().strip()

    name_score = fuzz.ratio(g_name, a_name) * 0.6
    dev_score = fuzz.ratio(g_dev, a_dev) * 0.4

    return round(name_score + dev_score, 1)


def find_best_match(google_app: dict, apple_apps: list[dict]) -> tuple[dict | None, float]:
    """
    하나의 구글 앱에 대해 애플 앱 목록에서 가장 잘 맞는 앱과 점수를 반환.
    70점 미만이면 (None, 점수)
    """
    if not apple_apps:
        return None, 0.0

    scored = [(a, match_score(google_app, a)) for a in apple_apps]
    best_app, best_score = max(scored, key=lambda x: x[1])

    if best_score >= 70:
        return best_app, best_score
    return None, best_score


def suggest_pairs(google_results: list[dict], apple_results: list[dict]) -> list[dict]:
    """
    검색 결과 두 목록에서 매칭 제안 목록을 생성한다.
    각 항목: {google, apple, score, confidence}
    """
    suggestions = []
    used_apple = set()

    for g in google_results:
        candidates = [a for a in apple_results if a.get("app_id") not in used_apple]
        best, score = find_best_match(g, candidates)
        if best:
            used_apple.add(best.get("app_id", ""))
            suggestions.append({
                "google": g,
                "apple": best,
                "score": score,
                "confidence": _confidence_label(score),
            })

    return suggestions


def _confidence_label(score: float) -> str:
    if score >= 90:
        return "high"
    if score >= 70:
        return "medium"
    return "low"
