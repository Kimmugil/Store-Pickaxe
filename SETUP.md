# Store-Pickaxe 수동 세팅 가이드

처음 배포할 때 아래 순서대로 진행하세요.  
전체 소요 시간: **약 30~40분**

---

## 목차

1. [Google 서비스 계정 만들기](#1-google-서비스-계정-만들기)
2. [마스터 스프레드시트 만들기](#2-마스터-스프레드시트-만들기)
3. [Google Apps Script (GAS) 확인](#3-google-apps-script-gas-확인)
4. [Google Drive 폴더 만들기](#4-google-drive-폴더-만들기)
5. [Gemini API 키 발급](#5-gemini-api-키-발급)
6. [마스터 시트 초기화 스크립트 실행](#6-마스터-시트-초기화-스크립트-실행)
7. [GitHub Secrets 등록](#7-github-secrets-등록)
8. [Vercel 배포](#8-vercel-배포)
9. [초기 설정 확인](#9-초기-설정-확인)

---

## 1. Google 서비스 계정 만들기

서비스 계정은 코드가 Google Sheets·Drive에 접근할 때 사용하는 "봇 계정"입니다.

### 1-1. Google Cloud 프로젝트 생성

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 상단 프로젝트 선택 → **새 프로젝트** 클릭
3. 프로젝트 이름: `store-pickaxe` (자유롭게)
4. **만들기** 클릭

### 1-2. API 활성화

1. 좌측 메뉴 → **API 및 서비스** → **라이브러리**
2. `Google Sheets API` 검색 → **사용** 클릭
3. `Google Drive API` 검색 → **사용** 클릭

### 1-3. 서비스 계정 생성

1. 좌측 메뉴 → **API 및 서비스** → **사용자 인증 정보**
2. 상단 **+ 사용자 인증 정보 만들기** → **서비스 계정**
3. 이름: `pickaxe-bot` (자유롭게) → **완료**

### 1-4. JSON 키 파일 다운로드

1. 방금 만든 서비스 계정 클릭 → **키** 탭
2. **키 추가** → **새 키 만들기** → **JSON** 선택
3. 자동으로 JSON 파일 다운로드됨 → **절대 공개 저장소에 올리지 마세요**
4. 이 파일을 열어두세요 (이후 단계에서 내용을 복사해야 함)

---

## 2. 마스터 스프레드시트 만들기

### 2-1. 스프레드시트 생성

1. [Google Sheets](https://sheets.google.com) 접속 → **새 스프레드시트** 생성
2. 이름: `Store-Pickaxe Master` (자유롭게)

### 2-2. 서비스 계정에 편집 권한 부여

1. 스프레드시트 우측 상단 **공유** 클릭
2. 아까 다운로드한 JSON 파일 안의 `"client_email"` 값 복사  
   예: `pickaxe-bot@store-pickaxe-12345.iam.gserviceaccount.com`
3. 이메일 입력 → **편집자** 권한으로 **보내기**

### 2-3. 스프레드시트 ID 메모

URL 형식: `https://docs.google.com/spreadsheets/d/`**`여기가_ID`**`/edit`  
이 ID를 메모해두세요 → 이후 `MASTER_SPREADSHEET_ID`로 사용합니다.

---

## 3. Google Apps Script (GAS) 확인

> 이미 `Code.gs` 파일이 있다면 배포된 상태일 수 있습니다.  
> 아래 내용으로 GAS 웹앱 URL이 있는지 확인하세요.

### 3-1. GAS 웹앱이 이미 있는 경우

GAS 웹앱 URL이 있으면 이 단계를 건너뛰어도 됩니다.  
URL 형식: `https://script.google.com/macros/s/AKfy.../exec`

### 3-2. GAS 웹앱이 없는 경우 — 새로 배포

1. [Google Apps Script](https://script.google.com) 접속 → **새 프로젝트**
2. 기존 코드를 모두 지우고, 아래 `Code.gs` 내용을 붙여넣기:

```javascript
function doPost(e) {
  var output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);
  try {
    var payload = JSON.parse(e.postData.contents);
    var folderId = payload.folderId;
    var fileName = payload.fileName;
    var serviceAccountEmail = payload.serviceAccountEmail;
    var folder = DriveApp.getFolderById(folderId);
    var files = folder.getFiles();
    var existingId = "";
    while (files.hasNext()) {
      var file = files.next();
      if (file.getName() === fileName && !file.isTrashed()) {
        existingId = file.getId();
        _ensureEditorAccess(file, serviceAccountEmail);
        break;
      }
    }
    if (existingId) {
      output.setContent(JSON.stringify({ ok: true, spreadsheetId: existingId, reused: true }));
      return output;
    }
    var newSS = SpreadsheetApp.create(fileName);
    var newFile = DriveApp.getFileById(newSS.getId());
    newFile.moveTo(folder);
    _ensureEditorAccess(newFile, serviceAccountEmail);
    output.setContent(JSON.stringify({ ok: true, spreadsheetId: newSS.getId(), reused: false }));
    return output;
  } catch (err) {
    output.setContent(JSON.stringify({ ok: false, error: err.toString() }));
    return output;
  }
}
function _ensureEditorAccess(file, email) {
  try {
    var editors = file.getEditors();
    for (var i = 0; i < editors.length; i++) {
      if (editors[i].getEmail() === email) return;
    }
    file.addEditor(email);
  } catch (e) { Logger.log("권한 부여 실패: " + e.toString()); }
}
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, message: "GAS 정상 동작 중" }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

3. 우측 상단 **배포** → **새 배포**
4. 유형: **웹 앱**
5. 설정:
   - **실행 주체**: 나(내 Google 계정)
   - **액세스 권한**: 모든 사용자
6. **배포** 클릭 → 표시되는 URL 메모 (`GAS_WEB_APP_URL`)

---

## 4. Google Drive 폴더 만들기

앱별 스프레드시트가 여기에 자동 생성됩니다.

1. [Google Drive](https://drive.google.com) → **새로 만들기** → **폴더**
2. 이름: `Store-Pickaxe Apps` (자유롭게)
3. 폴더 우클릭 → **공유** → 서비스 계정 이메일 → **편집자** 권한 부여
4. 폴더 URL에서 ID 메모  
   예: `https://drive.google.com/drive/folders/`**`여기가_ID`**  
   → `GDRIVE_FOLDER_ID`로 사용

---

## 5. Gemini API 키 발급

1. [Google AI Studio](https://aistudio.google.com/apikey) 접속
2. **Create API Key** 클릭
3. 발급된 키 메모 → `GEMINI_API_KEY`로 사용

---

## 6. 마스터 시트 초기화 스크립트 실행

이 단계에서 마스터 스프레드시트에 MASTER / CONFIG / UI_TEXTS 탭이 자동 생성됩니다.

### 6-1. 로컬 환경 준비

```bash
# 프로젝트 루트에서 실행
pip install -r requirements.txt
```

### 6-2. .env 파일 생성

프로젝트 루트에 `.env` 파일을 만들고 아래 내용 입력:

```env
GOOGLE_CREDENTIALS_JSON={"type":"service_account","project_id":"...전체 JSON 한 줄..."}
MASTER_SPREADSHEET_ID=여기에_스프레드시트_ID
GDRIVE_FOLDER_ID=여기에_드라이브_폴더_ID
GAS_WEB_APP_URL=https://script.google.com/macros/s/.../exec
GEMINI_API_KEY=AIza...
```

> **JSON 한 줄 붙여넣기 방법**: 다운로드한 JSON 파일을 텍스트 편집기로 열고,  
> 줄바꿈을 모두 제거해서 한 줄로 만들어 붙여넣으세요.  
> (VS Code에서: `Ctrl+H` → `\n` 검색 → 공백으로 교체)

### 6-3. 초기화 실행

```bash
python -m backend.init_sheets
```

성공하면 다음과 같이 출력됩니다:
```
마스터 스프레드시트 연결 중...
[1/3] MASTER 탭 초기화 → 헤더 생성 완료
[2/3] CONFIG 탭 초기화 → 13개 행 시드 완료
[3/3] UI_TEXTS 탭 초기화 → 90개 행 시드 완료
✅ 초기화 완료!
```

### 6-4. 관리자 비밀번호 변경 (중요!)

스프레드시트 → **CONFIG 탭** 열기 → `ADMIN_PASSWORD` 행의 value 칸을 변경하세요.  
기본값 `changeme123`은 반드시 변경해야 합니다.

---

## 7. GitHub Secrets 등록

GitHub Actions가 수집·분석 스크립트를 실행하려면 아래 시크릿이 필요합니다.

1. GitHub 리포지토리 → **Settings** → **Secrets and variables** → **Actions**
2. **New repository secret** 클릭하여 아래 5개 추가:

| Secret 이름 | 값 |
|---|---|
| `GOOGLE_CREDENTIALS_JSON` | 서비스 계정 JSON 파일 내용 전체 (한 줄) |
| `MASTER_SPREADSHEET_ID` | 마스터 스프레드시트 ID |
| `GDRIVE_FOLDER_ID` | Google Drive 폴더 ID |
| `GAS_WEB_APP_URL` | GAS 웹앱 URL |
| `GEMINI_API_KEY` | Gemini API 키 |

---

## 8. Vercel 배포

### 8-1. Vercel 프로젝트 연결

1. [Vercel](https://vercel.com) 접속 → **Add New Project**
2. GitHub 리포지토리 선택
3. **Framework Preset**: Next.js 자동 감지됨
4. **Root Directory**: `frontend` 로 변경 ← **이것이 중요합니다**

### 8-2. 환경변수 등록

Vercel 프로젝트 설정에서 **Environment Variables** 탭 → 아래 4개 추가:

| 변수 이름 | 값 |
|---|---|
| `GOOGLE_CREDENTIALS_JSON` | 서비스 계정 JSON 전체 (한 줄) |
| `MASTER_SPREADSHEET_ID` | 마스터 스프레드시트 ID |
| `GDRIVE_FOLDER_ID` | Google Drive 폴더 ID |
| `GAS_WEB_APP_URL` | GAS 웹앱 URL |

> Gemini API 키는 백엔드(Python)에서만 사용하므로 Vercel에 추가하지 않아도 됩니다.

### 8-3. 배포

**Deploy** 클릭 → 완료 후 발급된 URL에 접속하면 Store-Pickaxe가 열립니다.

---

## 9. 초기 설정 확인

배포 후 아래 순서로 동작을 확인하세요.

### 9-1. 사이트 접속 확인

Vercel URL에 접속 → 홈 화면이 나타나면 성공

### 9-2. 가이드 페이지 확인

`/guide` 경로 접속 → 분석 기준과 스케줄이 표시되면 성공

### 9-3. 게임 등록 테스트

`/add` 경로 → 게임 검색 → 등록 시도  
→ "등록 완료" 화면이 나타나면 성공

### 9-4. 관리자 패널 접속

`/admin` 경로 → CONFIG 탭에 설정한 비밀번호 입력  
→ 등록된 게임 목록이 보이면 성공  
→ "AI 승인" 버튼으로 원하는 앱 승인

### 9-5. 첫 수집 테스트 (선택)

GitHub → **Actions** 탭 → `리뷰 수집 (daily)` → **Run workflow**  
→ 완료 후 앱 상세 페이지에서 평점 데이터가 표시되면 성공

---

## 자주 묻는 질문

### Q. GAS 웹앱 URL이 이미 있는데 그걸 쓰면 되나요?

**네.** 기존 `Code.gs` 파일이 이미 배포된 상태라면 그 URL을 그대로 사용하시면 됩니다.  
단, GAS 코드에 `doPost` 함수가 있어야 하며, "모든 사용자" 권한으로 배포되어 있어야 합니다.

### Q. 수집이 자동으로 안 되는 것 같아요.

GitHub Actions 스케줄은 UTC 기준입니다.  
`collect.yml`에 설정된 `0 18 * * *` = KST 새벽 3시입니다.  
Actions 탭에서 수동으로 실행(`Run workflow`)하여 테스트할 수 있습니다.

### Q. 애플 리뷰가 너무 적어요.

앱스토어 RSS API 특성상 최근 500개만 제공됩니다.  
인기 게임은 수집 빈도를 `high`로 설정하면 누락을 최소화할 수 있습니다.  
관리자 패널 → 앱 설정에서 직접 변경하거나, MASTER 시트에서 `collect_frequency` 컬럼을 `high`로 수정하세요.

### Q. CONFIG나 UI_TEXTS를 바꿔도 반영이 안 돼요.

- CONFIG 변경: Python 스크립트 재실행 시 즉시 반영 (캐시 없음)
- UI_TEXTS 변경: Vercel 캐시 TTL 1시간 후 자동 반영  
  즉시 반영하려면 Vercel 대시보드 → **Deployments** → **Redeploy**

### Q. 구글 플레이 검색이 가끔 실패해요.

`google-play-scraper` npm 패키지는 Google의 비공식 API를 사용합니다.  
Google이 요청을 차단하면 일시적으로 실패할 수 있습니다.  
이 경우 앱 ID(패키지명)를 직접 입력하는 방법을 사용하세요.  
(추후 업데이트 예정)

---

## 파일 구조 요약

```
Store-Pickaxe/
├── backend/                    # Python 수집·분석 스크립트
│   ├── config.py               # 환경변수 + CONFIG 탭 로더
│   ├── init_sheets.py          # 마스터 시트 초기화 (최초 1회)
│   ├── main_collect.py         # 수집 진입점 (GitHub Actions)
│   ├── main_analyze.py         # 분석 진입점 (GitHub Actions)
│   ├── collectors/             # 구글·애플 수집기
│   ├── analyzers/              # 샘플링·급변감지·AI 분석
│   └── sheets/                 # Google Sheets CRUD
├── frontend/                   # Next.js 웹앱 (Vercel 배포)
│   ├── app/                    # App Router 페이지·API
│   ├── components/             # React 컴포넌트
│   └── lib/                    # 타입·유틸·Sheets 클라이언트
├── .github/workflows/
│   ├── collect.yml             # 매일 새벽 수집 자동화
│   └── analyze.yml             # 수집 완료 후 AI 분석 자동화
├── requirements.txt            # Python 의존성
└── SETUP.md                    # 이 파일
```
