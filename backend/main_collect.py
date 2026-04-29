"""
수집 진입점 — GitHub Actions collect.yml에서 실행

동작 순서 (앱당):
1. 평점 + 현재 버전 스냅샷 저장 (매일)
2. collect_frequency에 따라 신규 리뷰 수집
3. 버전 변경 / 평점 급변 / 리뷰 급증 감지 → TIMELINE 이벤트 생성
4. AI 분석 트리거 조건 충족 시 → pending_ai_trigger 설정
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
from backend.analyzers import shift_detector as sd

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)

# 환경변수로 특정 앱만 처리 가능
TARGET_APP_KEY = os.getenv("TARGET_APP_KEY", "")


def _should_collect_reviews(app: dict, today: str) -> bool:
    """collect_frequency에 따라 오늘 리뷰를 수집해야 하는지 판단."""
    freq = app.get("collect_frequency", "medium")
    last = app.get("last_collected_at", "")

    # 오늘 이미 수집한 경우 스킵 (같은 날 두 번 실행 방지)
    if last and last[:10] == today:
        return False

    if not last:
        return True

    weekday = datetime.now(timezone.utc).weekday()  # 0=월, 6=일

    if freq == "high":
        # 월/수/금 (0, 2, 4)
        return weekday in (0, 2, 4)
    elif freq == "medium":
        # 화/토 (1, 5)
        return weekday in (1, 5)
    else:
        # low: 일요일 (6)
        return weekday == 6


def _classify_velocity(google_reviews: list[dict], apple_reviews: list[dict]) -> str:
    """최근 30일 주간 평균 리뷰 수로 수집 빈도 분류."""
    from datetime import timedelta
    cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%dT%H:%M:%SZ")
    recent_g = [r for r in google_reviews if r.get("reviewed_at", "") >= cutoff]
    recent_a = [r for r in apple_reviews if r.get("reviewed_at", "") >= cutoff]
    weekly_avg = (len(recent_g) + len(recent_a)) / 4.3
    return sd.classify_velocity(weekly_avg)


def _check_ai_trigger(
    app: dict,
    new_g: list[dict],
    new_a: list[dict],
    new_events: list[dict],
) -> str | None:
    """AI 분석 트리거 조건 확인. 트리거 종류 반환 (없으면 None)"""
    if app.get("pending_ai_trigger"):
        return None  # 이미 대기 중

    total_new = len(new_g) + len(new_a)

    # 버전 출시 이벤트가 있고 새 리뷰가 충분히 쌓인 경우
    for event in new_events:
        if event["event_type"] == "version_release" and total_new >= cfg.min_reviews_for_version_ai():
            return "version"

    # 평점 급변 감지
    for event in new_events:
        if event["event_type"] == "sentiment_shift":
            return "shift"

    # 리뷰 급증
    for event in new_events:
        if event["event_type"] == "review_surge":
            return "surge"

    return None


def process_app(app: dict) -> None:
    app_key = app["app_key"]
    ss_id = app.get("spreadsheet_id", "")
    google_pkg = app.get("google_package", "")
    apple_id = app.get("apple_app_id", "")

    if not ss_id:
        log.warning(f"[{app_key}] spreadsheet_id 없음, 건너뜀")
        return

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    log.info(f"[{app_key}] 처리 시작")

    # ── 1. 평점 스냅샷 ──────────────────────────────────────────
    snapshot = {"date": today}

    if google_pkg:
        try:
            g_info = gc.get_current_rating(google_pkg)
            snapshot["google_rating"] = g_info["rating"]
            snapshot["google_review_count"] = g_info["review_count"]
            snapshot["google_version"] = g_info["version"]
        except Exception as e:
            log.error(f"[{app_key}] 구글 평점 조회 실패: {e}")

    if apple_id:
        try:
            a_info = ac.get_current_rating(apple_id)
            snapshot["apple_rating"] = a_info["rating"]
            snapshot["apple_review_count"] = a_info["review_count"]
            snapshot["apple_version"] = a_info["version"]
        except Exception as e:
            log.error(f"[{app_key}] 애플 평점 조회 실패: {e}")

    asheet.save_snapshot(ss_id, snapshot)

    # MASTER 현재 평점 갱신
    master.update_app(app_key, {
        "google_rating": snapshot.get("google_rating", ""),
        "apple_rating": snapshot.get("apple_rating", ""),
        "last_snapshot_at": today,
    })

    # ── 2. 리뷰 수집 (빈도 조건 충족 시) ──────────────────────
    new_g, new_a = [], []

    if _should_collect_reviews(app, today):
        any_collection_succeeded = False

        if google_pkg:
            try:
                existing_ids = asheet.get_existing_review_ids(ss_id, "google")
                new_g = gc.collect_reviews(google_pkg, existing_ids)
                saved = asheet.save_google_reviews(ss_id, new_g)
                any_collection_succeeded = True
                log.info(f"[{app_key}] 구글 리뷰 +{saved}개")
            except Exception as e:
                log.error(f"[{app_key}] 구글 리뷰 수집 실패: {e}")

            time.sleep(cfg.collect_delay())

        if apple_id:
            try:
                existing_ids = asheet.get_existing_review_ids(ss_id, "apple")
                new_a = ac.collect_reviews(apple_id, existing_ids)
                saved = asheet.save_apple_reviews(ss_id, new_a)
                any_collection_succeeded = True
                log.info(f"[{app_key}] 애플 리뷰 +{saved}개")
            except Exception as e:
                log.error(f"[{app_key}] 애플 리뷰 수집 실패: {e}")

        # 최소 하나의 플랫폼이 성공했을 때만 타임스탬프 갱신
        # (모두 실패한 경우 재시도 기회 보존)
        if any_collection_succeeded:
            master.update_app(app_key, {"last_collected_at": today})
        else:
            log.warning(f"[{app_key}] 모든 플랫폼 수집 실패 — last_collected_at 갱신 생략")

        # 수집 빈도 재분류 (30일 리뷰 속도 기반)
        try:
            all_g = asheet.get_google_reviews(ss_id)
            all_a = asheet.get_apple_reviews(ss_id)
            new_freq = _classify_velocity(all_g, all_a)
            if new_freq != app.get("collect_frequency"):
                master.update_app(app_key, {"collect_frequency": new_freq})
                log.info(f"[{app_key}] 수집 빈도 → {new_freq}")
        except Exception:
            pass

    # ── 3. 이벤트 감지 ─────────────────────────────────────────
    try:
        snapshots = asheet.get_snapshots(ss_id)
        existing_dates = asheet.get_existing_event_dates(ss_id)
        velocity = app.get("collect_frequency", "medium")

        new_events = []
        new_events += sd.detect_version_change(snapshots, existing_dates)
        new_events += sd.detect_rating_shifts(snapshots, existing_dates, velocity)
        new_events += sd.detect_review_surge(snapshots, existing_dates)

        for event in new_events:
            asheet.save_timeline_event(ss_id, event)
            log.info(f"[{app_key}] 이벤트: {event['event_type']} @ {event['event_date']}")

    except Exception as e:
        log.error(f"[{app_key}] 이벤트 감지 실패: {e}")
        new_events = []

    # ── 4. AI 트리거 확인 ──────────────────────────────────────
    if app.get("ai_approved", "").upper() == "TRUE":
        trigger = _check_ai_trigger(app, new_g, new_a, new_events)
        if trigger:
            master.set_pending_trigger(app_key, trigger)
            log.info(f"[{app_key}] AI 분석 대기 → {trigger}")

    log.info(f"[{app_key}] 완료")


def main():
    apps = master.get_active_apps()

    if TARGET_APP_KEY:
        apps = [a for a in apps if a["app_key"] == TARGET_APP_KEY]
        if not apps:
            log.error(f"앱을 찾을 수 없습니다: {TARGET_APP_KEY}")
            sys.exit(1)

    log.info(f"총 {len(apps)}개 앱 처리 시작")

    for app in apps:
        try:
            process_app(app)
        except Exception as e:
            log.error(f"[{app.get('app_key')}] 처리 중 오류: {e}")
        time.sleep(cfg.collect_delay())

    log.info("전체 수집 완료")


if __name__ == "__main__":
    main()
