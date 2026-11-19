/**
 * Viewport frame for the Interactive 3DGS Restaurant scene (Tipatat's Splat Restaurant).
 * Reuses TwinverseAI's SpaceViewport dark-glass styling + a collapsible chef-specials menu panel.
 */
import { Component, Suspense, useCallback, useEffect, useId, useRef, useState } from "react";
import { SPACE_SCENES, isSceneChunkError } from "../registry";
import styles from "../SpaceViewport.module.css";
import menuStyles from "./SparkInteractivityViewport.module.css";
import { FOOD_ITEMS } from "./foods";

const FAILURE_COPY = {
  webgl: {
    title: "이 브라우저에서는 3D 가우시안 스플랫팅을 표시할 수 없습니다.",
    text: "WebGL 2를 지원하는 최신 Chrome, Edge, Safari, Firefox에서 열어 주세요.",
    retry: false,
  },
  asset: {
    title: "3D 레스토랑 에셋을 불러오지 못했습니다.",
    text: "네트워크 연결을 확인한 뒤 페이지를 새로고침해 주세요.",
    retry: "reload",
  },
  chunk: {
    title: "3D 렌더러 모듈을 불러오지 못했습니다.",
    text: "새 버전이 배포되었거나 연결이 잠시 끊겼을 수 있습니다. 새로고침해 주세요.",
    retry: "reload",
  },
  lost: {
    title: "그래픽 장치와의 연결이 끊어졌습니다.",
    text: "다시 시도하면 3D 공간을 새로 불러옵니다.",
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

class SceneBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    const kind = isSceneChunkError(error) ? "chunk" : /webgl/i.test(String(error?.message)) ? "webgl" : "asset";
    console.error("[spaces/spark-interactivity] Scene failed:", error);
    this.props.onFailure(kind);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export default function SparkInteractivityViewport({ sceneKey, title, poster }) {
  const Scene = SPACE_SCENES[sceneKey];
  const frameRef = useRef(null);
  const apiRef = useRef(null);
  const hintId = useId();

  const [supported] = useState(canRenderWebGL2);
  const [canFullscreen] = useState(fullscreenSupported);
  const [attempt, setAttempt] = useState(0);
  const [failure, setFailure] = useState(null);
  const [ready, setReady] = useState(false);
  const [foodIndex, setFoodIndex] = useState(0);
  const [dishLoading, setDishLoading] = useState(true);
  const [autoRotate, setAutoRotate] = useState(true);
  const [menuOpen, setMenuOpen] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);

  const activeFood = FOOD_ITEMS[foodIndex] ?? FOOD_ITEMS[0];
  const status = !supported ? "unsupported" : failure ? "failed" : ready ? "ready" : "loading";
  const failureCopy = !supported ? FAILURE_COPY.webgl : failure ? FAILURE_COPY[failure] : null;

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
    setDishLoading(true);
    setAttempt((n) => n + 1);
  };

  const handleReady = useCallback(() => setReady(true), []);
  const handleDishLoading = useCallback((flag) => setDishLoading(Boolean(flag)), []);
  const handleError = useCallback((kind) => setFailure(kind || "asset"), []);
  const handleDeviceLost = useCallback(() => setFailure("lost"), []);

  return (
    <div className={styles.viewport}>
      <div
        ref={frameRef}
        className={styles.frame}
        tabIndex={0}
        role="application"
        aria-label={`${title} 인터랙티브 3D 뷰어`}
        aria-describedby={hintId}
      >
        {supported && !failure && Scene && (
          <SceneBoundary key={attempt} onFailure={handleError}>
            <Suspense fallback={null}>
              <Scene
                className={styles.canvas}
                foodIndex={foodIndex}
                autoRotate={autoRotate}
                apiRef={apiRef}
                onReady={handleReady}
                onDishLoading={handleDishLoading}
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
                <span>3DGS 파인다이닝 테이블 불러오는 중…</span>
                <span className={styles.loadingPercent}>11종 요리</span>
              </div>
              <div className={styles.progressTrack}>
                <div className={styles.progressFill} style={{ width: "100%", opacity: 0.7 }} />
              </div>
              <span className={styles.loadingBytes}>다크 자카드 테이블보 + 3D 가우시안 스플랫 요리 융합 렌더링</span>
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
            <span className={styles.badge}>
              WebGL 2 · Mesh + 3DGS
              {dishLoading && <span className={menuStyles.loadingTag}> · 요리 불러오는 중</span>}
            </span>
            <div className={styles.toolbar}>
              <button
                type="button"
                className={styles.toolButton}
                aria-pressed={menuOpen}
                onClick={() => setMenuOpen((open) => !open)}
              >
                {menuOpen ? "메뉴 숨김" : "메뉴 열기"}
              </button>
              <button
                type="button"
                className={styles.toolButton}
                aria-pressed={autoRotate}
                onClick={() => setAutoRotate((v) => !v)}
              >
                {autoRotate ? "회전 일시정지" : "회전 재생"}
              </button>
              <button
                type="button"
                className={styles.toolButton}
                onClick={() => apiRef.current?.reset()}
              >
                처음 시점으로
              </button>
              {canFullscreen && (
                <button type="button" className={styles.toolButton} aria-pressed={fullscreen} onClick={toggleFullscreen}>
                  {fullscreen ? "전체 화면 종료" : "전체 화면"}
                </button>
              )}
            </div>
          </div>
        )}

        {status === "ready" && menuOpen && (
          <aside className={menuStyles.menuPanel} aria-label="셰프 스페셜 3DGS 메뉴" data-ui>
            <div className={menuStyles.menuHeader}>
              <span className={menuStyles.menuOverline}>CHEF SPECIALS · 3DGS</span>
              <strong className={menuStyles.menuTitle}>스플랫 레스토랑 메뉴</strong>
            </div>
            <ul className={menuStyles.menuList} role="listbox" aria-label="요리 선택">
              {FOOD_ITEMS.map((item, index) => (
                <li key={item.key}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === foodIndex}
                    className={menuStyles.menuItem}
                    data-active={index === foodIndex ? "true" : undefined}
                    onClick={() => setFoodIndex(index)}
                  >
                    <span className={menuStyles.itemName}>{item.name}</span>
                    <span className={menuStyles.itemSub}>{item.enName}</span>
                  </button>
                </li>
              ))}
            </ul>
            <p className={menuStyles.menuCredit}>Food scans by Tipatat · SparkJS 2.0</p>
          </aside>
        )}

        {status === "ready" && (
          <div className={menuStyles.dishCaption} data-ui>
            <strong className={menuStyles.dishName}>{activeFood.name}</strong>
            <span className={menuStyles.dishEn}>{activeFood.enName} · 3D Gaussian Splat (.spz)</span>
          </div>
        )}

        {status !== "failed" && status !== "unsupported" && (
          <p id={hintId} className={styles.controlsHint}>
            마우스 드래그 시점 회전 · 마우스 휠 확대·축소 · 우측 메뉴 클릭으로 11종 3DGS 요리 즉시 전환
          </p>
        )}
      </div>
    </div>
  );
}
