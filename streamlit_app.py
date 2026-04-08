"""
스토어 제련소 — 모바일 게임 스토어 리뷰 분석 대시보드
"""
import json

import streamlit as st

from src.config import is_sheets_configured, is_gemini_configured

st.set_page_config(
    page_title="스토어 제련소",
    page_icon="⛏",
    layout="wide",
    initial_sidebar_state="collapsed",
)

# ------------------------------------------------------------------ #
#  디자인 시스템 — Clean Line Bento
# ------------------------------------------------------------------ #

DESIGN_CSS = """
<style>
@import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/variable/pretendardvariable.css');
html,body,[class*="css"]{font-family:'Pretendard Variable',sans-serif!important;color:#1E1E1E!important;}
.stApp{background-color:#F4F5F7!important;color:#1E1E1E!important;}
#MainMenu,footer,header{visibility:hidden;}
.block-container{padding:2rem 3rem!important;max-width:1400px;}
h1,h2,h3,h4,h5,h6{font-weight:800!important;color:#1E1E1E!important;}
p,span,label,div{color:#1E1E1E;}
.stMarkdown p,.stMarkdown span{color:#1E1E1E!important;}
[data-testid="stMarkdownContainer"] p{color:#1E1E1E!important;}
.stTextInput label{color:#1E1E1E!important;}
.stTextInput>div{border:none!important;box-shadow:none!important;}
.stTextInput>div>div{border:1.5px solid #1E1E1E!important;border-radius:20px!important;background:#FFFFFF!important;box-shadow:none!important;}
.stTextInput>div>div>input{border:none!important;border-radius:20px!important;background:#FFFFFF!important;padding:14px 20px!important;font-size:15px!important;box-shadow:none!important;color:#1E1E1E!important;}
.stTextInput>div>div>input:focus{outline:none!important;box-shadow:none!important;}
.stTextInput>div>div:focus-within{border-color:#1E1E1E!important;box-shadow:none!important;}
.stButton>button{border:1.5px solid #1E1E1E!important;border-radius:20px!important;background:#FFFFFF!important;color:#1E1E1E!important;font-weight:600!important;padding:8px 20px!important;box-shadow:none!important;}
.stButton>button p{color:#1E1E1E!important;}
.stButton>button:hover{background:#1E1E1E!important;color:#FFFFFF!important;}
.stButton>button:hover p{color:#FFFFFF!important;}
.stButton>button[kind="primary"],.stButton>button[data-testid="baseButton-primary"],[data-testid="baseButton-primary"]{background:#1E1E1E!important;color:#FFFFFF!important;}
.stButton>button[kind="primary"] p,.stButton>button[data-testid="baseButton-primary"] p,[data-testid="baseButton-primary"] p{color:#FFFFFF!important;}
.stButton>button[kind="primary"]:hover,[data-testid="baseButton-primary"]:hover{background:#444444!important;}
.stTabs [data-baseweb="tab-list"]{background:transparent;border-bottom:1.5px solid #1E1E1E;}
.stTabs [data-baseweb="tab"]{border-radius:20px 20px 0 0!important;border:1.5px solid transparent!important;font-weight:600;color:#1E1E1E!important;}
.stTabs [aria-selected="true"]{border:1.5px solid #1E1E1E!important;border-bottom:1.5px solid #FFFFFF!important;background:#FFFFFF!important;}
.stSelectbox>div>div{border:1.5px solid #1E1E1E!important;border-radius:20px!important;}
div[data-testid="stMetricValue"]{font-weight:800;color:#1E1E1E!important;}
[data-testid="stAlert"]{border-radius:20px!important;}
</style>
"""

st.markdown(DESIGN_CSS, unsafe_allow_html=True)


def card(content_html: str):
    st.markdown(
        f'<div style="background:#FFFFFF;border:1.5px solid #1E1E1E;border-radius:20px;padding:24px;margin-bottom:16px;">{content_html}</div>',
        unsafe_allow_html=True,
    )


def badge(text: str, color: str = "#1E1E1E", bg: str = "#F4F5F7") -> str:
    return (
        f'<span style="display:inline-block;border:1.5px solid {color};'
        f'border-radius:20px;padding:2px 12px;font-size:12px;font-weight:600;'
        f'color:{color};background:{bg};margin:2px;">{text}</span>'
    )


def rating_color(score) -> tuple[str, str]:
    try:
        s = float(score)
    except (TypeError, ValueError):
        return "#757575", "#F4F5F7"
    if s >= 4.5:
        return "#82C29A", "#f0faf3"
    if s >= 4.0:
        return "#6DC2FF", "#eff8ff"
    if s >= 3.5:
        return "#FFD166", "#FFFCF0"
    return "#FF9F9F", "#fff0f0"


def sentiment_color(pct) -> tuple[str, str]:
    try:
        p = float(pct)
    except (TypeError, ValueError):
        return "#757575", "#F4F5F7"
    if p >= 75:
        return "#82C29A", "#f0faf3"
    if p >= 55:
        return "#6DC2FF", "#eff8ff"
    if p >= 40:
        return "#FFD166", "#FFFCF0"
    return "#FF9F9F", "#fff0f0"


def star_bar_svg(score) -> str:
    try:
        s = min(max(float(score), 0), 5)
    except (TypeError, ValueError):
        return ""
    pct = s / 5 * 100
    color, _ = rating_color(score)
    return (
        f'<svg width="120" height="12" viewBox="0 0 120 12" xmlns="http://www.w3.org/2000/svg">'
        f'<rect x="0" y="4" width="120" height="4" rx="2" fill="#E8E8E8" vector-effect="non-scaling-stroke"/>'
        f'<rect x="0" y="4" width="{pct * 1.2:.1f}" height="4" rx="2" fill="{color}" vector-effect="non-scaling-stroke"/>'
        f'</svg>'
    )


def sentiment_gauge_svg(pct) -> str:
    try:
        p = min(max(float(pct), 0), 100)
    except (TypeError, ValueError):
        return ""
    color, _ = sentiment_color(pct)
    return (
        f'<svg width="120" height="12" viewBox="0 0 120 12" xmlns="http://www.w3.org/2000/svg">'
        f'<rect x="0" y="4" width="120" height="4" rx="2" fill="#E8E8E8" vector-effect="non-scaling-stroke"/>'
        f'<rect x="0" y="4" width="{p * 1.2:.1f}" height="4" rx="2" fill="{color}" vector-effect="non-scaling-stroke"/>'
        f'</svg>'
    )


# ------------------------------------------------------------------ #
#  세션 상태 초기화
# ------------------------------------------------------------------ #

def _init_state():
    defaults = {
        "page": "home",
        "search_query": "",
        "search_results": [],
        "current_app_key": None,
        "current_app_meta": None,
        "analysis_result": None,
        "pending_register": None,
    }
    for k, v in defaults.items():
        if k not in st.session_state:
            st.session_state[k] = v


_init_state()


# ------------------------------------------------------------------ #
#  데이터 로더 (캐시)
# ------------------------------------------------------------------ #

@st.cache_resource(show_spinner=False)
def get_sheets():
    if not is_sheets_configured():
        return None
    from src.sheets_manager import SheetsManager
    return SheetsManager()


@st.cache_data(ttl=300, show_spinner=False)
def load_analyzed_apps():
    sheets = get_sheets()
    if not sheets:
        return []
    try:
        apps = sheets.get_all_apps()
        result = []
        for app in apps:
            if app.get("status") != "active":
                continue
            latest = sheets.get_latest_analysis(app["app_key"])
            result.append({"meta": app, "has_analysis": latest is not None, "latest": latest})
        return result
    except Exception:
        return []


@st.cache_data(ttl=60, show_spinner=False)
def load_app_analysis(app_key: str):
    sheets = get_sheets()
    if not sheets:
        return None, []
    latest = sheets.get_latest_analysis(app_key)
    history = sheets.get_analysis_history(app_key)
    return latest, history


# ------------------------------------------------------------------ #
#  네비게이션 헬퍼
# ------------------------------------------------------------------ #

def go_home():
    st.session_state.page = "home"
    st.session_state.current_app_key = None
    st.session_state.analysis_result = None
    load_analyzed_apps.clear()


def go_search(query: str):
    st.session_state.page = "search"
    st.session_state.search_query = query


def go_detail(app_key: str, app_meta: dict):
    st.session_state.page = "detail"
    st.session_state.current_app_key = app_key
    st.session_state.current_app_meta = app_meta
    st.session_state.analysis_result = None


# ------------------------------------------------------------------ #
#  홈 화면
# ------------------------------------------------------------------ #

def render_home():
    st.markdown(
        '<h1 style="font-size:2rem;font-weight:900;margin-bottom:4px;">스토어 제련소</h1>'
        '<p style="color:#757575;font-size:15px;margin-bottom:32px;">모바일 게임 스토어 리뷰 분석 대시보드</p>',
        unsafe_allow_html=True,
    )

    col_search, col_btn = st.columns([5, 1])
    with col_search:
        query = st.text_input(
            label="앱 검색",
            placeholder="앱 이름을 입력하세요 (한글/영문 모두 가능)",
            label_visibility="collapsed",
            key="home_search_input",
        )
    with col_btn:
        if st.button("검색", use_container_width=True, type="primary"):
            if query.strip():
                go_search(query.strip())
                st.rerun()

    if query and st.session_state.get("home_search_input"):
        import streamlit.components.v1 as components

    st.markdown("<br>", unsafe_allow_html=True)

    analyzed_apps = load_analyzed_apps()

    if not analyzed_apps:
        card(
            '<p style="color:#757575;font-size:14px;text-align:center;margin:16px 0;">아직 분석된 앱이 없습니다.<br>위 검색창에서 앱을 검색하고 분석을 시작해 보세요.</p>'
        )
        return

    st.markdown(
        '<p style="font-size:13px;font-weight:700;color:#757575;letter-spacing:0.7px;text-transform:uppercase;margin-bottom:12px;">분석된 앱</p>',
        unsafe_allow_html=True,
    )

    cols = st.columns(4)
    for i, item in enumerate(analyzed_apps):
        meta = item["meta"]
        latest = item.get("latest") or {}
        with cols[i % 4]:
            g_rating = meta.get("google_rating", "")
            a_rating = meta.get("apple_rating", "")
            g_color, g_bg = rating_color(g_rating)
            icon_url = meta.get("icon_url", "")
            icon_html = f'<img src="{icon_url}" width="40" height="40" style="border-radius:10px;border:1.5px solid #E8E8E8;" />' if icon_url else '<div style="width:40px;height:40px;border-radius:10px;border:1.5px solid #1E1E1E;background:#F4F5F7;display:flex;align-items:center;justify-content:center;font-size:18px;">📱</div>'
            g_badge = badge(f"G {g_rating}★", g_color, g_bg) if g_rating else ""
            a_color, a_bg = rating_color(a_rating)
            a_badge = badge(f"A {a_rating}★", a_color, a_bg) if a_rating else ""
            summary_text = str(latest.get("overall_summary", ""))[:60] + "..." if latest.get("overall_summary") else "분석 대기 중"
            card(
                f'<div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:12px;">{icon_html}<div style="flex:1;min-width:0;"><p style="font-weight:700;font-size:14px;margin:0;word-break:keep-all;">{meta.get("app_name","")}</p><p style="font-size:12px;color:#757575;margin:2px 0 0;">{meta.get("developer","")}</p></div></div>'
                f'<div style="margin-bottom:8px;">{g_badge}{a_badge}</div>'
                f'<p style="font-size:12px;color:#757575;word-break:keep-all;margin-bottom:12px;">{summary_text}</p>'
            )
            if st.button("분석 내용 확인하기", key=f"home_btn_{meta['app_key']}", use_container_width=True):
                go_detail(meta["app_key"], meta)
                st.rerun()


# ------------------------------------------------------------------ #
#  검색 결과 화면
# ------------------------------------------------------------------ #

def render_search():
    if st.button("← 홈으로"):
        go_home()
        st.rerun()

    query = st.session_state.search_query
    st.markdown(
        f'<h2 style="font-size:1.3rem;font-weight:800;margin:16px 0 4px;">"{query}" 검색 결과</h2>'
        '<p style="color:#757575;font-size:13px;margin-bottom:24px;">원하는 앱을 선택해 분석을 시작하세요.</p>',
        unsafe_allow_html=True,
    )

    if not st.session_state.search_results:
        with st.spinner("구글 플레이 & 앱스토어 검색 중..."):
            results = _do_search(query)
            st.session_state.search_results = results

    results = st.session_state.search_results

    if not results:
        card('<p style="color:#757575;text-align:center;margin:16px 0;">검색 결과가 없습니다. 다른 검색어를 입력해 보세요.</p>')
        return

    st.markdown(
        '<div style="background:#FFFFFF;border:1.5px solid #1E1E1E;border-radius:20px;padding:14px 20px;margin-bottom:20px;">'
        '<p style="font-size:13px;color:#757575;margin:0;word-break:keep-all;">'
        '앱 이름이 스토어마다 다르거나 검색 결과가 적을 경우, 실제로 양쪽 스토어에 있는 앱이 <b style="color:#1E1E1E;">애플 미확인</b>으로 표시될 수 있어요. '
        '이 경우 <b style="color:#1E1E1E;">분석 시작 →</b> 단계에서 앱스토어 URL 또는 앱 ID를 직접 입력해 연결할 수 있어요.'
        '</p>'
        '</div>',
        unsafe_allow_html=True,
    )

    # 구글 + 애플 결과를 앱 이름 기준으로 합산
    merged = _merge_search_results(results)

    sheets = get_sheets()
    registered_keys = set()
    if sheets:
        try:
            registered_keys = {a["app_key"] for a in sheets.get_all_apps()}
        except Exception:
            pass

    for item in merged:
        g = item.get("google")
        a = item.get("apple")
        display_name = (g or a or {}).get("app_name", "알 수 없음")
        developer = (g or a or {}).get("developer", "")
        icon_url = (g or a or {}).get("icon_url", "")

        g_rating = g.get("rating") if g else None
        a_rating = a.get("rating") if a else None
        g_color, g_bg = rating_color(g_rating)
        a_color, a_bg = rating_color(a_rating)
        g_badge = badge(f"구글 {g_rating:.1f}★", g_color, g_bg) if g_rating else badge("구글 미확인", "#AAAAAA", "#F4F5F7")
        a_badge = badge(f"애플 {a_rating:.1f}★", a_color, a_bg) if a_rating else badge("애플 미확인", "#AAAAAA", "#F4F5F7")

        icon_html = (
            f'<img src="{icon_url}" width="52" height="52" style="border-radius:14px;border:1.5px solid #E8E8E8;flex-shrink:0;" />'
            if icon_url else
            '<div style="width:52px;height:52px;border-radius:14px;border:1.5px solid #1E1E1E;background:#F4F5F7;display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0;">📱</div>'
        )

        col_info, col_btn = st.columns([6, 1])
        with col_info:
            st.markdown(
                f'<div style="background:#FFFFFF;border:1.5px solid #1E1E1E;border-radius:20px;padding:16px 20px;display:flex;align-items:center;gap:16px;">'
                f'{icon_html}'
                f'<div style="flex:1;min-width:0;">'
                f'<p style="font-weight:700;font-size:15px;margin:0 0 2px;word-break:keep-all;">{display_name}</p>'
                f'<p style="font-size:12px;color:#757575;margin:0 0 8px;">{developer}</p>'
                f'<div>{g_badge}{a_badge}</div>'
                f'</div>'
                f'</div>',
                unsafe_allow_html=True,
            )
        with col_btn:
            st.markdown("<div style='height:14px;'></div>", unsafe_allow_html=True)
            app_key = _make_app_key(display_name, developer)
            if app_key in registered_keys:
                if st.button("분석 확인 →", key=f"search_view_{app_key}", use_container_width=True):
                    meta = sheets.get_app_by_key(app_key)
                    go_detail(app_key, meta or {})
                    st.rerun()
            else:
                if st.button("분석 시작 →", key=f"search_start_{app_key}", use_container_width=True, type="primary"):
                    st.session_state.pending_register = {
                        "app_key": app_key,
                        "app_name": display_name,
                        "developer": developer,
                        "icon_url": icon_url,
                        "google": g,
                        "apple": a,
                    }
                    st.session_state.page = "register"
                    st.rerun()


def _do_search(query: str) -> list[dict]:
    results = []
    try:
        from src.google_pickaxe import GooglePickaxe
        gp = GooglePickaxe()
        results.extend(gp.search_apps(query, n_hits=15))
    except Exception as e:
        st.warning(f"구글 플레이 검색 오류: {e}")
    try:
        from src.apple_pickaxe import ApplePickaxe
        ap = ApplePickaxe()
        results.extend(ap.search_apps(query, n_hits=25))
    except Exception as e:
        st.warning(f"앱스토어 검색 오류: {e}")
    return results


def _name_similarity(name1: str, name2: str) -> float:
    """두 앱 이름의 단어 기반 유사도를 반환합니다 (0.0~1.0)."""
    import re as _re
    STOP = {'키우기', '게임', 'game', 'games', 'rpg', '방치형', 'idle', 'adventure',
            '리그', '리버스', '모바일', 'mobile', 'online', '온라인', 'the', 'a', 'of'}

    def tokenize(name: str) -> set:
        name = _re.sub(r'[^\w\s가-힣a-z0-9]', ' ', name.lower())
        return {t for t in name.split() if t not in STOP and len(t) > 1}

    t1, t2 = tokenize(name1), tokenize(name2)
    if not t1 or not t2:
        return 0.0
    intersection = len(t1 & t2)
    if intersection == 0:
        return 0.0
    jaccard = intersection / len(t1 | t2)
    if t1.issubset(t2) or t2.issubset(t1):
        jaccard = max(jaccard, 0.7)
    return jaccard


def _merge_search_results(results: list[dict]) -> list[dict]:
    """구글/애플 결과를 앱 이름 유사도로 합칩니다."""
    google_apps = [r for r in results if r.get("platform") == "google"]
    apple_apps = [r for r in results if r.get("platform") == "apple"]

    merged = []
    used_apple = set()

    for g in google_apps:
        g_name = g.get("app_name", "")
        best_idx, best_score = None, 0.0
        for j, a in enumerate(apple_apps):
            if j in used_apple:
                continue
            score = _name_similarity(g_name, a.get("app_name", ""))
            if score > best_score:
                best_score = score
                best_idx = j
        if best_idx is not None and best_score >= 0.3:
            merged.append({"google": g, "apple": apple_apps[best_idx]})
            used_apple.add(best_idx)
        else:
            merged.append({"google": g, "apple": None})

    for j, a in enumerate(apple_apps):
        if j not in used_apple:
            merged.append({"google": None, "apple": a})

    return merged[:15]


def _extract_apple_id(text: str) -> str | None:
    """Apple 앱 ID 또는 스토어 URL에서 숫자 ID를 추출합니다."""
    import re as _re
    text = text.strip()
    # URL 형식: /id1234567890
    m = _re.search(r'/id(\d+)', text)
    if m:
        return m.group(1)
    # 숫자만 입력
    if text.isdigit():
        return text
    return None


def _make_app_key(app_name: str, developer: str) -> str:
    import re
    name = re.sub(r"[^\w\s]", "", app_name.lower())
    name = re.sub(r"\s+", "_", name.strip())
    return name[:30]


# ------------------------------------------------------------------ #
#  앱 등록 + 최초 수집 화면
# ------------------------------------------------------------------ #

def render_register():
    pending = st.session_state.pending_register
    if not pending:
        go_home()
        st.rerun()
        return

    if st.button("← 검색으로 돌아가기"):
        st.session_state.page = "search"
        st.rerun()

    app_name = pending["app_name"]
    g = pending.get("google")
    a = pending.get("apple")

    st.markdown(
        f'<h2 style="font-size:1.3rem;font-weight:800;margin:16px 0 4px;">{app_name} 분석 시작</h2>'
        '<p style="color:#757575;font-size:13px;margin-bottom:24px;">리뷰를 처음 수집하고 AI 분석을 진행합니다. 수분 정도 소요될 수 있습니다.</p>',
        unsafe_allow_html=True,
    )

    col1, col2 = st.columns(2)
    with col1:
        if g:
            g_color, g_bg = rating_color(g.get("rating"))
            g_rating_str = f"{float(g['rating']):.1f}★" if g.get("rating") is not None else "?★"
            card(
                f'<p style="font-size:12px;font-weight:700;color:#757575;letter-spacing:0.7px;margin-bottom:8px;">구글 플레이</p>'
                f'<p style="font-weight:700;font-size:15px;margin:0 0 4px;">{g.get("app_name","")}</p>'
                f'<p style="font-size:12px;color:#757575;margin:0 0 8px;">{g.get("developer","")}</p>'
                f'<p style="font-size:13px;margin:0;word-break:keep-all;">{badge(g_rating_str, g_color, g_bg)} {badge(g.get("genre",""), "#757575", "#F4F5F7")}</p>'
            )
        else:
            card('<p style="color:#757575;font-size:13px;text-align:center;">구글 플레이에 없는 앱입니다.</p>')

    with col2:
        if a:
            a_color, a_bg = rating_color(a.get("rating"))
            a_rating_str = f"{float(a['rating']):.1f}★" if a.get("rating") is not None else "?★"
            card(
                f'<p style="font-size:12px;font-weight:700;color:#757575;letter-spacing:0.7px;margin-bottom:8px;">애플 앱스토어</p>'
                f'<p style="font-weight:700;font-size:15px;margin:0 0 4px;">{a.get("app_name","")}</p>'
                f'<p style="font-size:12px;color:#757575;margin:0 0 8px;">{a.get("developer","")}</p>'
                f'<p style="font-size:13px;margin:0;">{badge(a_rating_str, a_color, a_bg)} {badge(a.get("genre",""), "#757575", "#F4F5F7")}</p>'
            )
        else:
            card(
                '<p style="font-size:12px;font-weight:700;color:#757575;letter-spacing:0.7px;margin-bottom:8px;">애플 앱스토어</p>'
                '<p style="font-size:13px;color:#757575;margin:0 0 12px;word-break:keep-all;">자동으로 매칭되지 않았어요.<br>앱스토어 URL 또는 앱 ID를 직접 입력해 연결할 수 있어요.</p>'
            )
            manual_id = st.text_input(
                "Apple 앱 ID 또는 앱스토어 URL",
                placeholder="예) 123456789  또는  https://apps.apple.com/kr/app/.../id123456789",
                key="manual_apple_id_input",
                label_visibility="collapsed",
            )
            if st.button("애플 앱 연결하기", key="link_apple_btn"):
                apple_id = _extract_apple_id(manual_id)
                if not apple_id:
                    st.error("유효한 앱 ID 또는 URL을 입력해주세요.")
                else:
                    with st.spinner("앱스토어에서 앱 정보를 불러오는 중..."):
                        try:
                            from src.apple_pickaxe import ApplePickaxe
                            ap = ApplePickaxe()
                            detail = ap.get_app_detail(apple_id)
                            st.session_state.pending_register["apple"] = detail
                            st.success(f"연결 완료: {detail.get('app_name', '')}")
                            st.rerun()
                        except Exception as e:
                            st.error(f"앱을 찾을 수 없습니다: {e}")

    if not is_sheets_configured():
        st.error("Google Sheets 설정이 필요합니다. .env 파일 또는 Streamlit Secrets를 확인하세요.")
        return

    if st.button("리뷰 수집 및 분석 시작", type="primary", use_container_width=False):
        _run_register_and_analyze(pending)


def _run_register_and_analyze(pending: dict):
    sheets = get_sheets()
    app_key = pending["app_key"]
    g = pending.get("google")
    a = pending.get("apple")

    progress = st.progress(0, text="앱 등록 중...")

    # 앱 등록
    try:
        app_info = {
            "app_key": app_key,
            "app_name": pending["app_name"],
            "app_name_en": pending["app_name"],
            "developer": pending.get("developer", ""),
            "icon_url": pending.get("icon_url", ""),
            "google_package": g.get("package_name", "") if g else "",
            "apple_app_id": a.get("apple_app_id", "") if a else "",
            "category": (g or a or {}).get("genre", ""),
            "google_rating": g.get("rating", "") if g else "",
            "apple_rating": a.get("rating", "") if a else "",
        }
        sheets.register_app(app_info)
    except ValueError:
        pass  # 이미 등록된 경우
    except Exception as e:
        st.error(f"앱 등록 오류: {e}")
        return

    progress.progress(15, text="구글 플레이 리뷰 수집 중...")

    # 구글 리뷰 수집
    if g and g.get("package_name"):
        try:
            from src.google_pickaxe import GooglePickaxe
            gp = GooglePickaxe()
            reviews = gp.collect_all_reviews(g["package_name"], max_count=3000)
            sheets.save_google_reviews(app_key, reviews)
            progress.progress(40, text=f"구글 리뷰 {len(reviews)}개 수집 완료. 애플 수집 중...")
        except Exception as e:
            st.warning(f"구글 리뷰 수집 오류: {e}")

    # 애플 리뷰 수집
    if a and a.get("apple_app_id"):
        try:
            from src.apple_pickaxe import ApplePickaxe
            ap = ApplePickaxe()
            reviews = ap.collect_all_reviews(
                a["apple_app_id"], pending["app_name"], how_many=2000
            )
            sheets.save_apple_reviews(app_key, reviews)
            progress.progress(65, text=f"애플 리뷰 {len(reviews)}개 수집 완료. AI 분석 중...")
        except Exception as e:
            st.warning(f"애플 리뷰 수집 오류: {e}")

    # AI 분석
    if not is_gemini_configured():
        st.warning("Gemini API 키가 없어 AI 분석을 건너뜁니다.")
        progress.progress(100, text="수집 완료.")
    else:
        try:
            progress.progress(70, text="AI 분석 중 (수십 초 소요)...")
            from src.analyzer import StoreAnalyzer
            analyzer = StoreAnalyzer()
            g_reviews = sheets.load_reviews(app_key, "google")
            a_reviews = sheets.load_reviews(app_key, "apple")
            app_meta = sheets.get_app_by_key(app_key) or app_info
            result = analyzer.analyze_app(app_meta, g_reviews, a_reviews)
            analysis_id = sheets.save_analysis(app_key, result)
            result["analysis_id"] = analysis_id
            st.session_state.analysis_result = result
            progress.progress(100, text="분석 완료!")
        except Exception as e:
            st.error(f"AI 분석 오류: {e}")
            progress.progress(100, text="수집 완료 (분석 실패).")

    load_analyzed_apps.clear()
    load_app_analysis.clear()

    st.session_state.pending_register = None
    app_meta_fresh = sheets.get_app_by_key(app_key)
    go_detail(app_key, app_meta_fresh or {"app_key": app_key, "app_name": pending["app_name"]})
    st.rerun()


# ------------------------------------------------------------------ #
#  앱 상세 / 분석 화면
# ------------------------------------------------------------------ #

def render_detail():
    app_key = st.session_state.current_app_key
    app_meta = st.session_state.current_app_meta or {}

    if st.button("← 홈으로"):
        go_home()
        st.rerun()

    app_name = app_meta.get("app_name") or app_key or "앱"
    developer = app_meta.get("developer", "")
    icon_url = app_meta.get("icon_url", "")

    icon_html = (
        f'<img src="{icon_url}" width="64" height="64" style="border-radius:16px;border:1.5px solid #E8E8E8;" />'
        if icon_url else
        '<div style="width:64px;height:64px;border-radius:16px;border:1.5px solid #1E1E1E;background:#F4F5F7;display:flex;align-items:center;justify-content:center;font-size:30px;">📱</div>'
    )

    latest, history = load_app_analysis(app_key)
    analysis = st.session_state.analysis_result or latest

    col_header, col_actions = st.columns([5, 1])
    with col_header:
        g_total = app_meta.get("total_google", 0)
        a_total = app_meta.get("total_apple", 0)
        last_run = app_meta.get("last_pickaxe_run", "")
        st.markdown(
            f'<div style="display:flex;align-items:center;gap:16px;margin-bottom:8px;">'
            f'{icon_html}'
            f'<div>'
            f'<h1 style="font-size:1.6rem;font-weight:900;margin:0 0 2px;">{app_name}</h1>'
            f'<p style="font-size:13px;color:#757575;margin:0;">{developer}'
            + (f' · 구글 {g_total:,}개 · 애플 {a_total:,}개' if g_total or a_total else '')
            + (f' · 최종 수집 {last_run[:10]}' if last_run else '')
            + f'</p></div></div>',
            unsafe_allow_html=True,
        )
    with col_actions:
        st.markdown("<div style='height:20px;'></div>", unsafe_allow_html=True)
        if st.button("다시 분석하기", type="primary"):
            _reanalyze(app_key, app_meta)

    if not analysis:
        card('<p style="color:#757575;text-align:center;font-size:14px;margin:24px 0;">아직 분석 결과가 없습니다.<br>리뷰 수집이 완료된 후 분석이 진행됩니다.</p>')
        return

    tab1, tab2, tab3, tab4 = st.tabs(["종합 평가", "플랫폼 비교", "버전 타임라인", "분석 이력"])

    with tab1:
        _render_overview(analysis, app_meta)
    with tab2:
        _render_platform_comparison(analysis)
    with tab3:
        _render_timeline(app_key)
    with tab4:
        _render_history(history)


def _reanalyze(app_key: str, app_meta: dict):
    sheets = get_sheets()
    if not sheets or not is_gemini_configured():
        st.error("Sheets 또는 Gemini 설정이 필요합니다.")
        return
    with st.spinner("최신 리뷰 추가 수집 및 재분석 중..."):
        # 신규 리뷰 수집
        g_package = app_meta.get("google_package", "").strip()
        a_id = str(app_meta.get("apple_app_id", "")).strip()
        if g_package:
            try:
                from src.google_pickaxe import GooglePickaxe
                gp = GooglePickaxe()
                existing = sheets.get_existing_review_ids(app_key, "google")
                new_r = gp.collect_new_reviews(g_package, existing)
                sheets.save_google_reviews(app_key, new_r)
            except Exception as e:
                st.warning(f"구글 추가 수집 오류: {e}")
        if a_id:
            try:
                from src.apple_pickaxe import ApplePickaxe
                ap = ApplePickaxe()
                existing = sheets.get_existing_review_ids(app_key, "apple")
                new_r = ap.collect_new_reviews(a_id, app_meta.get("app_name", ""), existing)
                sheets.save_apple_reviews(app_key, new_r)
            except Exception as e:
                st.warning(f"애플 추가 수집 오류: {e}")

        # 재분석
        try:
            from src.analyzer import StoreAnalyzer
            analyzer = StoreAnalyzer()
            g_reviews = sheets.load_reviews(app_key, "google")
            a_reviews = sheets.load_reviews(app_key, "apple")
            result = analyzer.analyze_app(app_meta, g_reviews, a_reviews)
            analysis_id = sheets.save_analysis(app_key, result)
            result["analysis_id"] = analysis_id
            st.session_state.analysis_result = result
        except Exception as e:
            st.error(f"재분석 오류: {e}")

    load_app_analysis.clear()
    load_analyzed_apps.clear()
    st.rerun()


def _render_overview(analysis: dict, app_meta: dict):
    g_score = analysis.get("google_sentiment_score", "")
    a_score = analysis.get("apple_sentiment_score", "")
    g_color, g_bg = sentiment_color(g_score)
    a_color, a_bg = sentiment_color(a_score)
    analysis_id = analysis.get("analysis_id", "")
    created_at = analysis.get("created_at", "")

    st.markdown("<br>", unsafe_allow_html=True)

    meta_info = ""
    if analysis_id:
        meta_info = f'<p style="font-size:11px;color:#757575;margin:0 0 16px;">분석 ID: {analysis_id[:8]}... · {created_at[:16]}</p>'

    col1, col2, col3 = st.columns(3)
    with col1:
        st.markdown(
            f'<div style="background:#FFFFFF;border:1.5px solid #1E1E1E;border-radius:20px;padding:20px;">'
            f'<p style="font-size:11px;font-weight:700;color:#757575;letter-spacing:0.7px;margin:0 0 8px;">구글 긍정도</p>'
            f'<p style="font-size:2rem;font-weight:900;margin:0 0 4px;color:{g_color};">{g_score}%</p>'
            f'{sentiment_gauge_svg(g_score)}'
            f'</div>',
            unsafe_allow_html=True,
        )
    with col2:
        st.markdown(
            f'<div style="background:#FFFFFF;border:1.5px solid #1E1E1E;border-radius:20px;padding:20px;">'
            f'<p style="font-size:11px;font-weight:700;color:#757575;letter-spacing:0.7px;margin:0 0 8px;">애플 긍정도</p>'
            f'<p style="font-size:2rem;font-weight:900;margin:0 0 4px;color:{a_color};">{a_score}%</p>'
            f'{sentiment_gauge_svg(a_score)}'
            f'</div>',
            unsafe_allow_html=True,
        )
    with col3:
        g_count = analysis.get("google_review_count", 0)
        a_count = analysis.get("apple_review_count", 0)
        st.markdown(
            f'<div style="background:#FFFFFF;border:1.5px solid #1E1E1E;border-radius:20px;padding:20px;">'
            f'<p style="font-size:11px;font-weight:700;color:#757575;letter-spacing:0.7px;margin:0 0 8px;">분석 리뷰 수</p>'
            f'<p style="font-size:1.5rem;font-weight:900;margin:0 0 4px;">{int(g_count or 0) + int(a_count or 0):,}개</p>'
            f'<p style="font-size:12px;color:#757575;margin:0;">G {g_count:,} · A {a_count:,}</p>'
            f'</div>',
            unsafe_allow_html=True,
        )

    st.markdown("<br>", unsafe_allow_html=True)

    # 종합 평가
    summary = analysis.get("overall_summary", "")
    if summary:
        card(
            f'<p style="font-size:11px;font-weight:700;color:#757575;letter-spacing:0.7px;margin:0 0 12px;">종합 평가</p>'
            f'{meta_info}'
            f'<p style="font-size:14px;line-height:1.8;word-break:keep-all;margin:0;">{summary}</p>'
        )

    # 칭찬 / 불만
    praises = _parse_list_field(analysis.get("main_praises", ""))
    complaints = _parse_list_field(analysis.get("main_complaints", ""))

    if praises or complaints:
        col_p, col_c = st.columns(2)
        with col_p:
            if praises:
                badges_html = "".join(badge(p, "#82C29A", "#f0faf3") for p in praises)
                card(
                    f'<p style="font-size:11px;font-weight:700;color:#757575;letter-spacing:0.7px;margin:0 0 12px;">주요 칭찬</p>'
                    f'<div>{badges_html}</div>'
                )
        with col_c:
            if complaints:
                badges_html = "".join(badge(c, "#FF9F9F", "#fff0f0") for c in complaints)
                card(
                    f'<p style="font-size:11px;font-weight:700;color:#757575;letter-spacing:0.7px;margin:0 0 12px;">주요 불만</p>'
                    f'<div>{badges_html}</div>'
                )


def _render_platform_comparison(analysis: dict):
    st.markdown("<br>", unsafe_allow_html=True)
    col1, col2 = st.columns(2)

    g_insights = analysis.get("google_insights", "")
    a_insights = analysis.get("apple_insights", "")
    g_keywords = _parse_list_field(analysis.get("top_keywords_google", ""))
    a_keywords = _parse_list_field(analysis.get("top_keywords_apple", ""))

    with col1:
        kw_html = "".join(badge(k, "#6DC2FF", "#eff8ff") for k in g_keywords)
        card(
            f'<p style="font-size:11px;font-weight:700;color:#757575;letter-spacing:0.7px;margin:0 0 12px;">구글 플레이 인사이트</p>'
            f'<p style="font-size:14px;line-height:1.8;word-break:keep-all;margin:0 0 16px;">{g_insights}</p>'
            f'<p style="font-size:11px;font-weight:700;color:#757575;letter-spacing:0.7px;margin:0 0 8px;">주요 키워드</p>'
            f'<div>{kw_html}</div>'
        )

    with col2:
        kw_html = "".join(badge(k, "#6DC2FF", "#eff8ff") for k in a_keywords)
        card(
            f'<p style="font-size:11px;font-weight:700;color:#757575;letter-spacing:0.7px;margin:0 0 12px;">애플 앱스토어 인사이트</p>'
            f'<p style="font-size:14px;line-height:1.8;word-break:keep-all;margin:0 0 16px;">{a_insights}</p>'
            f'<p style="font-size:11px;color:#757575;margin:0 0 16px;">※ Apple 공식 API 제한으로 최근 500개 리뷰 기준 분석입니다.</p>'
            f'<p style="font-size:11px;font-weight:700;color:#757575;letter-spacing:0.7px;margin:0 0 8px;">주요 키워드</p>'
            f'<div>{kw_html}</div>'
        )

    platform_diff = analysis.get("platform_diff", "")
    if platform_diff:
        st.markdown("<br>", unsafe_allow_html=True)
        card(
            f'<p style="font-size:11px;font-weight:700;color:#757575;letter-spacing:0.7px;margin:0 0 12px;">플랫폼 간 차이점</p>'
            f'<p style="font-size:14px;line-height:1.8;word-break:keep-all;margin:0;">{platform_diff}</p>'
        )


def _render_timeline(app_key: str):
    st.markdown("<br>", unsafe_allow_html=True)
    sheets = get_sheets()
    if not sheets:
        card('<p style="color:#757575;text-align:center;">Sheets 연결이 필요합니다.</p>')
        return

    events = sheets.load_timeline(app_key)
    if not events:
        card('<p style="color:#757575;text-align:center;font-size:14px;margin:16px 0;">타임라인 데이터가 아직 없습니다.<br>리뷰가 충분히 쌓이면 버전별 타임라인이 자동 생성됩니다.</p>')
        return

    sorted_events = sorted(events, key=lambda e: str(e.get("date", "")), reverse=True)

    for ev in sorted_events:
        version = ev.get("version", "")
        date = str(ev.get("date", ""))[:10]
        period_end = str(ev.get("period_end", ""))[:10]
        g_pct = ev.get("google_sentiment_pct", "")
        a_pct = ev.get("apple_sentiment_pct", "")
        g_count = ev.get("google_review_count", 0)
        a_count = ev.get("apple_review_count", 0)
        summary = ev.get("kr_summary", "")
        key_issues_raw = ev.get("key_issues", "")
        key_issues = _parse_list_field(key_issues_raw)

        g_color, g_bg = sentiment_color(g_pct)
        a_color, a_bg = sentiment_color(a_pct)
        period_str = f"{date} ~ {period_end}" if period_end and period_end != date else date

        issues_html = "".join(badge(k, "#757575", "#F4F5F7") for k in key_issues) if key_issues else ""
        summary_html = f'<p style="font-size:13px;color:#1E1E1E;word-break:keep-all;margin:8px 0 0;">{summary}</p>' if summary else ""

        card(
            f'<div style="display:flex;align-items:flex-start;gap:16px;">'
            f'<div style="flex-shrink:0;">'
            f'<p style="font-size:13px;font-weight:800;margin:0;">v{version}</p>'
            f'<p style="font-size:11px;color:#757575;margin:2px 0 0;">{period_str}</p>'
            f'</div>'
            f'<div style="flex:1;min-width:0;">'
            f'<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:8px;">'
            f'<div><p style="font-size:11px;font-weight:700;color:#757575;margin:0 0 2px;">구글 긍정도</p>'
            f'<span style="font-size:15px;font-weight:800;color:{g_color};">{g_pct}%</span>'
            f'<span style="font-size:11px;color:#757575;"> ({g_count}개)</span></div>'
            f'<div><p style="font-size:11px;font-weight:700;color:#757575;margin:0 0 2px;">애플 긍정도</p>'
            f'<span style="font-size:15px;font-weight:800;color:{a_color};">{a_pct}%</span>'
            f'<span style="font-size:11px;color:#757575;"> ({a_count}개)</span></div>'
            f'</div>'
            f'{issues_html}'
            f'{summary_html}'
            f'</div></div>'
        )


def _render_history(history: list[dict]):
    st.markdown("<br>", unsafe_allow_html=True)
    if not history:
        card('<p style="color:#757575;text-align:center;font-size:14px;margin:16px 0;">분석 이력이 없습니다.</p>')
        return

    st.markdown(
        f'<p style="font-size:13px;color:#757575;margin-bottom:16px;">총 {len(history)}회 분석이 진행되었습니다. 최신순으로 표시됩니다.</p>',
        unsafe_allow_html=True,
    )

    for item in history:
        analysis_id = item.get("analysis_id", "")
        created_at = str(item.get("created_at", ""))[:16]
        g_score = item.get("google_sentiment_score", "")
        a_score = item.get("apple_sentiment_score", "")
        g_count = item.get("google_review_count", 0)
        a_count = item.get("apple_review_count", 0)
        model = item.get("model_used", "")
        summary = str(item.get("overall_summary", ""))[:120]

        g_color, _ = sentiment_color(g_score)
        a_color, _ = sentiment_color(a_score)

        card(
            f'<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;">'
            f'<div>'
            f'<p style="font-size:12px;font-weight:700;margin:0 0 4px;color:#757575;font-family:monospace;">{analysis_id[:8]}...</p>'
            f'<p style="font-size:13px;font-weight:700;margin:0;">{created_at}</p>'
            f'</div>'
            f'<div style="display:flex;gap:12px;">'
            f'<div style="text-align:right;"><p style="font-size:11px;color:#757575;margin:0;">구글</p><p style="font-size:15px;font-weight:800;color:{g_color};margin:0;">{g_score}%</p></div>'
            f'<div style="text-align:right;"><p style="font-size:11px;color:#757575;margin:0;">애플</p><p style="font-size:15px;font-weight:800;color:{a_color};margin:0;">{a_score}%</p></div>'
            f'<div style="text-align:right;"><p style="font-size:11px;color:#757575;margin:0;">리뷰</p><p style="font-size:13px;font-weight:700;margin:0;">{int(g_count or 0)+int(a_count or 0):,}</p></div>'
            f'</div>'
            f'</div>'
            f'<p style="font-size:13px;color:#757575;word-break:keep-all;margin:8px 0 0;">{summary}{"..." if len(str(item.get("overall_summary",""))) > 120 else ""}</p>'
            + (f'<p style="font-size:11px;color:#C0C0C0;margin:4px 0 0;">{model}</p>' if model else "")
        )


# ------------------------------------------------------------------ #
#  유틸
# ------------------------------------------------------------------ #

def _parse_list_field(value) -> list[str]:
    if not value:
        return []
    if isinstance(value, list):
        return [str(v) for v in value]
    if isinstance(value, str):
        stripped = value.strip()
        if stripped.startswith("["):
            try:
                parsed = json.loads(stripped)
                return [str(v) for v in parsed]
            except Exception:
                pass
        return [s.strip().strip('"').strip("'") for s in stripped.strip("[]").split(",") if s.strip()]
    return []


# ------------------------------------------------------------------ #
#  라우터
# ------------------------------------------------------------------ #

def main():
    page = st.session_state.page

    if page == "home":
        render_home()
    elif page == "search":
        render_search()
    elif page == "register":
        render_register()
    elif page == "detail":
        render_detail()
    else:
        go_home()
        st.rerun()


main()
