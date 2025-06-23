# file_server
# 과제 제출 파일 서버

## 프로젝트 소개
컴퓨터 수업 혹은 IT 기기 이용 수업에서 교사가 학생들로부터 과제 제출을 받기 위한 웹 기반 파일 서버입니다. 웹페이지를 통해 간편하게 파일을 업로드하고 관리할 수 있습니다.

## 설치 방법
```bash
# 1. 프로젝트 클론
git clone https://github.com/사용자명/assignment-file-server.git
cd assignment-file-server

# 2. Node.js 모듈 설치
npm install
```

## 사용 방법
```bash
# start-utf8.bat 파일 실행 (Windows)
start-utf8.bat

# 또는 직접 실행
node server.js
```

실행 후 웹브라우저에서 `http://localhost:포트번호`로 접속하여 사용할 수 있습니다.

## 주요 기능
- **파일 드래그&드랍 업로드**: 마우스로 파일을 끌어서 놓기만 하면 간편하게 업로드
- **IP 기반 파일 관리**: 업로드한 IP 주소를 기반으로 자신이 올린 파일만 확인 가능
- **파일 다운로드 및 삭제**: 본인이 업로드한 파일의 다운로드 및 삭제 기능 (설정에 따라 선택 가능)
- **파일 크기 제한 설정**: 업로드 가능한 파일 크기 제한 조정 가능
- **포트 설정**: 서버 실행 포트 번호 사용자 정의 가능

## 스크린샷
![image](https://github.com/user-attachments/assets/b4c1b03a-9984-42d2-992a-6e180d75f9ce)

## 기술 스택
- **언어**: JavaScript (Node.js)
- **프레임워크**: Express.js
- **프론트엔드**: HTML5, CSS3, Vanilla JavaScript
- **파일 처리**: Multer

## 시스템 요구사항
- Node.js 14.0 이상
- Windows/macOS/Linux 지원


# 개인 설정 파일
config.ini
secrets.txt
```

### LICENSE
```text
MIT License

Copyright (c) 2025 [배명호]


