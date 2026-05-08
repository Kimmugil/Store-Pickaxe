"""
분석 진입점 — GitHub Actions analyze.yml (workflow_dispatch)에서 실행

환경변수:
  APP_KEY   분석할 앱 키 (필수)
  FORCE     true이면 pending_analysis 체크 없이 강제 실행 (재분석 용도)

동작:
  1. 전체 수집 리뷰에서 평점 분포 균형 샘플링
  2. Gemini 호출 → 결과 저장 (새 UUID로 추가, 기존 분석 이력 유지)
  3. pending_analysis=FALSE 로 변경
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

    google_reviews = asheet.get_google_reviews(ss_id)
    apple_reviews = asheet.get_apple_reviews(ss_id)

    g_sample, a_sample = sampler.sample_for_analysis(google_reviews, apple_reviews)

    total_sample = len(g_sample) + len(a_sample)
    min_reviews = cfg.min_reviews_for_ai()

    if total_sample < min_reviews:
        log.warning(f"[{app_key}] 샘플 부족 ({total_sample}개 < {min_reviews}개) — 건너뜀")
        master.set_pending_analysis(app_key, False)
        return

    log.info(f"[{app_key}] 샘플: Google {len(g_sample)}개 + Apple {len(a_sample)}개")

    result = gemini.analyze(g_sample, a_sample, mode="onboarding", review_scope="전체 수집 리뷰")

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

    force = os.getenv("FORCE", "false").strip().lower() == "true"

    app = master.get_app(app_key)
    if not app:
        log.error(f"앱을 찾을 수 없습니다: {app_key}")
        sys.exit(1)

    if not force and app.get("pending_analysis", "").upper() != "TRUE":
        log.info(f"[{app_key}] pending_analysis=FALSE — 건너뜀 (재분석하려면 관리자 패널 'AI 재분석' 버튼 사용)")
        return

    process_app(app)


if __name__ == "__main__":
    main()
