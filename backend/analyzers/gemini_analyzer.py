"""
Gemini AI 분석 엔진
이벤트 기반 트리거에서만 호출됨 (모든 버전 분석 X)
"""
import json
import re
from datetime import datetime, timezone

from google import genai
from google.genai import types

from backend.config import get_env, ai_model


def _client() -> genai.Client:
    return genai.Client(api_key=get_env("GEMINI_API_KEY", required=True))


def analyze(
    google_reviews: list[dict],
    apple_reviews: list[dict],
    trigger_type: str,
    period_label: str,
) -> dict:
    """
    리뷰 샘플을 받아 AI 분석을 수행한다.
    Returns: 분석 결과 dict
    """
    g_count = len(google_reviews)
    a_count = len(apple_reviews)

    if g_count == 0 and a_count == 0:
        raise ValueError("분석할 리뷰가 없습니다.")

    prompt = _build_prompt(google_reviews, apple_reviews, period_label)
    raw = _call_gemini(prompt)
    result = _parse_response(raw)

    result["trigger_type"] = trigger_type
    result["period_label"] = period_label
    result["sample_count_google"] = g_count
    result["sample_count_apple"] = a_count
    result["created_at"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    return result


def _build_prompt(google_reviews: list[dict], apple_reviews: list[dict], period_label: str) -> str:
    def fmt_review(r: dict, platform: str) -> str:
        rating = r.get("rating", "?")
        content = (r.get("content") or "").strip()[:300]
        ver = r.get("app_version", "")
        title = r.get("title", "")
        if title:
            content = f"[{title}] {content}"
        return f"  [{platform} ★{rating}] {content} (v{ver})" if ver else f"  [{platform} ★{rating}] {content}"

    g_lines = [fmt_review(r, "Google") for r in google_reviews]
    a_lines = [fmt_review(r, "Apple") for r in apple_reviews]
    all_reviews = "\n".join(g_lines + a_lines)

    return f"""당신은 모바일 게임 리뷰 분석 전문가입니다.
아래는 [{period_label}] 기간의 실제 사용자 리뷰 샘플입니다.
(Google Play {len(google_reviews)}개 + App Store {len(apple_reviews)}개)

{all_reviews}

위 리뷰를 분석하여 다음 JSON 형식으로 정확하게 응답하세요.
반드시 JSON만 출력하고, 마크다운 코드블록 없이 순수 JSON으로만 응답하세요.

{{
  "overall_summary": "한 문장으로 이 기간의 핵심 상황 (100자 이내)",
  "main_complaints": ["불만 1 (30자 이내)", "불만 2", "불만 3"],
  "main_praises": ["칭찬 1 (30자 이내)", "칭찬 2", "칭찬 3"],
  "google_sentiment": 정수 0~100 (구글 긍정도),
  "apple_sentiment": 정수 0~100 (애플 긍정도, 리뷰 없으면 null),
  "keywords_google": ["키워드1", "키워드2", "키워드3", "키워드4", "키워드5"],
  "keywords_apple": ["키워드1", "키워드2", "키워드3", "키워드4", "키워드5"],
  "platform_diff": "구글과 애플 반응의 주요 차이점 (없으면 빈 문자열)"
}}"""


def _call_gemini(prompt: str) -> str:
    client = _client()
    response = client.models.generate_content(
        model=ai_model(),
        contents=prompt,
        config=types.GenerateContentConfig(
            temperature=0.3,
            max_output_tokens=1024,
        ),
    )
    return response.text or ""


def _parse_response(raw: str) -> dict:
    text = raw.strip()
    # 마크다운 코드블록 제거
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"\s*```$", "", text, flags=re.MULTILINE)

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # JSON 부분만 추출 시도
        match = re.search(r"\{[\s\S]+\}", text)
        if match:
            return json.loads(match.group())
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
