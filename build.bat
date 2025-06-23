@echo off
chcp 65001 >nul
echo ==========================================
echo    🚀 로컬 파일 공유 Electron 앱 빌드
echo ==========================================
echo.

REM Node.js 설치 확인
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [❌ 오류] Node.js가 설치되어 있지 않습니다.
    echo Node.js를 https://nodejs.org 에서 다운로드하여 설치해주세요.
    echo.
    pause
    exit /b 1
)

echo ✅ Node.js 버전: 
node --version

REM 필요한 파일들 확인
echo.
echo 📁 필요한 파일들 확인 중...
if not exist "package.json" (
    echo [❌ 오류] package.json 파일이 없습니다.
    pause
    exit /b 1
)
if not exist "main.js" (
    echo [❌ 오류] main.js 파일이 없습니다.
    pause
    exit /b 1
)
if not exist "server.js" (
    echo [❌ 오류] server.js 파일이 없습니다.
    pause
    exit /b 1
)
if not exist "preload.js" (
    echo [❌ 오류] preload.js 파일이 없습니다.
    pause
    exit /b 1
)

echo ✅ 모든 필수 파일이 존재합니다.

REM 의존성 설치
echo.
echo 📦 의존성 패키지 설치 중...
npm install
if %errorlevel% neq 0 (
    echo [❌ 오류] 의존성 설치에 실패했습니다.
    pause
    exit /b 1
)

echo ✅ 의존성 설치 완료

REM 개발 모드 실행 옵션
echo.
echo ==========================================
echo 다음 중 선택하세요:
echo 1. 개발 모드로 실행 (빠른 테스트)
echo 2. 배포용 빌드 (시간 오래 걸림)
echo 3. 포터블 실행파일만 생성
echo ==========================================
set /p choice="선택 (1, 2, 3): "

if "%choice%"=="1" (
    echo.
    echo 🔧 개발 모드로 실행 중...
    echo 앱이 열리면 테스트해보세요. 종료는 Ctrl+C
    echo.
    npm run dev
) else if "%choice%"=="2" (
    echo.
    echo 📦 배포용 빌드 시작... (5-10분 소요)
    echo 인스톤설치 프로그램과 포터블 실행파일을 모두 생성합니다.
    echo.
    npm run build-win
    if %errorlevel% equ 0 (
        echo.
        echo ==========================================
        echo    ✅ 빌드 완료!
        echo ==========================================
        echo.
        echo 📂 생성된 파일들:
        if exist "dist\*.exe" (
            for %%f in (dist\*.exe) do echo   • %%f
        )
        if exist "dist\win-unpacked" (
            echo   • dist\win-unpacked\ (압축 해제된 앱)
        )
        echo.
        echo 🎉 이제 다른 컴퓨터에서도 실행할 수 있습니다!
        echo.
        explorer dist
    ) else (
        echo [❌ 오류] 빌드에 실패했습니다.
    )
) else if "%choice%"=="3" (
    echo.
    echo 📦 포터블 실행파일만 생성 중... (3-5분 소요)
    echo.
    npx electron-builder --win portable
    if %errorlevel% equ 0 (
        echo.
        echo ==========================================
        echo    ✅ 포터블 빌드 완료!
        echo ==========================================
        echo.
        echo 📂 생성된 파일: FileShare-Portable.exe
        echo 🎉 이 파일만 있으면 설치 없이 바로 실행 가능합니다!
        echo.
        explorer dist
    ) else (
        echo [❌ 오류] 포터블 빌드에 실패했습니다.
    )
) else (
    echo 잘못된 선택입니다.
    pause
    exit /b 1
)

echo.
echo ==========================================
echo 추가 정보:
echo • 개발 모드: 코드 수정 후 바로 테스트 가능
echo • 설치 프로그램: 다른 PC에 정식 설치
echo • 포터블: USB에 넣고 어디서든 실행
echo • 업로드 폴더: 앱과 같은 위치에 생성됨
echo ==========================================
echo.
pause