"""
스토어 곡괭이 스케줄러 진입점.
GitHub Actions에서 매일 자동으로 실행됩니다.
모든 active 앱의 신규 리뷰를 수집하여 구글 시트에 적재합니다.
"""
import logging
import sys
from collections import defaultdict

from src.google_pickaxe import GooglePickaxe
from src.apple_pickaxe import ApplePickaxe
from src.sheets_manager import SheetsManager

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger(__name__)


def _build_timeline_events(sheets: SheetsManager, app_key: str):
    """
    리뷰 데이터에서 버전 정보를 추출하여 타임라인 이벤트를 자동 생성합니다.
    이미 등록된 버전은 건너뜁니다.
    """
    existing_events = sheets.load_timeline(app_key)
    existing_versions = {e.get("version") for e in existing_events}

    g_reviews = sheets.load_reviews(app_key, "google")
    a_reviews = sheets.load_reviews(app_key, "apple")

    version_data: dict[str, dict] = defaultdict(
        lambda: {"google": [], "apple": [], "dates": []}
    )

    for r in g_reviews:
        v = str(r.get("app_version", "")).strip()
        if v:
            version_data[v]["google"].append(r)
            d = str(r.get("reviewed_at", ""))[:10]
            if d:
                version_data[v]["dates"].append(d)

    for r in a_reviews:
        v = str(r.get("app_version", "")).strip()
        if v:
            version_data[v]["apple"].append(r)
            d = str(r.get("reviewed_at", ""))[:10]
            if d:
                version_data[v]["dates"].append(d)

    new_event_count = 0
    for version, data in sorted(version_data.items()):
        if version in existing_versions:
            continue
        if len(data["google"]) + len(data["apple"]) < 5:
            continue

        dates = sorted(data["dates"])
        first_date = dates[0] if dates else ""

        g_reviews_v = data["google"]
        a_reviews_v = data["apple"]
        g_ratings = [int(r.get("rating", 3)) for r in g_reviews_v if r.get("rating")]
        a_ratings = [int(r.get("rating", 3)) for r in a_reviews_v if r.get("rating")]
        g_sentiment = int(sum(1 for s in g_ratings if s >= 4) / len(g_ratings) * 100) if g_ratings else 0
        a_sentiment = int(sum(1 for s in a_ratings if s >= 4) / len(a_ratings) * 100) if a_ratings else 0

        event = {
            "version": version,
            "date": first_date,
            "period_end": dates[-1] if dates else "",
            "type": "update",
            "type_label": "업데이트",
            "google_sentiment_pct": g_sentiment,
            "apple_sentiment_pct": a_sentiment,
            "google_review_count": len(g_reviews_v),
            "apple_review_count": len(a_reviews_v),
            "key_issues": "",
            "kr_summary": "",
            "user_edited": "False",
        }

        try:
            sheets.save_timeline_event(app_key, event)
            new_event_count += 1
        except Exception as e:
            log.warning(f"타임라인 이벤트 저장 실패 (v{version}): {e}")

    if new_event_count:
        log.info(f"  타임라인 이벤트 {new_event_count}개 추가")


def run_all():
    log.info("=== 스토어 곡괭이 시작 ===")

    sheets = SheetsManager()
    active_apps = sheets.get_active_apps()

    if not active_apps:
        log.info("수집할 앱이 없습니다.")
        return

    log.info(f"수집 대상: {len(active_apps)}개 앱")

    google_pickaxe = GooglePickaxe()
    apple_pickaxe = ApplePickaxe()
    summary = []

    for app in active_apps:
        app_key = app["app_key"]
        app_name = app.get("app_name", app_key)
        log.info(f"--- [{app_name}] 수집 시작 ---")
        result = {"app_key": app_key, "google_added": 0, "apple_added": 0, "error": None}

        try:
            # 구글 플레이 수집
            google_package = app.get("google_package", "").strip()
            if google_package:
                existing_ids = sheets.get_existing_review_ids(app_key, "google")
                if existing_ids:
                    reviews = google_pickaxe.collect_new_reviews(google_package, existing_ids)
                else:
                    reviews = google_pickaxe.collect_all_reviews(google_package)

                added = sheets.save_google_reviews(app_key, reviews)
                result["google_added"] = added
                log.info(f"  구글: {added}개 신규 적재")

            # 애플 앱스토어 수집
            apple_app_id = str(app.get("apple_app_id", "")).strip()
            if apple_app_id:
                existing_ids = sheets.get_existing_review_ids(app_key, "apple")
                how_many = 200 if existing_ids else 2000
                reviews = apple_pickaxe.collect_new_reviews(
                    apple_app_id, app_name, existing_ids, how_many=how_many
                )
                added = sheets.save_apple_reviews(app_key, reviews)
                result["apple_added"] = added
                log.info(f"  애플: {added}개 신규 적재")

            # 타임라인 자동 업데이트
            _build_timeline_events(sheets, app_key)

        except Exception as e:
            result["error"] = str(e)
            log.error(f"  오류 발생: {e}")

        summary.append(result)

    log.info("=== 수집 완료 ===")
    for r in summary:
        status = "ERROR" if r["error"] else "OK"
        log.info(
            f"  [{status}] {r['app_key']} | "
            f"구글 +{r['google_added']} | 애플 +{r['apple_added']}"
            + (f" | {r['error']}" if r["error"] else "")
        )


if __name__ == "__main__":
    run_all()
