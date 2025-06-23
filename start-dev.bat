@echo off
chcp 65001 >nul
echo ==========================================
echo    🚀 개발 모드로 빠른 실행
echo ==========================================
echo.

REM 의존성이 설치되어 있지 않으면 자동 설치
if not exist "node_modules" (
    echo 📦 의존성 설치 중...
    npm install
    echo.
)

echo 🔧 개발 모드로 실행 중...
echo.
echo 💡 팁:
echo • 파일 수정 후 Ctrl+R로 새로고침
echo • F12로 개발자 도구 열기
echo • 종료는 Ctrl+C 또는 창 닫기
echo.

npm run dev