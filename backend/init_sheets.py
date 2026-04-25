"""
마스터 스프레드시트 초기화 스크립트
처음 한 번만 실행하면 됩니다.

실행 방법:
  python -m backend.init_sheets

수행 작업:
  1. MASTER 탭 생성 (앱 목록)
  2. CONFIG 탭 생성 + 기본값 시드
  3. UI_TEXTS 탭 생성 + 한국어 기본값 시드
"""
import sys
import gspread
from google.oauth2.service_account import Credentials
from backend.config import get_env, get_google_credentials

_SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]

# ── CONFIG 기본값 ─────────────────────────────────────────────────
CONFIG_DEFAULTS = [
    ["key", "value", "description"],
    ["ADMIN_PASSWORD",               "changeme123",     "관리자 패널 비밀번호 (반드시 변경하세요!)"],
    ["AI_MODEL",                     "gemini-2.5-flash","사용할 Gemini 모델"],
    ["COLLECT_DELAY_SECONDS",        "2",               "수집 요청 간 딜레이(초)"],
    ["SENTIMENT_SHIFT_THRESHOLD_HIGH",  "0.5",          "High 앱 평점 급변 임계값(점)"],
    ["SENTIMENT_SHIFT_THRESHOLD_MEDIUM","0.7",          "Medium 앱 평점 급변 임계값(점)"],
    ["SENTIMENT_SHIFT_THRESHOLD_LOW",   "1.0",          "Low 앱 평점 급변 임계값(점)"],
    ["MIN_REVIEWS_FOR_AI",           "30",              "AI 분석 최소 리뷰 수"],
    ["MIN_REVIEWS_FOR_VERSION_AI",   "50",              "버전 트리거 최소 리뷰 수"],
    ["REVIEW_SURGE_MULTIPLIER",      "3.0",             "리뷰 급증 감지 배수"],
    ["HIGH_VELOCITY_THRESHOLD",      "50",              "High 분류 주간 리뷰 수 기준"],
    ["MEDIUM_VELOCITY_THRESHOLD",    "10",              "Medium 분류 주간 리뷰 수 기준"],
    ["SAMPLE_GOOGLE_COUNT",          "100",             "AI 분석 구글 샘플 최대 수"],
    ["SAMPLE_APPLE_COUNT",           "50",              "AI 분석 애플 샘플 최대 수"],
]

# ── UI_TEXTS 기본값 (한국어) ─────────────────────────────────────
UI_TEXTS_DEFAULTS = [
    ["key", "value"],
    # 내비게이션
    ["nav.home",                        "홈"],
    ["nav.add",                         "게임 등록"],
    ["nav.guide",                       "가이드"],
    ["nav.admin",                       "관리자"],
    # 사이트
    ["site.title",                      "Store-Pickaxe"],
    ["site.description",                "모바일 게임 리뷰 분석 대시보드"],
    # 홈
    ["home.title",                      "등록된 게임"],
    ["home.subtitle",                   "모바일 게임 리뷰 분석 대시보드"],
    ["home.empty.title",                "등록된 게임이 없습니다"],
    ["home.empty.desc",                 "게임 등록 페이지에서 추가해보세요."],
    ["home.card.last_analysis",         "최근 분석"],
    ["home.card.no_analysis",           "분석 없음"],
    # 등록 페이지
    ["add.title",                       "게임 등록"],
    ["add.desc",                        "구글 플레이 또는 앱스토어에서 게임을 검색하세요."],
    ["add.search.placeholder",          "게임 이름 입력 (예: 브롤스타즈)"],
    ["add.search.button",               "검색"],
    ["add.tab.google",                  "구글 플레이"],
    ["add.tab.apple",                   "앱스토어"],
    ["add.match.auto_label",            "자동 매칭 제안"],
    ["add.register.button",             "등록하기"],
    ["add.success.title",               "등록 완료!"],
    ["add.success.desc",                "게임이 성공적으로 등록되었습니다."],
    ["add.pending_ai.notice",           "AI 분석은 관리자 승인 후 자동으로 진행됩니다. 데이터 수집은 다음 날 새벽부터 시작됩니다."],
    ["add.no_results.google",           "구글 플레이에서 결과를 찾을 수 없습니다"],
    ["add.no_results.apple",            "앱스토어에서 결과를 찾을 수 없습니다"],
    # 공통
    ["common.loading",                  "로딩 중..."],
    ["common.error",                    "오류가 발생했습니다"],
    ["common.retry",                    "새로고침"],
    ["common.back",                     "목록으로"],
    ["common.view",                     "상세 보기"],
    ["common.platform.google",          "Google Play"],
    ["common.platform.apple",           "App Store"],
    ["common.platform.both",            "Google + Apple"],
    ["common.rating",                   "평점"],
    ["common.reviews",                  "리뷰"],
    ["common.version",                  "버전"],
    ["common.date",                     "날짜"],
    ["common.unknown",                  "알 수 없음"],
    # 앱 상세
    ["detail.tab.rating",               "평점 추이"],
    ["detail.tab.analysis",             "AI 분석"],
    ["detail.tab.reviews",              "리뷰"],
    ["detail.rating.title",             "평점 추이 차트"],
    ["detail.rating.no_data",           "아직 수집된 평점 데이터가 없습니다"],
    ["detail.last_snapshot",            "마지막 수집"],
    ["detail.chart.version_line",       "버전 출시"],
    ["detail.chart.shift_line",         "평점 급변"],
    ["detail.timeline.title",           "이벤트 타임라인"],
    ["detail.timeline.empty",           "감지된 이벤트가 없습니다"],
    ["detail.analysis.no_data",         "아직 분석 결과가 없습니다"],
    ["detail.analysis.not_approved",    "관리자 AI 분석 승인 대기 중입니다"],
    ["detail.analysis.pending",         "AI 분석 대기 중"],
    ["detail.analysis.loading",         "분석 중"],
    ["detail.analysis.complaints",      "주요 불만"],
    ["detail.analysis.praises",         "주요 칭찬"],
    ["detail.analysis.sample",          "샘플"],
    ["detail.reviews.no_reviews",       "수집된 리뷰가 없습니다"],
    # 이벤트 타입
    ["event.version_release",           "버전 출시"],
    ["event.sentiment_shift",           "평점 급변"],
    ["event.review_surge",              "리뷰 급증"],
    ["event.admin_patch",               "주요 패치"],
    # 감정 레이블
    ["sentiment.positive",              "긍정적"],
    ["sentiment.neutral",               "보통"],
    ["sentiment.negative",              "부정적"],
    # 관리자
    ["admin.title",                     "관리자 패널"],
    ["admin.login.password_placeholder","비밀번호를 입력하세요"],
    ["admin.login.button",              "로그인"],
    ["admin.login.error",               "비밀번호가 올바르지 않습니다"],
    ["admin.section.pending",           "AI 분석 승인 대기"],
    ["admin.pending.empty",             "대기 중인 앱이 없습니다"],
    ["admin.pending.approve",           "AI 승인"],
    ["admin.pending.reject",            "거부"],
    ["admin.section.apps",              "앱 관리"],
    ["admin.app.status.active",         "활성"],
    ["admin.app.status.paused",         "일시 중지"],
    ["admin.app.status.pending",        "대기"],
    ["admin.app.trigger_analysis",      "AI 분석 트리거"],
    ["admin.app.mark_patch",            "주요 패치 마킹"],
    # 가이드 공통
    ["guide.title",                     "분석 가이드"],
    ["guide.desc",                      "Store-Pickaxe가 데이터를 수집·분석하는 기준과 공식을 설명합니다."],
    ["guide.table.level",               "등급"],
    ["guide.table.condition",           "조건"],
    ["guide.table.schedule",            "수집 요일 / 주기"],
    ["guide.table.trigger",             "워크플로우"],
    ["guide.table.task",                "작업"],
    ["guide.table.threshold",           "임계값"],
    # 가이드 — 수집
    ["guide.section.collection",        "데이터 수집"],
    ["guide.collection.snapshot.title", "평점 스냅샷"],
    ["guide.collection.snapshot.desc",  "매일 새벽 3시(KST) 구글·애플 양쪽의 현재 평점과 앱 버전을 저장합니다. 버전이 바뀌면 타임라인 이벤트가 자동 생성됩니다."],
    ["guide.collection.frequency.title","리뷰 수집 빈도"],
    ["guide.collection.frequency.desc", "앱의 리뷰 발생 속도(주간 리뷰 수)에 따라 자동 분류됩니다."],
    ["guide.collection.frequency.high", "주 50개 이상"],
    ["guide.collection.frequency.high_days","월·수·금 (주 3회)"],
    ["guide.collection.frequency.medium","주 10~49개"],
    ["guide.collection.frequency.medium_days","화·토 (주 2회)"],
    ["guide.collection.frequency.low",  "주 10개 미만"],
    ["guide.collection.frequency.low_days","일요일 (주 1회)"],
    ["guide.collection.apple_note",     "애플 앱스토어는 최근 500개 리뷰만 공식 API로 제공됩니다. 수집 빈도가 높을수록 리뷰 누락 가능성이 줄어듭니다."],
    # 가이드 — 이벤트 감지
    ["guide.section.detection",         "이벤트 자동 감지"],
    ["guide.detection.version.title",   "버전 출시 (version_release)"],
    ["guide.detection.version.formula", "스냅샷의 앱 버전이 이전 날짜와 달라지면 → version_release 이벤트 자동 생성"],
    ["guide.detection.shift.title",     "평점 급변 (sentiment_shift)"],
    ["guide.detection.shift.formula",   "7일 롤링 평균 평점 − 30일 기준선 평균 평점 = 변화폭\n변화폭 > 임계값 AND 기간 데이터 5일 이상 → 이벤트 생성"],
    ["guide.detection.shift.threshold_desc","임계값은 앱의 리뷰 속도(등급)에 따라 달라집니다."],
    ["guide.detection.shift.threshold.high", "±0.5점 (High 등급)"],
    ["guide.detection.shift.threshold.medium","±0.7점 (Medium 등급)"],
    ["guide.detection.shift.threshold.low",  "±1.0점 (Low 등급)"],
    ["guide.detection.surge.title",     "리뷰 급증 (review_surge)"],
    ["guide.detection.surge.formula",   "최근 7일 일평균 신규 리뷰 수 ÷ 30일 일평균 신규 리뷰 수 ≥ 3배 → 이벤트 생성"],
    ["guide.detection.surge.note",      "기준 배수(기본값 3배)는 CONFIG 탭의 REVIEW_SURGE_MULTIPLIER로 변경 가능합니다."],
    # 가이드 — AI 분석
    ["guide.section.ai",                "AI 분석"],
    ["guide.ai.trigger.title",          "분석 발동 조건"],
    ["guide.ai.trigger.desc",           "관리자가 AI 분석을 승인한 앱에 한해, 아래 조건 중 하나가 충족되면 자동으로 분석이 예약됩니다."],
    ["guide.ai.trigger.registration",   "앱 최초 등록 후 리뷰 30개 이상 수집 시"],
    ["guide.ai.trigger.version",        "버전 업데이트 감지 AND 해당 버전 리뷰 50개 이상"],
    ["guide.ai.trigger.shift",          "평점 급변 이벤트 감지 시"],
    ["guide.ai.trigger.surge",          "리뷰 급증 이벤트 감지 시"],
    ["guide.ai.trigger.admin",          "관리자 패널에서 수동 트리거"],
    ["guide.ai.sampling.title",         "리뷰 샘플링 방법"],
    ["guide.ai.sampling.formula",       "최신 60% + 무작위 40% 혼합\n구글 최대 100개 + 애플 최대 50개 = 합계 최대 150개"],
    ["guide.ai.sampling.note",          "샘플 크기는 CONFIG 탭의 SAMPLE_GOOGLE_COUNT / SAMPLE_APPLE_COUNT로 조정 가능합니다."],
    ["guide.ai.output.title",           "분석 출력 항목"],
    ["guide.ai.output.summary",         "종합 요약 (한 문장)"],
    ["guide.ai.output.complaints",      "주요 불만 3가지"],
    ["guide.ai.output.praises",         "주요 칭찬 3가지"],
    ["guide.ai.output.sentiment",       "감정 점수 0~100점 (구글 / 애플 각각)"],
    ["guide.ai.output.keywords",        "주요 키워드 5개 (구글 / 애플 각각)"],
    ["guide.ai.output.platform_diff",   "플랫폼 반응 차이 설명"],
    # 가이드 — 스케줄
    ["guide.section.schedule",          "자동화 스케줄 요약"],
    ["guide.schedule.snapshot",         "평점·버전 스냅샷"],
    ["guide.schedule.review_high",      "리뷰 수집 (High)"],
    ["guide.schedule.review_medium",    "리뷰 수집 (Medium)"],
    ["guide.schedule.review_low",       "리뷰 수집 (Low)"],
    ["guide.schedule.event_detection",  "이벤트 감지"],
    ["guide.schedule.analyze",          "AI 분석 실행"],
]

# ── MASTER 헤더 ──────────────────────────────────────────────────
MASTER_HEADERS = [
    "app_key", "app_name", "developer",
    "google_package", "apple_app_id", "icon_url",
    "google_rating", "apple_rating",
    "collect_frequency", "status", "ai_approved",
    "spreadsheet_id",
    "registered_at", "last_snapshot_at",
    "last_collected_at", "last_analyzed_at",
    "pending_ai_trigger",
]


def _get_client() -> gspread.Client:
    creds = Credentials.from_service_account_info(
        get_google_credentials(), scopes=_SCOPES
    )
    return gspread.authorize(creds)


def _ensure_tab(ss: gspread.Spreadsheet, title: str, rows: int = 1000, cols: int = 20) -> gspread.Worksheet:
    try:
        return ss.worksheet(title)
    except gspread.WorksheetNotFound:
        return ss.add_worksheet(title, rows=rows, cols=cols)


def _seed(ws: gspread.Worksheet, rows: list[list[str]], force: bool = False) -> None:
    """현재 시트가 헤더만 있거나 비어있을 때만 시드 데이터를 입력."""
    current = ws.get_all_values()
    if len(current) > 1 and not force:
        print(f"  → '{ws.title}' 탭에 이미 데이터가 있습니다. 건너뜀 (force=True 로 강제 덮어쓰기 가능)")
        return
    ws.clear()
    ws.append_rows(rows, value_input_option="USER_ENTERED")
    print(f"  → '{ws.title}' 탭에 {len(rows) - 1}개 행 시드 완료")


def main(force: bool = False):
    master_id = get_env("MASTER_SPREADSHEET_ID", required=True)
    print(f"마스터 스프레드시트 연결 중... ({master_id})")

    gc = _get_client()
    ss = gc.open_by_key(master_id)
    print(f"연결 완료: '{ss.title}'")

    # 1. MASTER 탭
    print("\n[1/3] MASTER 탭 초기화")
    ws_master = _ensure_tab(ss, "MASTER", rows=2000, cols=len(MASTER_HEADERS))
    current = ws_master.get_all_values()
    if not current:
        ws_master.append_row(MASTER_HEADERS)
        print("  → MASTER 탭 헤더 생성 완료")
    else:
        print("  → MASTER 탭 이미 존재, 건너뜀")

    # 2. CONFIG 탭
    print("\n[2/3] CONFIG 탭 초기화")
    ws_config = _ensure_tab(ss, "CONFIG", rows=50, cols=3)
    _seed(ws_config, CONFIG_DEFAULTS, force=force)

    # 3. UI_TEXTS 탭
    print("\n[3/3] UI_TEXTS 탭 초기화")
    ws_texts = _ensure_tab(ss, "UI_TEXTS", rows=200, cols=2)
    _seed(ws_texts, UI_TEXTS_DEFAULTS, force=force)

    print("\n✅ 초기화 완료!")
    print("다음 단계:")
    print("  1. CONFIG 탭에서 ADMIN_PASSWORD 를 반드시 변경하세요.")
    print("  2. UI_TEXTS 탭에서 텍스트를 원하는 대로 수정하세요.")
    print(f"  3. 스프레드시트 URL: https://docs.google.com/spreadsheets/d/{master_id}")


if __name__ == "__main__":
    force = "--force" in sys.argv
    if force:
        print("⚠️  --force 모드: 기존 데이터를 덮어씁니다.")
    main(force=force)
