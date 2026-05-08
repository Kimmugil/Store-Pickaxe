"""
수집 진입점 — GitHub Actions collect.yml (workflow_dispatch)에서 실행

환경변수:
  APP_KEY   수집할 앱 키 (필수)
  MODE      onboarding | update (기본: update)
            onboarding: 가능한 모든 리뷰 수집 (처음 등록 시)
            update:     마지막 수집 이후 신규 리뷰만 수집
"""
import os
import sys
import time
import logging
from datetime import datetime, timezone

from backend import config as cfg
from backend.sheets import master_sheet as master
from backend.sheets import app_sheet as asheet
from backend.collectors import google_collector as gc
from backend.collectors import apple_collector as ac

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)


def process_app(app: dict, mode: str) -> None:
    app_key = app["app_key"]
    ss_id = app.get("spreadsheet_id", "")
    google_pkg = app.get("google_package", "")
    apple_id = app.get("apple_app_id", "")

    if not ss_id:
        log.error(f"[{app_key}] spreadsheet_id 없음 — 건너뜀")
        return

    log.info(f"[{app_key}] 수집 시작 (mode={mode})")

    google_added = 0
    apple_added = 0
    google_rating = ""
    apple_rating = ""
    any_success = False

    # ── Google Play ──────────────────────────────────────────────
    if google_pkg:
        try:
            existing_ids = asheet.get_existing_review_ids(ss_id, "google")

            if mode == "onboarding":
                # 전체 수집: 기존 ID만 제외, 페이지 제한 없음
                reviews = gc.collect_reviews(google_pkg, existing_ids, max_pages=50)
            else:
                # 신규 수집: 연속 기존 리뷰 감지 시 조기 종료
                reviews = gc.collect_reviews(google_pkg, existing_ids, max_pages=10)

            google_added = asheet.save_google_reviews(ss_id, reviews)
            any_success = True
            log.info(f"[{app_key}] Google +{google_added}개")

            # 현재 평점 조회
            try:
                info = gc.get_current_rating(google_pkg)
                google_rating = str(info.get("rating", ""))
            except Exception as e:
                log.warning(f"[{app_key}] Google 평점 조회 실패: {e}")

        except Exception as e:
            log.error(f"[{app_key}] Google 수집 실패: {e}")

        time.sleep(cfg.collect_delay())

    # ── App Store ────────────────────────────────────────────────
    if apple_id:
        try:
            existing_ids = asheet.get_existing_review_ids(ss_id, "apple")
            reviews = ac.collect_reviews(apple_id, existing_ids)
            apple_added = asheet.save_apple_reviews(ss_id, reviews)
            any_success = True
            log.info(f"[{app_key}] Apple +{apple_added}개")

            try:
                info = ac.get_current_rating(apple_id)
                apple_rating = str(info.get("rating", ""))
            except Exception as e:
                log.warning(f"[{app_key}] Apple 평점 조회 실패: {e}")

        except Exception as e:
            log.error(f"[{app_key}] Apple 수집 실패: {e}")

    if not any_success:
        log.error(f"[{app_key}] 모든 플랫폼 수집 실패")
        return

    # ── 수집 로그 + MASTER 갱신 ───────────────────────────────────
    asheet.save_collection_log(
        ss_id, mode, google_added, apple_added, google_rating, apple_rating
    )

    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    master.update_app(app_key, {
        "last_collected_at": now,
        "google_rating": google_rating,
        "apple_rating": apple_rating,
        "pending_analysis": "TRUE",
    })

    total_g = len(asheet.get_existing_review_ids(ss_id, "google"))
    total_a = len(asheet.get_existing_review_ids(ss_id, "apple"))
    master.update_app(app_key, {
        "google_review_count": total_g,
        "apple_review_count": total_a,
    })

    log.info(f"[{app_key}] 완료 — 분석 대기 상태로 변경됨")


def main():
    app_key = os.getenv("APP_KEY", "").strip()
    mode = os.getenv("MODE", "update").strip().lower()

    if mode not in ("onboarding", "update"):
        log.error(f"잘못된 MODE 값: '{mode}' (onboarding | update 중 선택)")
        sys.exit(1)

    if not app_key:
        log.error("APP_KEY 환경변수가 필요합니다.")
        sys.exit(1)

    app = master.get_app(app_key)
    if not app:
        log.error(f"앱을 찾을 수 없습니다: {app_key}")
        sys.exit(1)

    process_app(app, mode)


if __name__ == "__main__":
    main()
