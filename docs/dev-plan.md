# 개발계획서

> 이 문서는 /end 스킬 호출 시 자동 업데이트됩니다.

## 프로젝트 개요

- **프로젝트명**: TwinverseAI (Twinverse Platform 웹 포탈)
- **최종 비전**: 미래 인간-AI 공존 세계 최고 생태계 → [docs/vision.md](vision.md)
- **시작일**: 2026-04-04
- **기술 스택**: FastAPI + React + Vite + PostgreSQL + UE5 Pixel Streaming
- **배포**: Orbitron (GPU 서버, Docker)

## 마일스톤

| 단계 | 목표 | 상태 | 예정일 |
|------|------|------|--------|
| 1 | 프로젝트 초기 세팅 | 완료 | 2026-04-04 |
| 2 | 포탈 전면 구현 (게시판 + 레이아웃 + 디자인) | 완료 | 2026-04-04 |
| 3 | TwinverseDesk UE5 프로젝트 초기화 + 서버 GPU 환경 구성 | 완료 | 2026-04-07 |
| 4 | 프로젝트 비전 수립 + AI 방침 문서화 | 완료 | 2026-04-08 |
| 5 | Pixel Streaming 로컬 테스트 연동 | 예정 | - |
| 6 | AI 에이전트 통합 (TwinverseDesk 내) | 예정 | - |

## 기능 목록

| 기능 | 설명 | 우선순위 | 상태 |
|------|------|----------|------|
| 인증 시스템 | JWT 로그인/회원가입 | 높음 | 완료 |
| 어드민 대시보드 | 사용자 관리 | 높음 | 완료 |
| 프로젝트 문서 | 개발계획서/버그로그/작업일지 | 높음 | 완료 |
| 스킬 뷰어 | 사용 가능한 AI 스킬 조회 | 중간 | 완료 |
| 플러그인 관리 | MCP 플러그인 조회/수정/추가 | 중간 | 완료 |
| 게시판 시스템 | 게시판/게시글/댓글/파일첨부 CRUD | 높음 | 완료 |
| 포탈 레이아웃 | TopBar, Sidebar, Footer, MainLayout | 높음 | 완료 |
| 커뮤니티 페이지 | 게시판 목록, 게시글 상세 | 높음 | 완료 |
| 공개 페이지 | 홈, 소개, 서비스 페이지 | 중간 | 완료 |
| 디자인 시스템 | Dark Glass Neon (twinverse.org 매칭) | 높음 | 완료 |
| TwinverseDesk 페이지 | DeskRPG 분석 보고서 + 개발계획 + 실행하기 | 높음 | 완료 |
| TwinverseDesk UE5 | UE5 C++ 프로젝트 + Pixel Streaming + Dedicated Server | 높음 | 진행중 |
| Orbitron GPU 환경 | nvidia-container-toolkit + Docker GPU Runtime | 높음 | 완료 |
| Orbitron 서버 문서 | 서버 사양/상태 문서 + 관리자 메뉴 | 중간 | 완료 |
| 프로젝트 비전 문서 | 최종 목표/5대 원칙/로드맵/AI 행동지침 | 최상 | 완료 |
| Ultra Plan 스킬 | 멀티에이전트 심층 계획 수립 스킬 | 높음 | 완료 |
| 최근정보 시스템 | Claude Code 최신 뉴스 관리 (AdminNews) | 중간 | 완료 |
| 비전 페이지 | 시네마틱 비전 페이지 (/vision) + 상단 메뉴 | 높음 | 완료 |
