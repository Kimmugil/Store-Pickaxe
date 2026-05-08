"""
Gemini AI 분석 엔진 — 3개 독립 호출 구조

Call #1 (summary): 종합 요약 / 주요 불만·칭찬 / 키워드
  - 샘플: Google 전체 비례 샘플 + Apple 전체 비례 샘플
Call #2 (platform): 플랫폼 간 주요 이슈
  - 샘플: Apple 수집기간 내 동기간 Google + Apple 비교 샘플
Call #3 (phases): 시기별 트렌드 (Google 전용)
  - 샘플: 시기별 독립 샘플 (출시초반 / 성장기 / 안정기 각각)
  - 컨텍스트: 시기별 avg_rating, 긍정률 포함 (개선B)

sentiment(긍정도)는 AI에게 묻지 않고 실제 평점 분포에서 계산 (sampler.calc_sentiment).
"""
import json
import logging
import time
from datetime import datetime, timezone

from google import genai
from google.genai import types

from backend.config import get_env, ai_model

log = logging.getLogger(__name__)

_RETRY_DELAYS = (5, 15, 45)


def _client() -> genai.Client:
    return genai.Client(api_key=get_env("GEMINI_API_KEY", required=True))


def analyze(
    google_reviews: list[dict],
    apple_reviews: list[dict],
    mode: str,
    review_scope: str,
    same_period_google: list[dict] | None = None,
    phases: dict | None = None,
    release_date: str = "",
) -> dict:
    """
    3개의 독립 Gemini 호출로 분석 실행 후 결과 병합.
    Args:
        google_reviews: 종합 요약/불만/칭찬/키워드용 전체 Google 샘플
        apple_reviews:  종합 요약/불만/칭찬/키워드용 전체 Apple 샘플
        same_period_google: 플랫폼 비교용 동기간 Google 샘플
        phases: 시기별 분석 데이터 {"launch": {reviews, count, ...}, ...}
        release_date: 출시일 (YYYY-MM-DD)
    Returns:
        dict — sentiment 필드 없음 (caller가 calc_sentiment로 직접 계산해서 주입)
    """
    g_count = len(google_reviews)
    a_count = len(apple_reviews)

    if g_count == 0 and a_count == 0:
        raise ValueError("분석할 리뷰가 없습니다.")

    # Call #1: 종합 요약
    summary_result = _analyze_summary(google_reviews, apple_reviews, review_scope)

    # Call #2: 플랫폼 비교 (동기간 샘플이 있을 때만)
    sp = same_period_google or []
    platform_result = _analyze_platform(sp, apple_reviews) if (sp and apple_reviews) else {}

    # Call #3: 시기별 트렌드 (phases 데이터가 있을 때만)
    phase_result = _analyze_phases(phases, release_date) if phases else {}

    # ── 결과 병합 ────────────────────────────────────────────
    result: dict = {**summary_result}
    result["mode"] = mode
    result["review_scope"] = review_scope
    result["sample_count_google"] = g_count
    result["sample_count_apple"] = a_count
    result["created_at"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    # platform_diff 구조화
    g_diff = platform_result.get("platform_diff_google") or []
    a_diff = platform_result.get("platform_diff_apple") or []
    if g_diff or a_diff:
        result["platform_diff"] = json.dumps(
            {"google_specific": g_diff, "apple_specific": a_diff},
            ensure_ascii=False,
        )
    else:
        result["platform_diff"] = ""

    # 시기별 결과에 count/date/sentiment/avg_rating/keywords 메타데이터 병합
    for phase_key in ("launch", "growth", "stable"):
        field = f"google_phase_{phase_key}"
        phase_meta = (phases or {}).get(phase_key, {})
        gemini_val = phase_result.get(field)
        if gemini_val and phase_meta:
            if isinstance(gemini_val, dict):
                summary = gemini_val.get("summary", "")
                keywords = gemini_val.get("keywords", [])
            else:
                summary = str(gemini_val)
                keywords = []
            result[field] = json.dumps({
                "summary": summary,
                "count": phase_meta.get("count", 0),
                "date_from": phase_meta.get("date_from", ""),
                "date_to": phase_meta.get("date_to", ""),
                "sentiment": phase_meta.get("sentiment"),
                "avg_rating": phase_meta.get("avg_rating"),
                "keywords": keywords,
            }, ensure_ascii=False)
        else:
            result[field] = ""

    return result


# ── Call #1: 종합 요약 ────────────────────────────────────────────

def _analyze_summary(
    google_reviews: list[dict],
    apple_reviews: list[dict],
    review_scope: str,
) -> dict:
    g_lines = [_fmt_review(r, "Google") for r in google_reviews]
    a_lines = [_fmt_review(r, "Apple") for r in apple_reviews]
    all_reviews = "\n".join(g_lines + a_lines)

    prompt = f"""당신은 모바일 게임 리뷰 분석 전문가입니다. 한국어로 응답하세요.

## 분석 대상 리뷰 [{review_scope}] (Google {len(google_reviews)}개 + Apple {len(apple_reviews)}개)
(종합 요약 · 주요 불만/칭찬 · 키워드 분석 기반)
{all_reviews}

위 데이터를 분석하여 다음 JSON 형식으로 정확하게 응답하세요:

{{
  "overall_summary": "긍정과 부정을 균형있게 담은 전체 유저 반응 요약 (100자 이내). 반드시 칭찬 포인트와 불만 포인트를 모두 포함할 것. 예시: '전투 시스템과 그래픽은 호평이나, 과금 구조와 잦은 오류로 장기 유저 이탈 증가'",
  "main_complaints": [
    {{"title": "주요 불만 주제 (20자 이내)", "description": "이 불만에 대한 구체적 설명. 어떤 유저들이 왜 불편해하는지 (60자 이내)"}},
    {{"title": "주요 불만 주제 2", "description": "설명 2"}},
    {{"title": "주요 불만 주제 3", "description": "설명 3"}}
  ],
  "main_praises": [
    {{"title": "주요 칭찬 주제 (20자 이내)", "description": "이 칭찬에 대한 구체적 설명. 어떤 점이 왜 좋다고 하는지 (60자 이내)"}},
    {{"title": "주요 칭찬 주제 2", "description": "설명 2"}},
    {{"title": "주요 칭찬 주제 3", "description": "설명 3"}}
  ],
  "keywords_google": ["불만·칭찬을 대표하는 구체적 이슈 토픽 5개. '게임'·'재미'·'레벨' 같은 일반 단어 제외. 예: '과금유도', '서버불안정', '밸런스붕괴'"],
  "keywords_apple": ["동일 기준, App Store 리뷰 기반 5개"]
}}"""

    return _call_gemini(prompt)


# ── Call #2: 플랫폼 비교 ─────────────────────────────────────────

def _analyze_platform(
    same_period_google: list[dict],
    apple_reviews: list[dict],
) -> dict:
    sp_lines = [_fmt_review(r, "Google") for r in same_period_google]
    a_lines = [_fmt_review(r, "Apple") for r in apple_reviews]
    all_lines = "\n".join(sp_lines + a_lines)

    prompt = f"""당신은 모바일 게임 리뷰 분석 전문가입니다. 한국어로 응답하세요.

## 동기간 플랫폼 비교 리뷰 (Google {len(same_period_google)}개 + Apple {len(apple_reviews)}개)
※ App Store는 최근 약 500건만 수집 가능합니다. Apple 수집 기간과 동일한 Google Play 리뷰만 사용합니다.
{all_lines}

위 데이터를 분석하여 플랫폼별 고유 이슈를 다음 JSON 형식으로 응답하세요:

{{
  "platform_diff_google": [{{"title": "Google Play 고유 이슈 (15자 이내)", "description": "구체적 설명 (40자 이내)"}}, ...],
  "platform_diff_apple": [{{"title": "App Store 고유 이슈 (15자 이내)", "description": "구체적 설명 (40자 이내)"}}, ...]
}}
(각 2~3개, 없으면 [])"""

    return _call_gemini(prompt)


# ── Call #3: 시기별 트렌드 ───────────────────────────────────────

def _analyze_phases(
    phases: dict,
    release_date: str,
) -> dict:
    phase_labels = {
        "launch": "출시 초반 (0~30일)",
        "growth": "성장기 (31~180일)",
        "stable": "안정기 (181일+)",
    }

    present_phases = set()
    phase_sections = []

    for pk, label in phase_labels.items():
        pd = phases.get(pk)
        if not pd:
            continue
        present_phases.add(pk)
        avg_r = pd.get("avg_rating")
        sentiment = pd.get("sentiment")
        meta_parts = [f"{pd['count']}건", f"{pd['date_from']} ~ {pd['date_to']}"]
        if avg_r is not None:
            meta_parts.append(f"평균 ★{avg_r:.2f}")
        if sentiment is not None:
            meta_parts.append(f"긍정률 {sentiment}%")
        lines = [_fmt_review(r, "Google") for r in pd["reviews"]]
        phase_sections.append(
            f"### {label} ({', '.join(meta_parts)})\n" + "\n".join(lines)
        )

    if not phase_sections:
        return {"google_phase_launch": None, "google_phase_growth": None, "google_phase_stable": None}

    # JSON 응답 템플릿 — 데이터 없는 시기는 null
    json_fields = []
    for pk in ("launch", "growth", "stable"):
        if pk in present_phases:
            json_fields.append(
                f'  "google_phase_{pk}": {{"summary": "이 시기 핵심 트렌드 한 줄", "keywords": ["대표 이슈/키워드 5개"]}}'
            )
        else:
            json_fields.append(f'  "google_phase_{pk}": null')

    json_template = "{\n" + ",\n".join(json_fields) + "\n}"

    prompt = f"""당신은 모바일 게임 리뷰 분석 전문가입니다. 한국어로 응답하세요.

## Google Play 시기별 리뷰 (출시일: {release_date})
각 시기의 평균 평점과 긍정률이 헤더에 표시됩니다. 이를 참고하여 해당 시기 유저 반응 트렌드를 분석하세요.

{chr(10).join(phase_sections)}

위 시기별 리뷰를 분석하여 다음 JSON 형식으로 응답하세요:

{json_template}"""

    return _call_gemini(prompt)


# ── 공통 유틸 ────────────────────────────────────────────────────

def _fmt_review(r: dict, platform: str) -> str:
    rating = r.get("rating", "?")
    content = (r.get("content") or "").strip()[:350]
    title = r.get("title", "")
    if title:
        content = f"[{title}] {content}"
    date = (r.get("reviewed_at", "") or "")[:10]
    suffix = f" ({date})" if date else ""
    return f"  [{platform} ★{rating}]{suffix} {content}"


def _call_gemini(prompt: str) -> dict:
    client = _client()
    last_exc: Exception | None = None

    for attempt, delay in enumerate((*_RETRY_DELAYS, None), start=1):
        try:
            response = client.models.generate_content(
                model=ai_model(),
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.3,
                    max_output_tokens=8192,
                    response_mime_type="application/json",
                ),
            )
            text = response.text or ""
            return json.loads(text)
        except json.JSONDecodeError as exc:
            log.error(f"Gemini JSON 파싱 실패: {text[:500]}")
            raise RuntimeError(f"Gemini 응답 파싱 실패: {exc}") from exc
        except Exception as exc:
            last_exc = exc
            exc_str = str(exc)
            is_retryable = any(code in exc_str for code in ("429", "503", "quota", "RESOURCE_EXHAUSTED"))
            if is_retryable and delay is not None:
                log.warning(f"Gemini 오류 (시도 {attempt}/4): {exc_str[:100]} — {delay}초 후 재시도")
                time.sleep(delay)
            else:
                raise

    raise RuntimeError(f"Gemini API 4회 모두 실패: {last_exc}")
