@echo off
chcp 65001 >nul
echo ==========================================
echo    🚀 로컬 파일 공유 앱 설정 및 실행
echo ==========================================
echo.

REM 관리자 권한 확인
openfiles >nul 2>&1
if %errorlevel% neq 0 (
    echo [⚠️ 알림] 관리자 권한으로 실행하는 것을 권장합니다.
    echo 포트 바인딩 문제가 있을 수 있습니다.
    echo.
)

REM Node.js 설치 확인
echo 📋 시스템 확인 중...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [❌ 오류] Node.js가 설치되어 있지 않습니다.
    echo.
    echo 📥 Node.js 설치 방법:
    echo 1. https://nodejs.org 접속
    echo 2. LTS 버전 다운로드
    echo 3. 설치 후 컴퓨터 재시작
    echo.
    pause
    exit /b 1
)

echo ✅ Node.js 버전: 
node --version
echo ✅ NPM 버전: 
npm --version
echo.

REM 필요한 파일들 확인
echo 📁 필수 파일 확인 중...
set "missing_files="

if not exist "package.json" set "missing_files=%missing_files% package.json"
if not exist "main.js" set "missing_files=%missing_files% main.js"
if not exist "server.js" set "missing_files=%missing_files% server.js"
if not exist "preload.js" set "missing_files=%missing_files% preload.js"

if not "%missing_files%"=="" (
    echo [❌ 오류] 다음 파일들이 없습니다:%missing_files%
    echo.
    echo 모든 파일을 올바른 폴더에 저장했는지 확인해주세요.
    pause
    exit /b 1
)

echo ✅ 모든 필수 파일이 존재합니다.
echo.

REM 포트 3000 사용 확인
echo 🔍 포트 3000 사용 상태 확인...
netstat -ano | findstr :3000 >nul 2>&1
if %errorlevel% equ 0 (
    echo [⚠️ 경고] 포트 3000이 이미 사용 중입니다.
    echo.
    echo 다음 중 하나를 선택하세요:
    echo 1. 다른 프로그램 종료 후 계속
    echo 2. 그래도 실행 시도
    echo 3. 종료
    set /p port_choice="선택 (1, 2, 3): "
    
    if "%port_choice%"=="1" (
        echo 다른 프로그램을 종료한 후 다시 실행해주세요.
        pause
        exit /b 1
    )
    if "%port_choice%"=="3" (
        exit /b 1
    )
    echo 실행을 계속합니다...
    echo.
) else (
    echo ✅ 포트 3000 사용 가능
    echo.
)

REM node_modules 확인 및 설치
if not exist "node_modules" (
    echo 📦 의존성 패키지 설치 중... (처음 실행시 시간이 걸릴 수 있습니다)
    npm install
    if %errorlevel% neq 0 (
        echo [❌ 오류] 의존성 설치에 실패했습니다.
        echo.
        echo 해결 방법:
        echo 1. 인터넷 연결 확인
        echo 2. 방화벽/백신 프로그램 확인
        echo 3. 관리자 권한으로 실행
        echo 4. npm cache clean --force 실행 후 재시도
        pause
        exit /b 1
    )
    echo ✅ 의존성 설치 완료
    echo.
) else (
    echo ✅ 의존성 패키지가 이미 설치되어 있습니다.
    echo.
)

REM 실행 옵션 선택
echo ==========================================
echo 실행 옵션을 선택하세요:
echo 1. 개발 모드 (권장) - 빠른 실행
echo 2. 일반 모드 - 안정적 실행
echo 3. 포터블 빌드 - exe 파일 생성
echo 4. 종료
echo ==========================================
set /p run_choice="선택 (1, 2, 3, 4): "

if "%run_choice%"=="1" (
    echo.
    echo 🔧 개발 모드로 실행 중...
    echo 💡 창이 열리면 http://localhost:3000 으로 접속됩니다.
    echo 💡 종료하려면 이 창에서 Ctrl+C를 누르세요.
    echo.
    npm run dev
) else if "%run_choice%"=="2" (
    echo.
    echo 🚀 일반 모드로 실행 중...
    echo 💡 창이 열리면 http://localhost:3000 으로 접속됩니다.
    echo 💡 종료하려면 이 창에서 Ctrl+C를 누르세요.
    echo.
    npm start
) else if "%run_choice%"=="3" (
    echo.
    echo 📦 포터블 실행파일 생성 중...
    npm run build-win
    if %errorlevel% equ 0 (
        echo ✅ 빌드 완료! dist 폴더를 확인하세요.
        explorer dist 2>nul
    )
) else if "%run_choice%"=="4" (
    echo 종료합니다.
    exit /b 0
) else (
    echo 잘못된 선택입니다.
    pause
    goto :eof
)

echo.
echo ==========================================
echo 문제가 발생하면:
echo • 이 스크립트를 관리자 권한으로 실행
echo • 방화벽에서 Node.js 허용
echo • 백신 프로그램에서 폴더 제외 설정
echo ==========================================
pause