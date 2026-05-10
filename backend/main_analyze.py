"""
분석 진입점 — GitHub Actions analyze.yml (workflow_dispatch)에서 실행

환경변수:
  APP_KEY   분석할 앱 키 (필수)
  FORCE     true이면 pending_analysis 체크 없이 강제 실행 (재분석 용도)

동작:
  1. 전체 수집 리뷰에서 평점 분포 비례 샘플링 (저평점 1.5배 가중)
  2. Apple과 동기간 Google 리뷰 별도 샘플링 (플랫폼 비교용)
  3. 출시일이 있으면 Google 리뷰 시기별 분할 (launch/growth/stable)
  4. Gemini 호출 → 결과 저장 (새 UUID로 추가, 기존 분석 이력 유지)
  5. pending_analysis=FALSE 로 변경
"""
import os
import sys
import logging
import time
from datetime import datetime, timezone

from backend import config as cfg
from backend.sheets import master_sheet as master
from backend.sheets import app_sheet as asheet
from backend.analyzers import sampler
from backend.analyzers.sampler import calc_sentiment, calc_rating_dist
from backend.analyzers import gemini_analyzer as gemini

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)


def _calc_monthly_stats(reviews: list[dict]) -> list[dict]:
    """전체 Google 리뷰 기반 월별 평점 평균/건수 계산 (Gemini 컨텍스트용)."""
    monthly: dict[str, list[int]] = {}
    for r in reviews:
        month = (r.get("reviewed_at", "") or "")[:7]
        if len(month) == 7 and "-" in month:
            try:
                monthly.setdefault(month, []).append(int(r.get("rating", 3)))
            except (ValueError, TypeError):
                pass
    stats = []
    for month in sorted(monthly.keys()):
        ratings = monthly[month]
        if len(ratings) >= 5:  # 최소 5건 이상인 달만 포함
            avg = round(sum(ratings) / len(ratings), 2)
            stats.append({"month": month, "avg": avg, "count": len(ratings)})
    return stats  # 전체 기간 (Gemini가 중간 시기 트렌드 파악에 활용)


def process_app(app: dict) -> None:
    app_key = app["app_key"]
    ss_id = app.get("spreadsheet_id", "")
    release_date = app.get("release_date", "").strip()

    if not ss_id:
        log.error(f"[{app_key}] spreadsheet_id 없음")
        return

    log.info(f"[{app_key}] 분석 시작 (출시일: {release_date or '미설정'})")

    google_reviews = asheet.get_google_reviews(ss_id)
    apple_reviews = asheet.get_apple_reviews(ss_id)

    # 전체 샘플 (종합 분석용)
    g_sample, a_sample, date_min, date_max = sampler.sample_for_analysis(google_reviews, apple_reviews)

    total_sample = len(g_sample) + len(a_sample)
    min_reviews = cfg.min_reviews_for_ai()

    if total_sample < min_reviews:
        log.warning(f"[{app_key}] 샘플 부족 ({total_sample}개 < {min_reviews}개) — 건너뜀")
        master.set_pending_analysis(app_key, False)
        return

    log.info(f"[{app_key}] 전체 샘플: Google {len(g_sample)}개 + Apple {len(a_sample)}개 ({date_min} ~ {date_max})")

    # 동기간 플랫폼 비교 샘플 (Apple 수집 기간 = Google 필터 기간)
    sp_google, apple_date_from, apple_date_to = sampler.sample_platform_comparison(
        google_reviews, apple_reviews
    )
    if sp_google:
        log.info(f"[{app_key}] 동기간 Google 샘플: {len(sp_google)}개 ({apple_date_from} ~ {apple_date_to})")
    else:
        log.info(f"[{app_key}] Apple 리뷰 없음 — 플랫폼 비교 생략")

    # 시기별 분할 (출시일 있을 때만)
    phases: dict = {}
    if release_date:
        phases = sampler.sample_phases(google_reviews, release_date)
        for pk, pd in phases.items():
            log.info(f"[{app_key}] 시기별 {pk}: {pd['count']}건 ({pd['date_from']} ~ {pd['date_to']}), 샘플 {len(pd['reviews'])}개, 긍정률 {pd.get('sentiment')}%")

    # sentiment: AI 추측이 아닌 전체 수집 리뷰의 실제 평점 분포에서 계산
    google_sentiment = calc_sentiment(google_reviews)
    apple_sentiment = calc_sentiment(apple_reviews)
    log.info(f"[{app_key}] 긍정도 계산 — Google {google_sentiment}% / Apple {apple_sentiment}%")

    # 평점 분포: 전체 수집 리뷰 기반 (AI 분석과 별도로 집계)
    google_rating_dist = calc_rating_dist(google_reviews)
    apple_rating_dist = calc_rating_dist(apple_reviews)
    log.info(f"[{app_key}] 평점 분포 — Google {google_rating_dist} / Apple {apple_rating_dist}")

    # 월별 평점 통계 계산 (Gemini 컨텍스트용 — 샘플에서 빠진 중간 시기 보완)
    monthly_stats = _calc_monthly_stats(google_reviews)
    log.info(f"[{app_key}] 월별 통계: {len(monthly_stats)}개월 데이터")

    # 일일 AI 분석 한도 체크 (force=True일 때는 건너뜀)
    force = os.getenv("FORCE", "false").strip().lower() == "true"
    if not force:
        limit = cfg.daily_ai_limit()
        _today, usage = master.get_daily_ai_usage()
        if usage >= limit:
            log.warning(f"[{app_key}] 일일 AI 분석 한도 초과 ({usage}/{limit}) — pending_analysis=TRUE 유지")
            return  # pending_analysis 는 TRUE 그대로 유지

    result = gemini.analyze(
        g_sample, a_sample,
        mode="onboarding",
        review_scope="전체 수집 리뷰",
        same_period_google=sp_google,
        phases=phases,
        release_date=release_date,
        monthly_stats=monthly_stats,
    )
    result["google_sentiment"] = google_sentiment
    result["apple_sentiment"] = apple_sentiment
    result["sample_date_min"] = date_min
    result["sample_date_max"] = date_max
    result["google_rating_dist"] = google_rating_dist
    result["apple_rating_dist"] = apple_rating_dist

    # 분석 저장 (성공 시 pending_analysis=FALSE 보장)
    analysis_id = asheet.save_analysis(ss_id, result)
    log.info(f"[{app_key}] 분석 저장: {analysis_id}")

    # 일일 사용량 증가 (실패해도 분석 완료 처리는 계속)
    try:
        new_usage = master.increment_daily_ai_usage()
        log.info(f"[{app_key}] 일일 AI 분석 사용량: {new_usage}회")
    except Exception as e:
        log.warning(f"[{app_key}] 일일 사용량 증가 실패 (무시, 계속 진행): {e}")

    # pending_analysis=FALSE 는 반드시 설정 (재시도 포함)
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    update_fields = {"last_analyzed_at": now, "pending_analysis": "FALSE"}
    try:
        master.update_app(app_key, update_fields)
    except Exception as e:
        log.error(f"[{app_key}] pending_analysis 업데이트 1차 실패: {e} — 5초 후 재시도")
        time.sleep(5)
        master.update_app(app_key, update_fields)  # 2차 시도 (실패 시 예외 전파)
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
