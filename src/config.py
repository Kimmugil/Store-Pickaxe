"""
환경변수 및 인증 정보 로더.
우선순위: Streamlit Secrets > OS 환경변수 > .env 파일
"""
import json
import os

from dotenv import load_dotenv

load_dotenv()


def _get(key: str, default=None):
    """Streamlit secrets → 환경변수 순으로 값을 조회합니다."""
    try:
        import streamlit as st
        return st.secrets.get(key, os.environ.get(key, default))
    except Exception:
        return os.environ.get(key, default)


def get_gemini_api_key() -> str | None:
    return _get("GEMINI_API_KEY")


def get_gdrive_folder_id() -> str | None:
    return _get("GDRIVE_FOLDER_ID")


def get_master_spreadsheet_id() -> str | None:
    return _get("MASTER_SPREADSHEET_ID")


def get_google_credentials():
    """
    Google 서비스 계정 자격증명을 반환합니다.
    Streamlit Secrets의 [GOOGLE_SERVICE_ACCOUNT] 섹션 또는
    GOOGLE_SERVICE_ACCOUNT_JSON 환경변수를 지원합니다.
    """
    try:
        import streamlit as st
        from google.oauth2.service_account import Credentials

        scopes = [
            "https://spreadsheets.google.com/feeds",
            "https://www.googleapis.com/auth/drive",
        ]

        # Streamlit secrets TOML 섹션 방식
        if "GOOGLE_SERVICE_ACCOUNT" in st.secrets:
            info = dict(st.secrets["GOOGLE_SERVICE_ACCOUNT"])
            return Credentials.from_service_account_info(info, scopes=scopes)
    except Exception:
        pass

    # JSON 문자열 환경변수 방식 (GitHub Actions 등)
    json_str = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON")
    if json_str:
        from google.oauth2.service_account import Credentials

        scopes = [
            "https://spreadsheets.google.com/feeds",
            "https://www.googleapis.com/auth/drive",
        ]
        info = json.loads(json_str)
        return Credentials.from_service_account_info(info, scopes=scopes)

    return None


def is_sheets_configured() -> bool:
    return get_google_credentials() is not None


def is_gemini_configured() -> bool:
    return bool(get_gemini_api_key())
