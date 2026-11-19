/**
 * SparkJS 2.0 Streaming LoD 3D Gaussian Splatting scene.
 * Lazy-loaded via src/spaces/registry.js so three.js and SparkJS stay out of the main bundle.
 */
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { SparkRenderer, SplatMesh, SparkControls, isMobile } from "./vendor/spark.module.min.js";
import { findStreamingWorld, INITIAL_WORLD_KEY } from "./worlds";

export default function SparkStreamingLodScene({
  className,
  style,
  worldKey = INITIAL_WORLD_KEY,
  lodScale,
  focused = false,
  apiRef,
  onReady,
  onWorldLoaded,
  onError,
  onDeviceLost,
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const runtimeRef = useRef(null);
  const lodScaleRef = useRef(lodScale);
  const callbacksRef = useRef({ onReady, onWorldLoaded, onError, onDeviceLost });

  useEffect(() => {
    lodScaleRef.current = lodScale;
  }, [lodScale]);

  useEffect(() => {
    callbacksRef.current = { onReady, onWorldLoaded, onError, onDeviceLost };
  }, [onReady, onWorldLoaded, onError, onDeviceLost]);

  // Boot Three.js + SparkRenderer + SparkControls once per mount
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return undefined;

    let renderer;
    let spark;
    let controls;
    let resizeObserver;
    let disposed = false;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#050810");

    const width = Math.max(1, container.clientWidth || window.innerWidth);
    const height = Math.max(1, container.clientHeight || window.innerHeight);
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.01, 1000);

    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
      renderer.setSize(width, height, false);
    } catch (err) {
      callbacksRef.current.onError?.("webgl", err);
      return undefined;
    }

    const handleContextLost = (event) => {
      event.preventDefault();
      callbacksRef.current.onDeviceLost?.({ reason: "webglcontextlost" });
    };
    canvas.addEventListener("webglcontextlost", handleContextLost, false);

    try {
      spark = new SparkRenderer({
        renderer,
        pagedExtSplats: true,
        coneFov0: 70.0,
        coneFov: 120.0,
        behindFoveate: 0.2,
        coneFoveate: 0.4,
      });
      scene.add(spark);
      controls = new SparkControls({ canvas });
      controls.fpsMovement.enable = false;
    } catch (err) {
      renderer.dispose();
      canvas.removeEventListener("webglcontextlost", handleContextLost, false);
      callbacksRef.current.onError?.("webgl", err);
      return undefined;
    }

    const state = {
      scene,
      camera,
      renderer,
      spark,
      controls,
      world: null,
      worldConfig: null,
      resize: () => {
        if (disposed || !container) return;
        const w = Math.max(1, container.clientWidth);
        const h = Math.max(1, container.clientHeight);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
      },
      resetCamera: () => {
        const cfg = state.worldConfig;
        if (!cfg) return;
        camera.position.set(...(cfg.cameraPosition ?? [0, 0, 0]));
        camera.quaternion.set(...(cfg.cameraQuaternion ?? [0, 0, 0, 1])).normalize();
      },
    };
    runtimeRef.current = state;

    if (apiRef) {
      apiRef.current = {
        reset: () => state.resetCamera(),
        focusCanvas: () => canvas.focus({ preventScroll: true }),
      };
    }

    resizeObserver = new ResizeObserver(() => state.resize());
    resizeObserver.observe(container);

    let notifiedReady = false;
    renderer.setAnimationLoop(() => {
      if (disposed) return;
      controls.update(camera);
      renderer.render(scene, camera);
      if (!notifiedReady) {
        notifiedReady = true;
        callbacksRef.current.onReady?.({ backend: "webgl" });
      }
    });

    return () => {
      disposed = true;
      runtimeRef.current = null;
      if (apiRef) apiRef.current = null;
      resizeObserver?.disconnect();
      canvas.removeEventListener("webglcontextlost", handleContextLost, false);
      if (controls?.fpsMovement) {
        controls.fpsMovement.enable = false;
        controls.fpsMovement.keydown = {};
        controls.fpsMovement.keycode = {};
      }
      renderer.setAnimationLoop(null);
      if (state.world) {
        scene.remove(state.world);
        state.world.dispose?.();
        state.world = null;
      }
      scene.remove(spark);
      spark.dispose?.();
      renderer.dispose();
    };
  }, [apiRef]);

  // Gate keyboard movement on viewport focus so WASD never hijacks page inputs
  useEffect(() => {
    const rt = runtimeRef.current;
    if (!rt?.controls?.fpsMovement) return;
    rt.controls.fpsMovement.enable = Boolean(focused);
    if (!focused) {
      rt.controls.fpsMovement.keydown = {};
      rt.controls.fpsMovement.keycode = {};
    }
  }, [focused]);

  // Load or switch the active Streaming LoD world
  useEffect(() => {
    const rt = runtimeRef.current;
    if (!rt) return undefined;

    let cancelled = false;
    const cfg = findStreamingWorld(worldKey);
    rt.worldConfig = cfg;

    if (rt.world) {
      rt.scene.remove(rt.world);
      rt.world.dispose?.();
      rt.world = null;
    }

    try {
      const nextWorld = new SplatMesh({ url: cfg.url, paged: true });
      nextWorld.quaternion.set(...(cfg.quaternion ?? [0, 0, 0, 1])).normalize();
      nextWorld.position.set(...(cfg.position ?? [0, 0, 0]));
      nextWorld.scale.setScalar(cfg.scale ?? 1.0);
      rt.scene.add(nextWorld);
      rt.world = nextWorld;
      rt.scene.background = new THREE.Color(cfg.background ?? "#000000");

      rt.resetCamera();
      const targetScale = typeof lodScaleRef.current === "number" ? lodScaleRef.current : (cfg.lodSplatScale ?? 1.0);
      rt.spark.lodSplatScale = targetScale;

      const useHighDpi = cfg.highDpiOnDesktop && !isMobile();
      rt.renderer.setPixelRatio(useHighDpi ? Math.min(window.devicePixelRatio || 1, 2) : 1);
      rt.resize();

      Promise.resolve(nextWorld.initialized)
        .then(() => {
          if (!cancelled) callbacksRef.current.onWorldLoaded?.(cfg);
        })
        .catch((err) => {
          if (!cancelled) callbacksRef.current.onError?.("asset", err);
        });
    } catch (err) {
      callbacksRef.current.onError?.("asset", err);
    }

    return () => {
      cancelled = true;
    };
  }, [worldKey]);

  // Live LOD detail slider updates without reloading the world
  useEffect(() => {
    const rt = runtimeRef.current;
    if (!rt?.spark || typeof lodScale !== "number") return;
    rt.spark.lodSplatScale = lodScale;
  }, [lodScale]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: "100%", height: "100%", position: "relative", ...style }}
    >
      <canvas
        ref={canvasRef}
        tabIndex={0}
        style={{ display: "block", width: "100%", height: "100%", outline: "none", touchAction: "none" }}
      />
    </div>
  );
}
