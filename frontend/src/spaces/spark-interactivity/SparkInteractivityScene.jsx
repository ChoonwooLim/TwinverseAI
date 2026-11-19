/**
 * Interactive 3DGS Restaurant scene — GLB dining table dressed in a deep dark jacquard-woven
 * luxury tablecloth, spotlight shadows, and 11 switchable 3DGS food scans.
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
 * Generates seamless deep-charcoal jacquard/damask woven tablecloth PBR maps
 * (albedo + bump + roughness) so a subtle luxury pattern catches light as the table turns.
 */
function createDarkJacquardClothMaterial(maxAnisotropy = 4) {
  const size = 512;

  const colorCanvas = document.createElement("canvas");
  colorCanvas.width = size;
  colorCanvas.height = size;
  const cctx = colorCanvas.getContext("2d");

  const bumpCanvas = document.createElement("canvas");
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bctx = bumpCanvas.getContext("2d");

  const roughCanvas = document.createElement("canvas");
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rctx = roughCanvas.getContext("2d");

  // Deep midnight-charcoal woven fabric base
  cctx.fillStyle = "#171b24";
  cctx.fillRect(0, 0, size, size);

  bctx.fillStyle = "#767676";
  bctx.fillRect(0, 0, size, size);

  // Matte fabric base (~0.90 roughness -> 230/255)
  rctx.fillStyle = "#e6e6e6";
  rctx.fillRect(0, 0, size, size);

  // Deterministic pseudo-random helper for fine natural linen slub variation
  let seed = 4207;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  // Fine warp & weft weave grain
  const step = 4;
  for (let x = 0; x < size; x += step) {
    const delta = Math.floor((rand() - 0.5) * 6);
    cctx.fillStyle = `rgba(${29 + delta}, ${34 + delta}, ${46 + delta}, 0.48)`;
    cctx.fillRect(x, 0, 2, size);

    const bv = 132 + Math.floor((rand() - 0.5) * 18);
    bctx.fillStyle = `rgba(${bv}, ${bv}, ${bv}, 0.45)`;
    bctx.fillRect(x, 0, 2, size);
  }
  for (let y = 0; y < size; y += step) {
    const delta = Math.floor((rand() - 0.5) * 6);
    cctx.fillStyle = `rgba(${26 + delta}, ${31 + delta}, ${42 + delta}, 0.44)`;
    cctx.fillRect(0, y, size, 2);

    const bv = 138 + Math.floor((rand() - 0.5) * 18);
    bctx.fillStyle = `rgba(${bv}, ${bv}, ${bv}, 0.42)`;
    bctx.fillRect(0, y, size, 2);
  }

  // Subtle tone-on-tone jacquard diamond lattice & damask floret motif
  const drawMotif = (ctx, strokeColor, fillColor, lineWidth) => {
    const cell = 128;
    ctx.save();
    ctx.strokeStyle = strokeColor;
    ctx.fillStyle = fillColor;
    ctx.lineWidth = lineWidth;

    for (let gy = 0; gy <= size; gy += cell) {
      for (let gx = 0; gx <= size; gx += cell) {
        // Outer double-line diamond lattice
        ctx.beginPath();
        ctx.moveTo(gx, gy - cell / 2);
        ctx.lineTo(gx + cell / 2, gy);
        ctx.lineTo(gx, gy + cell / 2);
        ctx.lineTo(gx - cell / 2, gy);
        ctx.closePath();
        ctx.stroke();

        // Inner fine diamond frame
        const inset = 12;
        ctx.beginPath();
        ctx.moveTo(gx, gy - cell / 2 + inset);
        ctx.lineTo(gx + cell / 2 - inset, gy);
        ctx.lineTo(gx, gy + cell / 2 - inset);
        ctx.lineTo(gx - cell / 2 + inset, gy);
        ctx.closePath();
        ctx.stroke();

        // Delicate 4-petal damask rosette at center
        for (let a = 0; a < 4; a++) {
          ctx.save();
          ctx.translate(gx, gy);
          ctx.rotate((a * Math.PI) / 2);
          ctx.beginPath();
          ctx.ellipse(0, -14, 5.5, 11, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // Tiny center accent dot
        ctx.beginPath();
        ctx.arc(gx, gy, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Offset secondary subtle rosettes at cell midpoints
    for (let gy = cell / 2; gy < size; gy += cell) {
      for (let gx = cell / 2; gx < size; gx += cell) {
        for (let a = 0; a < 4; a++) {
          ctx.save();
          ctx.translate(gx, gy);
          ctx.rotate((a * Math.PI) / 2 + Math.PI / 4);
          ctx.beginPath();
          ctx.ellipse(0, -10, 4, 8, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    }
    ctx.restore();
  };

  // Tone-on-tone muted slate-champagne thread tint (very subtle, never loud)
  drawMotif(cctx, "rgba(52, 60, 78, 0.42)", "rgba(56, 64, 82, 0.34)", 1.6);
  // Slightly raised jacquard thread relief on bump map
  drawMotif(bctx, "rgba(182, 182, 182, 0.55)", "rgba(195, 195, 195, 0.5)", 2.0);
  // Satin sheen contrast on roughness map (lower roughness on woven motif so spotlight reveals it subtly)
  drawMotif(rctx, "rgba(145, 145, 145, 0.72)", "rgba(138, 138, 138, 0.72)", 2.2);

  const setupTex = (canvas, isColor = false) => {
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(9, 9);
    tex.anisotropy = Math.min(maxAnisotropy, 8);
    if (isColor) tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  };

  const map = setupTex(colorCanvas, true);
  const bumpMap = setupTex(bumpCanvas, false);
  const roughnessMap = setupTex(roughCanvas, false);

  const material = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#ffffff"),
    map,
    bumpMap,
    bumpScale: 0.014,
    roughnessMap,
    roughness: 1.0,
    metalness: 0.04,
    sheen: 0.78,
    sheenRoughness: 0.56,
    sheenColor: new THREE.Color("#5c6884"),
  });

  return {
    material,
    dispose() {
      map.dispose();
      bumpMap.dispose();
      roughnessMap.dispose();
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
    scene.background = new THREE.Color("#05070e");
    scene.fog = new THREE.FogExp2(0x05070e, 0.24);

    const width = Math.max(1, container.clientWidth || window.innerWidth);
    const height = Math.max(1, container.clientHeight || window.innerHeight);
    const camera = new THREE.PerspectiveCamera(62, width / height, 0.1, 100);
    camera.position.set(0, 0.88, -1.18);

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
    controls.minDistance = 0.72;
    controls.maxDistance = 2.35;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.update();

    // Moody fine-dining lighting to highlight the dark jacquard weave and dish
    const hemiLight = new THREE.HemisphereLight(0xeef3ff, 0x090c14, 0.42);
    scene.add(hemiLight);

    const spotLight = new THREE.SpotLight(0xfff1dc);
    spotLight.position.set(0.15, 1.45, -0.2);
    spotLight.castShadow = true;
    spotLight.shadow.mapSize.width = 1024;
    spotLight.shadow.mapSize.height = 1024;
    spotLight.shadow.camera.near = 0.2;
    spotLight.shadow.camera.far = 5;
    spotLight.shadow.radius = 4;
    spotLight.shadow.bias = -0.0005;
    spotLight.angle = 0.92;
    spotLight.penumbra = 1;
    spotLight.intensity = 4.2;
    scene.add(spotLight);

    const rimLight = new THREE.DirectionalLight(0x9fb4de, 0.55);
    rimLight.position.set(-1.6, 1.1, 1.8);
    scene.add(rimLight);

    const fillLight = new THREE.PointLight(0xffdfba, 0.65);
    fillLight.position.set(0.8, 0.55, -2.0);
    scene.add(fillLight);

    const jacquardCloth = createDarkJacquardClothMaterial(renderer.capabilities.getMaxAnisotropy());

    // Shadow caster disc for splat dishes (projected softly onto the dark tablecloth)
    const shadowGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.04, 40, 1);
    const shadowMat = new THREE.MeshPhongMaterial({ colorWrite: false, depthWrite: false });
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.visible = false;
    shadow.castShadow = true;
    shadow.position.set(0, 0.1, 0);
    scene.add(shadow);

    const transitionLength = isMobile() ? 24 : 44;
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
        camera.position.set(0, 0.88, -1.18);
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

    // Load restaurant table GLB and dress its cloth in the dark jacquard fabric
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
            node.material = jacquardCloth.material;
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
      jacquardCloth.dispose();
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
