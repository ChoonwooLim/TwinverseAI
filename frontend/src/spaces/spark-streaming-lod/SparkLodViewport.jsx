/**
 * Viewport frame for SparkJS 2.0 Streaming LoD scenes.
 * Reuses TwinverseAI's SpaceViewport dark-glass styling while providing world switching
 * (Coit Tower 40M, Jastrzębia Góra 100M, Hobbiton 24M, Cozy Spaceship 6M) and LOD detail tuning.
 */
import { Component, Suspense, useCallback, useEffect, useId, useRef, useState } from "react";
import { SPACE_SCENES, isSceneChunkError } from "../registry";
import styles from "../SpaceViewport.module.css";
import lodStyles from "./SparkLodViewport.module.css";
import { findStreamingWorld, INITIAL_WORLD_KEY, STREAMING_LOD_WORLDS } from "./worlds";

const FAILURE_COPY = {
  webgl: {
    title: "이 브라우저에서는 3D 가우시안 스플랫팅을 표시할 수 없습니다.",
    text: "WebGL 2를 지원하는 최신 Chrome, Edge, Safari, Firefox에서 열어 주세요. 브라우저 설정에서 하드웨어 가속이 꺼져 있다면 켜 주세요.",
    retry: false,
  },
  asset: {
    title: "스트리밍 LOD 월드 데이터를 불러오지 못했습니다.",
    text: "네트워크 연결을 확인한 뒤 페이지를 새로고침해 주세요.",
    retry: "reload",
  },
  chunk: {
    title: "3D 렌더러 모듈을 불러오지 못했습니다.",
    text: "새 버전이 배포되었거나 연결이 잠시 끊겼을 수 있습니다. 새로고침하면 최신 버전을 다시 불러옵니다.",
    retry: "reload",
  },
  lost: {
    title: "그래픽 장치와의 연결이 끊어졌습니다.",
    text: "그래픽 드라이버가 재시작되었거나 메모리가 부족했을 수 있습니다. 다시 시도하면 3D 공간을 새로 불러옵니다.",
    retry: "remount",
  },
};

function canRenderWebGL2() {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2");
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

function fullscreenElement() {
  return document.fullscreenElement ?? document.webkitFullscreenElement ?? null;
}

function fullscreenSupported() {
  return typeof document !== "undefined" && Boolean(document.fullscreenEnabled || document.webkitFullscreenEnabled);
}

async function enterFullscreen(element) {
  if (element.requestFullscreen) await element.requestFullscreen();
  else if (element.webkitRequestFullscreen) element.webkitRequestFullscreen();
}

async function exitFullscreen() {
  if (document.exitFullscreen) await document.exitFullscreen();
  else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
}

const isControl = (target) =>
  typeof target?.closest === "function" && Boolean(target.closest("button, a, input, select, label, [data-ui]"));

class SceneBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    const kind = isSceneChunkError(error) ? "chunk" : /webgl/i.test(String(error?.message)) ? "webgl" : "asset";
    console.error("[spaces/spark-lod] Scene failed:", error);
    this.props.onFailure(kind);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export default function SparkLodViewport({ sceneKey, title, poster }) {
  const Scene = SPACE_SCENES[sceneKey];
  const frameRef = useRef(null);
  const apiRef = useRef(null);
  const hintId = useId();
  const settingsId = useId();

  const [supported] = useState(canRenderWebGL2);
  const [canFullscreen] = useState(fullscreenSupported);
  const [attempt, setAttempt] = useState(0);
  const [failure, setFailure] = useState(null);
  const [ready, setReady] = useState(false);
  const [worldKey, setWorldKey] = useState(INITIAL_WORLD_KEY);
  const [lodScale, setLodScale] = useState(() => findStreamingWorld(INITIAL_WORLD_KEY).lodSplatScale ?? 1.5);
  const [focused, setFocused] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [streaming, setStreaming] = useState(true);

  const activeWorld = findStreamingWorld(worldKey);
  const status = !supported ? "unsupported" : failure ? "failed" : ready ? "ready" : "loading";
  const failureCopy = !supported ? FAILURE_COPY.webgl : failure ? FAILURE_COPY[failure] : null;

  const focusFrame = useCallback(() => {
    frameRef.current?.focus({ preventScroll: true });
    setFocused(true);
  }, []);

  useEffect(() => {
    const frame = frameRef.current;
    const onChange = () => setFullscreen(fullscreenElement() === frame && frame !== null);
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
      if (frame && fullscreenElement() === frame) exitFullscreen().catch(() => {});
    };
  }, []);

  useEffect(() => {
    const onBlur = () => setFocused(false);
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, []);

  const handleSelectWorld = (nextKey) => {
    const cfg = findStreamingWorld(nextKey);
    setWorldKey(cfg.key);
    setLodScale(cfg.lodSplatScale ?? 1.0);
    setStreaming(true);
    focusFrame();
  };

  const handleKeyDown = (event) => {
    if (event.key === "Escape") {
      if (settingsOpen) {
        setSettingsOpen(false);
        return;
      }
      setFocused(false);
      frameRef.current?.blur();
    }
  };

  const handlePointerDown = (event) => {
    if (isControl(event.target)) return;
    setSettingsOpen(false);
    setFocused(true);
  };

  const toggleFullscreen = async () => {
    const frame = frameRef.current;
    if (!frame) return;
    try {
      if (fullscreenElement() === frame) await exitFullscreen();
      else await enterFullscreen(frame);
    } catch {
      // Ignore user gesture rejection
    }
  };

  const retry = () => {
    if (failureCopy?.retry === "reload") {
      window.location.reload();
      return;
    }
    setFailure(null);
    setReady(false);
    setStreaming(true);
    setAttempt((n) => n + 1);
  };

  const handleReady = useCallback(() => {
    setReady(true);
  }, []);

  const handleWorldLoaded = useCallback(() => {
    setStreaming(false);
  }, []);

  const handleError = useCallback((kind) => {
    setFailure(kind || "asset");
  }, []);

  const handleDeviceLost = useCallback(() => {
    setFailure("lost");
  }, []);

  return (
    <div className={styles.viewport}>
      <div
        ref={frameRef}
        className={styles.frame}
        tabIndex={0}
        role="application"
        aria-label={`${title} 3D 스트리밍 뷰어`}
        aria-describedby={hintId}
        data-focused={focused ? "true" : undefined}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onFocus={() => setFocused(true)}
        onBlur={(event) => {
          if (!frameRef.current?.contains(event.relatedTarget)) {
            setFocused(false);
          }
        }}
      >
        {supported && !failure && Scene && (
          <SceneBoundary key={attempt} onFailure={handleError}>
            <Suspense fallback={null}>
              <Scene
                className={styles.canvas}
                worldKey={worldKey}
                lodScale={lodScale}
                focused={focused}
                apiRef={apiRef}
                onReady={handleReady}
                onWorldLoaded={handleWorldLoaded}
                onError={handleError}
                onDeviceLost={handleDeviceLost}
              />
            </Suspense>
          </SceneBoundary>
        )}

        <div className={styles.poster} data-hidden={status === "ready" ? "true" : undefined}>
          {poster && <img className={styles.posterImage} src={poster} alt="" decoding="async" />}
          {status === "loading" && (
            <div className={styles.loadingPanel} role="status">
              <div className={styles.loadingRow}>
                <span>SparkJS 2.0 스트리밍 LOD 불러오는 중…</span>
                <span className={styles.loadingPercent}>{activeWorld.badge}</span>
              </div>
              <div className={styles.progressTrack}>
                <div className={styles.progressFill} style={{ width: "100%", opacity: 0.7 }} />
              </div>
              <span className={styles.loadingBytes}>{activeWorld.description}</span>
            </div>
          )}
        </div>

        {failureCopy && (
          <div className={styles.failure} role="alert" data-ui>
            {poster && <img className={styles.posterImage} src={poster} alt="" decoding="async" />}
            <div className={styles.failurePanel}>
              <p className={styles.failureTitle}>{failureCopy.title}</p>
              <p className={styles.failureText}>{failureCopy.text}</p>
              {failureCopy.retry && (
                <button type="button" className={styles.primaryButton} onClick={retry}>
                  {failureCopy.retry === "reload" ? "페이지 새로고침" : "다시 시도"}
                </button>
              )}
            </div>
          </div>
        )}

        {status === "ready" && (
          <div className={styles.topBar} data-ui>
            <div className={lodStyles.worldTabs} role="tablist" aria-label="스트리밍 월드 선택">
              {STREAMING_LOD_WORLDS.map((w) => (
                <button
                  key={w.key}
                  type="button"
                  role="tab"
                  aria-selected={w.key === worldKey}
                  className={`${styles.toolButton} ${lodStyles.worldTab}`}
                  data-active={w.key === worldKey ? "true" : undefined}
                  onClick={() => handleSelectWorld(w.key)}
                >
                  <span>{w.label}</span>
                  <span className={lodStyles.worldBadge}>{w.badge}</span>
                </button>
              ))}
            </div>

            <div className={styles.toolbar}>
              <button
                type="button"
                className={styles.toolButton}
                onClick={() => {
                  apiRef.current?.reset();
                  focusFrame();
                }}
              >
                처음 위치로
              </button>
              <button
                type="button"
                className={styles.toolButton}
                aria-expanded={settingsOpen}
                aria-controls={settingsId}
                onClick={() => setSettingsOpen((open) => !open)}
              >
                LOD 설정
              </button>
              {canFullscreen && (
                <button type="button" className={styles.toolButton} aria-pressed={fullscreen} onClick={toggleFullscreen}>
                  {fullscreen ? "전체 화면 종료" : "전체 화면"}
                </button>
              )}
            </div>
          </div>
        )}

        {status === "ready" && settingsOpen && (
          <div id={settingsId} className={styles.settings} data-ui>
            <label className={styles.rangeRow}>
              <span>LOD 디테일</span>
              <input
                type="range"
                min={0.1}
                max={2.5}
                step={0.05}
                value={lodScale}
                onChange={(event) => setLodScale(Number(event.target.value))}
              />
              <span className={styles.rangeValue}>{lodScale.toFixed(2)}×</span>
            </label>
            <p className={styles.settingsNote}>
              값이 높을수록 더 많은 스플랫을 고해상도로 렌더링합니다. 프레임이 느리면 0.5~1.0으로 낮춰 보세요.
            </p>
          </div>
        )}

        {status === "ready" && (
          <div className={lodStyles.worldCaption} data-ui>
            <strong className={lodStyles.worldTitle}>
              {activeWorld.label}
              {streaming && <span className={lodStyles.streamingDot}> · 스트리밍 중</span>}
            </strong>
            <span className={lodStyles.worldDesc}>{activeWorld.description}</span>
          </div>
        )}

        {status === "ready" && !focused && (
          <p className={styles.focusHint}>화면을 클릭하면 키보드(WASD) 이동을 시작합니다</p>
        )}

        {status !== "failed" && status !== "unsupported" && (
          <p id={hintId} className={styles.controlsHint}>
            W A S D·방향키 이동 · E/Q 상하 이동 · Shift 빠르게 · 마우스 드래그 시점 회전 · 우클릭 드래그 평행 이동 · 휠 전후 이동 · Esc 조작 해제
          </p>
        )}
      </div>
    </div>
  );
}
