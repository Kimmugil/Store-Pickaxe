"""
AI 분석 진입점 — GitHub Actions analyze.yml에서 실행

처리 조건:
- ai_approved = TRUE
- pending_ai_trigger 가 비어있지 않음

트리거 종류별 처리:
- version  : 해당 버전 리뷰 샘플 분석
- shift    : 급변 전후 7일 리뷰 샘플 분석
- surge    : 급증 기간 리뷰 샘플 분석
- manual   : 전체 최신 리뷰 샘플 분석
"""
import os
import sys
import logging
from datetime import datetime, timedelta, timezone

from backend import config as cfg
from backend.sheets import master_sheet as master
from backend.sheets import app_sheet as asheet
from backend.analyzers import sampler
from backend.analyzers import gemini_analyzer as ai

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)

TARGET_APP_KEY = os.getenv("TARGET_APP_KEY", "")


def _period_label_for_trigger(trigger: str, events: list[dict]) -> str:
    if trigger == "version":
        for e in reversed(events):
            if e.get("event_type") == "version_release":
                return e.get("version", "unknown")
        return "latest_version"
    if trigger in ("shift", "surge"):
        for e in reversed(events):
            if e.get("event_type") in ("sentiment_shift", "review_surge"):
                return e.get("event_date", "")[:10]
        return datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _filter_for_trigger(
    trigger: str,
    events: list[dict],
    google_reviews: list[dict],
    apple_reviews: list[dict],
) -> tuple[list[dict], list[dict], str]:
    """트리거 종류에 맞는 리뷰 서브셋과 기간 레이블 반환."""

    if trigger == "version":
        for e in reversed(events):
            if e.get("event_type") == "version_release":
                ver = e.get("version", "")
                if ver:
                    g = sampler.reviews_for_version(google_reviews, ver)
                    a = sampler.reviews_for_version(apple_reviews, ver)
                    return g, a, ver
        # 버전 필터 없으면 최신 30일
        cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%dT%H:%M:%SZ")
        g = [r for r in google_reviews if r.get("reviewed_at", "") >= cutoff]
        a = [r for r in apple_reviews if r.get("reviewed_at", "") >= cutoff]
        return g, a, "recent"

    if trigger in ("shift", "surge"):
        # 이벤트 날짜 기준 전후 7일
        event_date = ""
        for e in reversed(events):
            if e.get("event_type") in ("sentiment_shift", "review_surge"):
                event_date = e.get("event_date", "")
                break
        if event_date:
            start = (datetime.fromisoformat(event_date) - timedelta(days=7)).strftime("%Y-%m-%dT%H:%M:%SZ")
            end = (datetime.fromisoformat(event_date) + timedelta(days=7)).strftime("%Y-%m-%dT%H:%M:%SZ")
            g = sampler.reviews_in_date_range(google_reviews, start, end)
            a = sampler.reviews_in_date_range(apple_reviews, start, end)
            return g, a, event_date
        # 기간 특정 불가 시 최신 30일
        cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%dT%H:%M:%SZ")
        g = [r for r in google_reviews if r.get("reviewed_at", "") >= cutoff]
        a = [r for r in apple_reviews if r.get("reviewed_at", "") >= cutoff]
        return g, a, "recent"

    # manual / 기타: 전체 최신 리뷰
    cutoff = (datetime.now(timezone.utc) - timedelta(days=90)).strftime("%Y-%m-%dT%H:%M:%SZ")
    g = [r for r in google_reviews if r.get("reviewed_at", "") >= cutoff]
    a = [r for r in apple_reviews if r.get("reviewed_at", "") >= cutoff]
    return g, a, "manual"


def process_app(app: dict) -> None:
    app_key = app["app_key"]
    ss_id = app.get("spreadsheet_id", "")
    trigger = app.get("pending_ai_trigger", "")

    if not ss_id or not trigger:
        return

    log.info(f"[{app_key}] AI 분석 시작 (trigger={trigger})")

    try:
        google_reviews = asheet.get_google_reviews(ss_id)
        apple_reviews = asheet.get_apple_reviews(ss_id)
        events = asheet.get_timeline(ss_id)

        g_filtered, a_filtered, period_label = _filter_for_trigger(
            trigger, events, google_reviews, apple_reviews
        )

        g_sample, a_sample = sampler.sample_for_analysis(g_filtered, a_filtered)

        min_required = cfg.min_reviews_for_ai()
        if len(g_sample) + len(a_sample) < min_required:
            log.warning(
                f"[{app_key}] 샘플 부족 ({len(g_sample) + len(a_sample)} < {min_required}), 건너뜀"
            )
            master.clear_pending_trigger(app_key)
            return

        result = ai.analyze(g_sample, a_sample, trigger, period_label)
        analysis_id = asheet.save_analysis(ss_id, result)

        # 관련 타임라인 이벤트에 분석 ID 연결
        for e in reversed(events):
            if e.get("analysis_id") == "" and e.get("event_type") in (
                "version_release", "sentiment_shift", "review_surge", "admin_patch"
            ):
                asheet.link_analysis_to_event(ss_id, e.get("event_id", ""), analysis_id)
                break

        master.update_app(app_key, {"last_analyzed_at": period_label})
        master.clear_pending_trigger(app_key)
        log.info(f"[{app_key}] AI 분석 완료 → {analysis_id}")

    except Exception as e:
        log.error(f"[{app_key}] AI 분석 실패: {e}")


def main():
    all_apps = master.get_all_apps()
    apps_to_analyze = [
        a for a in all_apps
        if a.get("ai_approved", "").upper() == "TRUE"
        and a.get("pending_ai_trigger", "")
        and a.get("status") == "active"
    ]

    if TARGET_APP_KEY:
        apps_to_analyze = [a for a in apps_to_analyze if a["app_key"] == TARGET_APP_KEY]

    log.info(f"분석 대상 {len(apps_to_analyze)}개 앱")

    for app in apps_to_analyze:
        try:
            process_app(app)
        except Exception as e:
            log.error(f"[{app.get('app_key')}] 오류: {e}")

    log.info("전체 분석 완료")


if __name__ == "__main__":
    main()
