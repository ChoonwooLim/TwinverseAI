# Design Sample Browser (디자인샘플) — Design Spec

- **Date**: 2026-05-17
- **Feature**: Admin sidebar 의 Claude Code 그룹에 '디자인샘플' 서브메뉴 추가. voltagent/awesome-design-md 의 71개 DESIGN.md 디자인 시스템 샘플을 브라우징/미리보기/복사할 수 있는 어드민 페이지 구축.
- **Source repo**: https://github.com/voltagent/awesome-design-md (CC-BY-SA / Apache, README 의 license 확인 시 합법 적용 가능)
- **Status**: Approved, ready for implementation planning

## 목적과 범위

### 왜 만드는가
프로젝트 디자인 시스템을 구성할 때 영감/참조 자료를 어드민 안에서 한 곳에 모아 보고, 마음에 드는 디자인의 DESIGN.md 를 즉시 복사해 코딩 에이전트 (Claude Code) 에게 "이런 스타일로 만들어줘" 라고 전달하기 위함. voltagent 의 71개 큐레이션을 그대로 활용한다.

### 사용자 흐름
1. 어드민이 `/admin/design-md` 진입 → 71개 카드 그리드 둘러봄
2. 카테고리/검색으로 좁힘
3. 마음에 드는 카드 클릭 → 디테일 페이지 (스플릿 뷰)
4. 좌측에서 DESIGN.md 원문 확인, 우측 iframe 에서 실제 시각 미리보기
5. `[📋 마크다운 복사]` 또는 `[⬇️ DESIGN.md 다운로드]` → 외부 에이전트에 전달
6. 옵션: `[🎨 토큰 프리뷰]` 토글 → 디테일 페이지 안의 데모 카드에 해당 디자인의 컬러/폰트 토큰을 임시 적용해서 시각 확인

### 범위 외
- 토큰을 우리 프로젝트 전체 디자인 시스템에 영구 적용 — 향후 작업으로 분리
- 사용자 커스텀 DESIGN.md 업로드/편집 — 외부 voltagent 데이터를 받기만 함
- 다국어 — 한국어 어드민 UI 만

## 아키텍처 전체상

```
┌─────────────────────────────────────────────────────────────────┐
│ Browser                                                          │
│  ┌──────────────────┐         ┌──────────────────────┐          │
│  │ AdminDesignMd    │ ─list─▶ │ AdminDesignMdDetail  │          │
│  │ (그리드 + 검색)  │         │ (스플릿: md + iframe)│          │
│  └────────┬─────────┘         └──────────┬───────────┘          │
└───────────┼─────────────────────────────┼─────────────────────┘
            │ GET /api/design-md          │ GET /api/design-md/:slug
            │ POST /api/design-md/sync    │
            ▼                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ FastAPI Backend                                                  │
│  ┌────────────────┐    ┌──────────────────┐                     │
│  │ routers/       │ ─▶ │ services/        │                     │
│  │ design_md.py   │    │ design_md_sync.py│                     │
│  └────────┬───────┘    └────────┬─────────┘                     │
│           │                     │                                │
│           ▼                     ▼                                │
│  ┌─────────────────────────────────────┐                        │
│  │ PostgreSQL: design_md, design_md_sync_meta │                 │
│  └─────────────────────────────────────┘                        │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  │ httpx (24h once)
                                  ▼
                  ┌───────────────────────────────────┐
                  │ github.com/voltagent/awesome-...  │
                  │ raw.githubusercontent.com         │
                  └───────────────────────────────────┘
```

## 사이드바 & 라우팅

### Sidebar 변경 (`frontend/src/components/layout/Sidebar.jsx:37-46`)

Claude Code 그룹의 `children` 배열에 4번째 항목으로 삽입:

```js
children: [
  { label: "AI 스킬", path: "/admin/skills" },
  { label: "플러그인", path: "/admin/plugins" },
  { label: "최근정보", path: "/admin/news" },
  { label: "디자인샘플", path: "/admin/design-md" },     // 신규
  { label: "Claw Code 분석", path: "/admin/claw-code" },
  { label: "공식 레포 분석", path: "/admin/claude-code-repo" },
],
```

### Routes (`frontend/src/App.jsx`)

```jsx
<Route path="/admin/design-md" element={<ProtectedRoute requiredRole="admin"><AdminDesignMd /></ProtectedRoute>} />
<Route path="/admin/design-md/:slug" element={<ProtectedRoute requiredRole="admin"><AdminDesignMdDetail /></ProtectedRoute>} />
```

`requiredRole="admin"` — 기존 Claude Code 메뉴들과 동일.

### URL slug 규약
voltagent 디렉토리명 그대로 사용. 영문 lowercase, `.`/`-` 포함 가능 (`bmw-m`, `mistral.ai`, `x.ai`). URL 안전.

## 백엔드 설계

### 모델 (`backend/models/design_md.py`)

```python
from typing import Optional
from datetime import datetime
from sqlmodel import SQLModel, Field, Column, JSON

class DesignMd(SQLModel, table=True):
    __tablename__ = "design_md"
    slug: str = Field(primary_key=True)
    name: str
    category: str = Field(default="", index=True)
    tagline: str = Field(default="")
    design_md: str                                          # 원문 전체 (수십 KB 예상)
    getdesign_url: str
    github_url: str
    color_tokens: Optional[list] = Field(default=None, sa_column=Column(JSON))
    font_tokens: Optional[list] = Field(default=None, sa_column=Column(JSON))
    last_synced_at: datetime = Field(default_factory=datetime.utcnow)

class DesignMdSyncMeta(SQLModel, table=True):
    __tablename__ = "design_md_sync_meta"
    id: int = Field(default=1, primary_key=True)
    last_sync_started: Optional[datetime] = None
    last_sync_finished: Optional[datetime] = None
    last_sync_status: str = Field(default="never")          # never | running | ok | failed
    last_sync_error: Optional[str] = None
    samples_count: int = Field(default=0)
```

`design_md_sync_meta` 는 싱글톤 행 (id=1) — 가장 단순한 패턴.

### Alembic 마이그레이션
신규 리비전 하나로 두 테이블 추가. 기존 데이터 영향 없음. 다운그레이드는 두 테이블 drop.

### Sync 서비스 (`backend/services/design_md_sync.py`)

흐름:
1. `https://raw.githubusercontent.com/VoltAgent/awesome-design-md/main/README.md` 페치
2. README 의 카테고리 섹션 정규식 파싱: `^### (.+?)$` 로 카테고리, `^- \[\*\*(.+?)\*\*\]\((.+?)\) - (.+)$` 로 이름/URL/tagline → `dict[slug, {category, tagline}]`. slug 는 URL 끝부분 (예: `https://getdesign.md/claude/design-md` → `claude`).
3. `https://api.github.com/repos/VoltAgent/awesome-design-md/git/trees/main?recursive=1` 페치 → `design-md/<slug>/DESIGN.md` 경로 71개 추출. README 와 cross-check (slug 매칭 안 되는 경우 카테고리="Other" 로 graceful).
4. 각 DESIGN.md raw URL 을 `asyncio.gather` 로 동시 10개씩 페치 (`httpx.AsyncClient(limits=httpx.Limits(max_connections=10))`).
5. 각 md 텍스트에서 `parse_tokens()`:
   - `color_tokens`: `#[0-9a-fA-F]{3,8}` 정규식, 중복 제거, 등장 빈도 상위 12개
   - `font_tokens`: `font-family: ['"]?([^'"\n;,]+)` 정규식 또는 markdown bold 안의 폰트 이름. 빈도 상위 6개. 추출 실패 가능 — 빈 배열 허용.
6. `session.merge(DesignMd(...))` 로 upsert. DB 에 있던 slug 중 이번 sync 에 없는 것 → 삭제.
7. `DesignMdSyncMeta` 업데이트 (`last_sync_finished=now`, `last_sync_status="ok"`, `samples_count=N`).
8. 예외 발생 시 `last_sync_status="failed"`, `last_sync_error=str(e)`, 부분 적용 데이터 rollback (transaction 활용).

### 라우터 (`backend/routers/design_md.py`)

| Method | Path | 권한 | 동작 |
|---|---|---|---|
| GET | `/api/design-md` | admin | 전체 목록. 슬림 페이로드 (slug, name, category, tagline, color_tokens 처음 5개, last_synced_at). design_md 본문 제외. |
| GET | `/api/design-md/{slug}` | admin | 단일 디테일. 전체 필드 포함 (design_md 원문 포함). 없으면 404. |
| GET | `/api/design-md/sync/status` | admin | `{last_sync_started, last_sync_finished, last_sync_status, last_sync_error, samples_count}` |
| POST | `/api/design-md/sync` | admin | `BackgroundTasks` 로 sync 비동기 시작. `last_sync_status == "running"` 이면 409 Conflict + "이미 동기화 진행 중" 메시지. |

`main.py` 의 `include_router` 에 등록: `app.include_router(design_md_router, prefix="/api/design-md", tags=["design-md"])`.

### 부팅 시 자동 sync (`backend/main.py`)

```python
@app.on_event("startup")
async def maybe_sync_design_md():
    async with get_session() as session:
        meta = session.get(DesignMdSyncMeta, 1) or DesignMdSyncMeta(id=1)
        if not session.get(DesignMdSyncMeta, 1):
            session.add(meta); session.commit()
        if meta.last_sync_status == "running":
            return  # 다른 인스턴스가 진행 중
        if meta.last_sync_finished is None:
            asyncio.create_task(sync_from_github())
            return
        age_h = (datetime.utcnow() - meta.last_sync_finished).total_seconds() / 3600
        if age_h > 24:
            asyncio.create_task(sync_from_github())
```

외부 cron 불필요. 어드민이 즉시 새 sync 를 원하면 UI 의 `[지금 동기화]` 버튼.

## 프론트엔드 — 일람 페이지

### 파일: `frontend/src/pages/admin/AdminDesignMd.jsx`

**컴포넌트 구조**:
```
<AdminLayout>
  <PageHeader>
    제목 + [지금 동기화] + 동기화 배지
  </PageHeader>
  <FilterBar>
    검색 input + 카테고리 chip 그룹
  </FilterBar>
  <CardGrid>
    {filtered.map(s => <DesignCard sample={s} />)}
  </CardGrid>
</AdminLayout>
```

**상태**:
- `samples` — `/api/design-md` 응답
- `syncStatus` — `/api/design-md/sync/status` 응답
- `query` — 검색어
- `activeCategory` — `null` (전체) | 카테고리명

**페치 흐름**:
- 마운트 시 두 API 병렬 호출
- `[지금 동기화]` 클릭 → `POST /api/design-md/sync` → 3초 간격 polling 으로 status 갱신, `last_sync_status != "running"` 되면 polling 종료 + samples 재페치

**필터링**: `useMemo(() => samples.filter(s => (!activeCategory || s.category === activeCategory) && (!query || s.name.toLowerCase().includes(query.toLowerCase()) || s.tagline.toLowerCase().includes(query.toLowerCase()))), [samples, activeCategory, query])`

**카드 컴포넌트** (`DesignCard.jsx` 또는 같은 파일 내):
```jsx
<Link to={`/admin/design-md/${sample.slug}`} className="design-card">
  <h3 className="design-card__name">{sample.name}</h3>
  <span className="design-card__chip">{sample.category}</span>
  <p className="design-card__tagline">{sample.tagline}</p>
  <div className="design-card__swatch" aria-label="color tokens">
    {sample.color_tokens?.slice(0, 5).map((c, i) =>
      <span key={i} style={{ background: c }} title={c} />
    )}
  </div>
</Link>
```

**동기화 배지**:
- `"never"` → ○ 회색 + "아직 동기화 안 됨"
- `"running"` → 🔄 회전 + "동기화 진행 중..."
- `"ok"` → ✅ + "N개 · X분 전" (시간 포맷: `< 1h ? "방금" : "X시간 전"`)
- `"failed"` → ⚠️ 노란색 + 마지막 성공 시각 + error 메시지 (hover tooltip)

**빈 상태**: samples 가 `[]` 이고 `syncStatus.last_sync_status === "never"` → 큰 안내 카드 "디자인 샘플이 아직 동기화되지 않았습니다. [지금 동기화]" 단일 버튼.

## 프론트엔드 — 디테일 페이지

### 파일: `frontend/src/pages/admin/AdminDesignMdDetail.jsx`

**상단 영역**:
```jsx
<header className="dmd-detail__header">
  <Link to="/admin/design-md">← 디자인샘플</Link>
  <h1>{sample.name}</h1>
  <span className="chip">{sample.category}</span>
  <p>{sample.tagline}</p>
  <div className="dmd-actions">
    <button onClick={copyMd}>📋 마크다운 복사</button>
    <button onClick={downloadMd}>⬇️ DESIGN.md 다운로드</button>
    <button onClick={() => setTokenPreview(v => !v)}>
      🎨 토큰 프리뷰 {tokenPreview ? "ON" : "OFF"}
    </button>
    <a href={sample.getdesign_url} target="_blank" rel="noreferrer">getdesign.md ↗</a>
    <a href={sample.github_url} target="_blank" rel="noreferrer">GitHub ↗</a>
  </div>
</header>
```

**메인 — 스플릿 뷰 (`.dmd-split`)**:
```jsx
<div className="dmd-split">
  <div className="dmd-md-pane preview-scope" style={tokenPreviewStyle}>
    {tokenPreview && <PreviewDemo tokens={sample} />}
    <ReactMarkdown remarkPlugins={[remarkGfm]}>{sample.design_md}</ReactMarkdown>
  </div>
  <div className="dmd-iframe-wrap">
    {iframeError
      ? <FallbackIframeCard url={sample.getdesign_url} />
      : <iframe
          src={sample.getdesign_url}
          title={`${sample.name} on getdesign.md`}
          sandbox="allow-scripts allow-same-origin allow-popups"
          loading="lazy"
          onError={() => setIframeError(true)}
          style={{ width: '100%', height: 'calc(100vh - 220px)', border: 0 }}
        />}
  </div>
</div>
```

**액션 핸들러**:
```js
const copyMd = async () => {
  await navigator.clipboard.writeText(sample.design_md);
  toast("DESIGN.md 가 클립보드에 복사되었습니다");
};
const downloadMd = () => {
  const blob = new Blob([sample.design_md], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'DESIGN.md';
  document.body.appendChild(a); a.click();
  a.remove(); URL.revokeObjectURL(url);
};
```

**토큰 프리뷰**:
```js
const tokenPreviewStyle = tokenPreview ? {
  '--preview-primary': sample.color_tokens?.[0],
  '--preview-bg': sample.color_tokens?.[1],
  '--preview-accent': sample.color_tokens?.[2],
  '--preview-text': sample.color_tokens?.[3] || '#fff',
  fontFamily: sample.font_tokens?.[0] || 'inherit',
} : {};
```

`<PreviewDemo>` 컴포넌트 — 좌측 패널 상단에 작은 미니 데모 (제목 h2, 본문 한 문단, 버튼 1개, 카드 1개). 모든 색/폰트는 `var(--preview-*)` 로만 읽음. `.preview-scope` div 안에서만 동작 — 사이드바·탑바 영향 없음.

토큰이 없을 때 (`color_tokens` 빈 배열): `[🎨 토큰 프리뷰]` 버튼 disabled + tooltip "이 디자인의 색상 토큰을 자동 추출하지 못했습니다".

**404 처리**: `/api/design-md/{slug}` 가 404 응답 → "디자인 샘플을 찾을 수 없습니다. [목록으로]" 카드.

**iframe 실패 폴백**:
- `onError` 트리거 또는 5초 onLoad 미달 → `FallbackIframeCard` 표시: "외부 사이트가 차단되어 임베드할 수 없습니다. [새 창에서 열기 ↗]"

## CSS — `frontend/src/styles/admin-design-md.css`

신규 CSS 파일 1개. Dark Glass Neon 매칭:

```css
.design-grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
.design-card { padding: 20px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 15px; backdrop-filter: blur(10px); transition: transform .2s, border-color .2s; }
.design-card:hover { transform: translateY(-2px); border-color: rgba(102,126,234,0.5); box-shadow: 0 8px 24px rgba(102,126,234,0.15); }
.design-card__name { font-size: 18px; font-weight: 600; color: #fff; margin-bottom: 8px; }
.design-card__chip { display: inline-block; padding: 2px 10px; border-radius: 999px; background: rgba(102,126,234,0.15); color: #00d4ff; font-size: 11px; margin-bottom: 8px; }
.design-card__tagline { color: rgba(255,255,255,0.65); font-size: 13px; line-height: 1.5; margin-bottom: 12px; }
.design-card__swatch { display: flex; gap: 4px; }
.design-card__swatch span { width: 24px; height: 12px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.1); }

.dmd-split { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
.dmd-md-pane { padding: 24px; background: rgba(255,255,255,0.03); border-radius: 12px; overflow-y: auto; max-height: calc(100vh - 220px); }
.dmd-iframe-wrap { position: sticky; top: 16px; }
.dmd-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 16px; }
.dmd-actions button, .dmd-actions a { padding: 8px 14px; border-radius: 8px; background: rgba(255,255,255,0.06); color: #fff; border: 1px solid rgba(255,255,255,0.1); text-decoration: none; cursor: pointer; }
.dmd-actions button:hover, .dmd-actions a:hover { background: linear-gradient(135deg, #667eea, #764ba2); }

@media (max-width: 1024px) {
  .dmd-split { grid-template-columns: 1fr; }
  .dmd-iframe-wrap { position: static; }
}
```

## 에러 / 엣지 케이스 정리

| 상황 | 처리 |
|------|------|
| 백엔드 sync 한번도 안 됨 | 일람: 빈 상태 카드 + "지금 동기화" 버튼 |
| sync 진행 중 일람 호출 | 마지막 성공 데이터 + 🔄 배지 |
| sync 실패 | 마지막 성공 데이터 + ⚠️ 배지 + error tooltip |
| GitHub rate limit | sync 실패로 처리. 24h 뒤 자동 재시도. raw.githubusercontent.com 은 rate limit 널널해서 실제 발생 가능성 낮음 |
| iframe 로드 실패 | 폴백 카드 + 새 창 링크 |
| 잘못된 slug | 디테일 404 카드 + 목록 링크 |
| 토큰 추출 실패 | 카드 swatch 회색 placeholder, 디테일 토큰 프리뷰 버튼 disabled |
| 동시 sync 요청 | POST sync 가 409 Conflict 반환 |
| voltagent 가 slug 이름 변경 | 다음 sync 시 옛 slug 삭제, 새 slug 추가. 기존 디테일 URL 은 404 |

## 비기능 요구사항

- **권한**: 모든 엔드포인트 admin only (`require_admin` 의존성). 일반 user 노출 X.
- **페이로드 크기**: 일람 응답 ~5KB 추정 (71개 × ~70 bytes). 디테일 응답 ~20-80KB (DESIGN.md 원문 크기에 따라).
- **첫 페인트**: 일람 페이지 카드 그리드 < 500ms (DB 쿼리 + JSON 직렬화).
- **iframe 보안**: `sandbox="allow-scripts allow-same-origin allow-popups"` — 폼 제출/탑네비 차단.
- **접근성**: 카드 키보드 탐색 (`<Link>` 사용하므로 자동), swatch `aria-label`/`title`, 액션 버튼 텍스트 라벨.
- **반응형**: 1024px 미만에서 스플릿 → 1col 스택. 카드 그리드는 `auto-fill minmax(260px, 1fr)` 으로 자연 반응.
- **라이선스 / 어트리뷰션**: voltagent/awesome-design-md 의 LICENSE 는 MIT (커밋 기준 확인 완료). 일람 페이지 하단에 고정 표기: `Source: voltagent/awesome-design-md (MIT) — 링크`. sync 시 추가 페치 불필요. 디테일 페이지의 `GitHub ↗` 링크는 해당 brand 의 DESIGN.md 파일로 직접 연결되므로 출처 추적성 충분.

## 마이그레이션 / 배포 영향

- DB: 신규 테이블 2개 추가. 기존 데이터 영향 없음.
- 환경변수: 추가 불필요 (GitHub 공개 리포 → 비인증).
- 첫 배포 후 부팅 시 24h 자동 sync 가 1회 트리거 → 어드민 페이지 첫 접속까지 sync 완료되어 있을 가능성 높음 (raw 71개 ~ 1-2초). 부팅 직후라면 일람 페이지가 "동기화 진행 중" 배지 + 빈 그리드. 어드민이 polling 으로 자동 갱신.
- 롤백: Alembic 다운그레이드로 두 테이블 drop + 코드 revert.

## 향후 확장 후보 (이번 범위 외)

- 즐겨찾기 / 비교 — 여러 디자인 나란히 비교
- 토큰을 우리 프로젝트 디자인 시스템에 적용 (영구) — 별도 admin 워크플로
- DESIGN.md 의 컬러를 시각적으로 더 풍부하게 (대비비 계산, accessibility 자동 점수 등)
- 자체 DESIGN.md 업로드/편집 — 사용자 추가 디자인 등록
- 디자인 적용 이력 추적 — "이 디자인의 토큰을 X 페이지에 적용함" 메타데이터

## 산출물 체크리스트

- [ ] `backend/models/design_md.py` (DesignMd, DesignMdSyncMeta)
- [ ] `backend/alembic/versions/<rev>_design_md.py` (마이그레이션)
- [ ] `backend/services/design_md_sync.py` (sync + parse_tokens)
- [ ] `backend/routers/design_md.py` (4 엔드포인트)
- [ ] `backend/main.py` startup hook + router 등록
- [ ] `frontend/src/pages/admin/AdminDesignMd.jsx`
- [ ] `frontend/src/pages/admin/AdminDesignMdDetail.jsx`
- [ ] `frontend/src/pages/admin/PreviewDemo.jsx` (또는 inline)
- [ ] `frontend/src/components/layout/Sidebar.jsx` 수정 (1줄)
- [ ] `frontend/src/App.jsx` 수정 (2 라우트 + import)
- [ ] `frontend/src/styles/admin-design-md.css` (신규)
- [ ] 일람/디테일/에러 케이스 수동 테스트
- [ ] LICENSE 어트리뷰션 확인 + 푸터 표기

## 검증 시나리오

1. 첫 부팅 → 일람 페이지 빈 상태 → [지금 동기화] 클릭 → 1-2초 후 71개 카드 표시
2. 검색 "AI" → AI 관련만 표시
3. 카테고리 "Developer Tools & IDEs" 클릭 → 해당 카테고리만
4. Claude 카드 클릭 → 디테일 페이지 → 좌측 DESIGN.md 렌더 OK, 우측 iframe 로드 OK
5. [📋 마크다운 복사] → 클립보드에 DESIGN.md 원문 들어감
6. [⬇️ 다운로드] → DESIGN.md 파일 다운로드
7. [🎨 토큰 프리뷰] → 좌측 패널 상단에 데모 카드, 색상이 Claude 의 terracotta 로 변경
8. 사이드바/탑바는 토큰 프리뷰 영향 받지 않음 (스코프 확인)
9. 잘못된 slug `/admin/design-md/foobar` → 404 카드
10. 24h 후 재부팅 시 자동 sync 트리거 확인 (로그)
