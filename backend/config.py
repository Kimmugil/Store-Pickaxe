"""
환경변수 로더 + Google Sheets CONFIG 탭 설정값
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


def get_config_int(key: str, default: int) -> int:
    try:
        return int(get_config(key, str(default)))
    except (ValueError, TypeError):
        return default


def ai_model() -> str:
    return get_config("AI_MODEL", "gemini-2.5-flash")

def collect_delay() -> int:
    return get_config_int("COLLECT_DELAY_SECONDS", 2)

def min_reviews_for_ai() -> int:
    return get_config_int("MIN_REVIEWS_FOR_AI", 20)

def sample_google_count() -> int:
    return get_config_int("SAMPLE_GOOGLE_COUNT", 150)

def sample_apple_count() -> int:
    return get_config_int("SAMPLE_APPLE_COUNT", 150)

def daily_ai_limit() -> int:
    return get_config_int("AI_DAILY_LIMIT", 30)
