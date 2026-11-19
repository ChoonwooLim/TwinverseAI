/**
 * Interactive 3DGS Restaurant scene (Mesh table + spotlight shadow + 11 switchable 3DGS food scans).
 * Lazy-loaded via src/spaces/registry.js; shares the SparkJS vendor chunk with spark-streaming-lod.
 */
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { SparkRenderer, SplatMesh, isMobile } from "../spark-streaming-lod/vendor/spark.module.min.js";
import { FOOD_ITEMS, TABLE_MODEL_URL } from "./foods";

function easeInOutSine(x) {
  return -(Math.cos(Math.PI * x) - 1) / 2;
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

  // Boot Three.js + SparkRenderer + OrbitControls + GLB table once per mount
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
    const camera = new THREE.PerspectiveCamera(65, width / height, 0.1, 1000);
    camera.position.set(0, 0.9, -1.2);

    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
      renderer.shadowMap.enabled = true;
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
    controls.target.set(0.12, 0, 0);
    controls.minDistance = 0.75;
    controls.maxDistance = 2.4;
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.update();

    // Lighting
    const spotLight = new THREE.SpotLight(0xffcc88);
    spotLight.position.set(0, 1, 0);
    spotLight.castShadow = true;
    spotLight.shadow.mapSize.width = 1024;
    spotLight.shadow.mapSize.height = 1024;
    spotLight.shadow.camera.near = 0.1;
    spotLight.shadow.camera.far = 5;
    spotLight.angle = 0.9;
    spotLight.penumbra = 1;
    spotLight.intensity = 3;
    scene.add(spotLight);

    const fillLight = new THREE.PointLight(0xffcc88, 0.25);
    fillLight.position.set(0, 0, -3);
    scene.add(fillLight);

    // Shadow caster disc for splat dishes
    const shadowGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.04, 40, 1);
    const shadowMat = new THREE.MeshPhongMaterial({ colorWrite: false, depthWrite: false });
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.visible = false;
    shadow.castShadow = true;
    shadow.position.set(0, 0.1, 0);
    scene.add(shadow);

    // Floor plane
    const floorGeo = new THREE.PlaneGeometry(10, 10);
    const floorMat = new THREE.MeshPhongMaterial({ color: 0x777777 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -1.397, 0);
    scene.add(floor);

    const transitionLength = isMobile() ? 24 : 45;
    const state = {
      scene,
      camera,
      renderer,
      spark,
      controls,
      table: null,
      shadow,
      shadowNextScale: 1,
      splatCache: new Map(),
      currentFood: null,
      nextFood: null,
      fadeOutTime: null,
      fadeInTime: null,
      rotationAngle: 0,
      lastTime: 0,
      pendingIndex: null,
      readyTable: false,
      requestSeq: 0,
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

            if (!state.currentFood) {
              splat.opacity = 1;
              state.currentFood = splat;
              state.nextFood = null;
              state.fadeOutTime = null;
              state.fadeInTime = null;
              if (item.shadowSize > 0) {
                shadow.visible = true;
                shadow.scale.setScalar(item.shadowSize);
              } else {
                shadow.visible = false;
              }
              return;
            }

            if (state.currentFood === splat) {
              splat.opacity = 1;
              state.fadeOutTime = null;
              state.fadeInTime = null;
              return;
            }

            state.nextFood = splat;
            state.shadowNextScale = item.shadowSize;
            shadow.visible = false;
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
        camera.position.set(0, 0.9, -1.2);
        controls.target.set(0.12, 0, 0);
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

    // Load restaurant table GLB, then show initial dish
    const gltfLoader = new GLTFLoader();
    gltfLoader
      .loadAsync(TABLE_MODEL_URL)
      .then((gltf) => {
        if (disposed) return;
        state.table = gltf.scene;
        const tableCloth = state.table.children.find((item) => item.name === "cover");
        if (tableCloth) tableCloth.receiveShadow = true;
        scene.add(state.table);
        state.readyTable = true;

        const initialIdx = state.pendingIndex ?? 0;
        state.switchTo(initialIdx);
        callbacksRef.current.onReady?.({ backend: "webgl" });
      })
      .catch((err) => {
        if (!disposed) callbacksRef.current.onError?.("asset", err);
      });

    renderer.setAnimationLoop((time) => {
      if (disposed) return;
      const dt = state.lastTime ? Math.min((time - state.lastTime) / 1000, 0.1) : 0;
      state.lastTime = time;

      if (autoRotateRef.current) {
        state.rotationAngle += dt * 0.1;
      }

      if (state.table) state.table.rotation.y = state.rotationAngle;
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
          if (state.shadowNextScale > 0) {
            shadow.visible = true;
            shadow.scale.setScalar(state.shadowNextScale);
          } else {
            shadow.visible = false;
          }
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
      shadowGeo.dispose();
      shadowMat.dispose();
      floorGeo.dispose();
      floorMat.dispose();
      scene.remove(spark);
      spark.dispose?.();
      renderer.dispose();
    };
  }, [apiRef]);

  // Switch active dish when user picks another item from menu
  useEffect(() => {
    const rt = runtimeRef.current;
    if (!rt) return;
    rt.pendingIndex = foodIndex;
    if (rt.readyTable) {
      rt.switchTo(foodIndex);
    }
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
