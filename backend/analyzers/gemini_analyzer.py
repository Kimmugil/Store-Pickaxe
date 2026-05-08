"""
Gemini AI 분석 엔진

sentiment(긍정도)는 AI에게 묻지 않고 실제 평점 분포에서 계산 (sampler.calc_sentiment).
Gemini는 텍스트 해석이 필요한 항목만 담당:
  - overall_summary, main_complaints, main_praises (각 {title, description} 구조)
  - keywords (구체적 이슈 토픽 한정)
  - platform_diff (구조화된 플랫폼별 차이)
  - google_phase_* (시기별 트렌드 요약)
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
    Args:
        google_reviews: 전체 Google 샘플 (종합 요약/불만/칭찬/키워드 기반)
        apple_reviews:  전체 Apple 샘플
        same_period_google: Apple과 동기간 Google 샘플 (platform_diff 기반)
        phases: {"launch": {reviews, count, date_from, date_to, sentiment}, ...} (시기별 분석)
        release_date: 출시일 (YYYY-MM-DD)
    Returns:
        dict — sentiment 필드 없음 (caller가 calc_sentiment로 직접 계산해서 주입)
    """
    g_count = len(google_reviews)
    a_count = len(apple_reviews)

    if g_count == 0 and a_count == 0:
        raise ValueError("분석할 리뷰가 없습니다.")

    prompt = _build_prompt(
        google_reviews, apple_reviews, review_scope,
        same_period_google or [], phases or {}, release_date,
    )
    result = _call_gemini(prompt)

    result["mode"] = mode
    result["review_scope"] = review_scope
    result["sample_count_google"] = g_count
    result["sample_count_apple"] = a_count
    result["created_at"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    # platform_diff 구조화: {google_specific, apple_specific} → JSON 직렬화
    g_diff = result.pop("platform_diff_google", []) or []
    a_diff = result.pop("platform_diff_apple", []) or []
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
        gemini_val = result.get(field)
        if gemini_val and phase_meta:
            # Gemini가 {summary, keywords} 객체 또는 문자열 반환 모두 처리
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
                "sentiment": phase_meta.get("sentiment"),  # 전체 버킷 기반 긍정률
                "avg_rating": phase_meta.get("avg_rating"),  # 전체 버킷 기반 평균 평점
                "keywords": keywords,
            }, ensure_ascii=False)
        else:
            result[field] = ""

    return result


def _fmt_review(r: dict, platform: str) -> str:
    rating = r.get("rating", "?")
    content = (r.get("content") or "").strip()[:350]
    title = r.get("title", "")
    if title:
        content = f"[{title}] {content}"
    date = (r.get("reviewed_at", "") or "")[:10]
    suffix = f" ({date})" if date else ""
    return f"  [{platform} ★{rating}]{suffix} {content}"


def _build_prompt(
    google_reviews: list[dict],
    apple_reviews: list[dict],
    review_scope: str,
    same_period_google: list[dict],
    phases: dict,
    release_date: str,
) -> str:
    g_lines = [_fmt_review(r, "Google") for r in google_reviews]
    a_lines = [_fmt_review(r, "Apple") for r in apple_reviews]
    all_reviews = "\n".join(g_lines + a_lines)

    has_apple = len(apple_reviews) > 0
    has_same_period = len(same_period_google) > 0 and has_apple
    has_phases = bool(phases)

    # ── 동기간 비교 섹션 ──
    if has_same_period:
        sp_lines = [_fmt_review(r, "Google") for r in same_period_google] + a_lines
        same_period_section = f"""

## 동기간 플랫폼 비교 리뷰 (Google {len(same_period_google)}개 + Apple {len(apple_reviews)}개)
※ App Store는 최근 약 500건만 수집 가능합니다. Apple 수집 기간과 동일한 Google Play 리뷰만 사용합니다.
{chr(10).join(sp_lines)}"""
        platform_diff_instruction = '''\
  "platform_diff_google": [{"title": "Google Play 고유 이슈 (15자 이내)", "description": "구체적 설명 (40자 이내)"}, ...],
  "platform_diff_apple": [{"title": "App Store 고유 이슈 (15자 이내)", "description": "구체적 설명 (40자 이내)"}, ...],
  (각 2~3개, 없으면 [])'''
    else:
        same_period_section = ""
        platform_diff_instruction = '''\
  "platform_diff_google": [],
  "platform_diff_apple": [],'''

    # ── 시기별 분석 섹션 ──
    if has_phases:
        phase_labels = {
            "launch": "출시 초반 (0~30일)",
            "growth": "성장기 (31~180일)",
            "stable": "안정기 (181일+)",
        }
        phase_parts = []
        for pk, label in phase_labels.items():
            pd = phases.get(pk)
            if pd:
                lines = [_fmt_review(r, "Google") for r in pd["reviews"]]
                phase_parts.append(
                    f"### {label} ({pd['count']}건, {pd['date_from']} ~ {pd['date_to']})\n"
                    + "\n".join(lines)
                )
        phases_section = (
            f"\n\n## Google Play 시기별 리뷰 (출시일: {release_date})\n"
            + "\n".join(phase_parts)
        )
        phase_instructions = '''\
  "google_phase_launch": {"summary": "출시 초반 핵심 트렌드 한 줄", "keywords": ["이 시기 대표 이슈/키워드 5개"]},
  "google_phase_growth": {"summary": "성장기 핵심 트렌드 한 줄", "keywords": ["이 시기 대표 이슈/키워드 5개"]},
  "google_phase_stable": {"summary": "안정기 핵심 트렌드 한 줄", "keywords": ["이 시기 대표 이슈/키워드 5개"]},
  (데이터 없는 시기는 해당 필드에 null 반환)'''
    else:
        phases_section = ""
        phase_instructions = '''\
  "google_phase_launch": null,
  "google_phase_growth": null,
  "google_phase_stable": null,
'''

    return f"""당신은 모바일 게임 리뷰 분석 전문가입니다. 한국어로 응답하세요.

## 전체 리뷰 샘플 [{review_scope}] (Google {len(google_reviews)}개 + Apple {len(apple_reviews)}개)
(overall_summary, main_complaints, main_praises, keywords 분석 기반)
{all_reviews}{same_period_section}{phases_section}

위 데이터를 분석하여 다음 JSON 형식으로 정확하게 응답하세요:

{{
  "overall_summary": "전체 리뷰 기반 핵심 상황 (100자 이내)",
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
  "keywords_apple": ["동일 기준, App Store 리뷰 기반 5개"],
{platform_diff_instruction}
{phase_instructions}
}}"""


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
