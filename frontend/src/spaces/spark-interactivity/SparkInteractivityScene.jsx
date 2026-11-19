/**
 * Interactive 3DGS Restaurant scene — minimalist dark studio showcase with 11 switchable 3DGS food scans.
 * Lazy-loaded via src/spaces/registry.js; shares the SparkJS vendor chunk with spark-streaming-lod.
 */
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { SparkRenderer, SplatMesh, isMobile } from "../spark-streaming-lod/vendor/spark.module.min.js";
import { FOOD_ITEMS } from "./foods";

function easeInOutSine(x) {
  return -(Math.cos(Math.PI * x) - 1) / 2;
}

/**
 * Soft radial contact shadow texture placed beneath the dish on the dark studio surface.
 */
function createContactShadowTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const cx = size / 2;
  const grad = ctx.createRadialGradient(cx, cx, size * 0.08, cx, cx, cx);
  grad.addColorStop(0, "rgba(0, 0, 0, 0.72)");
  grad.addColorStop(0.55, "rgba(0, 0, 0, 0.35)");
  grad.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export default function SparkInteractivityScene({
  className,
  style,
  foodIndex = 0,
  autoRotate = true,
  apiRef,
  onReady,
  onDishLoading,
  onError,
  onDeviceLost,
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const runtimeRef = useRef(null);
  const autoRotateRef = useRef(autoRotate);
  const callbacksRef = useRef({ onReady, onDishLoading, onError, onDeviceLost });

  useEffect(() => {
    autoRotateRef.current = autoRotate;
  }, [autoRotate]);

  useEffect(() => {
    callbacksRef.current = { onReady, onDishLoading, onError, onDeviceLost };
  }, [onReady, onDishLoading, onError, onDeviceLost]);

  // Boot Three.js + SparkRenderer + OrbitControls + dark studio stage once per mount
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
    scene.background = new THREE.Color("#070911");
    scene.fog = new THREE.FogExp2(0x070911, 0.42);

    const width = Math.max(1, container.clientWidth || window.innerWidth);
    const height = Math.max(1, container.clientHeight || window.innerHeight);
    const camera = new THREE.PerspectiveCamera(58, width / height, 0.1, 100);
    camera.position.set(0, 0.72, -1.05);

    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
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
      spark = new SparkRenderer({ renderer });
      scene.add(spark);
    } catch (err) {
      renderer.dispose();
      canvas.removeEventListener("webglcontextlost", handleContextLost, false);
      callbacksRef.current.onError?.("webgl", err);
      return undefined;
    }

    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0.08, 0.02, 0);
    controls.minDistance = 0.65;
    controls.maxDistance = 2.2;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.update();

    // Subtle dark-studio surface lighting
    const spotLight = new THREE.SpotLight(0xdce6ff, 1.8);
    spotLight.position.set(0, 2.2, 0);
    spotLight.angle = 0.85;
    spotLight.penumbra = 1;
    scene.add(spotLight);

    const rimLight = new THREE.DirectionalLight(0x8aa4d6, 0.35);
    rimLight.position.set(-1.5, 1.2, 1.8);
    scene.add(rimLight);

    // Deep charcoal-obsidian studio plane (fades seamlessly into dark background fog)
    const stageGeo = new THREE.CircleGeometry(6, 64);
    const stageMat = new THREE.MeshStandardMaterial({
      color: 0x0e1220,
      roughness: 0.78,
      metalness: 0.12,
    });
    const stage = new THREE.Mesh(stageGeo, stageMat);
    stage.rotation.x = -Math.PI / 2;
    stage.position.set(0, -0.02, 0);
    scene.add(stage);

    // Soft contact shadow directly under the dish
    const shadowTex = createContactShadowTexture();
    const shadowGeo = new THREE.PlaneGeometry(0.9, 0.9);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
    });
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(0, -0.015, 0);
    shadow.visible = false;
    scene.add(shadow);

    const transitionLength = isMobile() ? 22 : 40;
    const state = {
      scene,
      camera,
      renderer,
      spark,
      controls,
      shadow,
      shadowNextScale: 1,
      splatCache: new Map(),
      currentFood: null,
      nextFood: null,
      fadeOutTime: null,
      fadeInTime: null,
      rotationAngle: 0,
      lastTime: 0,
      requestSeq: 0,
      notifiedReady: false,
      switchTo(index) {
        const item = FOOD_ITEMS[index] ?? FOOD_ITEMS[0];
        const seq = ++state.requestSeq;
        callbacksRef.current.onDishLoading?.(true);

        let splat = state.splatCache.get(item.key);
        if (!splat) {
          splat = new SplatMesh({ url: item.url });
          state.splatCache.set(item.key, splat);
        }

        splat.quaternion.set(1, 0, 0, 0);
        splat.position.set(0, item.offsetY ?? 0, 0);
        splat.scale.setScalar(item.scale);
        splat.rotation.y = -state.rotationAngle;

        if (state.currentFood && state.currentFood !== splat) {
          splat.opacity = 0;
        }
        if (splat.parent !== scene) {
          scene.add(splat);
        }

        Promise.resolve(splat.initialized)
          .then(() => {
            if (disposed || seq !== state.requestSeq) return;
            callbacksRef.current.onDishLoading?.(false);

            if (!state.notifiedReady) {
              state.notifiedReady = true;
              callbacksRef.current.onReady?.({ backend: "webgl" });
            }

            const targetShadow = item.shadowSize > 0 ? item.shadowSize : 0.72;
            if (!state.currentFood) {
              splat.opacity = 1;
              state.currentFood = splat;
              state.nextFood = null;
              state.fadeOutTime = null;
              state.fadeInTime = null;
              shadow.visible = true;
              shadow.scale.setScalar(targetShadow);
              return;
            }

            if (state.currentFood === splat) {
              splat.opacity = 1;
              state.fadeOutTime = null;
              state.fadeInTime = null;
              return;
            }

            state.nextFood = splat;
            state.shadowNextScale = targetShadow;
            state.fadeOutTime = 0;
            state.fadeInTime = null;
          })
          .catch((err) => {
            if (!disposed && seq === state.requestSeq) {
              callbacksRef.current.onDishLoading?.(false);
              callbacksRef.current.onError?.("asset", err);
            }
          });
      },
      resize() {
        if (disposed || !container) return;
        const w = Math.max(1, container.clientWidth);
        const h = Math.max(1, container.clientHeight);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
      },
      resetCamera() {
        camera.position.set(0, 0.72, -1.05);
        controls.target.set(0.08, 0.02, 0);
        controls.update();
      },
    };
    runtimeRef.current = state;

    if (apiRef) {
      apiRef.current = {
        reset: () => state.resetCamera(),
      };
    }

    resizeObserver = new ResizeObserver(() => state.resize());
    resizeObserver.observe(container);

    renderer.setAnimationLoop((time) => {
      if (disposed) return;
      const dt = state.lastTime ? Math.min((time - state.lastTime) / 1000, 0.1) : 0;
      state.lastTime = time;

      if (autoRotateRef.current) {
        state.rotationAngle += dt * 0.12;
      }

      if (state.currentFood) state.currentFood.rotation.y = -state.rotationAngle;
      if (state.nextFood) state.nextFood.rotation.y = -state.rotationAngle;

      // Smooth fade-out of previous dish
      if (state.fadeOutTime !== null) {
        state.fadeOutTime += 1;
        if (state.fadeOutTime < transitionLength) {
          if (state.currentFood) {
            state.currentFood.opacity = 1 - easeInOutSine(state.fadeOutTime / transitionLength);
          }
        } else {
          if (state.currentFood && state.currentFood !== state.nextFood) {
            state.currentFood.opacity = 0;
            scene.remove(state.currentFood);
          }
          state.fadeOutTime = null;
          state.fadeInTime = 0;
          shadow.visible = true;
          shadow.scale.setScalar(state.shadowNextScale);
        }
      }

      // Smooth fade-in of next dish
      if (state.fadeInTime !== null && state.nextFood) {
        state.fadeInTime += 1;
        if (state.fadeInTime < transitionLength) {
          state.nextFood.opacity = easeInOutSine(state.fadeInTime / transitionLength);
        } else {
          state.nextFood.opacity = 1;
          state.currentFood = state.nextFood;
          state.nextFood = null;
          state.fadeInTime = null;
        }
      }

      controls.update();
      renderer.render(scene, camera);
    });

    return () => {
      disposed = true;
      runtimeRef.current = null;
      if (apiRef) apiRef.current = null;
      resizeObserver?.disconnect();
      canvas.removeEventListener("webglcontextlost", handleContextLost, false);
      renderer.setAnimationLoop(null);
      controls.dispose();
      for (const splat of state.splatCache.values()) {
        scene.remove(splat);
        splat.dispose?.();
      }
      state.splatCache.clear();
      stageGeo.dispose();
      stageMat.dispose();
      shadowTex.dispose();
      shadowGeo.dispose();
      shadowMat.dispose();
      scene.remove(spark);
      spark.dispose?.();
      renderer.dispose();
    };
  }, [apiRef]);

  // Load initial dish and switch cleanly when foodIndex changes
  useEffect(() => {
    const rt = runtimeRef.current;
    if (!rt) return;
    rt.switchTo(foodIndex);
  }, [foodIndex]);

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
