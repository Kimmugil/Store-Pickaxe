"""
Gemini AI 분석 엔진.
수집된 리뷰 데이터를 바탕으로 앱에 대한 인사이트를 생성합니다.
"""
import json
import re

import google.generativeai as genai

from src.config import get_gemini_api_key

MODEL_NAME = "gemini-2.5-flash"
REVIEW_SAMPLE_SIZE = 150  # 플랫폼당 최대 분석 리뷰 수


def _configure():
    api_key = get_gemini_api_key()
    if not api_key:
        raise RuntimeError("Gemini API 키가 설정되지 않았습니다.")
    genai.configure(api_key=api_key)


def _sample_reviews(reviews: list[dict], n: int) -> list[dict]:
    """최근 리뷰 우선으로 최대 n개를 샘플링합니다."""
    sorted_reviews = sorted(
        reviews,
        key=lambda r: str(r.get("reviewed_at", "")),
        reverse=True,
    )
    return sorted_reviews[:n]


def _format_reviews_for_prompt(reviews: list[dict], platform: str) -> str:
    if not reviews:
        return f"[{platform} 리뷰 없음]"
    lines = []
    for r in reviews:
        rating = r.get("rating", "?")
        content = str(r.get("content", "")).strip()
        version = r.get("app_version", "")
        date = str(r.get("reviewed_at", ""))[:10]
        if content:
            ver_str = f" (v{version})" if version else ""
            lines.append(f"[{rating}점{ver_str} | {date}] {content[:200]}")
    return "\n".join(lines[:REVIEW_SAMPLE_SIZE])


class StoreAnalyzer:
    def __init__(self):
        _configure()
        self._model = genai.GenerativeModel(MODEL_NAME)

    # ------------------------------------------------------------------ #
    #  전체 앱 분석
    # ------------------------------------------------------------------ #

    def analyze_app(
        self,
        app_meta: dict,
        google_reviews: list[dict],
        apple_reviews: list[dict],
    ) -> dict:
        """
        앱 전체 분석을 수행합니다.
        반환: 구조화된 분석 결과 dict
        """
        g_sample = _sample_reviews(google_reviews, REVIEW_SAMPLE_SIZE)
        a_sample = _sample_reviews(apple_reviews, REVIEW_SAMPLE_SIZE)

        g_text = _format_reviews_for_prompt(g_sample, "구글 플레이")
        a_text = _format_reviews_for_prompt(a_sample, "애플 앱스토어")

        app_name = app_meta.get("app_name") or app_meta.get("app_name_en", "앱")

        prompt = f"""
당신은 모바일 게임 사업 PM을 위한 유저 리뷰 분석 전문가입니다.
아래 '{app_name}' 앱의 구글 플레이와 애플 앱스토어 리뷰를 분석하고,
반드시 아래 JSON 형식으로만 응답하세요. JSON 외 다른 텍스트는 포함하지 마세요.

=== 구글 플레이 리뷰 ({len(g_sample)}개 샘플) ===
{g_text}

=== 애플 앱스토어 리뷰 ({len(a_sample)}개 샘플) ===
{a_text}

응답 JSON 형식:
{{
  "overall_summary": "앱 전체에 대한 종합 평가 (3~5문장, 한글)",
  "google_insights": "구글 플레이 리뷰의 주요 특징과 인사이트 (2~4문장, 한글)",
  "apple_insights": "애플 앱스토어 리뷰의 주요 특징과 인사이트 (2~4문장, 한글)",
  "platform_diff": "두 플랫폼 간 주목할 만한 차이점 또는 공통점 (2~3문장, 한글). 특이한 차이가 없으면 빈 문자열.",
  "top_keywords_google": ["구글 키워드1", "키워드2", "키워드3", "키워드4", "키워드5"],
  "top_keywords_apple": ["애플 키워드1", "키워드2", "키워드3", "키워드4", "키워드5"],
  "google_sentiment_score": 구글 긍정도 점수 (0~100 정수, 100이 매우 긍정),
  "apple_sentiment_score": 애플 긍정도 점수 (0~100 정수, 100이 매우 긍정),
  "main_complaints": ["주요 불만 사항1", "불만 사항2", "불만 사항3"],
  "main_praises": ["주요 칭찬 사항1", "칭찬 사항2", "칭찬 사항3"]
}}
"""

        response = self._model.generate_content(prompt)
        raw_text = response.text.strip()

        parsed = self._parse_json_response(raw_text)
        parsed["model_used"] = MODEL_NAME
        parsed["google_review_count"] = len(google_reviews)
        parsed["apple_review_count"] = len(apple_reviews)
        parsed["platforms"] = self._detect_platforms(google_reviews, apple_reviews)
        parsed["raw_json"] = json.dumps(parsed, ensure_ascii=False)

        return parsed

    # ------------------------------------------------------------------ #
    #  버전별 타임라인 요약
    # ------------------------------------------------------------------ #

    def summarize_version(
        self,
        version: str,
        google_reviews: list[dict],
        apple_reviews: list[dict],
    ) -> dict:
        """특정 버전의 리뷰 분위기를 요약합니다."""
        g_sample = _sample_reviews(google_reviews, 80)
        a_sample = _sample_reviews(apple_reviews, 80)

        g_text = _format_reviews_for_prompt(g_sample, "구글")
        a_text = _format_reviews_for_prompt(a_sample, "애플")

        prompt = f"""
버전 {version}에 대한 유저 리뷰를 분석하고 아래 JSON 형식으로만 응답하세요.

구글 리뷰:
{g_text}

애플 리뷰:
{a_text}

{{
  "kr_summary": "이 버전에 대한 유저 반응 한줄 요약 (한글, 30자 이내)",
  "google_sentiment_pct": 구글 긍정 리뷰 비율 (0~100 정수),
  "apple_sentiment_pct": 애플 긍정 리뷰 비율 (0~100 정수),
  "key_issues": ["핵심 이슈1", "이슈2", "이슈3"]
}}
"""
        response = self._model.generate_content(prompt)
        return self._parse_json_response(response.text.strip())

    # ------------------------------------------------------------------ #
    #  내부 헬퍼
    # ------------------------------------------------------------------ #

    def _parse_json_response(self, text: str) -> dict:
        """Gemini 응답에서 JSON을 추출합니다."""
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass
        return {"overall_summary": text, "parse_error": True}

    def _detect_platforms(
        self, google_reviews: list[dict], apple_reviews: list[dict]
    ) -> str:
        has_g = len(google_reviews) > 0
        has_a = len(apple_reviews) > 0
        if has_g and has_a:
            return "both"
        if has_g:
            return "google"
        return "apple"
