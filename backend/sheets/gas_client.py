"""
Google Apps Script 웹앱 클라이언트
기존 Code.gs를 그대로 사용 — 스프레드시트 생성 및 서비스 계정 권한 부여
"""
import time
import requests
from backend.config import get_env, get_google_credentials


def create_or_get_spreadsheet(file_name: str) -> tuple[str, bool]:
    """
    GAS 웹앱에 스프레드시트 생성을 요청한다.
    이미 존재하면 기존 ID를 반환한다.
    Returns: (spreadsheet_id, is_new)
    """
    gas_url = get_env("GAS_WEB_APP_URL", required=True)
    folder_id = get_env("GDRIVE_FOLDER_ID", required=True)
    service_account_email = get_google_credentials()["client_email"]

    payload = {
        "folderId": folder_id,
        "fileName": file_name,
        "serviceAccountEmail": service_account_email,
    }

    for attempt in range(3):
        try:
            resp = requests.post(gas_url, json=payload, timeout=30)
            resp.raise_for_status()
            data = resp.json()
            if not data.get("ok"):
                raise RuntimeError(f"GAS 오류: {data.get('error', '알 수 없는 오류')}")
            return data["spreadsheetId"], not data.get("reused", False)
        except Exception as e:
            if attempt == 2:
                raise
            time.sleep(5)

    raise RuntimeError("GAS 요청 3회 실패")


def app_spreadsheet_name(app_key: str, app_name: str) -> str:
    return f"Store-Pickaxe | {app_name} ({app_key})"
