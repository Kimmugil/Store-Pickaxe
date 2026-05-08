"""
Gemini AI 분석 엔진
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
        google_reviews: 전체 Google 샘플 (긍정도/키워드/종합 요약 기반)
        apple_reviews:  전체 Apple 샘플
        same_period_google: Apple과 동기간 Google 샘플 (platform_diff 기반)
        phases: {"launch": {reviews, count, date_from, date_to}, ...} (시기별 분석)
        release_date: 출시일 (YYYY-MM-DD)
    """
    g_count = len(google_reviews)
    a_count = len(apple_reviews)

    if g_count == 0 and a_count == 0:
        raise ValueError("분석할 리뷰가 없습니다.")

    prompt = _build_prompt(google_reviews, apple_reviews, review_scope,
                           same_period_google or [], phases or {}, release_date)
    result = _call_gemini(prompt)

    result["mode"] = mode
    result["review_scope"] = review_scope
    result["sample_count_google"] = g_count
    result["sample_count_apple"] = a_count
    result["created_at"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    # 시기별 결과에 count/date_from/date_to 메타데이터 병합
    for phase_key in ("launch", "growth", "stable"):
        field = f"google_phase_{phase_key}"
        phase_meta = (phases or {}).get(phase_key, {})
        summary_val = result.get(field)
        if summary_val and phase_meta:
            result[field] = json.dumps({
                "summary": summary_val if isinstance(summary_val, str) else "",
                "count": phase_meta.get("count", 0),
                "date_from": phase_meta.get("date_from", ""),
                "date_to": phase_meta.get("date_to", ""),
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
    ver = r.get("app_version", "")
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
※ App Store는 최근 약 500건만 수집 가능합니다. 공정한 비교를 위해 Apple 수집 기간과 동일한 Google Play 리뷰만 사용합니다.
{chr(10).join(sp_lines)}"""
        platform_diff_instruction = '"platform_diff": "동기간 리뷰 비교 기반 주요 차이점 (한 문단, 없으면 빈 문자열)"'
    else:
        same_period_section = ""
        platform_diff_instruction = '"platform_diff": ""'

    # ── 시기별 분석 섹션 ──
    if has_phases:
        phase_labels = {
            "launch": "출시 초반 (0~90일)",
            "growth": "성장기 (91~365일)",
            "stable": "안정기 (365일+)",
        }
        phase_parts = []
        for pk, label in phase_labels.items():
            pd = phases.get(pk)
            if pd:
                lines = [_fmt_review(r, "Google") for r in pd["reviews"]]
                phase_parts.append(
                    f"### {label} ({pd['count']}건, {pd['date_from']} ~ {pd['date_to']})\n" + "\n".join(lines)
                )
        phases_section = f"""

## Google Play 시기별 리뷰 (출시일: {release_date})
{"(출시 초반/성장기/안정기 순서로 유저 반응이 어떻게 변화했는지 파악하세요.)" if phase_parts else ""}
{chr(10).join(phase_parts)}"""
        phase_instructions = """  "google_phase_launch": "출시 초반 트렌드 한 줄 요약 (데이터 없으면 null)",
  "google_phase_growth": "성장기 트렌드 한 줄 요약 (데이터 없으면 null)",
  "google_phase_stable": "안정기 트렌드 한 줄 요약 (데이터 없으면 null)","""
    else:
        phases_section = ""
        phase_instructions = """  "google_phase_launch": null,
  "google_phase_growth": null,
  "google_phase_stable": null,"""

    return f"""당신은 모바일 게임 리뷰 분석 전문가입니다. 한국어로 응답하세요.

## 전체 리뷰 샘플 [{review_scope}] (Google {len(google_reviews)}개 + Apple {len(apple_reviews)}개)
(이 섹션을 기반으로 overall_summary, main_complaints, main_praises, 긍정도, 키워드를 분석합니다.)
{all_reviews}{same_period_section}{phases_section}

위 데이터를 분석하여 다음 JSON 형식으로 정확하게 응답하세요:

{{
  "overall_summary": "전체 리뷰 기반 핵심 상황 (100자 이내)",
  "main_complaints": ["주요 불만 1 (30자 이내)", "주요 불만 2", "주요 불만 3"],
  "main_praises": ["주요 칭찬 1 (30자 이내)", "주요 칭찬 2", "주요 칭찬 3"],
  "google_sentiment": 정수 0~100 (전체 Google 샘플 기반 긍정도, 없으면 null),
  "apple_sentiment": 정수 0~100 (전체 Apple 샘플 기반 긍정도, 없으면 null),
  "keywords_google": ["키워드1", "키워드2", "키워드3", "키워드4", "키워드5"],
  "keywords_apple": ["키워드1", "키워드2", "키워드3", "키워드4", "키워드5"],
  {platform_diff_instruction},
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
            log.error(f"Gemini JSON 파싱 실패 (response_mime_type=json 임에도): {text[:500]}")
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
