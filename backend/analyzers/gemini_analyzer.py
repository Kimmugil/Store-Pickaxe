"""
Gemini AI 분석 엔진
"""
import json
import logging
import re
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
) -> dict:
    """
    리뷰 샘플을 받아 AI 분석을 수행한다.
    mode: 'onboarding' | 'update'
    review_scope: 분석 대상 범위 설명 (예: "전체", "2025-01-01 이후 신규")
    Returns: 분석 결과 dict
    """
    g_count = len(google_reviews)
    a_count = len(apple_reviews)

    if g_count == 0 and a_count == 0:
        raise ValueError("분석할 리뷰가 없습니다.")

    prompt = _build_prompt(google_reviews, apple_reviews, review_scope)
    raw = _call_gemini(prompt)
    result = _parse_response(raw)

    result["mode"] = mode
    result["review_scope"] = review_scope
    result["sample_count_google"] = g_count
    result["sample_count_apple"] = a_count
    result["created_at"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    return result


def _build_prompt(google_reviews: list[dict], apple_reviews: list[dict], review_scope: str) -> str:
    def fmt(r: dict, platform: str) -> str:
        rating = r.get("rating", "?")
        content = (r.get("content") or "").strip()[:400]
        title = r.get("title", "")
        if title:
            content = f"[{title}] {content}"
        ver = r.get("app_version", "")
        suffix = f" (v{ver})" if ver else ""
        return f"  [{platform} ★{rating}] {content}{suffix}"

    lines = [fmt(r, "Google") for r in google_reviews] + [fmt(r, "Apple") for r in apple_reviews]
    all_reviews = "\n".join(lines)

    has_apple = len(apple_reviews) > 0

    platform_diff_instruction = (
        '"platform_diff": "Google Play와 App Store 반응의 주요 차이점 (없으면 빈 문자열)"'
        if has_apple
        else '"platform_diff": ""'
    )

    return f"""당신은 모바일 게임 리뷰 분석 전문가입니다.
아래는 [{review_scope}] 기간의 실제 사용자 리뷰 샘플입니다.
(Google Play {len(google_reviews)}개 + App Store {len(apple_reviews)}개)

{all_reviews}

위 리뷰를 분석하여 다음 JSON 형식으로 정확하게 응답하세요.
반드시 JSON만 출력하고, 마크다운 코드블록 없이 순수 JSON만 응답하세요.

{{
  "overall_summary": "한 문장으로 핵심 상황 요약 (100자 이내)",
  "main_complaints": ["주요 불만 1 (30자 이내)", "주요 불만 2", "주요 불만 3"],
  "main_praises": ["주요 칭찬 1 (30자 이내)", "주요 칭찬 2", "주요 칭찬 3"],
  "google_sentiment": 정수 0~100 (Google 긍정도, 리뷰 없으면 null),
  "apple_sentiment": 정수 0~100 (Apple 긍정도, 리뷰 없으면 null),
  "keywords_google": ["키워드1", "키워드2", "키워드3", "키워드4", "키워드5"],
  "keywords_apple": ["키워드1", "키워드2", "키워드3", "키워드4", "키워드5"],
  {platform_diff_instruction}
}}"""


def _call_gemini(prompt: str) -> str:
    client = _client()
    last_exc: Exception | None = None

    for attempt, delay in enumerate((*_RETRY_DELAYS, None), start=1):
        try:
            response = client.models.generate_content(
                model=ai_model(),
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.3,
                    max_output_tokens=4096,
                ),
            )
            return response.text or ""
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


def _parse_response(raw: str) -> dict:
    text = re.sub(r"^```(?:json)?\s*", "", raw.strip(), flags=re.MULTILINE)
    text = re.sub(r"\s*```$", "", text, flags=re.MULTILINE)

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]+\}", text)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass
        log.error(f"Gemini 응답 파싱 실패: {text[:200]}")
        return {
            "overall_summary": "분석 결과 파싱 실패",
            "main_complaints": [],
            "main_praises": [],
            "google_sentiment": None,
            "apple_sentiment": None,
            "keywords_google": [],
            "keywords_apple": [],
            "platform_diff": "",
        }
