/**
 * Viewport frame for an openable 3D space: focus and keyboard handling, loading poster with real
 * progress, fullscreen, reset, quality settings, performance panel, cinematic tour, photo mode and
 * the failure states. It does not import three.js; the scene component comes lazily from the
 * registry, so this frame can host any registered space.
 */
import { Component, Suspense, useCallback, useEffect, useId, useRef, useState } from "react";
import { SPACE_SCENES, isSceneChunkError } from "./registry";
import { isAvatarToggleKey, isEditableTarget, isFlightKey, isFlightToggleKey, isWalkKey, scrollsPage } from "./walkInput";
import { readStoredAvatarHidden, writeStoredAvatarHidden } from "./firstPerson";
import { readStoredAutoQuality, writeStoredAutoQuality } from "./frameGuard";
import { QUALITY_KEYS, QUALITY_LABELS, persistsQuality, readStoredQuality, stepDownNotice, writeStoredQuality } from "./qualityPresets";
import { useMediaQuery } from "./useMediaQuery";
import styles from "./SpaceViewport.module.css";

const FAILURE_COPY = {
  webgl: {
    title: "이 브라우저에서는 3D 화면을 표시할 수 없습니다.",
    text: "WebGPU 또는 WebGL 2를 지원하는 최신 Chrome, Edge, Safari, Firefox에서 열어 주세요. 브라우저 설정에서 하드웨어 가속이 꺼져 있다면 켜 주세요.",
    retry: false,
  },
  asset: {
    title: "3D 공간 데이터를 불러오지 못했습니다.",
    text: "네트워크 연결을 확인한 뒤 페이지를 새로고침해 주세요.",
    retry: "reload",
  },
  chunk: {
    title: "3D 화면 구성 요소를 불러오지 못했습니다.",
    text: "새 버전이 배포되었거나 연결이 잠시 끊겼을 수 있습니다. 새로고침하면 최신 버전을 다시 불러옵니다.",
    retry: "reload",
  },
  lost: {
    title: "그래픽 장치와의 연결이 끊어졌습니다.",
    text: "그래픽 드라이버가 재시작되었거나 메모리가 부족했을 수 있습니다. 다시 시도하면 3D 공간을 새로 불러옵니다.",
    retry: "remount",
  },
};

const BACKEND_LABELS = { webgpu: "WebGPU", webgl: "WebGL 2" };

/**
 * Review capture mode from the address: `?capture=1` shows the station panel, `&captureAll=1`
 * (only together with it) also saves every station once the space and its scenery have loaded.
 * It only adds a panel that saves PNG files the visitor asks for, so it is safe in production.
 */
function readCaptureFlags() {
  try {
    const params = new URLSearchParams(window.location.search);
    const enabled = params.get("capture") === "1";
    return { enabled, all: enabled && params.get("captureAll") === "1" };
  } catch {
    return { enabled: false, all: false };
  }
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}
const SUN_SOURCE_LABELS = { colliders: "에셋", hdr: "HDR 텍셀", default: "기본값" };

function canRender3D() {
  try {
    if (typeof navigator !== "undefined" && navigator.gpu) return true;
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2");
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

function safeStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
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

function formatCount(value) {
  if (!Number.isFinite(value)) return "-";
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return String(Math.round(value));
}

function formatMegabytes(bytes) {
  return (bytes / (1024 * 1024)).toFixed(1);
}

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

const isControl = (target) =>
  typeof target?.closest === "function" && Boolean(target.closest("button, a, input, select, label, [data-ui]"));

class SceneBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    const kind = isSceneChunkError(error) ? "chunk" : /webgl|webgpu/i.test(String(error?.message)) ? "webgl" : "asset";
    console.error("[spaces] Scene failed:", error);
    this.props.onFailure(kind);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export default function SpaceViewport({ sceneKey, title, poster }) {
  const Scene = SPACE_SCENES[sceneKey];
  const frameRef = useRef(null);
  const keysRef = useRef(new Set());
  const apiRef = useRef(null);
  const hintId = useId();
  const settingsId = useId();
  const [supported] = useState(canRender3D);
  const [canFullscreen] = useState(fullscreenSupported);
  const [attempt, setAttempt] = useState(0);
  const [failure, setFailure] = useState(null);
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState({ percent: 0, loaded: 0, total: 0 });
  const [focused, setFocused] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [backend, setBackend] = useState(null);
  const [activeQuality, setActiveQuality] = useState(null);
  const [chosenQuality, setChosenQuality] = useState(() => readStoredQuality(safeStorage()));
  const [exposure, setExposure] = useState(1);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [stats, setStats] = useState(null);
  const [touring, setTouring] = useState(false);
  const [flying, setFlying] = useState(false);
  const [avatarHidden, setAvatarHidden] = useState(() => readStoredAvatarHidden(safeStorage()));
  const [autoQuality, setAutoQuality] = useState(() => readStoredAutoQuality(safeStorage()));
  const [applyingQuality, setApplyingQuality] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [notice, setNotice] = useState(null);
  const [vegetation, setVegetation] = useState(null);
  const [scenery, setScenery] = useState(null);
  const [captureFlags] = useState(readCaptureFlags);
  const [captureIndex, setCaptureIndex] = useState(0);
  const [captureState, setCaptureState] = useState("idle");
  const [captureNote, setCaptureNote] = useState("");
  const [captureStationList, setCaptureStationList] = useState([]);
  const coarse = useMediaQuery("(pointer: coarse)");
  const anyFine = useMediaQuery("(any-pointer: fine)");
  const touchOnly = coarse && !anyFine;

  const status = !supported ? "unsupported" : failure ? "failed" : ready ? "ready" : "loading";
  const failureCopy = !supported ? FAILURE_COPY.webgl : failure ? FAILURE_COPY[failure] : null;

  const clearKeys = useCallback(() => keysRef.current.clear(), []);

  const focusFrame = useCallback(() => {
    frameRef.current?.focus({ preventScroll: true });
  }, []);

  // Keys never stick: clear them when the tab hides or the window loses focus, and on unmount.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") clearKeys();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", clearKeys);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", clearKeys);
      clearKeys();
    };
  }, [clearKeys]);

  // Fullscreen label follows the real state; leaving the page exits our fullscreen.
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

  // A notice raised behind the loading overlay stays until the space is shown, then 8 s.
  useEffect(() => {
    if (!notice || !ready) return undefined;
    const timer = window.setTimeout(() => setNotice(null), 8000);
    return () => window.clearTimeout(timer);
  }, [notice, ready]);

  const handleKeyDown = (event) => {
    const frame = frameRef.current;
    if (event.key === "Escape") {
      if (settingsOpen) {
        setSettingsOpen(false);
        focusFrame();
        return;
      }
      if (photo) {
        setPhoto(null);
        return;
      }
      if (event.target === frame) {
        clearKeys();
        frame.blur();
      }
      return;
    }
    if (event.target !== frame || event.isComposing || isEditableTarget(event.target)) return;
    const wasTouring = touring;
    if (touring) apiRef.current?.stopTour();
    if (event.metaKey) clearKeys(); // macOS drops keyup events while Cmd is held
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const tracked = isWalkKey(event.code) || isFlightKey(event.code);
    if (tracked && !photo) keysRef.current.add(event.code);
    if (isFlightToggleKey(event.code) && !event.repeat && !photo && !wasTouring) apiRef.current?.toggleFlight();
    if (isAvatarToggleKey(event.code) && !event.repeat) toggleAvatarHidden();
    if (tracked || scrollsPage(event.code)) event.preventDefault();
  };

  const handleKeyUp = (event) => {
    keysRef.current.delete(event.code);
  };

  const handleFocus = (event) => {
    if (event.target === frameRef.current) setFocused(true);
  };

  const handleBlur = (event) => {
    if (event.target === frameRef.current) {
      setFocused(false);
      clearKeys();
    }
  };

  const handlePointerDown = (event) => {
    if (isControl(event.target)) return;
    if (settingsOpen) setSettingsOpen(false);
    if (touring) apiRef.current?.stopTour();
    focusFrame();
  };

  const toggleFullscreen = async () => {
    const frame = frameRef.current;
    if (!frame) return;
    try {
      if (fullscreenElement() === frame) await exitFullscreen();
      else await enterFullscreen(frame);
    } catch {
      // Denied (e.g. not triggered by a user gesture): nothing to undo.
    }
    focusFrame();
  };

  const resetView = () => {
    apiRef.current?.reset();
    focusFrame();
  };

  const toggleAvatarHidden = () => {
    setAvatarHidden((hidden) => {
      writeStoredAvatarHidden(safeStorage(), !hidden);
      return !hidden;
    });
  };

  const toggleFlight = () => {
    if (touring) apiRef.current?.stopTour();
    apiRef.current?.toggleFlight();
    focusFrame();
  };

  const toggleTour = () => {
    if (touring) apiRef.current?.stopTour();
    else {
      setPhoto(null);
      apiRef.current?.startTour();
    }
    focusFrame();
  };

  const chooseQuality = (key) => {
    setChosenQuality(key);
    writeStoredQuality(safeStorage(), key);
    // Also re-applies a choice equal to the remembered one after an automatic step-down.
    apiRef.current?.setQuality(key);
  };

  const savePhoto = async () => {
    try {
      const blob = await apiRef.current?.capture();
      if (!blob) throw new Error("empty");
      downloadBlob(blob, `${title}-${timestamp()}.png`);
      setNotice("현재 화면을 PNG 파일로 저장했습니다.");
    } catch {
      setNotice("사진을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    }
  };

  // ── Review captures ──
  const captureStations = captureFlags.enabled ? captureStationList : [];
  // Scenery and vegetation have finished (either way), so every station shows its final content.
  const sceneryLoaded = Boolean(scenery && scenery.state !== "loading" && vegetation && vegetation.state !== "loading");

  const captureStationAt = useCallback(async (index) => {
    const stations = apiRef.current?.captureStations() ?? [];
    const station = stations[index];
    if (!station) return;
    const blob = await apiRef.current.captureStation(station);
    downloadBlob(blob, `${String(index + 1).padStart(2, "0")}-${station.id}-${activeQuality ?? "preset"}.png`);
  }, [activeQuality]);

  const captureOne = async () => {
    setCaptureState("working");
    try {
      await captureStationAt(captureIndex);
      setCaptureNote(`${captureIndex + 1}번 장면을 저장했습니다.`);
      setCaptureState("idle");
    } catch {
      setCaptureNote("장면을 저장하지 못했습니다.");
      setCaptureState("error");
    }
  };

  const captureAll = useCallback(async () => {
    const stations = apiRef.current?.captureStations() ?? [];
    setCaptureState("working");
    try {
      for (let index = 0; index < stations.length; index++) {
        setCaptureIndex(index);
        setCaptureNote(`${index + 1}/${stations.length} 저장 중`);
        await captureStationAt(index);
      }
      setCaptureNote(`${stations.length}개 장면을 모두 저장했습니다.`);
      setCaptureState("done");
    } catch {
      setCaptureNote("장면을 저장하지 못했습니다.");
      setCaptureState("error");
    }
  }, [captureStationAt]);

  const leaveCapture = () => {
    apiRef.current?.leaveCapture();
    setCaptureState("idle");
    setCaptureNote("");
  };

  // Unattended run: every station once, as soon as everything has loaded.
  useEffect(() => {
    if (!(captureFlags.all && status === "ready" && sceneryLoaded && captureState === "idle" && !applyingQuality)) return undefined;
    const timer = window.setTimeout(captureAll, 0);
    return () => window.clearTimeout(timer);
  }, [captureFlags.all, status, sceneryLoaded, captureState, applyingQuality, captureAll]);

  const handleReady = useCallback((info) => {
    if (captureFlags.enabled) setCaptureStationList(apiRef.current?.captureStations() ?? []);
    setReady(true);
    setBackend(info.backend);
    setActiveQuality(info.quality);
  }, [captureFlags.enabled]);

  // Automatic changes (slow frames, GPU errors) last for this visit and are always explained;
  // only a click on the quality control is remembered.
  const handleQualityChange = useCallback((key, reason) => {
    setActiveQuality(key);
    if (persistsQuality(reason)) return;
    const text = stepDownNotice(reason, QUALITY_LABELS[key]);
    if (text && reason !== "auto") setNotice(text);
  }, []);

  const handleFailure = useCallback((kind) => {
    setFailure(kind);
  }, []);

  const handleDeviceLost = useCallback(() => {
    setFailure("lost");
  }, []);

  const retry = () => {
    if (failureCopy?.retry === "reload") {
      window.location.reload();
      return;
    }
    setFailure(null);
    setReady(false);
    setProgress({ percent: 0, loaded: 0, total: 0 });
    setAttempt((value) => value + 1);
  };

  const sceneVisible = supported && Scene && failure !== "lost";
  const uiVisible = status === "ready" && !photo;

  return (
    <div className={styles.viewport}>
      <div
        ref={frameRef}
        className={styles.frame}
        data-focused={focused ? "true" : undefined}
        data-photo={photo ? "true" : undefined}
        tabIndex={0}
        role="application"
        aria-roledescription="3D 공간"
        aria-label={`${title} 3D 공간`}
        aria-describedby={hintId}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onPointerDownCapture={handlePointerDown}
      >
        {sceneVisible && (
          <SceneBoundary key={attempt} onFailure={handleFailure}>
            <Suspense fallback={null}>
              <Scene
                className={styles.canvas}
                interactive
                keysRef={keysRef}
                apiRef={apiRef}
                zoomEnabled={focused || touchOnly || Boolean(photo)}
                quality={chosenQuality}
                exposure={exposure}
                photoMode={photo}
                avatarHidden={avatarHidden}
                autoQuality={autoQuality}
                onQualityApplying={setApplyingQuality}
                showStats={showStats}
                onProgress={setProgress}
                onReady={handleReady}
                onQualityChange={handleQualityChange}
                onStats={setStats}
                onTourChange={setTouring}
                onFlightChange={setFlying}
                onNotice={setNotice}
                onScenery={setScenery}
                onVegetation={setVegetation}
                onError={handleFailure}
                onDeviceLost={handleDeviceLost}
              />
            </Suspense>
          </SceneBoundary>
        )}

        {/* Poster with real progress until the first frames are on screen. */}
        <div className={styles.poster} data-hidden={status === "ready" ? "true" : undefined} aria-hidden={status === "ready"}>
          {poster && <img className={styles.posterImage} src={poster} alt="" decoding="async" />}
          {status === "loading" && (
            <div className={styles.loadingPanel} data-ui>
              <div className={styles.loadingRow}>
                <span role="status">3D 공간을 불러오는 중{progress.label ? ` · ${progress.label}` : ""}</span>
                <span className={styles.loadingPercent}>{progress.percent}%</span>
              </div>
              <div
                className={styles.progressTrack}
                role="progressbar"
                aria-label="3D 공간 불러오기 진행률"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress.percent}
              >
                <div className={styles.progressFill} style={{ transform: `scaleX(${progress.percent / 100})` }} />
              </div>
              {progress.total > 0 && (
                <span className={styles.loadingBytes}>
                  {formatMegabytes(progress.loaded)} / {formatMegabytes(progress.total)} MB
                </span>
              )}
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

        {uiVisible && (
          <div className={styles.topBar} data-ui>
            <span className={styles.badge}>
              {BACKEND_LABELS[backend] ?? "-"}
              {activeQuality && <span className={styles.badgeMuted}> · 품질 {QUALITY_LABELS[activeQuality]}</span>}
            </span>
            <div className={styles.toolbar}>
              <button type="button" className={styles.toolButton} aria-pressed={touring} onClick={toggleTour}>
                {touring ? "투어 종료" : "시네마틱 투어"}
              </button>
              <button type="button" className={styles.toolButton} aria-pressed={flying} onClick={toggleFlight}>
                {flying ? "비행 중" : "비행"}
              </button>
              <button
                type="button"
                className={styles.toolButton}
                aria-pressed={avatarHidden}
                onClick={() => {
                  toggleAvatarHidden();
                  focusFrame();
                }}
              >
                {avatarHidden ? "아바타 표시" : "아바타 숨김"}
              </button>
              <button type="button" className={styles.toolButton} onClick={() => setPhoto({ focus: "building" })}>
                사진 모드
              </button>
              <button type="button" className={styles.toolButton} onClick={resetView}>
                처음 위치로
              </button>
              <button
                type="button"
                className={styles.toolButton}
                aria-expanded={settingsOpen}
                aria-controls={settingsId}
                onClick={() => setSettingsOpen((open) => !open)}
              >
                설정
              </button>
              {canFullscreen && (
                <button type="button" className={styles.toolButton} aria-pressed={fullscreen} onClick={toggleFullscreen}>
                  {fullscreen ? "전체 화면 종료" : "전체 화면"}
                </button>
              )}
            </div>
          </div>
        )}

        {uiVisible && settingsOpen && (
          <div id={settingsId} className={styles.settings} data-ui>
            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>품질</legend>
              <div className={styles.segmented}>
                {QUALITY_KEYS.map((key) => (
                  <label key={key} className={styles.segment} data-active={(activeQuality ?? chosenQuality) === key ? "true" : undefined}>
                    <input
                      type="radio"
                      name={`${settingsId}-quality`}
                      value={key}
                      checked={(activeQuality ?? chosenQuality) === key}
                      onChange={() => chooseQuality(key)}
                    />
                    {QUALITY_LABELS[key]}
                  </label>
                ))}
              </div>
              <p className={styles.settingsNote}>선택한 품질은 이 브라우저에 기억됩니다. '최대'는 고성능 그래픽 카드를 권장합니다.</p>
            </fieldset>
            <label className={styles.rangeRow}>
              <span>노출</span>
              <input
                type="range"
                min={0.4}
                max={2.5}
                step={0.05}
                value={exposure}
                onChange={(event) => setExposure(Number(event.target.value))}
              />
              <span className={styles.rangeValue}>{exposure.toFixed(2)}</span>
            </label>
            <label className={styles.checkRow}>
              <input
                type="checkbox"
                checked={autoQuality}
                onChange={(event) => {
                  setAutoQuality(event.target.checked);
                  writeStoredAutoQuality(safeStorage(), event.target.checked);
                }}
              />
              <span>느리면 자동으로 품질 낮추기</span>
            </label>
            <label className={styles.checkRow}>
              <input type="checkbox" checked={showStats} onChange={(event) => setShowStats(event.target.checked)} />
              <span>성능 표시</span>
            </label>
          </div>
        )}

        {uiVisible && showStats && stats && (
          <dl className={styles.stats} aria-label="성능 정보" data-ui>
            <div><dt>FPS 평균</dt><dd>{stats.fps.toFixed(0)}</dd></div>
            <div><dt>1% 저점</dt><dd>{stats.low1.toFixed(0)}</dd></div>
            <div><dt>프레임 시간</dt><dd>{stats.frameMs.toFixed(1)} ms</dd></div>
            <div><dt>드로우 콜</dt><dd>{formatCount(stats.drawCalls)}</dd></div>
            <div><dt>삼각형</dt><dd>{formatCount(stats.triangles)}</dd></div>
            <div><dt>텍스처</dt><dd>{formatCount(stats.textures)}</dd></div>
            <div><dt>백엔드</dt><dd>{BACKEND_LABELS[stats.backend] ?? "-"}</dd></div>
            <div className={styles.statsWide}>
              <dt>렌더 해상도</dt>
              <dd>{stats.width}×{stats.height} · 화면 {stats.cssWidth}×{stats.cssHeight} ({stats.pixelRatio.toFixed(2)}x)</dd>
            </div>
            <div><dt>품질</dt><dd>{QUALITY_LABELS[stats.quality]}</dd></div>
            {stats.flight && <div><dt>고도</dt><dd>{stats.flight.altitude.toFixed(1)} m (지면 위)</dd></div>}
            <div className={styles.statsWide}><dt>효과</dt><dd>{stats.features.join(", ") || "기본"}</dd></div>
            {stats.sun && (
              <div className={styles.statsWide}>
                <dt>태양</dt>
                <dd>
                  {SUN_SOURCE_LABELS[stats.sun.source] ?? stats.sun.source} · 방위 {stats.sun.azimuthDeg.toFixed(0)}° · 고도{" "}
                  {stats.sun.elevationDeg.toFixed(0)}° · 세기 {stats.sun.intensity.toFixed(2)} · 양지/그늘 ×{stats.sun.litToShade.toFixed(1)}
                </dd>
              </div>
            )}
            {stats.budget && stats.vegetation && (
              <div className={styles.statsWide}>
                <dt>식생 예산</dt>
                <dd>
                  {formatCount(stats.vegetation.triangles + stats.vegetation.shadowTriangles + stats.vegetation.reflectionTriangles)} / 예산{" "}
                  {formatCount(stats.budget.vegetation)} (식생 패스 전체) · 프레임 전체 {formatCount(stats.budget.total)}
                </dd>
              </div>
            )}
            {stats.staticPasses && (
              <div className={styles.statsWide}>
                <dt>건물·조형물 패스별</dt>
                <dd>
                  화면 {formatCount(stats.staticPasses.view.triangles)} ({stats.staticPasses.view.calls}회) · 그림자{" "}
                  {stats.staticPasses.cascades.map((c, i) => `C${i} ${formatCount(c.triangles)}(${c.calls})`).join(" ")} · 반사{" "}
                  {formatCount(stats.staticPasses.reflection.triangles)} ({stats.staticPasses.reflection.calls}회)
                  {stats.reflection
                    ? ` · 물 반사 ${stats.reflection.active ? "실행" : "중지"}${stats.reflection.distance ? ` (${stats.reflection.distance} m 이내, 화면 안일 때)` : ""}`
                    : ""}
                </dd>
              </div>
            )}
            {(stats.stalls?.length > 0 || stats.precompileMs != null) && (
              <div className={styles.statsWide}>
                <dt>정지</dt>
                <dd>
                  {stats.stalls?.length ? stats.stalls.map((stall) => `${(stall.ms / 1000).toFixed(1)} s (${stall.cause})`).join(", ") : "없음"}
                  {stats.precompileMs != null ? ` · 셰이더 준비 ${(stats.precompileMs / 1000).toFixed(1)} s` : ""}
                  {stats.pipelines
                    ? ` · 파이프라인 준비 ${Object.values(stats.pipelines.prepared).reduce((a, b) => a + b, 0)}개 · 첫 사용 화면 ${stats.pipelines.firstUse.scene} / 그림자 ${stats.pipelines.firstUse.shadow} / 반사 ${stats.pipelines.firstUse.reflection} (후처리 ${stats.pipelines.firstUse.post + stats.pipelines.prepared.post}, 기타 ${stats.pipelines.firstUse.other})`
                    : ""}
                </dd>
              </div>
            )}
            {stats.vegetation && (
              <div className={styles.statsWide}>
                <dt>식생</dt>
                <dd>
                  수종 {stats.vegetation.species} · {stats.vegetation.drawn.map((_, k) => `LOD${k}`).join("/")}{" "}
                  {stats.vegetation.drawn.join(" / ")} · 시야 밖 {formatCount(stats.vegetation.culled.frustum)} · 거리 밖{" "}
                  {formatCount(stats.vegetation.culled.distance)} · 거리 배율 {stats.vegetation.budgetScale.toFixed(2)}
                </dd>
              </div>
            )}
            {stats.vegetation && (
              <div className={styles.statsWide}>
                <dt>식생 패스별</dt>
                <dd>
                  화면 {formatCount(stats.vegetation.triangles)} ({stats.vegetation.drawCalls.view}회) · 그림자{" "}
                  {formatCount(stats.vegetation.shadowTriangles)} ({stats.vegetation.shadowCasters}그루,{" "}
                  {stats.vegetation.drawCalls.shadow}회) · 반사 {formatCount(stats.vegetation.reflectionTriangles)} (
                  {stats.vegetation.drawCalls.reflection}회)
                </dd>
              </div>
            )}
            {stats.cameraCollision && (
              <div className={styles.statsWide}>
                <dt>카메라 충돌</dt>
                <dd>
                  준비 {stats.cameraCollision.ready}/{stats.cameraCollision.total}
                  {stats.cameraCollision.building ? " · 구성 중" : ""} · 삼각형 {formatCount(stats.cameraCollision.triangles)} ·{" "}
                  {stats.cameraCollision.megabytes.toFixed(0)} MB · 구성 {(stats.cameraCollision.buildMs / 1000).toFixed(1)} s · 검사{" "}
                  {stats.cameraCollision.castMs.toFixed(2)} ms · 거리 {stats.cameraCollision.arm != null ? stats.cameraCollision.arm.toFixed(1) : "-"} /{" "}
                  {stats.cameraCollision.wanted != null ? stats.cameraCollision.wanted.toFixed(1) : "-"} m
                </dd>
              </div>
            )}
            {stats.shadow && (
              <div className={styles.statsWide}>
                <dt>그림자</dt>
                <dd>
                  캐스케이드 {stats.shadow.cascades}×{stats.shadow.mapSize} · {stats.shadow.maxFar} m · 드리움 {stats.shadow.casters} / 받음{" "}
                  {stats.shadow.receivers}
                </dd>
              </div>
            )}
          </dl>
        )}

        {status === "ready" && !focused && !touchOnly && !touring && !photo && (
          <p className={styles.focusHint}>화면을 클릭하면 조작을 시작합니다</p>
        )}

        {touring && (
          <p className={styles.tourChip} data-ui>시네마틱 투어 중 · 키를 누르거나 화면을 클릭하면 종료합니다</p>
        )}

        {applyingQuality && status === "ready" && (
          <p className={styles.vegetationChip} role="status">품질 적용 중…</p>
        )}

        {status === "ready" && photo && (
          <div className={styles.photoBar} data-ui>
            <span className={styles.photoLabel}>초점</span>
            <div className={styles.segmented}>
              {[
                ["building", "건물"],
                ["avatar", "아바타"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={styles.segmentButton}
                  aria-pressed={(avatarHidden ? "building" : photo.focus) === key}
                  disabled={avatarHidden && key === "avatar"}
                  title={avatarHidden && key === "avatar" ? "아바타를 숨긴 동안에는 건물에 초점을 맞춥니다" : undefined}
                  onClick={() => setPhoto({ focus: key })}
                >
                  {label}
                </button>
              ))}
            </div>
            <button type="button" className={styles.primaryButton} onClick={savePhoto}>PNG 저장</button>
            <button type="button" className={styles.toolButton} onClick={() => setPhoto(null)}>사진 모드 종료</button>
          </div>
        )}

        {captureFlags.enabled && status === "ready" && captureStations.length > 0 && (
          <div className={`${styles.photoBar} ${styles.captureBar}`} data-ui data-capture-state={captureState}>
            <label className={styles.photoLabel} htmlFor={`${settingsId}-capture`}>검토 장면</label>
            <select
              id={`${settingsId}-capture`}
              className={styles.captureSelect}
              value={captureIndex}
              disabled={captureState === "working"}
              onChange={(event) => setCaptureIndex(Number(event.target.value))}
            >
              {captureStations.map((station, index) => (
                <option key={station.id} value={index}>{`${index + 1}. ${station.label}`}</option>
              ))}
            </select>
            <button type="button" className={styles.primaryButton} disabled={captureState === "working"} onClick={captureOne}>이 장면 저장</button>
            <button type="button" className={styles.toolButton} disabled={captureState === "working"} onClick={captureAll}>모두 저장</button>
            <button type="button" className={styles.toolButton} disabled={captureState === "working"} onClick={leaveCapture}>캡처 종료</button>
            {captureNote && <span className={styles.photoLabel} role="status">{captureNote}</span>}
          </div>
        )}

        {scenery?.state === "loading" && status === "ready" && !photo && (
          <p className={styles.vegetationChip}>
            조형물 불러오는 중{scenery.count > 1 ? ` (${(scenery.index ?? 0) + 1}/${scenery.count})` : ""} {scenery.percent ?? 0}%
          </p>
        )}

        {vegetation?.state === "loading" && scenery?.state !== "loading" && status === "ready" && !photo && (
          <p className={styles.vegetationChip}>
            나무와 화단 불러오는 중{vegetation.count > 1 ? ` (${(vegetation.index ?? 0) + 1}/${vegetation.count})` : ""} {vegetation.percent ?? 0}%
          </p>
        )}

        {notice && (
          <p className={styles.notice} role="status">{notice}</p>
        )}

        {!photo && status !== "failed" && status !== "unsupported" && (
          <p id={hintId} className={styles.controlsHint}>
            {touchOnly
              ? "한 손가락으로 끌어 둘러보고 두 손가락으로 확대·축소합니다. 걷기는 현재 키보드에서만 할 수 있습니다."
              : "W A S D·방향키 이동 · Shift 달리기 · Space 점프 · F 비행 전환(비행 중 Space/E 상승 · Q/C 하강) · H 아바타 숨김 · 드래그 회전 · 휠 확대(화면 선택 후) · Esc 조작 해제"}
          </p>
        )}
      </div>
    </div>
  );
}
