"""
환경변수 로더 + Google Sheets CONFIG 탭 설정값 접근
"""
import os
import json
from functools import lru_cache
from dotenv import load_dotenv

load_dotenv()


def get_env(key: str, default: str = "", required: bool = False) -> str:
    val = os.environ.get(key, default)
    if required and not val:
        raise EnvironmentError(f"필수 환경변수 '{key}'가 설정되지 않았습니다.")
    return val


def get_google_credentials() -> dict:
    raw = get_env("GOOGLE_CREDENTIALS_JSON", required=True)
    return json.loads(raw)


@lru_cache(maxsize=1)
def _load_config_from_sheets() -> dict:
    import gspread
    from google.oauth2.service_account import Credentials

    creds = Credentials.from_service_account_info(
        get_google_credentials(),
        scopes=[
            "https://www.googleapis.com/auth/spreadsheets",
            "https://www.googleapis.com/auth/drive",
        ],
    )
    gc = gspread.authorize(creds)
    ss = gc.open_by_key(get_env("MASTER_SPREADSHEET_ID", required=True))

    try:
        ws = ss.worksheet("CONFIG")
        rows = ws.get_all_values()
    except Exception:
        return {}

    config = {}
    for row in rows[1:]:
        if len(row) >= 2 and row[0].strip():
            config[row[0].strip()] = row[1].strip()
    return config


def get_config(key: str, default: str = "") -> str:
    try:
        return _load_config_from_sheets().get(key, default)
    except Exception:
        return default


def get_config_float(key: str, default: float) -> float:
    try:
        return float(get_config(key, str(default)))
    except (ValueError, TypeError):
        return default


def get_config_int(key: str, default: int) -> int:
    try:
        return int(get_config(key, str(default)))
    except (ValueError, TypeError):
        return default


# 자주 쓰이는 설정값 헬퍼 (기본값은 CONFIG 탭에서 덮어씀)
def ai_model() -> str:
    return get_config("AI_MODEL", "gemini-2.5-flash")

def collect_delay() -> int:
    return get_config_int("COLLECT_DELAY_SECONDS", 2)

def shift_threshold(level: str) -> float:
    """level: high | medium | low"""
    defaults = {"high": 0.5, "medium": 0.7, "low": 1.0}
    key = f"SENTIMENT_SHIFT_THRESHOLD_{level.upper()}"
    return get_config_float(key, defaults.get(level, 0.7))

def min_reviews_for_ai() -> int:
    return get_config_int("MIN_REVIEWS_FOR_AI", 30)

def min_reviews_for_version_ai() -> int:
    return get_config_int("MIN_REVIEWS_FOR_VERSION_AI", 50)

def surge_multiplier() -> float:
    return get_config_float("REVIEW_SURGE_MULTIPLIER", 3.0)

def velocity_threshold(level: str) -> int:
    """weekly review count thresholds: high | medium"""
    if level == "high":
        return get_config_int("HIGH_VELOCITY_THRESHOLD", 50)
    return get_config_int("MEDIUM_VELOCITY_THRESHOLD", 10)

def sample_google_count() -> int:
    return get_config_int("SAMPLE_GOOGLE_COUNT", 100)

def sample_apple_count() -> int:
    return get_config_int("SAMPLE_APPLE_COUNT", 50)
