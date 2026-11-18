// Walkable-space runtime on three.js r187 WebGPURenderer (falls back to its WebGL 2 backend).
// Plain three.js, driven by the React wrapper in WalkableSpace.jsx.
import {
  AgXToneMapping,
  Box3,
  Frustum,
  Euler,
  MOUSE,
  Matrix3,
  Matrix4,
  PCFShadowMap,
  PerspectiveCamera,
  Scene,
  TOUCH,
  Vector2,
  Vector3,
  WebGPURenderer,
  getConsoleFunction,
  setConsoleFunction,
} from "three/webgpu";
import { reflector, uniform } from "three/tsl";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { findNearestFloor, floorAt, floorWithTops, heightAt } from "../walkPhysics";
import { CHARACTER, createCharacterState, stepCharacter } from "../characterController";
import { FIRST_PERSON, firstPersonPolarLimits, transitionAmount, viewRelativeMove, viewYaw } from "../firstPerson";
import { decodeHeightfield, heightfieldError, heightfieldList } from "../heightfield";
import { readFlightIntent, readJumpIntent, readMoveIntent } from "../walkInput";
import { devInfo } from "./devLog";
import {
  FLIGHT,
  altitudeAboveFloor,
  createFlightState,
  flightShadowFar,
  isFlying,
  resumeFlight,
  startFlight,
  startLanding,
  stepFlight,
} from "../flightPhysics";
import {
  QUALITY_PRESETS,
  classifyGpu,
  isQualityKey,
  lowerQuality,
  pickInitialQuality,
  readStoredQuality,
  summarizeFrameTimes,
} from "../qualityPresets";
import { createKTX2Loader, createTransferTracker, loadBackgroundImage, loadBinary, loadGLTF, loadHDR } from "./loaders";
import { createWaterMaterial, placeScenery, prepareScene, prepareStaticScenery, waterLevel } from "./materials";
import { createAvatar } from "./avatarRig";
import { createFountains } from "./fountains";
import { createHaze, createSun, sameShadowSettings, setupSky } from "./sky";
import { buildPipeline, createPipelineUniforms } from "./pipeline";
import { createTour } from "./tour";
import { VegetationSystem } from "./vegetation";
import { applyDoorPose, bindDoors, collectTextures, hideNodes, revealBatches } from "./sceneryNodes";
import { CameraCollider } from "./cameraCollision";
import { LAYERS, allCascadesMask, cascadeLayerMasks } from "./layers";
import { markReflectable, mergeStaticMeshes, mergeStaticMeshesNow } from "./staticMerge";
import { boxCorners, cascadeOutlines, casterCascadeBits, clipSliceToHeights, lightBasis, lightOutline, regionCeiling } from "../shadowCasters";
import { createFrameGuard, feedFrameGuard, resetFrameGuard } from "../frameGuard";
import { avatarOpacity } from "../cameraArm";
import { placeCamera, reachableFloor, spawnViewOffset } from "../cameraRig";
import { blockerActive, pathNearDoor, updateDoor } from "../doors";

/**
 * Movement tuning (metres, seconds). Walking and running speeds come from the motion-capture
 * clips' measured ground speed (avatar-animations.json, speedMps) so the feet do not slide; these
 * values are only the fallback for the procedural rig and match the shipped clips.
 */
export const MOVEMENT = {
  walkSpeed: 1.57,
  runSpeed: 4.76,
  acceleration: 9,
  turnRate: 10,
  maxFrameDelta: 1 / 20,
  bodyRadius: 0.4,
  /** Gravity, jump, steps and landing (see characterController.js). */
  character: CHARACTER,
  /** Flight speeds, limits and timings (see flightPhysics.js). */
  flight: FLIGHT,
  /** How fast the flying avatar turns to face its direction of travel (1/s). */
  flightTurnRate: 4,
  /** Doors ignore a flying avatar higher than this above the floor. */
  flightDoorHeight: 5,
};

/**
 * Putting a large scenery file on screen: textures are uploaded under a per-frame time budget,
 * then meshes appear one new material per frame, so upload and pipeline compilation are spread
 * over many frames instead of one long one.
 */
export const SCENERY_REVEAL = {
  uploadBudgetMs: 6,
  /** The tour opens a door when its camera passes within the trigger radius below this height above the door. */
  tourDoorHeight: 15,
  tourSamples: 160,
};

export const CAMERA = {
  fov: 50,
  near: 0.3,
  far: 2500,
  minDistance: 4,
  maxDistance: 160,
  photoMinDistance: 1.5,
  photoMaxDistance: 420,
  /** Zoom-out limit while flying. */
  flightMaxDistance: 260,
  /** The camera follows the avatar's height with this rate (1/s; horizontal following is rigid). */
  verticalFollowRate: 7,
  /** Orbit limits from straight up (rad): the follow view, and photo mode a little lower. */
  minPolarAngle: 0.12,
  maxPolarAngle: Math.PI * 0.62,
  photoMaxPolarAngle: Math.PI * 0.7,
};

/** Review captures (?capture=1): frame size, frames to settle, and the time value they freeze at. */
export const CAPTURE = Object.freeze({ width: 1920, height: 1080, settleFrames: 96, time: 12 });

const TAU = Math.PI * 2;
const _v = new Vector3();
const _v2 = new Vector3();

function dampFactor(rate, dt) {
  return 1 - Math.exp(-rate * dt);
}

function dampAngle(current, target, rate, dt) {
  let diff = (target - current) % TAU;
  if (diff > Math.PI) diff -= TAU;
  if (diff < -Math.PI) diff += TAU;
  return current + diff * dampFactor(rate, dt);
}

function describeGpu(renderer) {
  try {
    const backend = renderer.backend;
    if (backend.isWebGPUBackend) {
      const info = backend.device?.adapterInfo;
      return [info?.vendor, info?.architecture, info?.device, info?.description].filter(Boolean).join(" ");
    }
    const gl = backend.gl;
    const ext = gl?.getExtension("WEBGL_debug_renderer_info");
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl?.getParameter(gl.RENDERER) ?? "";
  } catch {
    return "";
  }
}

function isTouchOnly() {
  try {
    return window.matchMedia("(pointer: coarse)").matches && !window.matchMedia("(any-pointer: fine)").matches;
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

/** Classifies a start-up failure for the host's message. */
export function classifyEngineError(error) {
  const text = String(error?.message ?? error ?? "");
  if (/webgl|webgpu|adapter|context|backend/i.test(text) && !/fetch|404|load/i.test(text)) return "webgl";
  return "asset";
}

export class SpaceEngine {
  /**
   * @param {{ container: HTMLElement, assets: object, callbacks?: object, interactive?: boolean,
   *   reducedMotion?: boolean, keysRef?: { current: Set<string> }, quality?: string | null,
   *   exposure?: number }} options
   */
  constructor({ container, assets, callbacks = {}, interactive = true, reducedMotion = false, keysRef = null, quality = null, exposure = 1, avatarHidden = false, autoQuality = true }) {
    this.container = container;
    this.assets = assets;
    this.callbacks = callbacks;
    this.interactive = interactive;
    this.reducedMotion = reducedMotion;
    this.keysRef = keysRef;
    this.requestedQuality = isQualityKey(quality) ? quality : null;
    this.exposure = exposure;
    this.zoomEnabled = true;
    this.disposed = false;
    this.running = false;
    this.visible = true;
    this.onScreen = true;
    this.mode = interactive ? "follow" : "passive";
    this.photo = null;
    this.statsEnabled = false;
    this.frameTimes = [];
    // Frame guard (frameGuard.js): judges only after loading and a quiet run after each change.
    this.frameGuard = createFrameGuard({ enabled: autoQuality });
    this.contentReady = false;
    this.applyingQuality = false;
    // Static shadow casters with their world spheres, for per-cascade layers (shadowCasters.js).
    this.casters = [];
    this.staticRoots = [];
    // Frames over 400 ms with what happened just before, for the performance panel.
    this.stalls = [];
    this.lastEvent = null;
    this.lastPrecompileMs = null;
    // While > 0 nothing is rendered: compileAsync must never interleave with a real render (an
    // interleaved render picks up the precompile's render context and binds pipelines built for
    // one attachment layout inside another pass, which WebGPU rejects).
    this.compiling = 0;
    this.primingFrames = 0;
    this.gpuErrorSignatures = new Set();
    this.persistentGpuErrors = new Set();
    // Water reflection runs only while water is in view and near (see updateWaterReflection).
    this.reflectionMix = uniform(0);
    this.reflectionActive = false;
    this.captureQueue = [];
    this.cleanups = [];
    this.contentVersion = 0;
    this.doors = [];
    this.doorBoxes = [];
    this.flight = null;
    this.character = null;
    this.followY = null;
    // Hidden avatar: first-person view (see firstPerson.js).
    this.avatarHidden = Boolean(avatarHidden);
    this.cameraLift = null;
    this.viewTransition = null;
    this.savedViewDistance = null;
    this.firstPerson = false;
    // The visitor's orbit (OrbitControls' object); the drawn camera is placed from it (cameraRig.js).
    this.orbit = null;
    // Camera spring arm (cameraArm.js / cameraCollision.js).
    this.cameraCollider = null;
    this.armLength = null;
    this.armWanted = null;
    // Review captures: a fixed frame size and view while set, and callers waiting for frames.
    this.captureSize = null;
    this.captureView = null;
    this.frameWaiters = [];
    this.time = uniform(0);
    this.wind = uniform(reducedMotion ? 0 : 1);
    this.pipelineUniforms = createPipelineUniforms();
  }

  setCallbacks(callbacks) {
    this.callbacks = callbacks ?? {};
  }

  emit(name, ...args) {
    if (this.disposed) return;
    try {
      this.callbacks[name]?.(...args);
    } catch (error) {
      console.error(error);
    }
  }

  async start() {
    try {
      await this._start();
    } catch (error) {
      if (this.disposed) return;
      console.error("[spaces] The 3D space failed to start.", error);
      this.emit("onError", classifyEngineError(error), error);
    }
  }

  async _start() {
    const { container } = this;
    const renderer = new WebGPURenderer({ antialias: false, powerPreference: "high-performance" });
    this.renderer = renderer;
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = AgXToneMapping;
    renderer.toneMappingExposure = this.exposure;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFShadowMap;
    renderer.info.autoReset = false;
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.touchAction = "none";
    renderer.domElement.setAttribute("aria-hidden", "true");
    await renderer.init();
    this.countPipelines();
    if (this.disposed) {
      renderer.dispose();
      return;
    }
    container.appendChild(renderer.domElement);
    // KTX2 textures transcode to what this renderer's GPU takes (WebGPU or the WebGL 2 fallback).
    this.ktx2Loader = createKTX2Loader(renderer, this.assets.textureUrls);
    this.cleanups.push(() => this.ktx2Loader?.dispose());

    this.backend = renderer.backend.isWebGPUBackend ? "webgpu" : "webgl";
    this.gpuClass = classifyGpu(describeGpu(renderer));
    this.userChosenQuality = Boolean(this.requestedQuality || readStoredQuality(safeStorage()));
    this.qualityKey = this.requestedQuality ?? pickInitialQuality({
      stored: readStoredQuality(safeStorage()),
      backend: this.backend,
      gpuClass: this.gpuClass,
      mobile: isTouchOnly(),
    });
    this.watchGpuErrors();
    renderer.onDeviceLost = (info) => {
      this.stopLoop();
      this.emit("onDeviceLost", info);
    };

    // ── Assets ──
    const { assets } = this;
    const tracker = createTransferTracker((summary) => this.emit("onProgress", summary));
    const backdropWidth = this.backend === "webgpu" && this.gpuClass !== "low" && this.gpuClass !== "software" ? 8192 : 4096;
    const gridLoads = this.heightfieldLoads(assets, tracker);
    const [world, avatarGltf, hdr, backdrop, grids] = await Promise.all([
      loadGLTF(assets.worldUrl, tracker, this.ktx2Loader),
      loadGLTF(assets.avatarUrl, tracker, this.ktx2Loader),
      loadHDR(assets.environmentUrl, tracker),
      assets.backgroundUrl
        ? loadBackgroundImage(assets.backgroundUrl, tracker, backdropWidth).catch((error) => {
          console.warn("[spaces] Sky backdrop image failed to load; using the HDR sky.", error);
          return null;
        })
        : Promise.resolve(null),
      Promise.all(gridLoads),
    ]);
    if (this.disposed) {
      hdr.dispose();
      backdrop?.dispose();
      return;
    }
    this.hdr = hdr;
    this.backdrop = backdrop;
    this.colliders = this.collidersWithGrids(assets.colliders ?? {}, grids);

    // ── Scene ──
    const scene = new Scene();
    this.scene = scene;
    const preset = QUALITY_PRESETS[this.qualityKey];
    this.sky = setupSky(scene, { hdr, colliders: this.colliders });
    this.haze = createHaze(scene, this.sky.hazeColor);
    this.pipelineUniforms.bloomThreshold.value = Math.max(2.5, this.sky.skyP99 * 2);
    this.pipelineUniforms.backdropRotation.value.setFromMatrix4(
      new Matrix4().makeRotationFromEuler(new Euler(0, this.sky.skyRotation, 0)).transpose(),
    );
    this.sunLight = { intensity: this.sky.sunIntensity, color: this.sky.sunColor };
    this.sun = createSun(scene, this.sky.sunDirection, preset.shadows, this.sunLight);

    this.worldRoot = world.scene;
    // Surfaces with their own reflection strength use the same sun-free lighting HDR.
    this.environment = { texture: this.sky.lightingTexture, rotation: this.sky.skyRotation };
    this.prepared = [prepareScene(world.scene, { renderer, time: this.time, windStrength: this.wind, environment: this.environment })];
    // Fewer draw calls: static meshes sharing a material are merged per 60 m cell.
    this.worldMerge = mergeStaticMeshesNow(world.scene, { skip: (mesh) => this.mergeSkip(mesh) });
    this.registerCasters(world.scene);
    // The building blocks the camera; its collision structure is built a slice per frame.
    this.cameraCollider = new CameraCollider();
    scene.add(world.scene);
    this.cameraCollider.addRoot(world.scene);
    this.waterMeshes = [...this.prepared[0].water];
    // The water reflector draws only standing architecture near the water (and its own vegetation).
    this.waterBox = new Box3();
    for (const mesh of this.waterMeshes) this.waterBox.expandByObject(mesh);
    markReflectable(world.scene, this.waterBox);

    this.avatar = createAvatar(avatarGltf, assets.avatarConfig ?? {}, assets.avatarAnimations ?? null);
    this.speeds = this.avatar.speeds ?? { walk: MOVEMENT.walkSpeed, run: MOVEMENT.runSpeed };
    scene.add(this.avatar.object);
    // The avatar reflects and casts into every cascade.
    this.avatar.object.traverse((object) => {
      object.layers.enable(LAYERS.reflectable);
      object.layers.mask |= allCascadesMask();
    });


    this.fountains = createFountains(this.prepared[0].fountains, { time: this.time, count: preset.fountainParticles });
    for (const sprite of this.fountains.sprites) {
      sprite.layers.enable(LAYERS.reflectable);
      scene.add(sprite);
    }
    this.fountains.setVisible(!this.reducedMotion);

    // ── Camera & controls ──
    const camera = new PerspectiveCamera(CAMERA.fov, 1, CAMERA.near, CAMERA.far);
    camera.layers.enable(LAYERS.vegetationView);
    this.camera = camera;
    // OrbitControls moves its own object, the visitor's orbit, and the drawn camera is placed from
    // it every frame. OrbitControls also updates from its pointer handlers between frames, so it
    // must never see the spring arm's or the floor rule's adjustments (cameraRig.js).
    const orbit = new PerspectiveCamera(CAMERA.fov, 1, CAMERA.near, CAMERA.far);
    this.orbit = orbit;
    const controls = new OrbitControls(orbit, renderer.domElement);
    controls.enablePan = false;
    controls.enableDamping = !this.reducedMotion;
    controls.dampingFactor = 0.1;
    controls.rotateSpeed = 0.75;
    controls.zoomSpeed = 0.9;
    controls.minDistance = CAMERA.minDistance;
    controls.maxDistance = CAMERA.maxDistance;
    controls.minPolarAngle = CAMERA.minPolarAngle;
    controls.maxPolarAngle = CAMERA.maxPolarAngle;
    controls.mouseButtons = { LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.ROTATE };
    controls.touches = { ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_ROTATE };
    controls.enabled = this.interactive;
    this.controls = controls;
    // Shift (run) + drag would otherwise switch OrbitControls to its disabled pan mode; with
    // LEFT mapped to PAN while a modifier is held, its modifier swap turns the drag back into a rotation.
    const onPointerDown = (event) => {
      controls.mouseButtons.LEFT = event.shiftKey || event.ctrlKey || event.metaKey ? MOUSE.PAN : MOUSE.ROTATE;
      controls.mouseButtons.RIGHT = controls.mouseButtons.LEFT;
    };
    // Capture on the container (an ancestor of the canvas) so this always runs before OrbitControls.
    container.addEventListener("pointerdown", onPointerDown, true);
    this.cleanups.push(() => container.removeEventListener("pointerdown", onPointerDown, true));

    this.tour = createTour(this.colliders.buildingBounds);
    this.motion = null;
    this.reset();

    // ── Quality-dependent parts ──
    this.applyQuality(this.qualityKey, { initial: true });

    // ── Size, visibility, loop ──
    const resizeObserver = new ResizeObserver(() => this.resize());
    resizeObserver.observe(container);
    this.cleanups.push(() => resizeObserver.disconnect());
    const intersection = new IntersectionObserver((entries) => {
      this.onScreen = entries.some((entry) => entry.isIntersecting);
      this.updateLoop();
    });
    intersection.observe(container);
    this.cleanups.push(() => intersection.disconnect());
    const onVisibility = () => {
      this.visible = document.visibilityState !== "hidden";
      this.updateLoop();
    };
    document.addEventListener("visibilitychange", onVisibility);
    this.cleanups.push(() => document.removeEventListener("visibilitychange", onVisibility));
    this.resize();
    this.readyFrames = null;
    this.updateLoop();

    // Scenery and vegetation load, merge and compile behind the loading overlay; the space becomes
    // interactive once every pipeline is built and every LOD geometry uploaded.
    this.loadOptionalContent(assets)
      .then(() => this.prepareInteractive())
      .catch((error) => console.warn("[spaces] Optional content failed:", error))
      .finally(() => {
        if (this.disposed) return;
        this.contentReady = true;
        resetFrameGuard(this.frameGuard);
        this.readyFrames = 0;
      });
  }

  /**
   * Builds every render pipeline before the space is used, behind the loading overlay: every mesh
   * (vegetation LODs and the reflecting water included) is compiled with renderer.compileAsync for
   * the scene pass and the water reflection, a few meshes at a time with the browser given a frame
   * in between, so the overlay keeps animating and the driver compiles off the main thread. Then
   * a few frames are drawn with one instance of every vegetation mesh under the ground, so the
   * shadow-pass pipelines exist and every LOD geometry is uploaded without anything showing.
   */
  async prepareInteractive() {
    if (this.disposed) return;
    this.emit("onProgress", { percent: 100, loaded: 0, total: 0, label: "셰이더 준비" });
    const started = performance.now();
    await this.compileEverything((done) => this.emit("onProgress", { percent: Math.round(done * 100), loaded: 0, total: 0, label: "셰이더 준비" }));
    this.lastPrecompileMs = performance.now() - started;
    devInfo(`[spaces] Pipelines and geometry prepared in ${Math.round(this.lastPrecompileMs)} ms.`);
  }

  /**
   * Prepares every pipeline with rendering held: compileAsync for the scene pass and the water
   * reflection (one call each, awaited in turn: r187 keeps a single precompilation state on the
   * renderer, so overlapping compileAsync calls clear each other's state - the error "Cannot
   * destructure property 'useFrameBufferTarget' of 'this._precompilationState' as it is null"
   * came from starting one call per mesh without awaiting it). compileAsync yields to the browser
   * between items itself. Shadow-pass pipelines are not part of compileAsync (shadow maps render
   * through the normal path inside it), so shadows are switched off during the compile and the
   * casters are then primed a batch per frame. Pipeline builds are counted (see countPipelines).
   */
  async compileEverything(onProgress = null) {
    if (!this.post?.scenePass || this.disposed) return;
    this.preparing = true;
    this.pipelineStats = { prepared: { scene: 0, shadow: 0, reflection: 0, post: 0, other: 0 }, firstUse: { scene: 0, shadow: 0, reflection: 0, post: 0, other: 0 } };
    const below = (this.controls?.target ?? new Vector3()).clone();
    below.y -= 30;
    this.vegetation?.beginPrime(below);
    const planar = this.preset.water.reflection === "planar" && this.waterPlanar;
    if (planar) for (const mesh of this.waterMeshes) mesh.material = this.waterPlanar;
    this.compiling++;
    try {
      await this.precompile(onProgress);
    } finally {
      this.compiling--;
    }
    await this.primeShadows(onProgress);
    this.vegetation?.endPrime();
    this.updateWaterReflection(0, true);
    this.preparing = false;
  }

  /** compileAsync per pass context, one at a time; failures are reported with their materials. */
  async precompile(onProgress = null) {
    if (!this.post?.scenePass || this.disposed) return;
    const renderer = this.renderer;
    const pass = this.post.scenePass;
    const culled = [];
    const casting = [];
    this.scene.traverse((object) => {
      if (!(object.isMesh || object.isSprite || object.isPoints)) return;
      if (object.frustumCulled) {
        culled.push(object);
        object.frustumCulled = false;
      }
      if (object.castShadow) {
        casting.push(object);
        object.castShadow = false; // shadow maps render empty during the compile
      }
    });
    const size = new Vector2();
    const contexts = [{
      name: "scene",
      camera: pass.camera,
      enter: () => {
        // As PassNode.compileAsync sets it up, so the pipelines match the pass's own render.
        pass.renderTarget.samples = pass.options?.samples === undefined ? renderer.samples : pass.options.samples;
        renderer.getDrawingBufferSize(size);
        pass.setSize(size.width, size.height);
        renderer.setRenderTarget(pass.renderTarget);
        renderer.setMRT(pass.getMRT());
      },
    }];
    const mirrorSource = this.reflectorNode?.reflector;
    if (mirrorSource && this.preset.water.reflection === "planar") {
      const mirror = mirrorSource.getVirtualCamera(this.camera);
      contexts.push({
        name: "reflection",
        camera: mirror,
        enter: () => {
          renderer.setRenderTarget(mirrorSource.getRenderTarget(mirror));
          renderer.setMRT(null);
        },
      });
    }
    const previousTarget = renderer.getRenderTarget();
    const previousMRT = renderer.getMRT();
    try {
      for (const [index, context] of contexts.entries()) {
        if (this.disposed) return;
        const share = 0.9 / contexts.length;
        context.enter();
        try {
          await renderer.compileAsync(this.scene, context.camera, null, (event) => {
            if (event.total) onProgress?.(index * share + (share * event.loaded) / event.total);
          });
        } catch (error) {
          await this.reportPrecompileFailures(context, error);
        } finally {
          renderer.setRenderTarget(previousTarget);
          renderer.setMRT(previousMRT);
        }
      }
    } finally {
      for (const object of culled) object.frustumCulled = true;
      for (const object of casting) object.castShadow = true;
    }
  }

  /** Finds which meshes failed to precompile (one at a time) and names their materials. */
  async reportPrecompileFailures(context, error) {
    const failed = [];
    const objects = [];
    this.scene.traverseVisible((object) => {
      if (object.isMesh || object.isSprite || object.isPoints) objects.push(object);
    });
    for (const object of objects) {
      if (this.disposed) return;
      context.enter();
      try {
        await this.renderer.compileAsync(object, context.camera, this.scene);
      } catch (cause) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        failed.push(`${object.name || object.type} (${materials.map((m) => m?.name || m?.type).join(", ")}): ${cause?.message ?? cause}`);
      }
    }
    console.warn(`[spaces] Precompiling the ${context.name} pass failed (${error?.message ?? error}); these build on first use:`, failed.length ? failed.slice(0, 12) : "no single mesh failed on its own");
  }

  /**
   * Builds the shadow-pass pipelines a batch per frame: every caster's shadow is switched off,
   * then switched back on a few casters at a time (fewer when a frame took long, more when it was
   * quick), so no single frame compiles them all. Runs behind the overlay or the
   * "품질 적용 중…" chip; the vegetation priming instances are under the ground.
   */
  async primeShadows(onProgress = null) {
    const casters = [];
    this.scene.traverse((object) => {
      if (object.isMesh && object.castShadow) {
        casters.push(object);
        object.castShadow = false;
      }
    });
    let index = 0;
    let batch = 4;
    const frame = () => {
      this.primingFrames = 1;
      return new Promise((resolve) => {
        const wait = () => (this.primingFrames > 0 && !this.disposed ? requestAnimationFrame(wait) : resolve());
        requestAnimationFrame(wait);
      });
    };
    // The first frame builds the post-processing passes on their own.
    await frame();
    while (index < casters.length && !this.disposed) {
      for (const object of casters.slice(index, index + batch)) object.castShadow = true;
      index += batch;
      const started = performance.now();
      await frame();
      const took = performance.now() - started;
      batch = took < 120 ? Math.min(48, Math.ceil(batch * 1.5)) : took > 300 ? Math.max(1, Math.floor(batch / 2)) : batch;
      onProgress?.(0.9 + (0.1 * Math.min(index, casters.length)) / Math.max(1, casters.length));
    }
    for (const object of casters) object.castShadow = true;
    await frame();
  }

  /**
   * Counts every render-pipeline build by pass (scene, shadow, reflection, post-processing) and
   * by phase: built while preparing (precompile and priming) or on first use afterwards, which
   * is what freezes a frame. Shown in the performance panel.
   */
  countPipelines() {
    const backend = this.renderer?.backend;
    if (!backend?.createRenderPipeline || backend.__spacesCounted) return;
    const original = backend.createRenderPipeline.bind(backend);
    backend.__spacesCounted = true;
    this.pipelineCounter = 0;
    this.pipelineStats = { prepared: { scene: 0, shadow: 0, reflection: 0, post: 0, other: 0 }, firstUse: { scene: 0, shadow: 0, reflection: 0, post: 0, other: 0 } };
    backend.createRenderPipeline = (renderObject, promises) => {
      const kind = this.pipelineKind(renderObject);
      this.pipelineCounter++;
      const phase = this.preparing || this.compiling > 0 ? "prepared" : "firstUse";
      this.pipelineStats[phase][kind]++;
      if (phase === "firstUse" && kind !== "post" && this.contentReady) {
        const material = renderObject.material;
        devInfo(`[spaces] Pipeline built on first use (${kind}): ${renderObject.object?.name || renderObject.object?.type} / ${material?.name || material?.type}`);
      }
      return original(renderObject, promises);
    };
  }

  pipelineKind(renderObject) {
    const { object, camera, material } = renderObject;
    if (object?.isQuadMesh || material?.name === "RenderPipeline") return "post";
    if (camera === this.camera) return "scene";
    const mirror = this.reflectorNode?.reflector?.virtualCameras?.get?.(this.camera);
    if (mirror && camera === mirror) return "reflection";
    if (camera?.isOrthographicCamera) return "shadow";
    return "other";
  }

  /**
   * The water reflection runs only while a water surface is inside the view frustum and within the
   * preset's reflection distance; beyond that the water uses the environment reflection. It fades
   * over about half a second both ways (the reflector keeps its last texture while fading out).
   */
  updateWaterReflection(dt, snap = false) {
    if (!this.waterMeshes?.length) return;
    const planar = this.preset.water.reflection === "planar" && this.waterPlanar;
    let wanted = false;
    if (planar) {
      if (!this.waterBoxes) this.waterBoxes = this.waterMeshes.map((mesh) => new Box3().setFromObject(mesh));
      this.camera.updateMatrixWorld();
      const frustum = new Frustum().setFromProjectionMatrix(
        new Matrix4().multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse),
        this.camera.coordinateSystem,
      );
      const reach = (this.preset.water.reflectionDistance ?? 200) * (this.reflectionActive ? 1.1 : 1);
      wanted = this.waterBoxes.some((box) => frustum.intersectsBox(box) && box.distanceToPoint(this.camera.position) <= reach);
    }
    const step = snap ? 1 : dt / 0.5;
    const mix = this.reflectionMix.value;
    this.reflectionMix.value = wanted ? Math.min(1, mix + step) : Math.max(0, mix - step);
    const active = planar && this.reflectionMix.value > 0;
    if (active !== this.reflectionActive || snap) {
      this.reflectionActive = active;
      this.vegetation?.setReflectionActive(active);
      if (!this.waterEnv) this.waterEnv = createWaterMaterial({ time: this.time, environment: this.environment });
      const material = active ? this.waterPlanar : this.waterEnv;
      for (const mesh of this.waterMeshes) mesh.material = material;
    }
    if (this.waterPlanar) this.waterPlanar.envMapIntensity = 0.12 + (1 - this.reflectionMix.value) * 0.88;
  }

  /** Turns the frame guard (automatic quality) on or off. */
  setAutoQuality(enabled) {
    this.frameGuard.enabled = Boolean(enabled);
    resetFrameGuard(this.frameGuard);
  }

  /**
   * Registers the static meshes below `root`: every mesh's world box as a possible receiver (its
   * top sets the shadow region ceilings) and every caster's light-space outline for the
   * per-cascade layers (door leaves are recomputed each frame).
   */
  registerCasters(root) {
    root.updateWorldMatrix(true, true);
    this.staticRoots.push(root);
    this.receiverTops = this.receiverTops ?? [];
    this.staticBounds = this.staticBounds ?? new Box3();
    this.sunBasis = this.sunBasis ?? lightBasis(this.sky.sunDirection);
    root.traverse((object) => {
      if (!object.isMesh) return;
      const box = new Box3().setFromObject(object);
      if (box.isEmpty()) return;
      this.staticBounds.union(box);
      this.receiverTops.push({ minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z, top: box.max.y });
      if (!object.castShadow) return;
      let dynamic = false;
      for (let node = object; node; node = node.parent) if (node.userData?.cameraDynamic) dynamic = true;
      this.casters.push({ object, dynamic, outline: lightOutline(boxCorners(box.min, box.max), this.sunBasis) });
    });
  }

  // ── Heightfield grids ──

  /** Starts loading every heightfield grid named in colliders.json; each resolves to a grid or null. */
  heightfieldLoads(assets, tracker) {
    const urls = assets.heightfieldUrls ?? {};
    return heightfieldList(assets.colliders).map(async (meta) => {
      const problem = heightfieldError(meta);
      if (problem) {
        console.warn(`[spaces] Heightfield ${meta?.file ?? "(unnamed)"} ignored: ${problem}.`);
        return null;
      }
      const url = urls[meta.file];
      if (!url) {
        console.warn(`[spaces] Heightfield file ${meta.file} is not bundled; walking there uses the analytic colliders.`);
        return null;
      }
      try {
        return decodeHeightfield(await loadBinary(url, tracker), meta);
      } catch (error) {
        console.warn(`[spaces] Heightfield ${meta.file} could not be used; walking there uses the analytic colliders.`, error);
        return null;
      }
    });
  }

  /** A copy of the colliders with the decoded grids attached (the imported JSON is not touched). */
  collidersWithGrids(colliders, grids) {
    const loaded = (grids ?? []).filter(Boolean);
    if (!loaded.length && !colliders.heightfield && !colliders.heightfields) return colliders;
    const { heightfield: _single, ...rest } = colliders;
    return { ...rest, heightfields: loaded };
  }

  // ── GPU error watchdog ──

  watchGpuErrors() {
    const previous = getConsoleFunction();
    const engine = this;
    setConsoleFunction(function (level, message, ...params) {
      if (previous) previous(level, message, ...params);
      else (console[level] ?? console.log)(message, ...params);
      if (level === "error" && /shader|wgsl|glsl|program|pipeline|compil|NodeBuilder/i.test(String(message))) {
        engine.handleGpuError(String(message));
      }
    });
    this.cleanups.push(() => setConsoleFunction(previous));
    this.renderer.onError = (info) => {
      console.error("[spaces] GPU error", info?.message);
      this.handleGpuError(info?.message ?? "GPU error");
    };
  }

  /**
   * A GPU error lowers the preset once per distinct error (session only, with the notice; the
   * stored choice is never touched). Follow-up messages of the same failure are ignored, and an
   * error that is still there after its step-down is reported once and no longer acted on.
   */
  handleGpuError(message) {
    if (this.disposed) return;
    const text = String(message ?? "");
    if (/invalid due to a previous error/i.test(text)) return;
    const signature = text.split("\n")[0].replace(/\d+/g, "#").slice(0, 240);
    if (this.gpuErrorSignatures.has(signature)) {
      if (!this.persistentGpuErrors.has(signature)) {
        this.persistentGpuErrors.add(signature);
        console.error("[spaces] A GPU error persists after lowering the quality; not lowering further. Please report:", text);
      }
      return;
    }
    const now = performance.now();
    if (this.lastGpuError && now - this.lastGpuError < 2500) return;
    this.lastGpuError = now;
    this.gpuErrorSignatures.add(signature);
    const lower = lowerQuality(this.qualityKey);
    if (lower) {
      this.applyQuality(lower, { reason: "gpu-error" });
    } else {
      this.emit("onNotice", "그래픽 처리 중 오류가 발생했습니다. 화면 일부가 올바르게 보이지 않을 수 있습니다.");
    }
    console.warn("[spaces] Lowered quality after a GPU error:", text);
  }

  // ── Quality ──

  setQuality(key) {
    if (!isQualityKey(key) || !this.renderer) return;
    // The quality prop and the settings control may both deliver the same click.
    if (key === this.qualityKey && this.userChosenQuality) return;
    this.userChosenQuality = true;
    this.requestedQuality = key;
    this.applyQuality(key, { reason: "user" });
  }

  applyQuality(key, { initial = false, reason = "auto" } = {}) {
    if (!this.scene) return;
    const preset = QUALITY_PRESETS[key];
    const changed = key !== this.qualityKey || initial;
    this.qualityKey = key;
    this.preset = preset;

    if (!sameShadowSettings(this.sun.settings, preset.shadows)) {
      this.sun.dispose();
      this.sun = createSun(this.scene, this.sky.sunDirection, preset.shadows, this.sunLight);
    }
    this.vegetation?.setSettings(preset.vegetation, preset.triangleBudget);
    this.fountains?.setCount(preset.fountainParticles);
    this.applyWater(preset);
    this.pipelineUniforms.vignette.value = preset.vignette;
    this.pipelineUniforms.grain.value = this.reducedMotion ? 0 : preset.grain;
    this.rebuildPipeline();
    this.resize();
    resetFrameGuard(this.frameGuard);
    this.lastEvent = { label: "품질 변경", at: performance.now() };
    if (!initial && this.contentReady) this.applyQualityPipelines();
    if (changed) this.emit("onQualityChange", key, reason);
  }

  /**
   * After a preset change: the new lighting and passes are compiled asynchronously while the last
   * frame stays on screen ("품질 적용 중…"), instead of compiling inside the next frames.
   */
  async applyQualityPipelines() {
    const token = (this.applyToken = (this.applyToken ?? 0) + 1);
    this.emit("onQualityApplying", true);
    const started = performance.now();
    // Every mesh (all vegetation LODs, the reflecting water) is compiled for the new lighting and
    // passes, then the priming frames build the new cascades' shadow pipelines.
    this.applyingQuality = true;
    await this.compileEverything();
    if (this.disposed || token !== this.applyToken) return;
    this.lastPrecompileMs = performance.now() - started;
    this.applyingQuality = false;
    this.finishingQuality = true;
    resetFrameGuard(this.frameGuard);
  }

  applyWater(preset) {
    if (!this.waterMeshes?.length) return;
    let material;
    if (preset.water.reflection === "planar") {
      if (!this.waterPlanar) {
        const node = reflector({ resolutionScale: preset.water.resolutionScale, bounces: false });
        node.target.rotation.x = -Math.PI / 2; // reflector plane normal (+Z) points up
        node.target.position.y = waterLevel(this.waterMeshes);
        this.scene.add(node.target);
        this.reflectorNode = node;
        // The reflection draws its own short, cheap vegetation set, not the view's.
        const mirror = node.reflector.getVirtualCamera(this.camera);
        mirror.layers.disableAll();
        mirror.layers.enable(LAYERS.reflectable);
        mirror.layers.enable(LAYERS.vegetationReflection);
        this.waterPlanar = createWaterMaterial({ time: this.time, reflectorNode: node, environment: this.environment, reflectionMix: this.reflectionMix });
      }
      this.reflectorNode.reflector.resolutionScale = preset.water.resolutionScale;
      // The planar material takes over only while water is in view and near.
      if (!this.waterEnv) this.waterEnv = createWaterMaterial({ time: this.time, environment: this.environment });
      material = this.reflectionMix.value > 0 ? this.waterPlanar : this.waterEnv;
    } else {
      if (!this.waterEnv) this.waterEnv = createWaterMaterial({ time: this.time, environment: this.environment });
      material = this.waterEnv;
    }
    for (const mesh of this.waterMeshes) mesh.material = material;
  }

  rebuildPipeline() {
    this.post?.dispose();
    this.post = buildPipeline({
      renderer: this.renderer,
      scene: this.scene,
      camera: this.camera,
      preset: this.preset,
      uniforms: this.pipelineUniforms,
      backdrop: this.backdrop,
      photoMode: Boolean(this.photo),
      reducedMotion: this.reducedMotion,
    });
  }

  setExposure(value) {
    this.exposure = value;
    if (this.renderer) this.renderer.toneMappingExposure = value;
  }

  // ── Interaction state ──

  setInteractive(value) {
    this.interactive = value;
    if (this.controls) this.controls.enabled = value && this.mode !== "tour";
    if (!value && this.mode === "follow") this.mode = "passive";
    if (value && this.mode === "passive") {
      this.mode = "follow";
      this.reset();
    }
  }

  setZoomEnabled(value) {
    this.zoomEnabled = value;
    if (this.controls) this.controls.enableZoom = value;
  }

  setReducedMotion(value) {
    this.reducedMotion = value;
    this.wind.value = value ? 0 : 1;
    if (this.controls) this.controls.enableDamping = !value;
    this.fountains?.setVisible(!value);
    if (this.preset) {
      this.pipelineUniforms.grain.value = value ? 0 : this.preset.grain;
      this.rebuildPipeline();
    }
  }

  setStatsEnabled(value) {
    this.statsEnabled = value;
  }

  /**
   * The spawn point from colliders.json, moved to the nearest spot where the body stands on a
   * floor when it is inside a wall, a no-floor cell or an obstacle (with a warning, once).
   */
  spawnPoint() {
    if (this.spawn) return this.spawn;
    const spawn = this.colliders.spawn ?? {};
    const x = Number.isFinite(spawn.x) ? spawn.x : 0;
    const z = Number.isFinite(spawn.z) ? spawn.z : 0;
    const rescue = findNearestFloor(x, z, this.colliders, { radius: MOVEMENT.bodyRadius });
    if (!rescue) {
      console.warn(`[spaces] Spawn (${x.toFixed(2)}, ${z.toFixed(2)}) has no floor and none was found within 30 m.`);
      this.spawn = { x, z };
    } else {
      if (rescue.x !== x || rescue.z !== z) {
        const reason = floorAt(x, z, this.colliders) === null ? "has no floor" : "is blocked";
        console.warn(`[spaces] Spawn (${x.toFixed(2)}, ${z.toFixed(2)}) ${reason}; using the nearest floor at (${rescue.x.toFixed(2)}, ${rescue.z.toFixed(2)}).`);
      }
      this.spawn = rescue;
    }
    return this.spawn;
  }

  /** Avatar back to the spawn point, camera behind it. */
  reset() {
    if (!this.camera || !this.avatar) return;
    const spawn = this.colliders.spawn ?? {};
    const { x, z } = this.spawnPoint();
    const yaw = Number.isFinite(spawn.faceYaw) ? spawn.faceYaw : 0;
    const y = floorWithTops(x, z, this.colliders) ?? heightAt(x, z, this.colliders);
    const wasFlying = isFlying(this.flight);
    this.motion = { x, y, z, visualY: y, yaw, vx: 0, vz: 0, moving: 0, run: 0 };
    this.flight = createFlightState({ x, y, z });
    this.character = { ...createCharacterState({ x, z }, this.colliders), y };
    this.followY = y;
    this.avatar.object.position.set(x, y, z);
    this.avatar.object.rotation.y = yaw;
    this.avatar.update(0, { distance: 0, speed: 0, moving: 0, run: 0, reducedMotion: this.reducedMotion, flight: { active: false, snap: true }, air: null });
    if (wasFlying) {
      this.setFlightCamera(false);
      this.emit("onFlightChange", false);
    }

    this.viewTransition = null;
    this.releaseCameraArm();
    this.avatar.setVisible(!this.avatarHidden);
    this.cameraLift = this.avatarHidden ? this.avatar.eyeHeight : this.avatar.height * 0.8;
    if (this.mode === "passive") return;
    const target = _v.set(x, y + this.cameraLift, z);
    const controls = this.controls;
    // Hidden: at the eyes looking along the spawn direction. Shown: spawn.viewBackM behind and
    // spawn.viewRiseM above the look-at point (default 9 and 3), clamped to the follow orbit's
    // limits, which are set first so OrbitControls takes the view over unchanged.
    let offset;
    if (this.avatarHidden) {
      offset = new Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)).multiplyScalar(FIRST_PERSON.minDistance);
      controls.minDistance = FIRST_PERSON.minDistance;
    } else {
      const limits = { minDistance: CAMERA.minDistance, maxDistance: CAMERA.maxDistance, minPolarAngle: CAMERA.minPolarAngle, maxPolarAngle: CAMERA.maxPolarAngle };
      const view = spawnViewOffset(spawn, yaw, limits);
      offset = new Vector3(view.x, view.y, view.z);
      controls.minDistance = CAMERA.minDistance;
      if (this.mode !== "photo") {
        controls.minPolarAngle = CAMERA.minPolarAngle;
        controls.maxPolarAngle = CAMERA.maxPolarAngle;
      }
    }
    const orbit = this.orbit;
    const damping = controls.enableDamping;
    controls.enableDamping = false;
    orbit.position.copy(target).add(offset);
    controls.target.copy(target);
    controls.update(); // flushes any residual damped motion
    orbit.position.copy(target).add(offset);
    controls.target.copy(target);
    controls.enableDamping = damping;
    controls.update();
    // The first frames (and the loading frames, which run no follow update) draw the orbit as it is.
    this.camera.position.copy(orbit.position);
    this.camera.lookAt(target);
    this.updateCameraNear(this.avatarHidden);
  }

  // ── Hidden avatar (first-person view) ──

  /**
   * Hides or shows the avatar model. Hidden: the camera glides in to the eyes (about 0.4 s, a cut
   * under reduced motion) and the model disappears near the end; shown: the model appears and the
   * camera returns to the distance it had. Movement, collisions and everything else are unchanged.
   */
  setAvatarHidden(hidden) {
    const value = Boolean(hidden);
    if (value === this.avatarHidden) return;
    this.avatarHidden = value;
    if (!this.camera || !this.avatar || !this.motion) return; // applied by reset()
    const controls = this.controls;
    const distance = this.orbit.position.distanceTo(controls.target);
    const fromLift = this.cameraLift ?? this.avatar.height * 0.8;
    if (this.mode !== "follow") {
      // Tour, photo and passive views keep their camera; the change applies at once.
      this.avatar.setVisible(!value);
      this.cameraLift = value ? this.avatar.eyeHeight : this.avatar.height * 0.8;
      controls.minDistance = this.mode === "photo" ? CAMERA.photoMinDistance : value ? FIRST_PERSON.minDistance : CAMERA.minDistance;
      if (value && this.photo?.focus === "avatar") this.setPhotoMode({ focus: "building" });
      return;
    }
    if (value) {
      if (distance > FIRST_PERSON.orbitThreshold) this.savedViewDistance = distance;
      controls.minDistance = FIRST_PERSON.minDistance;
      this.viewTransition = {
        t: 0,
        fromLift,
        toLift: this.avatar.eyeHeight,
        fromDistance: distance,
        toDistance: FIRST_PERSON.minDistance,
        hideAt: FIRST_PERSON.hideAt,
      };
    } else {
      this.avatar.setVisible(true);
      this.viewTransition = {
        t: 0,
        fromLift,
        toLift: this.avatar.height * 0.8,
        fromDistance: distance,
        toDistance: Math.max(CAMERA.minDistance, this.savedViewDistance ?? 9),
        hideAt: null,
      };
    }
    // Photo mode's avatar focus is not available while hidden.
    if (value && this.photo?.focus === "avatar") this.setPhotoMode({ focus: "building" });
  }

  /** Near plane: smaller in first person so nearby walls are not cut away. */
  updateCameraNear(firstPerson) {
    const near = firstPerson ? FIRST_PERSON.near : CAMERA.near;
    if (!this.camera || this.camera.near === near) return;
    this.camera.near = near;
    this.camera.updateProjectionMatrix();
    // The cascades are split from the camera's near and far planes.
    this.sun?.refit();
  }

  /**
   * Carries the camera and its orbit target along with the avatar (third person or first person),
   * runs the view transition and applies the look limits. Returns true in first person.
   */
  followCamera(dt, dx, dz, { crisp = false } = {}) {
    const { orbit, controls, motion: m } = this;
    const previousFollow = this.followY ?? m.visualY;
    // The height is followed with a little damping in third person, so small steps do not bounce
    // the view; in flight and in first person it follows exactly (no landing bend in the eyes).
    this.followY = crisp || this.avatarHidden
      ? m.visualY
      : previousFollow + (m.visualY - previousFollow) * dampFactor(CAMERA.verticalFollowRate, dt);

    let lift = this.cameraLift ?? this.avatar.height * 0.8;
    let distance = null;
    const transition = this.viewTransition;
    if (transition) {
      transition.t += dt;
      const u = transitionAmount(transition.t, FIRST_PERSON.transitionSeconds, this.reducedMotion);
      lift = transition.fromLift + (transition.toLift - transition.fromLift) * u;
      distance = transition.fromDistance + (transition.toDistance - transition.fromDistance) * u;
      if (transition.hideAt !== null && u >= transition.hideAt) this.avatar.setVisible(false);
      if (u >= 1) {
        this.viewTransition = null;
        if (!this.avatarHidden) controls.minDistance = CAMERA.minDistance;
      }
    }
    const previousLift = this.cameraLift ?? lift;
    this.cameraLift = lift;

    // The orbit moves with the avatar (camera and target by the same amount).
    orbit.position.x += dx;
    orbit.position.z += dz;
    orbit.position.y += this.followY - previousFollow + (lift - previousLift);
    controls.target.set(m.x, this.followY + lift, m.z);
    if (distance !== null) {
      const offset = _v2.subVectors(orbit.position, controls.target);
      const length = offset.length();
      if (length > 1e-6) offset.divideScalar(length);
      else offset.set(-Math.sin(m.yaw), 0, -Math.cos(m.yaw));
      orbit.position.copy(controls.target).addScaledVector(offset, distance);
    }

    // Hidden avatar: a wheel step out of the eyes glides to an orbit round the invisible body, and
    // zooming in close glides back to the eyes (the wheel alone would crawl at that tiny radius).
    const currentDistance = orbit.position.distanceTo(controls.target);
    if (this.avatarHidden && !this.viewTransition) {
      if (this.firstPerson && currentDistance > FIRST_PERSON.minDistance * 1.02) {
        this.viewTransition = { t: 0, fromLift: lift, toLift: lift, fromDistance: currentDistance, toDistance: FIRST_PERSON.orbitDistance, hideAt: null };
      } else if (!this.firstPerson && currentDistance < FIRST_PERSON.snapInDistance) {
        this.viewTransition = { t: 0, fromLift: lift, toLift: lift, fromDistance: currentDistance, toDistance: FIRST_PERSON.minDistance, hideAt: null };
      }
    }
    const firstPerson = this.avatarHidden && orbit.position.distanceTo(controls.target) < FIRST_PERSON.orbitThreshold;
    if (firstPerson) {
      const limits = firstPersonPolarLimits();
      controls.minPolarAngle = limits.min;
      controls.maxPolarAngle = limits.max;
    } else {
      controls.minPolarAngle = CAMERA.minPolarAngle;
      controls.maxPolarAngle = CAMERA.maxPolarAngle;
    }
    this.firstPerson = firstPerson;
    this.updateCameraNear(firstPerson);
    // First person draws the orbit as it is; third person adds the spring arm and the floor rule.
    this.placeDrawnCamera(dt, { arm: !firstPerson, floor: firstPerson ? "none" : "avatar" });
    return firstPerson;
  }

  /**
   * Once every collision structure is built, casts the space's fixed world-space probes
   * (assets.collisionProbes: segments that must hit solid scenery) and warns once if any misses,
   * so a scenery file whose collision ends up in the wrong place cannot go unnoticed.
   */
  checkCollisionProbes() {
    const probes = this.assets.collisionProbes;
    if (this.collisionProbed || !probes?.length || !this.contentReady || !this.cameraCollider || this.cameraCollider.building) return;
    this.collisionProbed = true;
    const results = probes.map((probe) => {
      const [hit] = this.cameraCollider.castRays([{ origin: new Vector3(...probe.from), end: new Vector3(...probe.to) }]);
      return { name: probe.name, hit };
    });
    const missed = results.filter((result) => !Number.isFinite(result.hit));
    if (missed.length) {
      console.warn(`[spaces] Camera collision probes found nothing at: ${missed.map((m) => m.name).join(", ")}. A scenery file's collision is missing or misplaced.`);
    }
    this.collisionProbeResults = results;
  }

  // ── Drawn camera ──

  /** No arm (first person, tour, photo of the building): forget the pull-in and show the avatar fully. */
  releaseCameraArm() {
    this.armLength = null;
    this.armWanted = null;
    this.avatar?.setFade(1);
  }

  /**
   * Places the drawn camera from the visitor's orbit (cameraRig.js). The spring arm casts from the
   * orbit target towards the orbit position with five parallel rays and stands the camera a margin
   * in front of the nearest hit (in at once, out over about 0.4 s); the floor rule then lifts it
   * above the floor it could plausibly stand over. Neither touches the orbit, so the visitor's
   * pitch, yaw and zoom come back unchanged in open space. Fades the avatar when the camera is close.
   * @param {number} dt
   * @param {{ arm: boolean, floor: "avatar" | "camera" | "none" }} options the floor as walked to
   *   from the avatar (follow, avatar photo), the plain floor under the camera (building photo), or none
   */
  placeDrawnCamera(dt, { arm, floor }) {
    const { camera, orbit, controls, colliders } = this;
    const target = controls.target;
    const collider = this.cameraCollider?.readyCount ? this.cameraCollider : null;
    const m = this.motion;
    let floorUnder = null;
    if (floor === "avatar" && m) {
      const avatarFloor = heightAt(m.x, m.z, colliders);
      const floorOf = (x, z) => floorAt(x, z, colliders);
      floorUnder = (x, z) => reachableFloor(m.x, m.z, avatarFloor, x, z, floorOf);
    } else if (floor !== "none") {
      floorUnder = (x, z) => heightAt(x, z, colliders);
    }
    const placed = placeCamera(target, _v2.subVectors(orbit.position, target), {
      arm: arm ? { previous: this.armLength, dt, cast: collider ? (rays) => collider.castRays(rays) : null } : null,
      floorUnder,
    });
    camera.position.set(placed.x, placed.y, placed.z);
    camera.lookAt(target);
    if (arm && placed.armLength !== null) {
      this.armWanted = placed.wanted;
      this.armLength = placed.armLength;
      if (!this.avatarHidden) this.avatar.setFade(avatarOpacity(placed.armLength));
    } else {
      this.releaseCameraArm();
    }
  }

  // ── Flight ──

  /** F / the toolbar button: take off when walking, land when flying, fly on when landing. */
  toggleFlight() {
    const m = this.motion;
    if (!m || !this.flight || !this.interactive || this.mode !== "follow") return;
    const current = this.flight;
    if (current.mode === "walk") {
      // Mid-jump, flight starts at the current height and vertical speed.
      const airborne = Boolean(this.character && !this.character.grounded);
      const vy = airborne ? this.character.vy : 0;
      this.flight = startFlight({ ...current, x: m.x, y: m.y, z: m.z, vx: m.vx, vy, vz: m.vz }, this.colliders, { airborne });
      this.setFlightCamera(true);
      this.emit("onFlightChange", true);
    } else if (current.mode === "landing") {
      this.flight = resumeFlight(current);
    } else {
      const { state, rescue } = startLanding(current, this.colliders, { radius: MOVEMENT.bodyRadius, extraBoxes: this.doorBoxes });
      this.flight = state;
      this.reportLandingRescue(rescue);
    }
  }

  /** Whether the avatar is in the air (taking off, flying or landing). */
  isFlying() {
    return isFlying(this.flight);
  }

  reportLandingRescue(rescue) {
    if (!rescue) return;
    devInfo(
      `[spaces] Cannot land at (${rescue.from.x.toFixed(1)}, ${rescue.from.z.toFixed(1)}): ${rescue.reason}; `
        + `landing at (${rescue.to.x.toFixed(1)}, ${rescue.to.z.toFixed(1)}) instead.`,
    );
  }

  setFlightCamera(flying) {
    if (!this.controls || this.photo) return;
    this.controls.maxDistance = flying ? CAMERA.flightMaxDistance : CAMERA.maxDistance;
  }

  /**
   * Per-cascade layers. Each cascade camera sees only its own cascade layer (plus the near
   * cascades the vegetation casters); every static caster carries the layer of each cascade its
   * shadow can land in, from the light-space footprint of that cascade's slice of the view
   * frustum (shadowCasters.js). CSM's square cascade cameras are far larger than that footprint,
   * so without this the far cascades redraw nearly every caster in the scene.
   */
  configureShadowLayers() {
    const csm = this.sun?.csm;
    if (!csm?.lights?.length || !csm.camera || !csm.frustums?.length) return;
    const far = Math.min(csm.camera.far, csm.maxFar);
    const starts = csm.lights.map((_, i) => (i === 0 ? 0 : (csm.breaks[i - 1] ?? 0) * far));
    const masks = cascadeLayerMasks(starts, { vegetationDistance: this.preset.vegetation?.shadowDistance ?? 0 });
    let vegetationCascades = 0;
    csm.lights.forEach((light, i) => {
      light.shadow.camera.layers.mask = masks[i];
      if (masks[i] & (1 << LAYERS.vegetationShadow)) vegetationCascades++;
    });
    this.shadowLayerStarts = starts;
    this.vegetation?.setShadowCascades(vegetationCascades);

    if (!this.casters.length || !this.sunBasis) return;
    this.camera.updateMatrixWorld();
    // Each cascade's slice of the view, cut to where geometry can receive shadow: from the lowest
    // ground to the tallest receiver inside the slice (at least the tallest plant).
    const yMin = this.staticBounds.min.y - 2;
    const yMax = this.staticBounds.max.y + 2;
    const plantTop = this.vegetation?.maxHeight ?? 20;
    const regions = csm.frustums.slice(0, csm.lights.length).map((frustum) => {
      const corners = [...frustum.vertices.near, ...frustum.vertices.far].map((v) => v.clone().applyMatrix4(this.camera.matrixWorld));
      const slab = clipSliceToHeights(corners, yMin, yMax);
      return clipSliceToHeights(corners, yMin, regionCeiling(slab, this.receiverTops, plantTop) + 1);
    });
    const outlines = cascadeOutlines(regions, this.sunBasis);
    const clear = ~allCascadesMask();
    for (const entry of this.casters) {
      if (entry.dynamic) {
        const box = new Box3().setFromObject(entry.object);
        entry.outline = lightOutline(boxCorners(box.min, box.max), this.sunBasis);
      }
      const bits = casterCascadeBits(outlines, entry.outline);
      entry.object.layers.mask = (entry.object.layers.mask & clear) | (bits << LAYERS.cascadeBase);
    }
  }

  /**
   * Static scenery per pass for the panel: meshes and triangles drawn in the view, in each shadow
   * cascade (after the per-cascade layers) and in the water reflection, from the same bounding-
   * sphere culling the renderer does.
   */
  staticPassStats() {
    const frustum = new Frustum();
    const matrix = new Matrix4();
    const count = (camera, filter) => {
      camera.updateMatrixWorld();
      matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      frustum.setFromProjectionMatrix(matrix, camera.coordinateSystem);
      let calls = 0;
      let triangles = 0;
      for (const root of this.staticRoots) {
        root.traverseVisible((object) => {
          if (!object.isMesh || !object.layers.test(camera.layers) || !filter(object)) return;
          if (object.frustumCulled && !frustum.intersectsObject(object)) return;
          const geometry = object.geometry;
          const perInstance = Math.round((geometry.index ? geometry.index.count : geometry.attributes.position.count) / 3);
          calls++;
          triangles += perInstance * (object.isInstancedMesh ? object.count : 1);
        });
      }
      return { calls, triangles };
    };
    const view = count(this.camera, () => true);
    const cascades = (this.sun?.csm?.lights ?? []).map((light) => count(light.shadow.camera, (object) => object.castShadow));
    const reflector = this.reflectorNode?.reflector && this.reflectionActive
      ? count(this.reflectorNode.reflector.getVirtualCamera(this.camera), () => true)
      : { calls: 0, triangles: 0 };
    return { view, cascades, reflection: reflector };
  }

  /** Meshes never merged: water, flags and fountains keep their own objects. */
  mergeSkip(mesh) {
    for (let node = mesh; node; node = node.parent) {
      const name = typeof node.name === "string" ? node.name : "";
      if (name.startsWith("Water_") || name.startsWith("Flag_") || name.startsWith("Fountain_")) return true;
    }
    return false;
  }

  /** Grows the shadow range with altitude so the flying avatar's shadow stays on the ground. */
  updateFlightShadows() {
    const csm = this.sun?.csm;
    if (!csm || !this.sun.settings) return;
    const altitude = isFlying(this.flight) ? altitudeAboveFloor(this.flight, this.colliders) : 0;
    const wanted = flightShadowFar(this.sun.settings.maxFar, altitude, this.sky?.sunElevationDeg);
    if (Math.abs(csm.maxFar - wanted) > Math.max(10, wanted * 0.1) || (wanted === this.sun.settings.maxFar && csm.maxFar !== wanted)) {
      csm.maxFar = wanted;
      this.sun.refit();
    }
  }

  updateFlight(dt) {
    const { controls, orbit, motion: m } = this;
    controls.update(dt);
    const keys = this.interactive ? this.keysRef?.current : null;
    const intent = readMoveIntent(keys);
    const { vertical } = readFlightIntent(keys);
    const move = viewRelativeMove(controls.target.x - orbit.position.x, controls.target.z - orbit.position.z, intent);
    const wx = move.x;
    const wz = move.z;

    const result = stepFlight(this.flight, { moveX: wx, moveZ: wz, vertical, fast: intent.run }, dt, this.colliders, {
      radius: MOVEMENT.bodyRadius,
      extraBoxes: this.doorBoxes,
    });
    this.flight = result.state;
    this.reportLandingRescue(result.rescue);
    if (result.forced) devInfo("[spaces] The way down was blocked; the avatar was set down on the landing point.");
    const f = this.flight;
    const dx = f.x - m.x;
    const dz = f.z - m.z;
    m.x = f.x;
    m.y = f.y;
    m.z = f.z;
    // In the air the height is already smooth; after touchdown the walker's damping takes over.
    m.visualY = result.landed ? m.visualY + (m.y - m.visualY) * dampFactor(18, dt) : m.y;

    const horizontal = Math.hypot(f.vx, f.vz);
    const previousYaw = m.yaw;
    if (horizontal > 0.6) m.yaw = dampAngle(m.yaw, Math.atan2(f.vx, f.vz), MOVEMENT.flightTurnRate, dt);
    let turn = (m.yaw - previousYaw) % TAU;
    if (turn > Math.PI) turn -= TAU;
    if (turn < -Math.PI) turn += TAU;
    m.vx = result.landed ? 0 : f.vx;
    m.vz = result.landed ? 0 : f.vz;
    m.moving += (0 - m.moving) * dampFactor(8, dt);
    m.run += (0 - m.run) * dampFactor(5, dt);

    this.avatar.object.position.set(m.x, m.visualY, m.z);
    this.avatar.object.rotation.y = m.yaw;
    this.avatar.update(dt, {
      distance: 0,
      speed: 0,
      moving: m.moving,
      run: m.run,
      reducedMotion: this.reducedMotion,
      flight: {
        active: isFlying(f),
        forward: horizontal / FLIGHT.cruiseSpeed,
        // The arms follow the move keys directly; the body follows the speed.
        moveIntent: move.moving && f.mode !== "landing",
        turnRate: dt > 0 ? turn / dt : 0,
        climb: f.vy / FLIGHT.verticalSpeed,
      },
    });

    // The view pitches with the look direction, never with the body's flight pitch or bank.
    this.followCamera(dt, dx, dz, { crisp: true });

    if (result.landed) {
      this.character = { ...createCharacterState({ x: m.x, z: m.z }, this.colliders), y: m.y };
      this.setFlightCamera(false);
      this.emit("onFlightChange", false);
    }
  }

  // ── Tour ──

  startTour() {
    if (!this.camera || this.mode === "tour") return;
    if (this.photo) this.setPhotoMode(null);
    // The tour moves only the drawn camera; the visitor's orbit waits untouched for its end.
    this.saved = { mode: this.mode };
    this.mode = "tour";
    this.tourElapsed = 0;
    this.releaseCameraArm();
    this.liftTourClear();
    this.markTourDoors();
    this.updateCameraNear(false);
    this.controls.enabled = false;
    this.emit("onTourChange", true);
  }

  /**
   * Raises the tour path in 10 m steps (up to 60 m) while any part of it passes through solid
   * scenery or the building (checked against the camera collision structures built so far).
   */
  liftTourClear() {
    const collider = this.cameraCollider;
    if (!collider?.readyCount || !this.colliders.buildingBounds) return;
    const position = new Vector3();
    const target = new Vector3();
    const previous = new Vector3();
    for (let lift = this.tour?.lift ?? 0; lift <= 60; lift += 10) {
      const tour = lift === (this.tour?.lift ?? 0) ? this.tour : createTour(this.colliders.buildingBounds, { lift });
      let blocked = false;
      for (let i = 0; i <= SCENERY_REVEAL.tourSamples && !blocked; i++) {
        tour.sample((i / SCENERY_REVEAL.tourSamples) * tour.duration, false, position, target);
        if (i > 0 && Number.isFinite(collider.castSegment(previous, position))) blocked = true;
        previous.copy(position);
      }
      if (!blocked) {
        if (tour !== this.tour) devInfo(`[spaces] Tour path raised by ${lift} m to clear the scenery.`);
        this.tour = tour;
        return;
      }
    }
  }

  /** Doors whose passage the tour camera flies near are held open for the tour. */
  markTourDoors() {
    if (!this.doors.length || !this.tour) return;
    const points = [];
    const position = new Vector3();
    const target = new Vector3();
    for (let i = 0; i <= SCENERY_REVEAL.tourSamples; i++) {
      this.tour.sample((i / SCENERY_REVEAL.tourSamples) * this.tour.duration, false, position, target);
      points.push({ x: position.x, y: position.y, z: position.z });
    }
    for (const binding of this.doors) {
      const low = points.filter((point) => point.y < binding.baseY + SCENERY_REVEAL.tourDoorHeight);
      binding.openForTour = pathNearDoor(binding.door, low);
    }
  }

  stopTour() {
    if (this.mode !== "tour") return;
    this.mode = this.saved?.mode === "passive" ? "passive" : "follow";
    this.controls.enabled = this.interactive;
    this.controls.update();
    this.emit("onTourChange", false);
  }

  // ── Photo mode ──

  /** @param {null | { focus: "building" | "avatar" }} photo */
  setPhotoMode(photo) {
    if (!this.camera) return;
    if (this.mode === "tour") this.stopTour();
    const entering = Boolean(photo) && !this.photo;
    const leaving = !photo && this.photo;
    const previousFocus = this.photo?.focus ?? null;
    this.photo = photo ? { focus: photo.focus === "avatar" && !this.avatarHidden ? "avatar" : "building" } : null;
    const controls = this.controls;
    if (entering) {
      // The visitor's follow orbit is kept for the way back.
      this.savedFollow = { position: this.orbit.position.clone(), target: controls.target.clone() };
      controls.minDistance = CAMERA.photoMinDistance;
      controls.maxDistance = CAMERA.photoMaxDistance;
      controls.minPolarAngle = CAMERA.minPolarAngle;
      this.updateCameraNear(false);
      controls.maxPolarAngle = CAMERA.photoMaxPolarAngle;
      controls.enabled = true;
      this.mode = "photo";
    }
    if (this.photo) {
      // A new focus orbits on from where the camera is drawn now, so the view does not jump.
      if (entering || this.photo.focus !== previousFocus) this.orbit.position.copy(this.camera.position);
      controls.target.copy(this.photoFocusPoint(_v));
      controls.update();
    }
    if (leaving) {
      controls.minDistance = this.avatarHidden ? FIRST_PERSON.minDistance : CAMERA.minDistance;
      controls.maxDistance = isFlying(this.flight) ? CAMERA.flightMaxDistance : CAMERA.maxDistance;
      controls.enabled = this.interactive;
      this.mode = this.interactive ? "follow" : "passive";
      if (this.savedFollow) {
        this.orbit.position.copy(this.savedFollow.position);
        controls.target.copy(this.savedFollow.target);
      }
      controls.update();
    }
    if (entering || leaving) this.rebuildPipeline();
  }

  photoFocusPoint(out) {
    if (this.photo?.focus === "avatar" && this.motion) {
      return out.set(this.motion.x, this.motion.visualY + this.avatar.height * 0.6, this.motion.z);
    }
    const bounds = this.colliders.buildingBounds;
    if (bounds?.min && bounds?.max) {
      return out.set(
        (bounds.min[0] + bounds.max[0]) / 2,
        bounds.min[1] + (bounds.max[1] - bounds.min[1]) * 0.45,
        (bounds.min[2] + bounds.max[2]) / 2,
      );
    }
    return out.set(0, 25, 0);
  }

  /** Resolves with a PNG of the next rendered frame. */
  capture() {
    return new Promise((resolve, reject) => {
      if (!this.renderer) {
        reject(new Error("not ready"));
        return;
      }
      this.captureQueue.push({ resolve, reject });
    });
  }

  // ── Review captures (?capture=1) ──

  /**
   * Draws a fixed review station and resolves with a PNG: the camera stands at `station.eye`
   * looking at `station.target`, shader time (wind, water, fountains) stands still at one value,
   * the doors are shut, the frame guard leaves the preset alone, and the frame is `width` x
   * `height` at pixel ratio 1. Every station starts from the same state (temporal AA history and
   * jitter restarted, vegetation level hysteresis cleared, avatar at its rest pose, film grain off)
   * and the image is taken after `settleFrames` drawn frames there (a whole number of the 32-frame
   * jitter cycle), so the same scene gives the same picture.
   */
  async captureStation(station, { width = CAPTURE.width, height = CAPTURE.height, settleFrames = CAPTURE.settleFrames } = {}) {
    if (!this.camera || !this.renderer) throw new Error("not ready");
    this.enterCapture(width, height);
    this.captureView = { eye: new Vector3(...station.eye), target: new Vector3(...station.target) };
    this.vegetation?.resetSelection();
    this.avatar?.restPose?.();
    this.restartTemporal();
    await this.waitFrames(settleFrames);
    return this.capture();
  }

  /** Temporal AA starts over: history from the next frame, jitter sequence from its first sample. */
  restartTemporal() {
    const traa = this.post?.traa;
    if (!traa) return;
    if (Number.isInteger(traa._jitterIndex)) traa._jitterIndex = 0;
    traa.setSize?.(1, 1); // a size change makes the node reseed its history from the next frame
  }

  enterCapture(width, height) {
    if (this.mode === "tour") this.stopTour();
    if (this.photo) this.setPhotoMode(null);
    if (this.mode !== "capture") {
      this.captureReturn = this.mode;
      this.mode = "capture";
      this.controls.enabled = false;
      this.releaseCameraArm();
      for (const binding of this.doors) {
        binding.door.phase = "closed";
        binding.door.progress = 0;
        applyDoorPose(binding, true);
      }
    }
    this.time.value = CAPTURE.time;
    this.pipelineUniforms.grain.value = 0;
    this.captureSize = { width, height };
    this.applyCaptureSize();
  }

  /** Back to walking (or the passive view) at the window's own size. */
  leaveCapture() {
    if (this.mode !== "capture") return;
    this.mode = this.captureReturn === "passive" || !this.interactive ? "passive" : "follow";
    this.captureSize = null;
    this.captureView = null;
    this.controls.enabled = this.interactive;
    this.pipelineUniforms.grain.value = this.reducedMotion ? 0 : this.preset?.grain ?? 0;
    this.resize();
  }

  applyCaptureSize() {
    const { width, height } = this.captureSize;
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.sun?.refit();
  }

  updateCapture() {
    if (!this.captureView) return;
    this.camera.position.copy(this.captureView.eye);
    this.camera.lookAt(this.captureView.target);
  }

  /** Resolves after `count` more frames have been drawn. */
  waitFrames(count) {
    return new Promise((resolve) => {
      this.frameWaiters.push({ remaining: Math.max(1, count), resolve });
    });
  }

  // ── Loop ──

  updateLoop() {
    const shouldRun = this.visible && this.onScreen && !this.disposed && Boolean(this.post);
    if (shouldRun === this.running) return;
    this.running = shouldRun;
    if (shouldRun) {
      this.lastTime = null;
      this.renderer.setAnimationLoop((time) => this.frame(time));
    } else {
      this.renderer?.setAnimationLoop(null);
    }
  }

  stopLoop() {
    this.running = false;
    this.renderer?.setAnimationLoop(null);
  }

  resize() {
    if (!this.renderer || !this.camera || !this.preset) return;
    if (this.captureSize) {
      this.applyCaptureSize();
      return;
    }
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    const device = window.devicePixelRatio || 1;
    const budget = Math.sqrt(this.preset.maxPixels / (width * height));
    const ratio = Math.max(0.5, Math.min(this.preset.pixelRatio, device, budget));
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    // CSM fits its cascades to the camera frustum once; refit after the aspect changes.
    this.sun?.refit();
  }

  frame(time) {
    if (this.disposed) return;
    // Frame timing comes from the animation-loop timestamps of frames that were actually
    // rendered; the first frame after a (re)start only sets the reference.
    const now = Number.isFinite(time) ? time : performance.now();
    const rawDelta = this.lastTime === null ? 0 : Math.max(0, (now - this.lastTime) / 1000);
    this.lastTime = now;
    const dt = Math.min(rawDelta, MOVEMENT.maxFrameDelta);

    // Overloaded (under about 8 fps): skip every other animation frame, so the browser handles
    // input and the page's controls in between while the guard steps the preset down. The frame
    // time of the next drawn frame is measured from the last drawn one.
    if (rawDelta > 0.12 && !this.skippedFrame) {
      this.skippedFrame = true;
      this.lastTime = now - rawDelta * 1000;
      return;
    }
    this.skippedFrame = false;
    // While pipelines compile (and during loading, behind the overlay) nothing is rendered; the
    // last frame stays on screen. Priming frames are the exception.
    const priming = this.primingFrames > 0 && this.compiling === 0;
    if (this.compiling > 0 || (!this.contentReady && !priming)) {
      this.cameraCollider?.build();
      return;
    }
    if (priming) this.primingFrames--;
    if (rawDelta > 0 && this.mode !== "capture") this.recordFrameTime(rawDelta * 1000);
    const pipelinesBefore = this.pipelineCounter ?? 0;
    this.renderer.info.reset();
    if (!this.reducedMotion && this.mode !== "capture") this.time.value += dt;

    this.updateDoors(dt);
    if (this.mode === "follow") this.updateFollow(dt);
    else if (this.mode === "tour") this.updateTour(dt);
    else if (this.mode === "photo") this.updatePhoto(dt);
    else if (this.mode === "capture") this.updateCapture();
    else this.updatePassive(dt);

    if (this.mode !== "follow") this.idleAvatar(this.mode === "capture" ? 0 : dt);
    this.updateFlightShadows();
    this.configureShadowLayers();
    this.checkCollisionProbes();
    this.vegetation?.update(this.camera);
    // Remember budget moves, so a stall right after one is labelled in the panel.
    const scale = this.vegetation?.budgetScale;
    if (scale !== undefined && Math.abs(scale - (this.lastBudgetScale ?? scale)) > 0.02) {
      this.lastEvent = { label: "식생 거리 배율", at: performance.now() };
    }
    if (scale !== undefined) this.lastBudgetScale = scale;
    this.cameraCollider?.build();

    const uniforms = this.pipelineUniforms;
    this.camera.updateMatrixWorld();
    uniforms.backdropProjectionInverse.value.copy(this.camera.projectionMatrixInverse);
    uniforms.backdropCameraWorld.value.copy(this.camera.matrixWorld);

    this.updateWaterReflection(dt);
    this.post.pipeline.render();
    if (this.finishingQuality && this.primingFrames === 0) {
      this.finishingQuality = false;
      this.emit("onQualityApplying", false);
    }

    if (this.frameWaiters.length) {
      for (const waiter of this.frameWaiters) waiter.remaining--;
      for (const waiter of this.frameWaiters.filter((w) => w.remaining <= 0)) waiter.resolve();
      this.frameWaiters = this.frameWaiters.filter((w) => w.remaining > 0);
    }

    if (this.captureQueue.length) {
      const queue = this.captureQueue.splice(0);
      this.renderer.domElement.toBlob((blob) => {
        for (const entry of queue) {
          if (blob) entry.resolve(blob);
          else entry.reject(new Error("capture failed"));
        }
      }, "image/png");
    }

    if (this.readyFrames !== null) {
      this.readyFrames++;
      if (this.readyFrames >= 3) {
        this.readyFrames = null;
        this.emit("onReady", {
          backend: this.backend,
          quality: this.qualityKey,
          userChosenQuality: this.userChosenQuality,
          locomotion: this.avatar.locomotionKind,
          sunSource: this.sky.sunSource,
      sunIntensity: this.sky.sunIntensity,
      litToShade: 1 + this.sky.sunRatio,
          backdrop: Boolean(this.backdrop),
        });
      }
    }
    // rawDelta covers the previous frame's work: label a stall with that frame's pipeline builds.
    if (rawDelta > 0) this.checkWarmup(rawDelta * 1000, this.previousFramePipelines ?? 0);
    this.previousFramePipelines = (this.pipelineCounter ?? 0) - pipelinesBefore;
    this.maybeEmitStats(performance.now());
  }

  updateFollow(dt) {
    if (isFlying(this.flight)) {
      this.updateFlight(dt);
      return;
    }
    const { controls, orbit, motion: m } = this;
    controls.update(dt);

    const intent = this.interactive ? readMoveIntent(this.keysRef?.current) : { forward: 0, right: 0, run: false };
    const lookX = controls.target.x - orbit.position.x;
    const lookZ = controls.target.z - orbit.position.z;
    const move = viewRelativeMove(lookX, lookZ, intent);
    const wantsMove = move.moving;
    const wx = move.x;
    const wz = move.z;
    const speed = intent.run ? this.speeds.run : this.speeds.walk;
    const wasGrounded = this.character.grounded;
    // Same speed in the air, a little less acceleration.
    const k = dampFactor(MOVEMENT.acceleration * (wasGrounded ? 1 : CHARACTER.airControl), dt);
    m.vx += ((wantsMove ? wx * speed : 0) - m.vx) * k;
    m.vz += ((wantsMove ? wz * speed : 0) - m.vz) * k;

    const jump = this.interactive && readJumpIntent(this.keysRef?.current);
    const step = stepCharacter(this.character, { dx: m.vx * dt, dz: m.vz * dt, jump }, dt, this.colliders, {
      radius: MOVEMENT.bodyRadius,
      extraBoxes: this.doorBoxes,
    });
    this.character = step.state;
    const c = this.character;
    const dx = c.x - m.x;
    const dz = c.z - m.z;
    const distance = Math.hypot(dx, dz);
    if (dt > 0) {
      // Velocity follows what actually happened, so pushing into a wall does not build up speed.
      m.vx = dx / dt;
      m.vz = dz / dt;
    }
    m.x = c.x;
    m.z = c.z;
    m.y = c.y;
    if (this.flight) Object.assign(this.flight, { x: m.x, y: m.y, z: m.z });
    // Steps are smoothed on the ground; a jump or fall arc is shown as it is.
    m.visualY = c.grounded ? m.visualY + (m.y - m.visualY) * dampFactor(18, dt) : m.y;

    // In first person the invisible body turns with the view; otherwise it faces where it walks.
    if (this.firstPerson && Math.hypot(lookX, lookZ) > 1e-9) m.yaw = viewYaw(lookX, lookZ);
    else if (wantsMove) m.yaw = dampAngle(m.yaw, Math.atan2(wx, wz), MOVEMENT.turnRate, dt);
    const actualSpeed = dt > 0 ? distance / dt : 0;
    m.moving += (Math.min(1, actualSpeed / this.speeds.walk) - m.moving) * dampFactor(8, dt);
    const running = intent.run && actualSpeed > this.speeds.walk * 1.2 ? 1 : 0;
    m.run += (running - m.run) * dampFactor(5, dt);

    this.avatar.object.position.set(m.x, m.visualY, m.z);
    this.avatar.object.rotation.y = m.yaw;
    this.avatar.update(dt, {
      distance,
      speed: actualSpeed,
      moving: m.moving,
      run: m.run,
      reducedMotion: this.reducedMotion,
      air: {
        airborne: !c.grounded,
        forward: actualSpeed / Math.max(this.speeds.run, 1e-3),
        jumped: step.jumped,
        landed: step.landed,
        airTime: c.airTime,
        falling: c.vy < 0,
      },
    });

    this.followCamera(dt, dx, dz);
  }

  /**
   * Automatic doors: the avatar is the visitor (none in passive use); the tour holds open the
   * doors it flies through. Blockers of doors that are not open enough become moving boxes.
   */
  updateDoors(dt) {
    if (!this.doors.length) return;
    const high = isFlying(this.flight) && altitudeAboveFloor(this.flight, this.colliders) > MOVEMENT.flightDoorHeight;
    const visitor = this.mode !== "passive" && this.mode !== "capture" && this.motion && !high ? { x: this.motion.x, z: this.motion.z } : null;
    const boxes = [];
    for (const binding of this.doors) {
      updateDoor(binding.door, dt, {
        visitor,
        bodyRadius: MOVEMENT.bodyRadius,
        forceOpen: this.mode === "tour" && binding.openForTour === true,
        reducedMotion: this.reducedMotion,
      });
      applyDoorPose(binding, this.reducedMotion);
      if (blockerActive(binding.door, this.reducedMotion)) boxes.push(binding.door.blocker);
    }
    this.doorBoxes = boxes;
  }

  idleAvatar(dt) {
    const m = this.motion;
    if (!m) return;
    m.vx = 0;
    m.vz = 0;
    m.moving += (0 - m.moving) * dampFactor(8, dt);
    m.run += (0 - m.run) * dampFactor(5, dt);
    // Tour, photo and passive modes pause flight control: the avatar hovers where it is.
    const flying = isFlying(this.flight);
    if (flying) Object.assign(this.flight, { vx: 0, vy: 0, vz: 0 });
    this.avatar.update(dt, {
      distance: 0,
      speed: 0,
      moving: m.moving,
      run: m.run,
      reducedMotion: this.reducedMotion,
      flight: { active: flying, forward: 0, turnRate: 0, climb: 0 },
      air: this.character && !this.character.grounded && !flying ? { airborne: true, airTime: this.character.airTime } : null,
    });
  }

  updateTour(dt) {
    this.tourElapsed += dt;
    const done = this.tour.sample(this.tourElapsed, this.reducedMotion, this.camera.position, _v);
    this.camera.lookAt(_v);
    if (done) this.stopTour();
  }

  updatePhoto(dt) {
    const { controls, camera } = this;
    const avatarFocus = this.photo?.focus === "avatar";
    if (avatarFocus) controls.target.copy(this.photoFocusPoint(_v));
    controls.update();
    // The building focus orbits the building's centre (inside it), so only the avatar focus has an
    // arm; the building focus keeps the plain floor under the camera.
    this.placeDrawnCamera(dt, { arm: avatarFocus, floor: avatarFocus ? "avatar" : "camera" });
    this.pipelineUniforms.focusDistance.value = camera.position.distanceTo(this.photoFocusPoint(_v2));
  }

  updatePassive(dt) {
    // Slow orbit around the building for background use (static with reduced motion).
    const bounds = this.colliders.buildingBounds;
    const min = bounds?.min ?? [-65, 0, -44];
    const max = bounds?.max ?? [65, 70, 62];
    const cx = (min[0] + max[0]) / 2;
    const cz = (min[2] + max[2]) / 2;
    const radius = Math.max(max[0] - min[0], max[2] - min[2], 10) * 1.6 + 8;
    if (!this.reducedMotion) this.passiveAngle = (this.passiveAngle ?? 0) + dt * 0.035;
    const angle = this.passiveAngle ?? 0;
    const span = Math.max(10, max[1] - min[1]);
    this.camera.position.set(cx + Math.sin(angle) * radius, min[1] + span * 0.7 + 6, cz + Math.cos(angle) * radius);
    this.camera.lookAt(cx, min[1] + span * 0.35, cz);
  }

  // ── Stats & warm-up quality check ──

  recordFrameTime(ms) {
    this.frameTimes.push(ms);
    if (this.frameTimes.length > 240) this.frameTimes.shift();
  }

  /**
   * Frame-time guard: in the first seconds after a preset is applied an automatically chosen
   * preset steps down when frames are slow; at any time, any preset steps down when frames take
   * over 100 ms (a couple of seconds at 2 fps is enough to decide).
   */
  checkWarmup(ms, pipelinesBuilt = 0) {
    if (ms > 400) {
      const recent = this.lastEvent && performance.now() - this.lastEvent.at < 10000 ? this.lastEvent.label : "알 수 없음";
      const cause = pipelinesBuilt > 0 ? `셰이더 컴파일 ${pipelinesBuilt}개` : recent;
      this.stalls.push({ ms: Math.round(ms), cause });
      if (this.stalls.length > 4) this.stalls.shift();
    }
    const verdict = feedFrameGuard(this.frameGuard, ms, {
      loaded: this.contentReady && !this.applyingQuality && this.compiling === 0 && this.primingFrames === 0,
      userChosen: this.userChosenQuality,
      canStepDown: lowerQuality(this.qualityKey) !== null,
    });
    if (verdict) this.applyQuality(lowerQuality(this.qualityKey), { reason: verdict === "overload" ? "overload" : "performance" });
  }

  maybeEmitStats(now) {
    if (!this.statsEnabled || (this.lastStats && now - this.lastStats < 500)) return;
    this.lastStats = now;
    const summary = summarizeFrameTimes(this.frameTimes);
    const info = this.renderer.info;
    const canvas = this.renderer.domElement;
    const shadowObjects = this.countShadowObjects();
    this.emit("onStats", {
      fps: summary.fps,
      low1: summary.low1,
      frameMs: summary.frameMs,
      drawCalls: info.render.drawCalls,
      triangles: info.render.triangles,
      textures: info.memory.textures,
      backend: this.backend,
      width: canvas.width,
      height: canvas.height,
      cssWidth: canvas.clientWidth,
      cssHeight: canvas.clientHeight,
      pixelRatio: this.renderer.getPixelRatio(),
      quality: this.qualityKey,
      features: this.post?.features ?? [],
      sun: {
        source: this.sky.sunSource,
        azimuthDeg: this.sky.sunAzimuthDeg,
        elevationDeg: this.sky.sunElevationDeg,
        intensity: this.sun.light.intensity,
        litToShade: 1 + this.sky.sunRatio,
        measured: this.sky.sunMeasured,
      },
      vegetation: this.vegetation ? this.vegetation.stats() : null,
      budget: { vegetation: this.preset.triangleBudget, total: info.render.triangles },
      staticPasses: this.staticPassStats(),
      reflection: { active: this.reflectionActive, distance: this.preset.water.reflectionDistance ?? null },
      stalls: [...this.stalls],
      pipelines: this.pipelineStats ?? null,
      collisionProbes: this.collisionProbeResults
        ? { total: this.collisionProbeResults.length, missed: this.collisionProbeResults.filter((r) => !Number.isFinite(r.hit)).length }
        : null,
      precompileMs: this.lastPrecompileMs,
      shadow: {
        cascades: this.sun.settings.cascades,
        mapSize: this.sun.settings.mapSize,
        maxFar: Math.round(this.sun.csm?.maxFar ?? this.sun.settings.maxFar),
        casters: shadowObjects.casters,
        receivers: shadowObjects.receivers,
      },
      cameraCollision: this.cameraCollider
        ? {
          ready: this.cameraCollider.readyCount,
          total: this.cameraCollider.entries.length,
          building: this.cameraCollider.building,
          triangles: this.cameraCollider.triangles,
          megabytes: this.cameraCollider.bytes / 1048576,
          buildMs: this.cameraCollider.buildMs,
          castMs: this.cameraCollider.castMs,
          arm: this.armLength,
          wanted: this.armWanted,
        }
        : null,
      flight: isFlying(this.flight)
        ? { altitude: altitudeAboveFloor(this.flight, this.colliders), mode: this.flight.mode }
        : null,
    });
  }

  /** Meshes casting and receiving sun shadows (cached until the scene content changes). */
  countShadowObjects() {
    if (this.shadowCounts && this.shadowCounts.version === this.contentVersion) return this.shadowCounts;
    let casters = 0;
    let receivers = 0;
    this.scene.traverse((object) => {
      if (!object.isMesh && !object.isSprite) return;
      if (object.castShadow) casters++;
      if (object.receiveShadow) receivers++;
    });
    this.shadowCounts = { casters, receivers, version: this.contentVersion };
    return this.shadowCounts;
  }

  // ── Vegetation (optional, loads after interaction starts) ──

  /** Optional files after the space is interactive: scenery first, then vegetation. */
  async loadOptionalContent(assets) {
    await this.loadScenery(assets.scenery);
    if (!this.disposed) await this.loadVegetation(assets.vegetation);
  }

  /**
   * Loads scenery-1.glb, scenery-2.glb ... (static placed scenery such as statues) one after
   * another and adds each scene as it is. A missing or failed file logs one warning and is skipped.
   * @param {{ files?: Record<string, string>, placements?: Record<string, { position?: number[], yawDeg?: number }> } | null | undefined} scenery
   */
  async loadScenery(scenery) {
    const files = scenery?.files ?? {};
    const names = Object.keys(files);
    if (!names.length) {
      this.emit("onScenery", { state: "missing" });
      return;
    }
    let loaded = 0;
    for (const [index, file] of names.entries()) {
      const report = (percent) => {
        this.emit("onScenery", { state: "loading", file, index, count: names.length, percent });
        if (!this.contentReady) this.emit("onProgress", { percent, loaded: 0, total: 0, label: `조형물 ${index + 1}/${names.length}` });
      };
      report(0);
      const tracker = createTransferTracker((summary) => report(summary.percent));
      let gltf;
      try {
        gltf = await loadGLTF(files[file], tracker, this.ktx2Loader);
      } catch (error) {
        if (this.disposed) return;
        console.warn(`[spaces] Scenery file ${file} failed to load; skipped.`, error);
        continue;
      }
      if (this.disposed) return;
      const placement = scenery?.placements?.[file];
      const hidden = hideNodes(gltf.scene, placement?.hide);
      for (const name of hidden.missing) console.warn(`[spaces] Scenery ${file}: node ${name} listed under hide was not found.`);
      const { doors, warnings } = bindDoors(gltf.scene, placement, file);
      for (const warning of warnings) console.warn(`[spaces] Scenery ${warning}`);
      prepareStaticScenery(gltf.scene, { renderer: this.renderer });
      // Merge by material across frames (door leaves and other moving parts are left alone).
      const merge = mergeStaticMeshes(gltf.scene, { skip: (mesh) => this.mergeSkip(mesh) });
      let slice = performance.now();
      for (let step = merge.next(); !step.done; step = merge.next()) {
        if (performance.now() - slice > 8) {
          await new Promise((resolve) => requestAnimationFrame(() => resolve()));
          if (this.disposed) return;
          slice = performance.now();
        }
      }
      gltf.scene.name = gltf.scene.name || file;
      // Files modelled around their own origin are placed by scenery.json; others go in as they are.
      const holder = placeScenery(gltf.scene, placement, file);
      await this.revealGradually(gltf.scene, holder, { immediate: !this.contentReady });
      if (this.disposed) return;
      // Everything below registers world-space data, so the placement must be in the matrices
      // first (nothing has rendered yet during loading to update them).
      holder.updateWorldMatrix(true, true);
      this.registerCasters(gltf.scene);
      markReflectable(gltf.scene, this.waterBox);
      // Solid scenery blocks the camera too (door leaves at their current pose).
      this.cameraCollider?.addRoot(gltf.scene);
      // Doors start working once their leaves are on screen.
      const baseY = Number(placement?.position?.[1]) || 0;
      for (const binding of doors) this.doors.push(Object.assign(binding, { baseY, openForTour: false }));
      if (doors.length && this.mode === "tour") this.markTourDoors();
      this.contentVersion += 1;
      loaded++;
    }
    this.emit("onScenery", loaded ? { state: "ready", percent: 100, count: loaded } : { state: "error" });
  }

  /**
   * Adds `holder` (containing `root`) to the scene with its meshes hidden, uploads the textures
   * under a per-frame time budget, then shows the meshes one new material per frame. The frame
   * loop keeps running throughout, so the avatar stays controllable while a large file comes in.
   */
  async revealGradually(root, holder, { immediate = false } = {}) {
    const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));
    const batches = revealBatches(root).map((batch) => batch.filter((mesh) => mesh.visible)).filter((batch) => batch.length);
    for (const batch of batches) for (const mesh of batch) mesh.visible = false;
    this.scene.add(holder);
    let start = performance.now();
    for (const texture of collectTextures(root)) {
      if (this.disposed) return;
      try {
        this.renderer.initTexture(texture);
      } catch {
        // Uploaded on first draw instead.
      }
      if (performance.now() - start > SCENERY_REVEAL.uploadBudgetMs) {
        await nextFrame();
        start = performance.now();
      }
    }
    for (const batch of batches) {
      if (this.disposed) return;
      for (const mesh of batch) mesh.visible = true;
      // During loading nothing renders and everything is compiled before the first frame.
      if (!immediate) await nextFrame();
    }
  }

  /**
   * Loads vegetation-1.glb, vegetation-2.glb ... one after another (not in parallel, to keep memory
   * spikes and frame hitches down) after the space is interactive. Each species appears as soon as
   * its file is in; a missing or failed file skips its species with one warning.
   * @param {{ files?: Record<string, string>, manifest?: object | null } | null | undefined} vegetation
   */
  async loadVegetation(vegetation) {
    const files = vegetation?.files ?? {};
    const manifest = vegetation?.manifest ?? null;
    const names = Object.keys(files).sort((a, b) => (Number(a.match(/\d+/)?.[0]) || 0) - (Number(b.match(/\d+/)?.[0]) || 0) || a.localeCompare(b));
    const wanted = new Set(Object.values(manifest?.species ?? {}).map((entry) => entry?.file).filter(Boolean));
    for (const file of wanted) {
      if (!files[file]) console.warn(`[spaces] Vegetation file ${file} is not bundled; its species are skipped.`);
    }
    if (!names.length) {
      this.emit("onVegetation", { state: "missing" });
      return;
    }
    this.vegetation = new VegetationSystem({
      renderer: this.renderer,
      time: this.time,
      windStrength: this.wind,
      environment: this.environment,
      settings: this.preset.vegetation,
      triangleBudget: this.preset.triangleBudget,
    });
    this.scene.add(this.vegetation.group);
    let loaded = 0;
    for (const [index, file] of names.entries()) {
      const report = (percent) => {
        this.emit("onVegetation", { state: "loading", file, index, count: names.length, percent });
        if (!this.contentReady) this.emit("onProgress", { percent, loaded: 0, total: 0, label: `나무와 화단 ${index + 1}/${names.length}` });
      };
      report(0);
      const tracker = createTransferTracker((summary) => report(summary.percent));
      let gltf;
      try {
        gltf = await loadGLTF(files[file], tracker, this.ktx2Loader);
      } catch (error) {
        if (this.disposed) return;
        console.warn(`[spaces] Vegetation file ${file} failed to load; its species are skipped.`, error);
        continue;
      }
      if (this.disposed) return;
      const result = this.vegetation.addFile(file, gltf, manifest);
      for (const warning of result.warnings) console.warn(`[spaces] Vegetation: ${warning}`);
      this.adoptPrepared(result.prepared);
      this.contentVersion += 1;
      loaded++;
      // Give the renderer a frame before the next file so its compile and upload do not stack up.
      await new Promise((resolve) => requestAnimationFrame(() => resolve()));
      if (this.disposed) return;
    }
    this.emit("onVegetation", loaded ? { state: "ready", percent: 100, species: this.vegetation.species.length } : { state: "error" });
  }

  /** Water and fountains found in later-loaded files join the existing ones. */
  adoptPrepared(prepared) {
    this.prepared.push(prepared);
    if (prepared.water.length) {
      this.waterMeshes.push(...prepared.water);
      this.applyWater(this.preset);
    }
    if (prepared.fountains.length) {
      const extra = createFountains(prepared.fountains, { time: this.time, count: this.preset.fountainParticles });
      for (const sprite of extra.sprites) this.scene.add(sprite);
      extra.setVisible(!this.reducedMotion);
      const base = this.fountains;
      this.fountains = {
        sprites: [...base.sprites, ...extra.sprites],
        setCount: (value) => { base.setCount(value); extra.setCount(value); },
        setVisible: (value) => { base.setVisible(value); extra.setVisible(value); },
        dispose: () => { base.dispose(); extra.dispose(); },
      };
    }
  }

  // ── Teardown ──

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.stopLoop();
    for (const cleanup of this.cleanups.splice(0)) {
      try {
        cleanup();
      } catch (error) {
        console.error(error);
      }
    }
    for (const entry of this.captureQueue.splice(0)) entry.reject(new Error("disposed"));
    this.controls?.dispose();
    this.post?.dispose();
    this.sun?.dispose();
    this.fountains?.dispose();
    this.avatar?.dispose();
    this.vegetation?.dispose();
    this.reflectorNode?.dispose?.();
    this.waterPlanar?.dispose();
    this.waterEnv?.dispose();
    for (const prepared of this.prepared ?? []) {
      for (const material of prepared.disposables) material.dispose?.();
    }
    const textures = new Set();
    this.scene?.traverse((object) => {
      if (object.geometry) object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
      for (const material of materials) {
        for (const key of Object.keys(material)) {
          if (material[key]?.isTexture) textures.add(material[key]);
        }
        material.dispose();
      }
    });
    for (const texture of textures) texture.dispose();
    this.hdr?.dispose();
    if (this.sky?.lightingTexture && this.sky.lightingTexture !== this.hdr) this.sky.lightingTexture.dispose();
    this.backdrop?.dispose();
    if (this.scene) {
      this.scene.environment = null;
      this.scene.background = null;
      this.scene.fogNode = null;
    }
    this.renderer?.dispose();
    this.renderer?.domElement?.remove();
  }
}
