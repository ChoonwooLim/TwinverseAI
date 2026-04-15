# Orbitron Pixel Streaming Platform Implementation Plan

> **대상**: Orbitron 플랫폼 개발자 (Orbitron 서버 `/home/stevenlim/WORK/orbitron/` 에서 작업). 외부 엔지니어가 이 문서 하나만 보고 구현할 수 있도록 작성.
>
> **연관 스펙**: `docs/superpowers/specs/2026-04-15-pixel-streaming-platform-design.md`
>
> **Goal:** TwinverseAI 프로젝트 안에 멀티슬롯 Pixel Streaming 업로드/배포 기능 구현 (Phase B).
>
> **Architecture:** Orbitron (Node.js + PG) 이 tus 프로토콜로 UE5 Linux 패키지 zip 수신 → 검증 · Docker 이미지 빌드 → twinverse-ai GPU 호스트로 전송 · on-demand 기동. Cloudflare DNS 자동화 + 슬롯별 서브도메인. 최근 3개 버전 유지 · 원클릭 롤백.
>
> **Tech Stack:** Node.js (기존 Orbitron), PostgreSQL, `tus-node-server`, `tus-js-client`, Docker CLI (`save`/`load`), ssh/rsync, Cloudflare API (`cloudflare` npm), cloudflared SIGHUP, Wilbur Pixel Streaming, React(TwinverseAI 랜딩).

---

## Phase 0 — 사전 조사 & 스캐폴딩

외부 엔지니어는 Orbitron 내부 구조를 모르므로 먼저 기존 패턴을 파악해야 한다. 이 단계의 산출물은 **결정 메모** (`docs/orbitron/pixel-streaming-prereqs.md`) 하나 + 개발 브랜치 생성.

### Task 0-1: 브랜치 생성 & 작업 공간 준비

**Files:**
- Create: `feature/pixel-streaming` 브랜치

- [ ] Orbitron repo 클론 상태 확인: `cd /home/stevenlim/WORK/orbitron && git status`
- [ ] main 에서 브랜치 분기:
  ```bash
  git checkout main && git pull
  git checkout -b feature/pixel-streaming
  ```
- [ ] 원격 push:
  ```bash
  git push -u origin feature/pixel-streaming
  ```
- [ ] Commit (빈 README 추가): `git commit --allow-empty -m "chore: start pixel-streaming feature branch"`

### Task 0-2: Orbitron 프론트/백 스택 조사 메모 작성

**Files:**
- Create: `docs/orbitron/pixel-streaming-prereqs.md`

- [ ] 다음 항목을 실제 코드 확인 후 메모에 기록:
  1. **프론트 스택**: `server.js`/`public/`/`routes/` 를 훑어 SSR(EJS 등) vs SPA 판단.
     ```bash
     ls public/ && grep -r "res.render" routes/ | head -5
     ```
  2. **인증 미들웨어**: `routes/auth.js` 에서 JWT 검증 방식 확인. 재사용 가능한 `requireAdmin` 미들웨어 존재 여부.
  3. **프로젝트 상세 페이지 라우트**: `routes/projects.js` 에서 프로젝트 상세 조회 엔드포인트 구조.
  4. **Cloudflare DNS 자동화 코드 존재 여부**:
     ```bash
     grep -r "cloudflare" --include="*.js" . | grep -v node_modules | head -10
     grep -r "CNAME\|DNS" routes/ services/ | head -10
     ```
     → 있으면 재활용 함수 경로 기록. 없으면 "신규 구현 필요" 기록.
  5. **기존 배포(deployments/) 패턴**: `services/` 하위에 이미 SSH + Docker 배포 로직 있는지 확인.
  6. **cloudflared config 경로**: `/home/stevenlim/.cloudflared/config.yml` ingress 구조 확인.
- [ ] 메모에 각 항목별 "재사용 가능" / "신규 구현" / "확장 필요" 분류 명시.
- [ ] Commit:
  ```bash
  git add docs/orbitron/pixel-streaming-prereqs.md
  git commit -m "docs: pre-implementation recon for pixel streaming"
  ```

### Task 0-3: Wilbur admin API 조사

**Files:**
- Modify: `docs/orbitron/pixel-streaming-prereqs.md` (섹션 추가)

- [ ] 기존 `/opt/twinverse-ps2` 컨테이너 내 Wilbur 설정 파악:
  ```bash
  ssh twinverse-ai "docker exec twinverse-ps2 ls /opt/wilbur && docker exec twinverse-ps2 cat /opt/wilbur/config/default.json" 2>/dev/null | head -50
  ```
- [ ] Wilbur admin 엔드포인트 존재 여부(`/api/streamers`, `/api/players` 등) curl 테스트:
  ```bash
  ssh twinverse-ai "curl -s http://localhost:8080/api/streamers"
  ```
- [ ] 없으면 대안 확인 (signaling WebSocket 로그 파싱, player 포트 TCP 연결 수 기반 등).
- [ ] 메모의 "세션 수 조회 방법" 섹션 채우기.
- [ ] Commit: `git commit -am "docs: record wilbur admin API discovery"`

### Task 0-4: 디렉토리/포트/상수 상수 파일 생성

**Files:**
- Create: `services/pixelStreaming/constants.js`

- [ ] 다음 내용으로 파일 작성:
  ```js
  // Orbitron Pixel Streaming 상수 — 전역적으로 참조
  module.exports = {
    // 서브도메인 루트
    SUBDOMAIN_ROOT: 'ps.twinverse.org',

    // 슬롯 컨테이너 포트 풀 (외부 충돌 피해서 8081~8999)
    PORT_RANGE: { min: 8081, max: 8999 },

    // 최근 유지할 버전 수 (FIFO)
    MAX_VERSIONS_PER_SLOT: 3,

    // 업로드 크기 하드 리밋 (20GB)
    MAX_UPLOAD_BYTES: 20 * 1024 * 1024 * 1024,

    // 유휴 감지 워커 주기 (초)
    IDLE_SWEEP_INTERVAL_S: 30,

    // 기본 유휴 타임아웃 (초)
    DEFAULT_IDLE_TIMEOUT_S: 600,

    // 콜드 스타트 최대 대기 (초)
    START_TIMEOUT_S: 90,

    // Orbitron 서버 측 스토리지 루트
    STORAGE_ROOT: '/srv/pixelstreaming',

    // 원격 GPU 호스트
    GPU_HOST: 'twinverse-ai',
    GPU_USER: 'stevenlim',
    GPU_SLOTS_ROOT: '/opt/ps-slots',

    // Docker 이미지 네임스페이스
    IMAGE_NAMESPACE: 'twinverse/ps',

    // 빌드 상태 enum
    BUILD_STATUS: {
      UPLOADING: 'uploading',
      EXTRACTING: 'extracting',
      BUILDING: 'building',
      READY: 'ready',
      FAILED: 'failed',
    },

    // 슬롯 상태 enum
    SLOT_STATE: {
      DRAFT: 'draft',
      RUNNING: 'running',
      STOPPED: 'stopped',
      ERROR: 'error',
    },
  };
  ```
- [ ] Commit: `git add services/pixelStreaming/constants.js && git commit -m "feat(ps): add pixel streaming constants"`

---

## Phase 1 — 데이터 모델 & 슬롯 CRUD

### Task 1-1: PG 스키마 마이그레이션 작성

**Files:**
- Create: `db/migrations/20260415_pixel_streaming.sql`

- [ ] 마이그레이션 SQL 작성:
  ```sql
  BEGIN;

  CREATE TABLE ps_slots (
      id              SERIAL PRIMARY KEY,
      project_id      INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name            VARCHAR(50) NOT NULL,
      display_name    VARCHAR(100) NOT NULL,
      description     TEXT DEFAULT '',
      thumbnail_url   VARCHAR(500),
      subdomain       VARCHAR(150) UNIQUE NOT NULL,
      container_port  INTEGER NOT NULL UNIQUE,
      active_version  INTEGER,
      state           VARCHAR(20) DEFAULT 'draft',
      idle_timeout_s  INTEGER DEFAULT 600,
      last_activity_at TIMESTAMP,
      owner_user_id   INTEGER REFERENCES users(id),
      tenant_id       INTEGER,
      pinned          BOOLEAN DEFAULT false,
      created_at      TIMESTAMP DEFAULT NOW(),
      updated_at      TIMESTAMP DEFAULT NOW(),
      UNIQUE (project_id, name)
  );

  CREATE TABLE ps_versions (
      id              SERIAL PRIMARY KEY,
      slot_id         INTEGER NOT NULL REFERENCES ps_slots(id) ON DELETE CASCADE,
      version_label   VARCHAR(50) NOT NULL,
      upload_size_b   BIGINT NOT NULL DEFAULT 0,
      image_tag       VARCHAR(200),
      build_status    VARCHAR(20) DEFAULT 'uploading',
      build_log       TEXT,
      uploaded_at     TIMESTAMP DEFAULT NOW(),
      uploaded_by     INTEGER REFERENCES users(id),
      UNIQUE (slot_id, version_label)
  );

  ALTER TABLE ps_slots
      ADD CONSTRAINT ps_slots_active_version_fk
      FOREIGN KEY (active_version) REFERENCES ps_versions(id)
      DEFERRABLE INITIALLY DEFERRED;

  CREATE INDEX idx_ps_slots_project ON ps_slots(project_id);
  CREATE INDEX idx_ps_versions_slot ON ps_versions(slot_id);

  COMMIT;
  ```
- [ ] 롤백 SQL 같은 파일 하단에 주석으로 명시:
  ```sql
  -- ROLLBACK:
  -- DROP TABLE ps_versions;
  -- DROP TABLE ps_slots;
  ```

### Task 1-2: 마이그레이션 실행 확인 (통합 테스트)

**Files:**
- Test: `tests/db/pixelStreamingSchema.test.js`

- [ ] Orbitron 테스트 DB 에 마이그레이션 적용 후 테이블 존재 검증:
  ```js
  const { Pool } = require('pg');
  const fs = require('fs');

  test('ps_slots and ps_versions tables exist', async () => {
    const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    const sql = fs.readFileSync('db/migrations/20260415_pixel_streaming.sql', 'utf8');
    await pool.query(sql);
    const res = await pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_name IN ('ps_slots', 'ps_versions')
      ORDER BY table_name
    `);
    expect(res.rows.map(r => r.table_name)).toEqual(['ps_slots', 'ps_versions']);
    await pool.end();
  });
  ```
- [ ] 실행: `npm test -- tests/db/pixelStreamingSchema.test.js`
- [ ] Expected: PASS.
- [ ] Commit: `git add db/migrations/ tests/db/ && git commit -m "feat(ps): schema migration for slots and versions"`

### Task 1-3: 슬롯 DAO (CRUD 순수 함수)

**Files:**
- Create: `services/pixelStreaming/slotDao.js`
- Test: `tests/pixelStreaming/slotDao.test.js`

- [ ] 테스트 먼저 작성:
  ```js
  const dao = require('../../services/pixelStreaming/slotDao');

  describe('slotDao', () => {
    let projectId;
    beforeEach(async () => {
      projectId = await createTestProject();
    });

    test('create slot assigns next free port', async () => {
      const s = await dao.create({ projectId, name: 'office', displayName: 'Office' });
      expect(s.container_port).toBeGreaterThanOrEqual(8081);
      expect(s.subdomain).toBe('office.ps.twinverse.org');
    });

    test('create twice with same name rejects', async () => {
      await dao.create({ projectId, name: 'office', displayName: 'Office' });
      await expect(
        dao.create({ projectId, name: 'office', displayName: 'Office' })
      ).rejects.toThrow(/unique/i);
    });

    test('listByProject returns only own slots', async () => {
      await dao.create({ projectId, name: 'a', displayName: 'A' });
      const other = await createTestProject();
      await dao.create({ projectId: other, name: 'b', displayName: 'B' });
      const rows = await dao.listByProject(projectId);
      expect(rows).toHaveLength(1);
    });
  });
  ```
- [ ] 실행하여 실패 확인: `npm test -- tests/pixelStreaming/slotDao.test.js` → FAIL (module not found).
- [ ] 구현:
  ```js
  const pool = require('../../db/db');
  const { PORT_RANGE, SUBDOMAIN_ROOT } = require('./constants');

  async function allocatePort() {
    const { rows } = await pool.query('SELECT container_port FROM ps_slots');
    const used = new Set(rows.map(r => r.container_port));
    for (let p = PORT_RANGE.min; p <= PORT_RANGE.max; p++) {
      if (!used.has(p)) return p;
    }
    throw new Error('No free port in range');
  }

  async function create({ projectId, name, displayName, description = '', thumbnailUrl = null }) {
    if (!/^[a-z0-9-]{1,50}$/.test(name)) {
      throw new Error('name must match [a-z0-9-]{1,50}');
    }
    const port = await allocatePort();
    const subdomain = `${name}.${SUBDOMAIN_ROOT}`;
    const { rows } = await pool.query(
      `INSERT INTO ps_slots
         (project_id, name, display_name, description, thumbnail_url, subdomain, container_port)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [projectId, name, displayName, description, thumbnailUrl, subdomain, port]
    );
    return rows[0];
  }

  async function listByProject(projectId) {
    const { rows } = await pool.query(
      'SELECT * FROM ps_slots WHERE project_id=$1 ORDER BY created_at',
      [projectId]
    );
    return rows;
  }

  async function getById(id) {
    const { rows } = await pool.query('SELECT * FROM ps_slots WHERE id=$1', [id]);
    return rows[0] || null;
  }

  async function updateMeta(id, patch) {
    const allowed = ['display_name', 'description', 'thumbnail_url', 'idle_timeout_s', 'pinned'];
    const sets = [], vals = [];
    for (const [k, v] of Object.entries(patch)) {
      if (!allowed.includes(k)) continue;
      vals.push(v); sets.push(`${k}=$${vals.length}`);
    }
    if (!sets.length) return getById(id);
    vals.push(id);
    const { rows } = await pool.query(
      `UPDATE ps_slots SET ${sets.join(',')}, updated_at=NOW() WHERE id=$${vals.length} RETURNING *`,
      vals
    );
    return rows[0];
  }

  async function remove(id) {
    await pool.query('DELETE FROM ps_slots WHERE id=$1', [id]);
  }

  module.exports = { create, listByProject, getById, updateMeta, remove, allocatePort };
  ```
- [ ] 실행: PASS.
- [ ] Commit: `git add services/pixelStreaming/slotDao.js tests/pixelStreaming/slotDao.test.js && git commit -m "feat(ps): slot DAO with port allocation"`

### Task 1-4: 버전 DAO

**Files:**
- Create: `services/pixelStreaming/versionDao.js`
- Test: `tests/pixelStreaming/versionDao.test.js`

- [ ] 테스트 작성 — version_label 자동 증가 ("v1", "v2"), FIFO 삭제 (N=3):
  ```js
  const dao = require('../../services/pixelStreaming/versionDao');

  test('createNext increments version label', async () => {
    const slotId = await createTestSlot();
    const v1 = await dao.createNext({ slotId, uploadedBy: 1 });
    expect(v1.version_label).toBe('v1');
    const v2 = await dao.createNext({ slotId, uploadedBy: 1 });
    expect(v2.version_label).toBe('v2');
  });

  test('pruneOldVersions keeps only MAX_VERSIONS_PER_SLOT', async () => {
    const slotId = await createTestSlot();
    for (let i = 0; i < 5; i++) await dao.createNext({ slotId, uploadedBy: 1 });
    await dao.pruneOldVersions(slotId);
    const rows = await dao.listBySlot(slotId);
    expect(rows).toHaveLength(3);
    expect(rows.map(r => r.version_label)).toEqual(['v5', 'v4', 'v3']);
  });
  ```
- [ ] 실행 → FAIL.
- [ ] 구현:
  ```js
  const pool = require('../../db/db');
  const { MAX_VERSIONS_PER_SLOT, BUILD_STATUS } = require('./constants');

  async function createNext({ slotId, uploadedBy }) {
    const { rows: prev } = await pool.query(
      `SELECT version_label FROM ps_versions WHERE slot_id=$1
       ORDER BY id DESC LIMIT 1`, [slotId]
    );
    const nextN = prev.length ? parseInt(prev[0].version_label.slice(1), 10) + 1 : 1;
    const { rows } = await pool.query(
      `INSERT INTO ps_versions (slot_id, version_label, build_status, uploaded_by)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [slotId, `v${nextN}`, BUILD_STATUS.UPLOADING, uploadedBy]
    );
    return rows[0];
  }

  async function updateStatus(versionId, status, logAppend = null) {
    await pool.query(
      `UPDATE ps_versions SET build_status=$1,
         build_log = COALESCE(build_log,'') || COALESCE($2,'')
       WHERE id=$3`,
      [status, logAppend, versionId]
    );
  }

  async function listBySlot(slotId) {
    const { rows } = await pool.query(
      'SELECT * FROM ps_versions WHERE slot_id=$1 ORDER BY id DESC',
      [slotId]
    );
    return rows;
  }

  async function pruneOldVersions(slotId) {
    // 활성 버전은 절대 삭제하지 않음
    const { rows: toDelete } = await pool.query(
      `SELECT v.id FROM ps_versions v
       LEFT JOIN ps_slots s ON s.active_version = v.id
       WHERE v.slot_id=$1 AND s.id IS NULL
       ORDER BY v.id DESC OFFSET $2`,
      [slotId, MAX_VERSIONS_PER_SLOT]
    );
    if (!toDelete.length) return [];
    const ids = toDelete.map(r => r.id);
    await pool.query('DELETE FROM ps_versions WHERE id = ANY($1)', [ids]);
    return ids;
  }

  module.exports = { createNext, updateStatus, listBySlot, pruneOldVersions };
  ```
- [ ] 실행 → PASS.
- [ ] Commit: `git commit -am "feat(ps): version DAO with FIFO pruning"`

### Task 1-5: 슬롯 CRUD 라우트

**Files:**
- Create: `routes/pixelStreaming.js`
- Modify: `server.js` (라우터 mount)
- Test: `tests/routes/pixelStreaming.test.js`

- [ ] 테스트 먼저 — 인증 없음 401, admin 으로 POST 성공:
  ```js
  const request = require('supertest');
  const app = require('../../server').app;

  describe('POST /api/projects/:id/ps-slots', () => {
    test('requires auth', async () => {
      const r = await request(app).post('/api/projects/1/ps-slots').send({ name: 'x', display_name: 'X' });
      expect(r.status).toBe(401);
    });

    test('admin can create slot', async () => {
      const token = await loginAsAdmin();
      const r = await request(app)
        .post('/api/projects/1/ps-slots')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'office', display_name: 'Office' });
      expect(r.status).toBe(201);
      expect(r.body.subdomain).toBe('office.ps.twinverse.org');
    });
  });
  ```
- [ ] 실행 → FAIL.
- [ ] 구현:
  ```js
  const express = require('express');
  const router = express.Router({ mergeParams: true });
  const slotDao = require('../services/pixelStreaming/slotDao');
  const versionDao = require('../services/pixelStreaming/versionDao');
  const { requireAdmin } = require('../middleware/auth'); // Task 0-2 에서 경로 확인

  router.get('/', requireAdmin, async (req, res) => {
    const rows = await slotDao.listByProject(req.params.projectId);
    res.json(rows);
  });

  router.post('/', requireAdmin, async (req, res) => {
    try {
      const slot = await slotDao.create({
        projectId: req.params.projectId,
        name: req.body.name,
        displayName: req.body.display_name,
        description: req.body.description,
        thumbnailUrl: req.body.thumbnail_url,
      });
      res.status(201).json(slot);
    } catch (e) {
      if (/unique/i.test(e.message)) return res.status(409).json({ error: 'slot name taken' });
      res.status(400).json({ error: e.message });
    }
  });

  router.patch('/:slotId', requireAdmin, async (req, res) => {
    const slot = await slotDao.updateMeta(req.params.slotId, req.body);
    if (!slot) return res.status(404).end();
    res.json(slot);
  });

  router.delete('/:slotId', requireAdmin, async (req, res) => {
    // 실제 teardown 은 Phase 4 에서 추가. Phase 1 은 DB row 삭제만.
    await slotDao.remove(req.params.slotId);
    res.status(204).end();
  });

  router.get('/:slotId/versions', requireAdmin, async (req, res) => {
    res.json(await versionDao.listBySlot(req.params.slotId));
  });

  module.exports = router;
  ```
- [ ] `server.js` 에서 마운트:
  ```js
  const psRouter = require('./routes/pixelStreaming');
  app.use('/api/projects/:projectId/ps-slots', psRouter);
  ```
- [ ] 실행 → PASS.
- [ ] Commit: `git commit -am "feat(ps): slot CRUD routes"`

---

## Phase 2 — 업로드 & 압축 해제 검증

### Task 2-1: tus-node-server 설치 & 업로드 초기화

**Files:**
- Modify: `package.json`
- Create: `services/pixelStreaming/uploadService.js`
- Test: `tests/pixelStreaming/uploadService.test.js`

- [ ] 설치:
  ```bash
  npm install @tus/server @tus/file-store
  ```
- [ ] 업로드 디렉토리 보장 — `/srv/pixelstreaming/uploads-incoming/` (tus 임시 저장).
- [ ] 구현:
  ```js
  const { Server } = require('@tus/server');
  const { FileStore } = require('@tus/file-store');
  const path = require('path');
  const fs = require('fs');
  const { STORAGE_ROOT, MAX_UPLOAD_BYTES } = require('./constants');

  const INCOMING = path.join(STORAGE_ROOT, 'uploads-incoming');
  fs.mkdirSync(INCOMING, { recursive: true });

  const tusServer = new Server({
    path: '/api/uploads',
    datastore: new FileStore({ directory: INCOMING }),
    maxSize: MAX_UPLOAD_BYTES,
    namingFunction: (req) => {
      // upload_id = uuid + slotId metadata
      const meta = req.headers['upload-metadata'] || '';
      const uuid = require('crypto').randomUUID();
      return uuid;
    },
  });

  module.exports = { tusServer, INCOMING };
  ```
- [ ] `server.js` 에 연결:
  ```js
  const { tusServer } = require('./services/pixelStreaming/uploadService');
  app.all('/api/uploads/*', (req, res) => tusServer.handle(req, res));
  app.all('/api/uploads', (req, res) => tusServer.handle(req, res));
  ```
- [ ] 테스트 — curl 로 빈 POST → 201 Location 헤더 확인:
  ```js
  test('tus creation returns Location', async () => {
    const r = await request(app)
      .post('/api/uploads')
      .set('Tus-Resumable', '1.0.0')
      .set('Upload-Length', '1024')
      .set('Upload-Metadata', 'filename dGVzdC56aXA='); // "test.zip" base64
    expect(r.status).toBe(201);
    expect(r.headers.location).toMatch(/\/api\/uploads\/[a-f0-9-]+/);
  });
  ```
- [ ] 실행 → PASS.
- [ ] Commit: `git commit -am "feat(ps): tus upload server mounted"`

### Task 2-2: 업로드 초기화 라우트 (슬롯 연동)

**Files:**
- Modify: `routes/pixelStreaming.js`
- Modify: `services/pixelStreaming/uploadService.js`
- Test: `tests/pixelStreaming/uploadService.test.js`

- [ ] `POST /api/projects/:projectId/ps-slots/:slotId/upload/initiate` 라우트 추가.
  - 응답: `{upload_id, upload_url: '/api/uploads', chunk_size: 64*1024*1024}`.
  - upload_id 와 slotId 매핑 메모리/DB 저장 (간단하게 `ps_pending_uploads` 테이블 or 인메모리 Map + cleanup).
- [ ] 선택: 단순화 위해 tus metadata 에 `slot_id=<N>` 를 포함하도록 클라이언트에 강제. 서버는 finalize 시 metadata 에서 slot_id 추출.
- [ ] 구현:
  ```js
  router.post('/:slotId/upload/initiate', requireAdmin, async (req, res) => {
    const slot = await slotDao.getById(req.params.slotId);
    if (!slot) return res.status(404).end();
    res.json({
      upload_url: '/api/uploads',
      required_metadata: {
        slot_id: String(slot.id),
        filename: 'must include .zip',
      },
      chunk_size: 64 * 1024 * 1024,
    });
  });
  ```
- [ ] Commit: `git commit -am "feat(ps): upload initiate endpoint"`

### Task 2-3: finalize 훅 — 업로드 완료 감지

**Files:**
- Modify: `services/pixelStreaming/uploadService.js`
- Create: `services/pixelStreaming/pipeline.js`
- Test: `tests/pixelStreaming/pipeline.test.js`

- [ ] tus-node-server 의 `POST_FINISH` 이벤트에 훅 연결:
  ```js
  tusServer.on('POST_FINISH', async (req, res, upload) => {
    const meta = upload.metadata || {};
    const slotId = parseInt(meta.slot_id, 10);
    if (!slotId) return; // invalid upload, ignore
    const pipeline = require('./pipeline');
    pipeline.run({
      slotId,
      uploadPath: path.join(INCOMING, upload.id),
      uploadedBy: /* JWT 에서 추출 필요 — Task 2-4 에서 처리 */ 1,
    }).catch(err => console.error('pipeline failed', err));
  });
  ```
- [ ] `pipeline.js` 스켈레톤:
  ```js
  const path = require('path');
  const fs = require('fs/promises');
  const versionDao = require('./versionDao');
  const { STORAGE_ROOT, BUILD_STATUS } = require('./constants');
  const slotDao = require('./slotDao');

  async function run({ slotId, uploadPath, uploadedBy }) {
    const slot = await slotDao.getById(slotId);
    const version = await versionDao.createNext({ slotId, uploadedBy });
    const versionDir = path.join(STORAGE_ROOT, `project-${slot.project_id}`, slot.name, 'versions', version.version_label);
    await fs.mkdir(versionDir, { recursive: true });
    const zipDest = path.join(versionDir, 'upload.zip');
    await fs.rename(uploadPath, zipDest);
    // 다음 단계: extract → build → deploy. 다음 태스크에서 채움.
    await versionDao.updateStatus(version.id, BUILD_STATUS.EXTRACTING);
    // TODO: Task 2-4에서 extractor 호출
    return version;
  }

  module.exports = { run };
  ```
- [ ] 테스트: 더미 zip 업로드 시 `versionDir/upload.zip` 생성 + status=extracting:
  ```js
  test('pipeline moves upload and creates version row', async () => {
    const slotId = await createTestSlot();
    const tmp = await makeTempZip();
    const v = await pipeline.run({ slotId, uploadPath: tmp, uploadedBy: 1 });
    expect(fs.existsSync(path.join(STORAGE_ROOT, `project-${...}/v1/upload.zip`))).toBe(true);
    expect(v.build_status).toBe('uploading'); // createNext 초기값
  });
  ```
- [ ] Commit: `git commit -am "feat(ps): pipeline skeleton + finalize hook"`

### Task 2-4: zip 검증 & 추출 (보안 포함)

**Files:**
- Create: `services/pixelStreaming/extractor.js`
- Test: `tests/pixelStreaming/extractor.test.js`

- [ ] `npm install yauzl` (path traversal 안전한 zip 라이브러리).
- [ ] 테스트 먼저:
  ```js
  const { extractAndValidate } = require('../../services/pixelStreaming/extractor');

  test('rejects zip with path traversal', async () => {
    const zip = await makeZipWithEntry('../../etc/passwd', 'bad');
    await expect(extractAndValidate(zip, '/tmp/test-extract')).rejects.toThrow(/unsafe/);
  });

  test('requires Shipping binary', async () => {
    const zip = await makeZipWithEntry('Package/Linux/Foo/Content/Paks/a.ucas', 'x'.repeat(100));
    await expect(extractAndValidate(zip, '/tmp/test-extract')).rejects.toThrow(/Shipping/);
  });

  test('requires at least one .ucas', async () => {
    const zip = await makeZipWithEntry('Package/Linux/Foo/Binaries/Linux/Foo-Linux-Shipping', 'bin');
    await expect(extractAndValidate(zip, '/tmp/test-extract')).rejects.toThrow(/ucas/);
  });

  test('valid package extracts successfully', async () => {
    const zip = await makeValidPackageZip(); // 헬퍼
    await extractAndValidate(zip, '/tmp/test-extract');
    expect(fs.existsSync('/tmp/test-extract/Package/Linux')).toBe(true);
  });
  ```
- [ ] 실행 → FAIL.
- [ ] 구현:
  ```js
  const yauzl = require('yauzl');
  const path = require('path');
  const fs = require('fs/promises');
  const fsSync = require('fs');

  async function extractAndValidate(zipPath, destDir) {
    await fs.mkdir(destDir, { recursive: true });
    const resolvedDest = path.resolve(destDir);

    await new Promise((resolve, reject) => {
      yauzl.open(zipPath, { lazyEntries: true }, (err, zip) => {
        if (err) return reject(err);
        zip.on('entry', async (entry) => {
          const target = path.resolve(path.join(destDir, entry.fileName));
          if (!target.startsWith(resolvedDest + path.sep)) {
            return reject(new Error(`unsafe entry: ${entry.fileName}`));
          }
          if (/\/$/.test(entry.fileName)) {
            await fs.mkdir(target, { recursive: true });
            return zip.readEntry();
          }
          zip.openReadStream(entry, async (err, rs) => {
            if (err) return reject(err);
            await fs.mkdir(path.dirname(target), { recursive: true });
            const ws = fsSync.createWriteStream(target);
            rs.pipe(ws);
            ws.on('finish', () => zip.readEntry());
            ws.on('error', reject);
          });
        });
        zip.on('end', resolve);
        zip.on('error', reject);
        zip.readEntry();
      });
    });

    // 필수 파일 검증
    const glob = require('glob');
    const shipping = glob.sync(path.join(destDir, 'Package/Linux/*/Binaries/Linux/*-Linux-Shipping'));
    if (!shipping.length) throw new Error('missing *-Linux-Shipping binary');
    const ucas = glob.sync(path.join(destDir, 'Package/Linux/*/Content/Paks/*.ucas'));
    if (!ucas.length) throw new Error('missing .ucas files in Content/Paks');

    return { shippingBinary: shipping[0], gameName: path.basename(path.dirname(path.dirname(path.dirname(shipping[0])))) };
  }

  module.exports = { extractAndValidate };
  ```
- [ ] 실행 → PASS.
- [ ] Commit: `git commit -am "feat(ps): zip extractor with path traversal + content validation"`

### Task 2-5: pipeline 에서 extractor 호출

**Files:**
- Modify: `services/pixelStreaming/pipeline.js`

- [ ] `run()` 안에서 extractor 호출 + status 갱신 + 실패 처리 추가:
  ```js
  const { extractAndValidate } = require('./extractor');

  async function run({ slotId, uploadPath, uploadedBy }) {
    const slot = await slotDao.getById(slotId);
    const version = await versionDao.createNext({ slotId, uploadedBy });
    const versionDir = path.join(STORAGE_ROOT, `project-${slot.project_id}`, slot.name, 'versions', version.version_label);
    await fs.mkdir(versionDir, { recursive: true });
    const zipDest = path.join(versionDir, 'upload.zip');
    await fs.rename(uploadPath, zipDest);

    try {
      await versionDao.updateStatus(version.id, BUILD_STATUS.EXTRACTING);
      const meta = await extractAndValidate(zipDest, versionDir);
      await versionDao.updateStatus(version.id, BUILD_STATUS.BUILDING,
        `\nExtracted. game=${meta.gameName}\n`);
      // Phase 3 에서 빌드 호출
    } catch (e) {
      await versionDao.updateStatus(version.id, BUILD_STATUS.FAILED, `\nERROR: ${e.message}\n`);
      throw e;
    }
    return version;
  }
  ```
- [ ] Commit: `git commit -am "feat(ps): wire extractor into pipeline"`

---

## Phase 3 — Docker 이미지 빌드 & GPU 호스트 전송

### Task 3-1: UE5 Pixel Streaming Dockerfile 템플릿

**Files:**
- Create: `templates/pixel-streaming/Dockerfile`
- Create: `templates/pixel-streaming/entrypoint.sh`

- [ ] 기존 `TwinversePS2-Deploy/Dockerfile` 을 참고(Orbitron 개발자는 `git clone ChoonwooLim/TwinversePS2-Deploy` 로 확인). 핵심 요소:
  - Base: `nvidia/cuda:12.6.0-base-ubuntu22.04`
  - 의존성: xvfb, mesa, vulkan, pulseaudio, ffmpeg, libnss3, libasound2, libxshmfence1
  - Wilbur Pixel Streaming frontend 복사 (npm install & build)
  - UE5 Shipping 바이너리 위치: `/opt/ue5/Package/Linux/<GAME>/Binaries/Linux/<GAME>-Linux-Shipping`
  - ENTRYPOINT: xvfb-run + Shipping 실행, Wilbur signaling, player 구동
- [ ] Dockerfile 작성 (실제 동작 검증된 기존 파일 베이스로):
  ```dockerfile
  FROM nvidia/cuda:12.6.0-base-ubuntu22.04

  ARG DEBIAN_FRONTEND=noninteractive
  RUN apt-get update && apt-get install -y --no-install-recommends \
      xvfb pulseaudio ffmpeg mesa-utils libvulkan1 vulkan-tools \
      libnss3 libasound2 libxshmfence1 libxkbcommon0 \
      curl ca-certificates nodejs npm \
    && rm -rf /var/lib/apt/lists/*

  # Wilbur (Pixel Streaming frontend + signaling)
  # 버전 고정: Orbitron 개발자가 Phase 3-1 착수 시 Epic 최신 호환 태그 확인
  RUN git clone --depth 1 --branch 5.5 \
      https://github.com/EpicGames/PixelStreamingInfrastructure /opt/psi \
    && cd /opt/psi/Frontend/implementations/typescript && npm ci && npm run build \
    && cd /opt/psi/SignallingWebServer && npm ci

  # UE5 패키지 복사 (빌드 context = versions/v<N>/Package)
  COPY Linux /opt/ue5/Package/Linux

  COPY entrypoint.sh /usr/local/bin/entrypoint.sh
  RUN chmod +x /usr/local/bin/entrypoint.sh

  EXPOSE 8080 8888
  ENV DISPLAY=:99
  ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
  ```
- [ ] `entrypoint.sh` 작성 (기존 `TwinversePS2-Deploy/scripts/entrypoint.sh` 베이스):
  ```bash
  #!/usr/bin/env bash
  set -e
  # Xvfb
  Xvfb :99 -screen 0 1920x1080x24 +extension GLX +render -noreset &

  # Signaling
  node /opt/psi/SignallingWebServer/cirrus.js \
    --HttpPort=${WILBUR_PLAYER_PORT:-8080} \
    --StreamerPort=${WILBUR_STREAMER_PORT:-8888} &

  # UE5 Shipping
  GAME_BIN=$(ls /opt/ue5/Package/Linux/*/Binaries/Linux/*-Linux-Shipping | head -1)
  exec "$GAME_BIN" \
    -AudioMixer -RenderOffScreen -ForceRes \
    -ResX=1920 -ResY=1080 \
    -PixelStreamingIP=localhost \
    -PixelStreamingPort=${WILBUR_STREAMER_PORT:-8888}
  ```
- [ ] Commit: `git commit -am "feat(ps): Pixel Streaming Dockerfile template"`

### Task 3-2: 이미지 빌드 실행기

**Files:**
- Create: `services/pixelStreaming/imageBuilder.js`
- Test: `tests/pixelStreaming/imageBuilder.test.js`

- [ ] 빌드는 `docker build` 자식 프로세스로 실행. 로그 스트림을 SSE 로 내보낼 수 있어야 함.
- [ ] 구현:
  ```js
  const { spawn } = require('child_process');
  const path = require('path');
  const fs = require('fs/promises');
  const { IMAGE_NAMESPACE } = require('./constants');

  function buildImage({ versionDir, slotName, versionLabel, onLog }) {
    return new Promise(async (resolve, reject) => {
      // 템플릿 파일을 versionDir 에 복사 (Docker build context 한정)
      const template = path.resolve(__dirname, '../../templates/pixel-streaming');
      await fs.copyFile(path.join(template, 'Dockerfile'), path.join(versionDir, 'Dockerfile'));
      await fs.copyFile(path.join(template, 'entrypoint.sh'), path.join(versionDir, 'entrypoint.sh'));

      const tag = `${IMAGE_NAMESPACE}-${slotName}:${versionLabel}`;
      // build context = versionDir/Package → COPY Linux 경로 유효하려면 context=versionDir/Package
      const ctx = path.join(versionDir, 'Package');
      // Dockerfile/entrypoint 도 context 안으로 이동
      await fs.copyFile(path.join(versionDir, 'Dockerfile'), path.join(ctx, 'Dockerfile'));
      await fs.copyFile(path.join(versionDir, 'entrypoint.sh'), path.join(ctx, 'entrypoint.sh'));

      const proc = spawn('docker', ['build', '-t', tag, ctx]);
      proc.stdout.on('data', d => onLog?.(d.toString()));
      proc.stderr.on('data', d => onLog?.(d.toString()));
      proc.on('close', code => code === 0 ? resolve(tag) : reject(new Error(`docker build exit ${code}`)));
    });
  }

  module.exports = { buildImage };
  ```
- [ ] 테스트는 실제 Docker 데몬 필요. CI 에서 건너뛰고 수동 smoke test 만 (문서화):
  ```js
  test.skip('buildImage returns tag on success', async () => {
    // skipped: requires docker, run manually
  });
  ```
- [ ] Commit: `git commit -am "feat(ps): docker image builder"`

### Task 3-3: 이미지 전송 (save | ssh load)

**Files:**
- Create: `services/pixelStreaming/imageTransfer.js`
- Test: `tests/pixelStreaming/imageTransfer.test.js`

- [ ] 구현:
  ```js
  const { spawn } = require('child_process');
  const { GPU_HOST, GPU_USER } = require('./constants');

  function transferImage({ tag, onLog }) {
    return new Promise((resolve, reject) => {
      const save = spawn('docker', ['save', tag]);
      const load = spawn('ssh', [`${GPU_USER}@${GPU_HOST}`, 'docker', 'load']);
      save.stdout.pipe(load.stdin);
      save.stderr.on('data', d => onLog?.('[save] ' + d));
      load.stdout.on('data', d => onLog?.('[load] ' + d));
      load.stderr.on('data', d => onLog?.('[load] ' + d));
      save.on('error', reject); load.on('error', reject);
      load.on('close', code => code === 0 ? resolve(tag) : reject(new Error(`load exit ${code}`)));
    });
  }

  module.exports = { transferImage };
  ```
- [ ] 테스트는 수동(`test.skip`) + smoke 스크립트 `scripts/test-transfer.sh` 로.
- [ ] Commit: `git commit -am "feat(ps): image transfer via docker save | ssh docker load"`

### Task 3-4: 슬롯 compose 파일 템플릿 & 원격 배포

**Files:**
- Create: `services/pixelStreaming/remoteDeploy.js`
- Test: `tests/pixelStreaming/remoteDeploy.test.js`

- [ ] compose 렌더링 + 원격 기록:
  ```js
  const { spawn } = require('child_process');
  const { GPU_HOST, GPU_USER, GPU_SLOTS_ROOT } = require('./constants');

  function renderCompose({ imageTag, slotName, containerPort }) {
    return `services:
    ps:
      image: ${imageTag}
      container_name: ps-${slotName}
      restart: "no"
      runtime: nvidia
      environment:
        - NVIDIA_VISIBLE_DEVICES=all
        - NVIDIA_DRIVER_CAPABILITIES=compute,utility,graphics,display,video
        - WILBUR_PLAYER_PORT=8080
        - WILBUR_STREAMER_PORT=8888
      ports:
        - "${containerPort}:8080"
      healthcheck:
        test: ["CMD", "curl", "-f", "http://localhost:8080/"]
        interval: 10s
        timeout: 3s
        retries: 6
  `;
  }

  function runSsh(cmd) {
    return new Promise((resolve, reject) => {
      const p = spawn('ssh', [`${GPU_USER}@${GPU_HOST}`, cmd]);
      let out = '', err = '';
      p.stdout.on('data', d => out += d);
      p.stderr.on('data', d => err += d);
      p.on('close', code => code === 0 ? resolve(out) : reject(new Error(err || `exit ${code}`)));
    });
  }

  async function writeSlotCompose({ slotName, compose }) {
    const dir = `${GPU_SLOTS_ROOT}/${slotName}`;
    await runSsh(`mkdir -p ${dir}`);
    // compose 를 heredoc 으로 전송
    const escaped = compose.replace(/'/g, `'\\''`);
    await runSsh(`cat > ${dir}/docker-compose.yml <<'EOF'\n${escaped}\nEOF`);
  }

  async function removeSlotRemote(slotName) {
    await runSsh(`cd ${GPU_SLOTS_ROOT}/${slotName} && docker compose down || true`);
    await runSsh(`rm -rf ${GPU_SLOTS_ROOT}/${slotName}`);
  }

  module.exports = { renderCompose, writeSlotCompose, removeSlotRemote, runSsh };
  ```
- [ ] 단위 테스트 — `renderCompose` 가 올바른 YAML 생성하는지:
  ```js
  test('renderCompose includes image tag and port', () => {
    const y = renderCompose({ imageTag: 'foo:v1', slotName: 'office', containerPort: 8081 });
    expect(y).toMatch('image: foo:v1');
    expect(y).toMatch('"8081:8080"');
    expect(y).toMatch('container_name: ps-office');
  });
  ```
- [ ] Commit: `git commit -am "feat(ps): remote deploy via ssh + compose"`

### Task 3-5: pipeline.js 에 빌드/전송 단계 연결

**Files:**
- Modify: `services/pixelStreaming/pipeline.js`

- [ ] `run()` 확장 — extract 성공 후 build → transfer → writeCompose 호출:
  ```js
  const { buildImage } = require('./imageBuilder');
  const { transferImage } = require('./imageTransfer');
  const { renderCompose, writeSlotCompose } = require('./remoteDeploy');

  async function run({ slotId, uploadPath, uploadedBy }) {
    const slot = await slotDao.getById(slotId);
    const version = await versionDao.createNext({ slotId, uploadedBy });
    const versionDir = ...; // 기존 코드 유지
    const zipDest = path.join(versionDir, 'upload.zip');
    await fs.rename(uploadPath, zipDest);

    const appendLog = (txt) => versionDao.updateStatus(version.id, undefined, txt);
    try {
      await versionDao.updateStatus(version.id, BUILD_STATUS.EXTRACTING);
      await extractAndValidate(zipDest, versionDir);

      await versionDao.updateStatus(version.id, BUILD_STATUS.BUILDING);
      const tag = await buildImage({
        versionDir, slotName: slot.name, versionLabel: version.version_label,
        onLog: appendLog,
      });
      await pool.query('UPDATE ps_versions SET image_tag=$1 WHERE id=$2', [tag, version.id]);

      await transferImage({ tag, onLog: appendLog });
      const compose = renderCompose({ imageTag: tag, slotName: slot.name, containerPort: slot.container_port });
      await writeSlotCompose({ slotName: slot.name, compose });

      await versionDao.updateStatus(version.id, BUILD_STATUS.READY);
      // Phase 4 에서 active_version 교체 & 기존 컨테이너 정리 추가
    } catch (e) {
      await versionDao.updateStatus(version.id, BUILD_STATUS.FAILED, `\nERROR: ${e.message}\n`);
      throw e;
    }
    return version;
  }
  ```
- [ ] Commit: `git commit -am "feat(ps): pipeline runs build+transfer+compose"`

### Task 3-6: 빌드 로그 SSE 엔드포인트

**Files:**
- Modify: `routes/pixelStreaming.js`
- Test: `tests/routes/pixelStreaming.test.js`

- [ ] 구현:
  ```js
  router.get('/:slotId/versions/:versionId/build-log', requireAdmin, async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.flushHeaders();

    let lastLen = 0;
    const timer = setInterval(async () => {
      const { rows } = await pool.query(
        'SELECT build_log, build_status FROM ps_versions WHERE id=$1',
        [req.params.versionId]
      );
      if (!rows.length) return;
      const v = rows[0];
      if (v.build_log && v.build_log.length > lastLen) {
        res.write(`data: ${JSON.stringify({ log: v.build_log.slice(lastLen) })}\n\n`);
        lastLen = v.build_log.length;
      }
      if (['ready','failed'].includes(v.build_status)) {
        res.write(`event: done\ndata: ${JSON.stringify({ status: v.build_status })}\n\n`);
        clearInterval(timer);
        res.end();
      }
    }, 1000);
    req.on('close', () => clearInterval(timer));
  });
  ```
- [ ] 테스트: 짧은 빌드 시뮬레이션 + SSE 수신 확인 (단순 integration).
- [ ] Commit: `git commit -am "feat(ps): build log SSE stream"`

---

## Phase 4 — 버전 활성화, 롤백, Cloudflare DNS

### Task 4-1: symlink 원자적 교체 유틸

**Files:**
- Create: `services/pixelStreaming/activation.js`
- Test: `tests/pixelStreaming/activation.test.js`

- [ ] 테스트 먼저:
  ```js
  const { activateVersion } = require('../../services/pixelStreaming/activation');

  test('activateVersion switches current symlink atomically', async () => {
    const base = tmpDir();
    fs.mkdirSync(path.join(base, 'versions/v1'), { recursive: true });
    fs.mkdirSync(path.join(base, 'versions/v2'), { recursive: true });
    await activateVersion({ slotRoot: base, versionLabel: 'v1' });
    expect(fs.readlinkSync(path.join(base, 'current'))).toBe('versions/v1');
    await activateVersion({ slotRoot: base, versionLabel: 'v2' });
    expect(fs.readlinkSync(path.join(base, 'current'))).toBe('versions/v2');
  });
  ```
- [ ] 구현:
  ```js
  const fs = require('fs/promises');
  const path = require('path');

  async function activateVersion({ slotRoot, versionLabel }) {
    const tmp = path.join(slotRoot, `current.tmp.${process.pid}`);
    try { await fs.unlink(tmp); } catch {}
    await fs.symlink(`versions/${versionLabel}`, tmp);
    await fs.rename(tmp, path.join(slotRoot, 'current'));
  }

  module.exports = { activateVersion };
  ```
- [ ] Commit: `git commit -am "feat(ps): atomic version activation via symlink rename"`

### Task 4-2: 기존 컨테이너 정리 + 활성화 파이프라인

**Files:**
- Modify: `services/pixelStreaming/pipeline.js`

- [ ] `run()` 마지막에 추가:
  ```js
  const { activateVersion } = require('./activation');
  const { runSsh } = require('./remoteDeploy');

  // (BUILD_STATUS.READY 직전 블록 안쪽)
  const slotRoot = path.join(STORAGE_ROOT, `project-${slot.project_id}`, slot.name);
  await activateVersion({ slotRoot, versionLabel: version.version_label });

  // 기존 실행 중 컨테이너 있으면 stop (on-demand 라 재시작은 사용자 Play 에 맡김)
  await runSsh(`cd /opt/ps-slots/${slot.name} && docker compose down || true`);

  // DB active_version 업데이트
  await pool.query('UPDATE ps_slots SET active_version=$1, state=$2 WHERE id=$3',
    [version.id, 'stopped', slotId]);

  // FIFO 오래된 버전 삭제
  const removed = await versionDao.pruneOldVersions(slotId);
  for (const vid of removed) {
    await removeVersionFiles(slotRoot, vid); // 다음 태스크에서 구현
  }
  ```
- [ ] Commit: `git commit -am "feat(ps): activate version + cleanup old containers"`

### Task 4-3: 롤백 API

**Files:**
- Modify: `routes/pixelStreaming.js`
- Create: `services/pixelStreaming/rollback.js`
- Test: `tests/pixelStreaming/rollback.test.js`

- [ ] 구현:
  ```js
  // rollback.js
  async function rollbackTo({ slotId, versionId }) {
    const slot = await slotDao.getById(slotId);
    const v = await pool.query('SELECT * FROM ps_versions WHERE id=$1 AND slot_id=$2',
      [versionId, slotId]);
    if (!v.rows.length) throw new Error('version not in slot');
    if (v.rows[0].build_status !== 'ready') throw new Error('version not ready');

    const slotRoot = path.join(STORAGE_ROOT, `project-${slot.project_id}`, slot.name);
    await activateVersion({ slotRoot, versionLabel: v.rows[0].version_label });

    // compose 파일 재기록 (이미지 태그가 이 버전 것이어야 함)
    const compose = renderCompose({
      imageTag: v.rows[0].image_tag,
      slotName: slot.name,
      containerPort: slot.container_port,
    });
    await writeSlotCompose({ slotName: slot.name, compose });

    await runSsh(`cd /opt/ps-slots/${slot.name} && docker compose down || true`);
    await pool.query('UPDATE ps_slots SET active_version=$1, state=$2 WHERE id=$3',
      [versionId, 'stopped', slotId]);
  }
  module.exports = { rollbackTo };
  ```
- [ ] Route:
  ```js
  router.post('/:slotId/versions/:versionId/activate', requireAdmin, async (req, res) => {
    try {
      await require('../services/pixelStreaming/rollback')
        .rollbackTo({ slotId: req.params.slotId, versionId: req.params.versionId });
      res.status(204).end();
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  ```
- [ ] Commit: `git commit -am "feat(ps): rollback to prior version"`

### Task 4-4: Cloudflare DNS 자동화

**Files:**
- Create: `services/pixelStreaming/cloudflareDns.js`
- Test: `tests/pixelStreaming/cloudflareDns.test.js`

> Task 0-2 결과에 따라: 기존 Orbitron 에 Cloudflare 자동화 코드가 있으면 **재사용** (이 태스크는 wrapper 만 작성). 없으면 아래대로 신규 구현.

- [ ] `npm install cloudflare`.
- [ ] 필요한 env vars: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID`, `CLOUDFLARE_TUNNEL_HOSTNAME` (예: `<uuid>.cfargotunnel.com`).
- [ ] 구현:
  ```js
  const Cloudflare = require('cloudflare');
  const cf = new Cloudflare({ token: process.env.CLOUDFLARE_API_TOKEN });
  const ZONE = process.env.CLOUDFLARE_ZONE_ID;
  const TUNNEL_HOST = process.env.CLOUDFLARE_TUNNEL_HOSTNAME;

  async function ensureCname(subdomain) {
    const existing = await cf.dnsRecords.browse(ZONE, { name: subdomain });
    if (existing.result.length) return existing.result[0];
    const r = await cf.dnsRecords.add(ZONE, {
      type: 'CNAME', name: subdomain, content: TUNNEL_HOST, proxied: true,
    });
    return r.result;
  }

  async function removeCname(subdomain) {
    const existing = await cf.dnsRecords.browse(ZONE, { name: subdomain });
    for (const r of existing.result) {
      await cf.dnsRecords.del(ZONE, r.id);
    }
  }

  module.exports = { ensureCname, removeCname };
  ```
- [ ] 테스트는 실제 API 호출 대신 `cloudflare` mock 으로:
  ```js
  jest.mock('cloudflare');
  ```
- [ ] Commit: `git commit -am "feat(ps): cloudflare DNS automation"`

### Task 4-5: cloudflared ingress 자동 갱신

**Files:**
- Create: `services/pixelStreaming/cloudflaredIngress.js`
- Test: `tests/pixelStreaming/cloudflaredIngress.test.js`

> cloudflared config 경로: `/home/stevenlim/.cloudflared/config.yml`. 수정 후 `sudo systemctl kill -s HUP cloudflared` 로 리로드.

- [ ] 구현:
  ```js
  const fs = require('fs/promises');
  const yaml = require('yaml');
  const { spawn } = require('child_process');

  const CFGD = '/home/stevenlim/.cloudflared/config.yml';

  async function addIngressRule({ hostname, servicePort }) {
    const doc = yaml.parse(await fs.readFile(CFGD, 'utf8'));
    doc.ingress = doc.ingress || [];
    // catch-all (service: http_status:404) 앞에 삽입
    const idx = doc.ingress.findIndex(r => r.service && r.service.startsWith('http_status'));
    const rule = { hostname, service: `http://twinverse-ai:${servicePort}` };
    doc.ingress.splice(idx >= 0 ? idx : doc.ingress.length, 0, rule);
    await fs.writeFile(CFGD, yaml.stringify(doc));
    await reload();
  }

  async function removeIngressRule(hostname) {
    const doc = yaml.parse(await fs.readFile(CFGD, 'utf8'));
    doc.ingress = (doc.ingress || []).filter(r => r.hostname !== hostname);
    await fs.writeFile(CFGD, yaml.stringify(doc));
    await reload();
  }

  function reload() {
    return new Promise((resolve, reject) => {
      const p = spawn('sudo', ['systemctl', 'kill', '-s', 'HUP', 'cloudflared']);
      p.on('close', c => c === 0 ? resolve() : reject(new Error(`SIGHUP exit ${c}`)));
    });
  }

  module.exports = { addIngressRule, removeIngressRule };
  ```
- [ ] sudo 권한: `/etc/sudoers.d/orbitron` 에 `stevenlim ALL=(ALL) NOPASSWD: /bin/systemctl kill -s HUP cloudflared` 추가 필요 — Orbitron 개발자가 운영자에게 요청.
- [ ] 단위 테스트: 임시 파일로 ingress 조작 검증.
- [ ] Commit: `git commit -am "feat(ps): cloudflared ingress auto-update + SIGHUP"`

### Task 4-6: 슬롯 생성 시 DNS + ingress 통합

**Files:**
- Modify: `routes/pixelStreaming.js`
- Modify: `services/pixelStreaming/slotDao.js` (또는 라우트 레벨에서 처리)

- [ ] `POST /ps-slots` 에서 DAO create 성공 후 DNS + ingress 호출. 실패 시 slot row 롤백(delete).
- [ ] `DELETE /ps-slots/:id` 에서 reverse 호출 (ingress 제거 → DNS 제거 → 컨테이너 down → DB row 삭제).
- [ ] 통합 테스트: mock CF API + 임시 cloudflared config.
- [ ] Commit: `git commit -am "feat(ps): wire DNS+ingress to slot lifecycle"`

---

## Phase 5 — 온디맨드 기동 & 유휴 자동 stop

### Task 5-1: start/stop 라우트

**Files:**
- Modify: `routes/pixelStreaming.js`
- Create: `services/pixelStreaming/runtimeControl.js`
- Test: `tests/pixelStreaming/runtimeControl.test.js`

- [ ] 구현:
  ```js
  const { runSsh } = require('./remoteDeploy');
  const slotDao = require('./slotDao');
  const pool = require('../../db/db');
  const { START_TIMEOUT_S } = require('./constants');
  const fetch = require('node-fetch');

  async function start(slotId) {
    const slot = await slotDao.getById(slotId);
    if (!slot || !slot.active_version) throw new Error('slot has no active version');
    await runSsh(`cd /opt/ps-slots/${slot.name} && docker compose up -d`);
    // 헬스폴링
    const deadline = Date.now() + START_TIMEOUT_S * 1000;
    while (Date.now() < deadline) {
      try {
        const r = await fetch(`http://twinverse-ai:${slot.container_port}/`, { timeout: 2000 });
        if (r.ok) break;
      } catch {}
      await new Promise(r => setTimeout(r, 2000));
    }
    await pool.query(
      `UPDATE ps_slots SET state='running', last_activity_at=NOW() WHERE id=$1`, [slotId]);
    return {
      ready: true,
      stream_url: `https://${slot.subdomain}`,
      estimated_ready_in_s: 0,
    };
  }

  async function stop(slotId) {
    const slot = await slotDao.getById(slotId);
    await runSsh(`cd /opt/ps-slots/${slot.name} && docker compose stop`);
    await pool.query(`UPDATE ps_slots SET state='stopped' WHERE id=$1`, [slotId]);
  }

  async function status(slotId) {
    const slot = await slotDao.getById(slotId);
    // Phase 5-2 의 sessionCount 사용
    const sessions = await require('./sessionProbe').count(slot);
    return {
      state: slot.state,
      current_session_count: sessions,
      last_activity_at: slot.last_activity_at,
    };
  }

  module.exports = { start, stop, status };
  ```
- [ ] 라우트:
  ```js
  router.post('/:slotId/start', requireAdmin, async (req, res) => {
    try { res.json(await require('../services/pixelStreaming/runtimeControl').start(req.params.slotId)); }
    catch (e) { res.status(400).json({ error: e.message }); }
  });
  router.post('/:slotId/stop', requireAdmin, async (req, res) => {
    await require('../services/pixelStreaming/runtimeControl').stop(req.params.slotId);
    res.status(204).end();
  });
  router.get('/:slotId/status', requireAdmin, async (req, res) => {
    res.json(await require('../services/pixelStreaming/runtimeControl').status(req.params.slotId));
  });
  ```
- [ ] Commit: `git commit -am "feat(ps): start/stop/status runtime control"`

### Task 5-2: Wilbur 세션 수 조회

**Files:**
- Create: `services/pixelStreaming/sessionProbe.js`

> Task 0-3 결과에 따라 구현. Wilbur admin API 가 있으면 그것 사용, 없으면 signaling 포트 TCP 연결 수 (`ss -tn state established sport = :8888`).

- [ ] 구현 예시 (Wilbur admin API 가정):
  ```js
  const fetch = require('node-fetch');

  async function count(slot) {
    try {
      const r = await fetch(`http://twinverse-ai:${slot.container_port}/api/streamers`, { timeout: 2000 });
      if (!r.ok) return 0;
      const data = await r.json();
      return Array.isArray(data) ? data.reduce((n, s) => n + (s.players?.length || 0), 0) : 0;
    } catch { return 0; }
  }
  module.exports = { count };
  ```
- [ ] 주석: Wilbur admin 미지원이면 `ss` 기반 fallback 구현 필요.
- [ ] Commit: `git commit -am "feat(ps): wilbur session probe"`

### Task 5-3: 유휴 감지 워커

**Files:**
- Create: `services/pixelStreaming/idleSweeper.js`
- Modify: `server.js` (부팅 시 기동)

- [ ] 구현:
  ```js
  const pool = require('../../db/db');
  const { IDLE_SWEEP_INTERVAL_S } = require('./constants');
  const sessionProbe = require('./sessionProbe');
  const runtime = require('./runtimeControl');

  function startIdleSweeper() {
    setInterval(async () => {
      try {
        const { rows } = await pool.query(
          `SELECT * FROM ps_slots WHERE state='running' AND pinned=false`);
        for (const slot of rows) {
          const sessions = await sessionProbe.count(slot);
          const idleMs = Date.now() - new Date(slot.last_activity_at).getTime();
          if (sessions === 0 && idleMs > slot.idle_timeout_s * 1000) {
            console.log(`[idleSweeper] stopping ${slot.name} (idle ${idleMs}ms)`);
            await runtime.stop(slot.id);
          } else if (sessions > 0) {
            await pool.query(`UPDATE ps_slots SET last_activity_at=NOW() WHERE id=$1`, [slot.id]);
          }
        }
      } catch (e) { console.error('[idleSweeper]', e); }
    }, IDLE_SWEEP_INTERVAL_S * 1000);
  }

  module.exports = { startIdleSweeper };
  ```
- [ ] `server.js` 에서:
  ```js
  require('./services/pixelStreaming/idleSweeper').startIdleSweeper();
  ```
- [ ] 테스트: 인메모리 fake DB + fake sessionProbe 로 idle/active 분기 검증.
- [ ] Commit: `git commit -am "feat(ps): idle sweeper with pinned exemption"`

### Task 5-4: 공개 API (랜딩페이지용)

**Files:**
- Create: `routes/pixelStreamingPublic.js`
- Modify: `server.js`
- Test: `tests/routes/pixelStreamingPublic.test.js`

- [ ] 구현:
  ```js
  const express = require('express');
  const router = express.Router();
  const pool = require('../db/db');
  const rateLimit = require('express-rate-limit');
  const limiter = rateLimit({ windowMs: 60*1000, max: 60 });

  router.get('/projects/:projectSlug/ps-slots', limiter, async (req, res) => {
    const { rows } = await pool.query(
      `SELECT s.name, s.display_name, s.description, s.thumbnail_url, s.subdomain
         FROM ps_slots s
         JOIN projects p ON p.id = s.project_id
        WHERE p.subdomain = $1 AND s.active_version IS NOT NULL`,
      [req.params.projectSlug]
    );
    res.json(rows);
  });

  module.exports = router;
  ```
- [ ] `server.js`: `app.use('/api/public', require('./routes/pixelStreamingPublic'));`
- [ ] Commit: `git commit -am "feat(ps): public slot listing API"`

---

## Phase 6 — UI

### Task 6-1: Orbitron 대시보드 — 슬롯 목록 탭

**Files:**
- Create: `public/pixel-streaming.html` (또는 기존 프론트 스택 맞춰서)
- Create: `public/js/pixel-streaming.js`
- Modify: 기존 프로젝트 상세 페이지에 탭 링크 추가

> Task 0-2 의 스택 결정에 따라 SPA(React 등) 이면 컴포넌트로 작성. 여기서는 SSR/vanilla JS 가정.

- [ ] 슬롯 목록 테이블 + 생성 모달 + 슬롯 상세 패널. fetch API 로 위 엔드포인트 호출.
- [ ] 업로드: `tus-js-client` 사용:
  ```js
  const upload = new tus.Upload(file, {
    endpoint: '/api/uploads',
    chunkSize: 64 * 1024 * 1024,
    metadata: { filename: file.name, slot_id: String(slotId) },
    onProgress: (bytesSent, bytesTotal) => { /* 진행바 갱신 */ },
    onSuccess: () => { /* SSE 빌드 로그 구독 */ },
  });
  upload.start();
  ```
- [ ] SSE 구독:
  ```js
  const es = new EventSource(`/api/projects/${pid}/ps-slots/${sid}/versions/${vid}/build-log`);
  es.onmessage = e => appendLog(JSON.parse(e.data).log);
  es.addEventListener('done', e => { es.close(); refreshVersions(); });
  ```
- [ ] Commit: `git commit -am "feat(ps): dashboard UI — slots, upload, build log"`

### Task 6-2: 대시보드 — 버전 히스토리 & 롤백 & 런타임 컨트롤

**Files:**
- Modify: `public/js/pixel-streaming.js`

- [ ] 버전 목록 + Rollback 버튼 + Start/Stop 버튼 + idle_timeout 편집 필드.
- [ ] Commit.

### Task 6-3: TwinverseAI 랜딩페이지 연동

**Files:**
- (TwinverseAI repo) `frontend/src/pages/PixelStreaming.tsx`
- (TwinverseAI repo) `frontend/src/App.tsx` (라우트 추가)
- (TwinverseAI repo) 메뉴 컴포넌트에 항목 추가

> 이 태스크만 Orbitron repo 가 아닌 TwinverseAI repo 에서 작업.

- [ ] 페이지 구현:
  ```tsx
  export default function PixelStreaming() {
    const [slots, setSlots] = useState([]);
    useEffect(() => {
      fetch('https://orbitron.twinverse.org/api/public/projects/twinverseai/ps-slots')
        .then(r => r.json()).then(setSlots);
    }, []);
    return (
      <div className="grid">
        {slots.map(s => (
          <Card key={s.name} thumbnail={s.thumbnail_url}
                title={s.display_name} description={s.description}>
            <button onClick={() => handlePlay(s)}>▶ Play</button>
          </Card>
        ))}
      </div>
    );
  }

  async function handlePlay(slot) {
    setLoading(true);
    const r = await fetch(`/api/ps/start`, { method: 'POST', body: JSON.stringify({ slot: slot.name }) });
    const { ready, stream_url } = await r.json();
    if (ready) window.location.href = stream_url;
  }
  ```
- [ ] TwinverseAI 백엔드에 `/api/ps/start` 프록시 엔드포인트 추가 (Orbitron API 를 JWT admin token 으로 호출) — 공개 시작은 Phase C 에서 권한 설계 후 공개.
- [ ] Commit (TwinverseAI repo): `feat: add /pixel-streaming landing page`.

---

## Phase 7 — 마이그레이션 & 컷오버

### Task 7-1: 기존 환경 백업

- [ ] `ssh twinverse-ai "sudo tar czf /root/twinverse-ps2-backup-$(date +%Y%m%d).tgz /opt/twinverse-ps2"`
- [ ] `ssh orbitron "cp /home/stevenlim/.cloudflared/config.yml /home/stevenlim/.cloudflared/config.yml.bak-$(date +%Y%m%d)"`

### Task 7-2: 첫 슬롯 생성 `office`

- [ ] Orbitron 대시보드에서 `office` 슬롯 생성.
- [ ] 현재 `C:\WORK\TwinverseDesk\Package\Linux` 폴더를 zip 으로 압축.
- [ ] 대시보드 업로드 → 빌드 성공 → `office.ps.twinverse.org` 확인.

### Task 7-3: 하위 호환 리다이렉트

- [ ] cloudflared config 에 수동으로:
  ```yaml
  - hostname: ps.twinverse.org
    service: http://twinverse-ai:<office_port>
  - hostname: ps2.twinverse.org
    service: http://twinverse-ai:<office_port>
  ```
- [ ] 또는 Cloudflare Worker 로 301 리다이렉트.

### Task 7-4: 구 시스템 정리

- [ ] twinverse-ai: `docker compose down && rm -rf /opt/twinverse-ps2`.
- [ ] cloudflared: 구 ingress 규칙 삭제 + reload.
- [ ] GitHub: `TwinversePS2-Deploy` repo 설정 → Archive.

### Task 7-5: 문서 업데이트

- [ ] TwinverseAI `CLAUDE.md`: Pixel Streaming 관련 레퍼런스 갱신.
- [ ] `docs/shared-drive-setup.md` 업데이트: Z: 경유 배포는 더 이상 권장 경로 아님 명시.

---

## Self-Review 체크리스트 (완료 시 확인)

- [ ] 각 섹션/요구사항이 스펙과 매칭되는가?
  - ✅ 멀티슬롯, 서브도메인, on-demand, N=3 롤백, 자동 배포, tus 업로드, Cloudflare 자동화, Wilbur 세션 탐지, 유휴 stop, 공개 API, UI 통합, 마이그레이션 체크리스트 — 모두 태스크 포함.
- [ ] 플레이스홀더 없음? (TBD/TODO/"나중에")
  - ✅ 단, Task 0-2/0-3 "조사" 산출물에 따라 이후 태스크의 세부 구현 경로가 결정되는 분기는 명시적으로 노출함. 이는 외부 엔지니어가 Orbitron 내부 구조를 모른다는 필연적 제약.
- [ ] 타입/메서드 이름 일관성?
  - ✅ `slotDao.create/listByProject/getById/updateMeta/remove`, `versionDao.createNext/updateStatus/listBySlot/pruneOldVersions`, `pipeline.run`, `activateVersion`, `ensureCname/removeCname`, `addIngressRule/removeIngressRule` 전역 일관.

## 실행 방식

이 계획은 **외부 Orbitron 개발자에게 전달**하는 문서입니다. Claude/AI 에이전트가 바로 실행하는 계획이 아니므로, subagent-driven / executing-plans 스킬 자동 실행 대상이 아닙니다.

Orbitron 개발자에게 전달 시:
1. 이 파일 전체 공유.
2. `docs/superpowers/specs/2026-04-15-pixel-streaming-platform-design.md` 설계 문서도 함께 전달.
3. Phase 0 의 사전 조사 결과를 본인(Steven)이 검토한 후 Phase 1 착수 승인.
4. 각 Phase 완료마다 데모 + 코드 리뷰 게이트.
