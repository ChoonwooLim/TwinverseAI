---
name: start
description: 새 작업 세션 시작 - 프로젝트 컨텍스트 자동 로드
user-invocable: true
---

# TwinverseAI 프로젝트 - 작업 세션 시작

새로운 작업을 시작하기 전에 아래 단계를 반드시 수행하여 프로젝트의 현재 상태를 정확히 파악합니다.

## 1단계: 프로젝트 현재 상태 확인
// turbo
```
cd c:\WORK\TwinverseAI && git log --since="midnight" --format="%h %ai %s" --reverse
```
→ 오늘 세션에서 수행한 커밋들을 시간순으로 확인합니다.

## 2단계: Orbitron 서버 상태 확인

SSH로 Orbitron 서버에 접속하여 현재 상태를 확인합니다.

```
ssh stevenlim@192.168.219.101 "echo '=== GPU ===' && nvidia-smi --query-gpu=name,memory.used,memory.total,utilization.gpu --format=csv,noheader && echo '=== CONTAINERS ===' && docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | head -20 && echo '=== DISK ===' && df -h / | tail -1 && echo '=== RAM ===' && free -h | head -2"
```

→ GPU 상태, 실행 중인 컨테이너, 디스크/메모리 사용량을 확인합니다.

## 3단계: Orbitron 서버 문서 최신화

`docs/orbitron-server.md` 문서가 현재 서버 상태와 일치하는지 확인합니다:
- GPU VRAM 사용량 변화
- 새 컨테이너 추가/삭제
- 디스크 사용량 변화 (86% 이상이면 경고)
- 소프트웨어 버전 변경

변경사항이 있으면 문서를 업데이트합니다.

## 4단계: 사용자에게 보고

위 정보를 요약하여 사용자에게 간단히 보고합니다:
- 프로젝트 구조 확인 완료 여부
- 최근 작업 이력 요약 (당일)
- Orbitron 서버 상태 요약 (GPU, 컨테이너, 디스크)
- 준비 완료 상태 알림

그 후 사용자의 작업 요청을 수행합니다.
