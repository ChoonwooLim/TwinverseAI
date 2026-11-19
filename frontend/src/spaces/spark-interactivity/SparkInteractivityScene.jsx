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

/**
 * Generates seamless woven linen albedo + bump maps for a fine-dining tablecloth look.
 */
function createLuxuryLinenMaterial(maxAnisotropy = 4) {
  const size = 512;
  const colorCanvas = document.createElement("canvas");
  colorCanvas.width = size;
  colorCanvas.height = size;
  const cctx = colorCanvas.getContext("2d");

  const bumpCanvas = document.createElement("canvas");
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bctx = bumpCanvas.getContext("2d");

  // Warm alabaster ivory linen base
  cctx.fillStyle = "#ece7de";
  cctx.fillRect(0, 0, size, size);

  bctx.fillStyle = "#808080";
  bctx.fillRect(0, 0, size, size);

  // Deterministic pseudo-random helper for organic slub threads
  let seed = 1337;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  // Fine warp (vertical) and weft (horizontal) linen threads
  const step = 4;
  for (let x = 0; x < size; x += step) {
    const shade = Math.floor((rand() - 0.5) * 10);
    const v = 232 + shade;
    cctx.fillStyle = `rgba(${v}, ${v - 4}, ${v - 11}, 0.42)`;
    cctx.fillRect(x, 0, 2, size);

    const bv = 138 + Math.floor((rand() - 0.5) * 28);
    bctx.fillStyle = `rgba(${bv}, ${bv}, ${bv}, 0.55)`;
    bctx.fillRect(x, 0, 2, size);
  }

  for (let y = 0; y < size; y += step) {
    const shade = Math.floor((rand() - 0.5) * 10);
    const v = 236 + shade;
    cctx.fillStyle = `rgba(${v}, ${v - 4}, ${v - 10}, 0.38)`;
    cctx.fillRect(0, y, size, 2);

    const bv = 148 + Math.floor((rand() - 0.5) * 28);
    bctx.fillStyle = `rgba(${bv}, ${bv}, ${bv}, 0.5)`;
    bctx.fillRect(0, y, size, 2);
  }

  // Subtle cross-weave intersection highlights + gentle slub fibers
  for (let y = 0; y < size; y += step * 2) {
    for (let x = 0; x < size; x += step * 2) {
      const alt = ((x + y) / (step * 2)) % 2 === 0;
      bctx.fillStyle = alt ? "rgba(185, 185, 185, 0.35)" : "rgba(95, 95, 95, 0.25)";
      bctx.fillRect(x, y, 2, 2);
    }
  }

  const map = new THREE.CanvasTexture(colorCanvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(16, 16);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = Math.min(maxAnisotropy, 8);

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(16, 16);
  bumpMap.anisotropy = Math.min(maxAnisotropy, 8);

  const material = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#f0ebe2"),
    map,
    bumpMap,
    bumpScale: 0.012,
    roughness: 0.9,
    metalness: 0.0,
    sheen: 0.65,
    sheenRoughness: 0.68,
    sheenColor: new THREE.Color("#fffcf5"),
  });

  return {
    material,
    dispose() {
      map.dispose();
      bumpMap.dispose();
      material.dispose();
    },
  };
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
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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

    // Fine-dining warm neutral lighting
    const hemiLight = new THREE.HemisphereLight(0xfffaf2, 0x1e2436, 0.55);
    scene.add(hemiLight);

    const spotLight = new THREE.SpotLight(0xfff3e2);
    spotLight.position.set(0, 1.35, 0);
    spotLight.castShadow = true;
    spotLight.shadow.mapSize.width = 1024;
    spotLight.shadow.mapSize.height = 1024;
    spotLight.shadow.camera.near = 0.2;
    spotLight.shadow.camera.far = 5;
    spotLight.shadow.radius = 4;
    spotLight.shadow.bias = -0.0005;
    spotLight.angle = 0.95;
    spotLight.penumbra = 1;
    spotLight.intensity = 3.2;
    scene.add(spotLight);

    const fillLight = new THREE.PointLight(0xffe9cf, 0.45);
    fillLight.position.set(0.6, 0.4, -2.5);
    scene.add(fillLight);

    const linenFabric = createLuxuryLinenMaterial(renderer.capabilities.getMaxAnisotropy());

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
        state.table.traverse((node) => {
          if (!node.isMesh) return;
          const isCloth = node.name === "cover" || node.material?.name === "Fabric055";
          if (isCloth) {
            node.material = linenFabric.material;
            node.receiveShadow = true;
          }
        });
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
      linenFabric.dispose();
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
