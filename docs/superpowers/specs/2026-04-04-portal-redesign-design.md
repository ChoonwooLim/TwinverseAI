# TwinverseAI Portal Redesign — Design Spec

> Date: 2026-04-04
> Status: Approved

## Overview

HomePage을 종합 포털로 전면 재구성. 상단 메뉴 + 왼쪽 사이드바 레이아웃, 게시판 시스템(공지, Q&A, 이미지, 동영상), 회사소개/서비스 페이지 추가. 기존 개발도구(문서/스킬/플러그인)는 어드민으로 이동.

## 사용자 유형

- **외부 고객**: 회사소개, 서비스 확인, 커뮤니티 게시판 이용
- **관리자(admin/superadmin)**: 어드민 대시보드, 사용자/게시판 관리, 개발도구

## 1. 레이아웃

### 전체 구조

```
┌─────────────────────────────────────────────────┐
│  TopBar: 로고 │ 홈 │ 회사소개 │ 서비스 │ 커뮤니티 │ 로그인/프로필  │
├────────┬────────────────────────────────────────┤
│ Side   │         Content Area                   │
│ bar    │                                        │
│ (하위  │   현재 카테고리에 따라 콘텐츠 변경       │
│  메뉴) │                                        │
├────────┴────────────────────────────────────────┤
│  Footer: 회사정보 │ 이용약관 │ 개인정보처리방침    │
└─────────────────────────────────────────────────┘
```

### 상단 메뉴

| 메뉴 | 경로 | 설명 |
|------|------|------|
| 홈 | `/` | 메인 대시보드 |
| 회사소개 | `/about` | 회사 소개, 비전, 팀 |
| 서비스 | `/services` | 서비스/프로그램 소개 |
| 커뮤니티 | `/community/*` | 게시판 모음 |
| 관리자 | `/admin/*` | admin 이상만 표시 |

### 사이드바 (카테고리별 하위 메뉴)

- **홈**: 사이드바 없음 (전체 너비)
- **커뮤니티**: 공지사항, Q&A, 이미지 갤러리, 동영상
- **관리자**: 대시보드, 사용자 관리, 게시판 관리, 프로젝트 문서, AI 스킬, 플러그인

### 반응형

- 768px 이하: 상단 메뉴 → 햄버거, 사이드바 → 드로어

## 2. 페이지 구성

### 공개 페이지

| 페이지 | 경로 | 내용 |
|--------|------|------|
| 홈 | `/` | 히어로 배너 + 공지 최신 3건 + 최신 게시물 + 서비스 요약 |
| 회사소개 | `/about` | 비전/미션, 팀 소개, 연혁 (코드 고정) |
| 서비스 | `/services` | 서비스/프로그램 카드 (코드 고정) |
| 로그인 | `/login` | Sign in / Register 탭 (기존) |

### 커뮤니티 (조회 공개, 작성 로그인 필요)

| 페이지 | 경로 | 타입 |
|--------|------|------|
| 공지사항 | `/community/notice` | 관리자만 작성, 목록+상세 |
| Q&A | `/community/qna` | 로그인 사용자 작성, 답글 |
| 이미지 갤러리 | `/community/gallery` | 이미지 업로드, 그리드 |
| 동영상 | `/community/videos` | 동영상 파일 또는 YouTube URL |

### 어드민 (admin 이상)

| 페이지 | 경로 | 내용 |
|--------|------|------|
| 대시보드 | `/admin` | 통계 (사용자, 게시물, 댓글) |
| 사용자 관리 | `/admin/users` | 목록, 역할 변경, 비활성화 |
| 게시판 관리 | `/admin/boards` | 전체 게시물 수정/삭제 |
| 프로젝트 문서 | `/admin/docs` | 기존 문서 뷰어 |
| AI 스킬 | `/admin/skills` | 기존 스킬 뷰어 |
| 플러그인 | `/admin/plugins` | 기존 플러그인 관리 |

## 3. 게시판 시스템

### DB 모델

**Post**
- id: int (PK)
- board_type: str ("notice" | "qna" | "gallery" | "video")
- title: str
- content: str (마크다운)
- author_id: int → User (FK)
- is_pinned: bool (default false)
- view_count: int (default 0)
- video_url: str | null
- created_at, updated_at

**Comment**
- id: int (PK)
- post_id: int → Post (FK)
- author_id: int → User (FK)
- content: str
- created_at

**File**
- id: int (PK)
- post_id: int → Post (FK)
- original_name: str
- stored_path: str
- file_type: str ("image" | "video" | "other")
- file_size: int
- uploaded_at

### 권한 규칙

- 공지사항 작성: admin/superadmin만
- Q&A/갤러리/동영상 작성: 로그인 사용자
- 수정/삭제: 작성자 본인 또는 admin
- 조회: 모든 사용자 (비로그인 포함)

### 게시판 UI 패턴

- 공지사항/Q&A: 테이블 목록 (제목, 작성자, 날짜, 조회수) → 상세 페이지
- 이미지 갤러리: 카드 그리드 (썸네일) → 라이트박스
- 동영상: 카드 리스트 (썸네일 + 제목) → 플레이어
- 페이지네이션: 공통, 페이지당 20건

## 4. 파일 업로드

- 저장: Docker 볼륨 `/app/uploads/{uuid}.{ext}`
- 서빙: FastAPI StaticFiles `/uploads/`
- 제한: 이미지 10MB, 동영상 100MB
- Dockerfile에 uploads 볼륨 추가

## 5. API 엔드포인트

### 게시판 `/api/boards`

| Method | 경로 | 설명 | 권한 |
|--------|------|------|------|
| GET | `/{board_type}` | 목록 (페이지네이션) | 공개 |
| GET | `/{board_type}/{id}` | 상세 (조회수 +1) | 공개 |
| POST | `/{board_type}` | 작성 | notice: admin, 나머지: 로그인 |
| PUT | `/{board_type}/{id}` | 수정 | 작성자/admin |
| DELETE | `/{board_type}/{id}` | 삭제 | 작성자/admin |

### 댓글 `/api/comments`

| Method | 경로 | 설명 | 권한 |
|--------|------|------|------|
| GET | `/{post_id}` | 목록 | 공개 |
| POST | `/{post_id}` | 작성 | 로그인 |
| DELETE | `/{comment_id}` | 삭제 | 작성자/admin |

### 파일 `/api/files`

| Method | 경로 | 설명 | 권한 |
|--------|------|------|------|
| POST | `/upload` | 업로드 (multipart) | 로그인 |

### 어드민 `/api/admin` (확장)

| Method | 경로 | 설명 |
|--------|------|------|
| GET | `/stats` | 전체 통계 |
| GET | `/posts` | 전체 게시물 |
| PUT | `/users/{id}/role` | 역할 변경 |
| PUT | `/users/{id}/active` | 활성/비활성 |

## 6. 파일 구조

### Backend

```
backend/
├── models/
│   ├── __init__.py (모든 모델 export)
│   ├── user.py (기존)
│   ├── post.py (신규)
│   ├── comment.py (신규)
│   └── file.py (신규)
├── routers/
│   ├── auth.py (기존 유지)
│   ├── admin.py (확장: 통계, 사용자관리, 게시판관리, 문서/스킬/플러그인 통합)
│   ├── boards.py (신규)
│   ├── comments.py (신규)
│   └── files.py (신규)
├── main.py (라우터 추가, uploads 서빙)
├── database.py
├── deps.py
└── requirements.txt
```

### Frontend

```
frontend/src/
├── components/
│   ├── layout/
│   │   ├── TopBar.jsx + TopBar.module.css
│   │   ├── Sidebar.jsx + Sidebar.module.css
│   │   ├── Footer.jsx + Footer.module.css
│   │   └── MainLayout.jsx + MainLayout.module.css
│   ├── board/
│   │   ├── PostList.jsx + PostList.module.css
│   │   ├── PostDetail.jsx + PostDetail.module.css
│   │   ├── PostForm.jsx + PostForm.module.css
│   │   ├── CommentSection.jsx + CommentSection.module.css
│   │   └── FileUpload.jsx + FileUpload.module.css
│   └── ProtectedRoute.jsx
├── pages/
│   ├── HomePage.jsx (재작성)
│   ├── AboutPage.jsx (신규)
│   ├── ServicesPage.jsx (신규)
│   ├── LoginPage.jsx (기존 유지)
│   ├── community/
│   │   ├── BoardPage.jsx (범용 목록)
│   │   └── PostPage.jsx (상세/작성/수정)
│   └── admin/
│       ├── AdminDashboard.jsx (확장)
│       ├── AdminUsers.jsx (신규)
│       ├── AdminBoards.jsx (신규)
│       ├── AdminDocs.jsx (기존 이동)
│       ├── AdminSkills.jsx (기존 이동)
│       └── AdminPlugins.jsx (기존 이동)
├── services/
│   └── api.js (기존 유지)
├── App.jsx (전면 재작성)
├── main.jsx
└── styles/
    └── global.css (재작성)
```

## 7. 디자인 방향

- 기존 CSS 디자인 시스템 폐기, /frontend-design 스킬로 전체 새 디자인 적용
- 모든 페이지에 CSS Modules 사용
- Space Grotesk / DM Sans 폰트 유지 가능 (디자인 스킬 판단)
- 반응형: Mobile-first, 768px 브레이크포인트
