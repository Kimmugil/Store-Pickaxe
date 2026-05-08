"""
분석 진입점 — GitHub Actions analyze.yml (workflow_dispatch)에서 실행

환경변수:
  APP_KEY   분석할 앱 키 (필수)

동작:
  1. pending_analysis=TRUE 인지 확인
  2. 마지막 분석 이후 신규 리뷰 샘플링 (첫 분석이면 전체)
  3. Gemini 호출 → 결과 저장
  4. pending_analysis=FALSE 로 변경
"""
import os
import sys
import logging
from datetime import datetime, timezone

from backend import config as cfg
from backend.sheets import master_sheet as master
from backend.sheets import app_sheet as asheet
from backend.analyzers import sampler
from backend.analyzers import gemini_analyzer as gemini

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)


def process_app(app: dict) -> None:
    app_key = app["app_key"]
    ss_id = app.get("spreadsheet_id", "")

    if not ss_id:
        log.error(f"[{app_key}] spreadsheet_id 없음")
        return

    log.info(f"[{app_key}] 분석 시작")

    # ── 마지막 분석 이후 신규 리뷰만 대상 ───────────────────────────
    latest = asheet.get_latest_analysis(ss_id)

    if latest:
        since_date = latest.get("created_at", "")[:10]
        mode = "update"
        review_scope = f"{since_date} 이후 신규 리뷰"
    else:
        since_date = None
        mode = "onboarding"
        review_scope = "전체 수집 리뷰"

    google_reviews = asheet.get_google_reviews(ss_id)
    apple_reviews = asheet.get_apple_reviews(ss_id)

    g_sample, a_sample = sampler.sample_for_analysis(google_reviews, apple_reviews, since_date)

    total_sample = len(g_sample) + len(a_sample)
    min_reviews = cfg.min_reviews_for_ai()

    if total_sample < min_reviews:
        log.warning(f"[{app_key}] 샘플 부족 ({total_sample}개 < {min_reviews}개) — 건너뜀")
        master.set_pending_analysis(app_key, False)
        return

    log.info(f"[{app_key}] 샘플: Google {len(g_sample)}개 + Apple {len(a_sample)}개 ({review_scope})")

    # ── Gemini 분석 ──────────────────────────────────────────────
    result = gemini.analyze(g_sample, a_sample, mode=mode, review_scope=review_scope)

    # ── 결과 저장 ────────────────────────────────────────────────
    analysis_id = asheet.save_analysis(ss_id, result)
    log.info(f"[{app_key}] 분석 저장: {analysis_id}")

    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    master.update_app(app_key, {
        "last_analyzed_at": now,
        "pending_analysis": "FALSE",
    })
    log.info(f"[{app_key}] 완료")


def main():
    app_key = os.getenv("APP_KEY", "").strip()
    if not app_key:
        log.error("APP_KEY 환경변수가 필요합니다.")
        sys.exit(1)

    app = master.get_app(app_key)
    if not app:
        log.error(f"앱을 찾을 수 없습니다: {app_key}")
        sys.exit(1)

    if app.get("pending_analysis", "").upper() != "TRUE":
        log.info(f"[{app_key}] pending_analysis=FALSE — 건너뜀")
        return

    process_app(app)


if __name__ == "__main__":
    main()
