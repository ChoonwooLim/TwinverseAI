// Builds the engine's node graphs without a GPU, so API mismatches with the installed three.js
// (renamed nodes, changed signatures) fail here instead of on screen. Nothing is rendered.
import { describe, expect, it } from "vitest";
import {
  BoxGeometry,
  CompressedTexture,
  DataTexture,
  EquirectangularReflectionMapping,
  Group,
  HalfFloatType,
  Mesh,
  MeshStandardMaterial,
  DoubleSide,
  FrontSide,
  NoToneMapping,
  PerspectiveCamera,
  RGBAFormat,
  SRGBColorSpace,
  Scene,
  StandardNodeLibrary,
  Texture,
  Vector3,
  WebGPUCoordinateSystem,
} from "three/webgpu";
import { reflector, uniform } from "three/tsl";
import { QUALITY_KEYS, QUALITY_PRESETS } from "../qualityPresets";
import { buildPipeline, createPipelineUniforms } from "./pipeline";
import { createWaterMaterial, instanceRepeatedMeshes, placeScenery, prepareScene, prepareStaticScenery } from "./materials";
import { createFountains } from "./fountains";
import { createHaze, createSun, hazeAmount, setupSky } from "./sky";

const fakeRenderer = () => ({
  toneMapping: NoToneMapping,
  outputColorSpace: SRGBColorSpace,
  library: new StandardNodeLibrary(),
  getMaxAnisotropy: () => 16,
});

function skyTexture() {
  const width = 16;
  const height = 8;
  const data = new Uint16Array(width * height * 4).fill(15360); // 1.0 as half float
  const texture = new DataTexture(data, width, height, RGBAFormat, HalfFloatType);
  texture.mapping = EquirectangularReflectionMapping;
  return texture;
}

describe("render pipeline graph", () => {
  for (const key of QUALITY_KEYS) {
    for (const variant of [
      { backdrop: false, photoMode: false },
      { backdrop: true, photoMode: true },
    ]) {
      it(`builds for ${key} (backdrop ${variant.backdrop}, photo ${variant.photoMode})`, () => {
        const post = buildPipeline({
          renderer: fakeRenderer(),
          scene: new Scene(),
          camera: new PerspectiveCamera(),
          preset: QUALITY_PRESETS[key],
          uniforms: createPipelineUniforms(),
          backdrop: variant.backdrop ? new Texture() : null,
          photoMode: variant.photoMode,
          reducedMotion: false,
        });
        expect(post.pipeline.outputNode).toBeTruthy();
        expect(post.pipeline.outputColorTransform).toBe(false);
        if (key === "max") expect(post.features).toEqual(expect.arrayContaining(["SSGI", "SSR", "TRAA"]));
        if (key === "balanced") expect(post.features).toContain("FXAA");
        post.dispose();
      });
    }
  }
});

describe("scene preparation", () => {
  it("handles water, flags, glass, lawn, paving and instancing by name", () => {
    const root = new Group();
    const shared = new BoxGeometry();
    const stone = new MeshStandardMaterial({ name: "Stone" });
    for (let i = 0; i < 4; i++) {
      const column = new Mesh(shared, stone);
      column.name = `Column_${i}`;
      column.position.x = i * 3;
      root.add(column);
    }
    const water = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
    water.name = "Water_Pond";
    const flag = new Mesh(new BoxGeometry(), new MeshStandardMaterial({ name: "Flag cloth" }));
    flag.name = "Flag_Korea";
    const glass = new Mesh(new BoxGeometry(), new MeshStandardMaterial({ name: "Window Glass" }));
    const lawn = new Mesh(new BoxGeometry(), new MeshStandardMaterial({ roughness: 0.5 }));
    lawn.name = "Lawn_Front";
    const paving = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
    paving.name = "Paving_Plaza";
    const fountain = new Group();
    fountain.name = "Fountain_Left";
    root.add(water, flag, glass, lawn, paving, fountain);

    const environment = { texture: skyTexture(), rotation: 0.5 };
    const result = prepareScene(root, { renderer: fakeRenderer(), time: uniform(0), windStrength: uniform(1), environment });
    expect(result.water).toEqual([water]);
    expect(result.fountains).toEqual([fountain]);
    expect(result.flags).toBe(1);
    expect(result.glass).toBe(1);
    expect(result.instanced).toBe(4);
    expect(flag.material.isNodeMaterial).toBe(true);
    expect(flag.material.positionNode).toBeTruthy();
    expect(glass.material.isMeshPhysicalNodeMaterial).toBe(true);
    expect(glass.material.envMap).toBe(environment.texture);
    expect(lawn.material.roughness).toBeGreaterThanOrEqual(0.92);
    expect(lawn.castShadow).toBe(false);
    expect(paving.material.userData.ssrStrength).toBeGreaterThan(0);
    expect(root.children.some((child) => child.isInstancedMesh && child.count === 4)).toBe(true);
  });

  it("treats the lobby shell as enclosed: never blocks the camera, casts nothing, little sky light", () => {
    const root = new Group();
    const shell = new Group();
    shell.name = "Interior_Shell";
    const floor = new Mesh(new BoxGeometry(), new MeshStandardMaterial({ name: "Interior_Floor" }));
    shell.add(floor);
    root.add(shell);
    prepareScene(root, { renderer: fakeRenderer(), time: uniform(0), windStrength: uniform(1) });
    expect(floor.userData.cameraBlocks).toBe(false);
    expect(floor.castShadow).toBe(false);
    expect(floor.receiveShadow).toBe(true);
    expect(floor.material.envMapIntensity).toBeLessThanOrEqual(0.2);
  });

  it("gives compressed (KTX2) textures the same anisotropic filtering as images", () => {
    const root = new Group();
    const map = new CompressedTexture([{ data: new Uint8Array(16), width: 4, height: 4 }], 4, 4);
    root.add(new Mesh(new BoxGeometry(), new MeshStandardMaterial({ map })));
    prepareScene(root, { renderer: fakeRenderer(), time: uniform(0), windStrength: uniform(1) });
    expect(map.anisotropy).toBe(16);
  });

  it("adds wind to vegetation materials", () => {
    const root = new Group();
    const leaves = new Mesh(new BoxGeometry(), new MeshStandardMaterial({ alphaTest: 0.5 }));
    root.add(leaves);
    prepareScene(root, { renderer: fakeRenderer(), time: uniform(0), windStrength: uniform(1), foliage: true });
    expect(leaves.material.positionNode).toBeTruthy();
    expect(leaves.material.alphaTest).toBe(0.5);
  });

  it("leaves fewer than three repeats alone", () => {
    const root = new Group();
    const geometry = new BoxGeometry();
    const material = new MeshStandardMaterial();
    root.add(new Mesh(geometry, material), new Mesh(geometry, material));
    expect(instanceRepeatedMeshes(root)).toBe(0);
  });
});

describe("water, fountains and sky", () => {
  it("builds both water materials", () => {
    const time = uniform(0);
    const environment = { texture: skyTexture(), rotation: 0 };
    expect(createWaterMaterial({ time, environment }).normalNode).toBeTruthy();
    const planar = createWaterMaterial({ time, reflectorNode: reflector({ resolutionScale: 0.5, bounces: false }), environment });
    expect(planar.emissiveNode).toBeTruthy();
    expect(planar.envMapIntensity).toBeLessThan(0.5);
  });

  it("builds fountain jets", () => {
    const emitter = new Group();
    emitter.name = "Fountain_A";
    emitter.userData.jetHeight = 6;
    const fountains = createFountains([emitter], { time: uniform(0), count: 100 });
    expect(fountains.sprites).toHaveLength(1);
    expect(fountains.sprites[0].count).toBe(100);
    fountains.setCount(50);
    expect(fountains.sprites[0].count).toBe(50);
    fountains.dispose();
  });

  it("takes the sun from colliders.json first and sets up haze", () => {
    const scene = new Scene();
    const hdr = skyTexture();
    const sky = setupSky(scene, { hdr, colliders: { sun: { azimuthDeg: 0, elevationDeg: 45 }, skyRotationDeg: 90 } });
    expect(sky.sunSource).toBe("colliders");
    expect(sky.sunDirection.z).toBeGreaterThan(0.6);
    expect(scene.environment).toBe(hdr);
    expect(scene.background).toBe(hdr);
    expect(scene.environmentRotation.y).toBeCloseTo(Math.PI / 2, 6);
    createHaze(scene, sky.hazeColor);
    expect(scene.fogNode).toBeTruthy();
  });
});

function sunnySkyTexture() {
  // Uniform sky of radiance 1 with a very bright sun texel about 40 degrees up.
  const width = 64;
  const height = 32;
  const data = new Float32Array(width * height * 4).fill(1);
  const i = (7 * width + 20) * 4;
  data[i] = data[i + 1] = data[i + 2] = 60000;
  const texture = new DataTexture(data, width, height, RGBAFormat);
  texture.mapping = EquirectangularReflectionMapping;
  return texture;
}

describe("sun, shade and haze balance", () => {
  it("keeps haze subtle at 150 m and mild at 400 m", () => {
    expect(hazeAmount(150)).toBeLessThan(0.03);
    expect(hazeAmount(400)).toBeGreaterThan(0.04);
    expect(hazeAmount(400)).toBeLessThan(0.1);
    expect(hazeAmount(400, 60)).toBeLessThan(hazeAmount(400));
  });

  it("moves the HDR sun into the shadow-casting light so shade stays shade", () => {
    const scene = new Scene();
    const hdr = sunnySkyTexture();
    const sky = setupSky(scene, { hdr, colliders: {} });
    expect(sky.sunSource).toBe("hdr");
    expect(scene.background).toBe(hdr);
    expect(scene.environment).not.toBe(hdr);
    expect(sky.clampedTexels).toBe(1);
    const i = (7 * 64 + 20) * 4;
    expect(scene.environment.image.data[i]).toBeLessThan(100);
    expect(hdr.image.data[i]).toBe(60000);
    // Sunlit horizontal paving vs shade: between about 3x and 5x.
    expect(1 + sky.sunRatio).toBeGreaterThanOrEqual(3.2);
    expect(1 + sky.sunRatio).toBeLessThanOrEqual(5);
    expect(sky.sunIntensity).toBeGreaterThan(sky.skyIrradiance);
  });
});

describe("cascaded shadows cover the walking area on every preset", () => {
  for (const key of QUALITY_KEYS) {
    it(key, () => {
      const scene = new Scene();
      const sun = createSun(scene, new Vector3(0.42, 0.72, 0.55).normalize(), QUALITY_PRESETS[key].shadows, { intensity: 5 });
      const camera = new PerspectiveCamera(50, 16 / 9, 0.3, 2500);
      // A follow camera behind an avatar on the avenue in front of the building, looking at its chest
      // (a fixed test vantage point, not the spawn from colliders.json).
      camera.position.set(0, 4.5, 155);
      camera.lookAt(0, 1.5, 146);
      camera.updateMatrixWorld();
      sun.csm._init({ camera, renderer: { coordinateSystem: WebGPUCoordinateSystem, reversedDepthBuffer: false } });
      sun.csm.updateBefore();

      const cascadeOf = (point) => sun.csm.lights.findIndex((light) => {
        light.shadow.updateMatrices(light);
        const cam = light.shadow.camera;
        const p = point.clone().applyMatrix4(cam.matrixWorldInverse);
        return p.x >= cam.left && p.x <= cam.right && p.y >= cam.bottom && p.y <= cam.top && -p.z >= cam.near && -p.z <= cam.far;
      });
      expect(sun.csm.lights).toHaveLength(QUALITY_PRESETS[key].shadows.cascades);
      expect(cascadeOf(new Vector3(0, 0, 146))).toBe(0); // the avatar's feet: finest cascade
      expect(cascadeOf(new Vector3(0, 1.8, 146))).toBe(0); // its head
      expect(cascadeOf(new Vector3(6, 0, 128))).toBeGreaterThanOrEqual(0); // a flagpole base ahead
      expect(cascadeOf(new Vector3(0, 0, 62))).toBeGreaterThanOrEqual(0); // the building front
      sun.dispose();
    });
  }
});

describe("instanced LOD vegetation", () => {
  function vegetationFile() {
    const root = new Group();
    const leaves = new MeshStandardMaterial({ name: "Pine needles", alphaTest: 0.5 });
    const bark = new MeshStandardMaterial({ name: "Bark" });
    for (const [lod, size] of [[0, 1], [1, 0.8], [2, 0.5]]) {
      const node = new Group();
      node.name = `VegLib_Pine_LOD${lod}`;
      const trunk = new Mesh(new BoxGeometry(0.4, 4 * size, 0.4), bark);
      const crown = new Mesh(new BoxGeometry(3, 6 * size, 3), leaves);
      node.add(trunk, crown);
      root.add(node);
    }
    const hedge = new Mesh(new BoxGeometry(4, 1.2, 1), new MeshStandardMaterial({ name: "Hedge leaves" }));
    hedge.name = "Hedge_01";
    root.add(hedge);
    return { scene: root, hedge };
  }

  const manifest = {
    units: "m",
    species: { Pine: { file: "vegetation-1.glb", lods: ["VegLib_Pine_LOD0", "VegLib_Pine_LOD1", "VegLib_Pine_LOD2"], lodDistancesM: [35, 110], heightM: 14 } },
    instances: { Pine: Array.from({ length: 120 }, (_, i) => [(i % 12) * 15 - 90, 0, Math.floor(i / 12) * 15, i * 0.3, 0.9 + (i % 5) * 0.05, (i % 7) / 6]) },
  };

  it("instances the library, never draws it at the origin, and keeps placed nodes", async () => {
    const { VegetationSystem } = await import("./vegetation");
    const { LAYERS } = await import("./layers");
    const system = new VegetationSystem({
      renderer: fakeRenderer(),
      time: uniform(0),
      windStrength: uniform(1),
      settings: QUALITY_PRESETS.high.vegetation,
      triangleBudget: QUALITY_PRESETS.high.triangleBudget,
    });
    const file = vegetationFile();
    const result = system.addFile("vegetation-1.glb", file, manifest);
    expect(result.species).toEqual(["Pine"]);
    expect(file.scene.getObjectByName("VegLib_Pine_LOD0")).toBeUndefined();
    expect(file.scene.getObjectByName("Hedge_01")).toBe(file.hedge);
    expect(file.hedge.material.positionNode).toBeTruthy(); // wind on placed foliage

    const camera = new PerspectiveCamera(50, 16 / 9, 0.3, 2500);
    camera.position.set(0, 2, -20);
    camera.lookAt(0, 2, 60);
    camera.updateMatrixWorld();
    system.update(camera);
    const stats = system.stats();
    expect(stats.species).toBe(1);
    expect(stats.drawn[0]).toBeLessThanOrEqual(QUALITY_PRESETS.high.vegetation.maxLod0);
    const drawn = stats.drawn.reduce((sum, value) => sum + value, 0);
    expect(drawn).toBeGreaterThan(0);
    expect(stats.culled.frustum + stats.culled.distance).toBeGreaterThan(0); // trees behind the camera are not drawn
    expect(stats.triangles).toBeGreaterThan(0);

    const meshes = system.group.children.filter((child) => child.isInstancedMesh);
    const view = meshes.filter((mesh) => mesh.layers.mask === 1 << LAYERS.vegetationView);
    const casters = meshes.filter((mesh) => mesh.layers.mask === 1 << LAYERS.vegetationShadow);
    const mirror = meshes.filter((mesh) => mesh.layers.mask === 1 << LAYERS.vegetationReflection);
    expect(view.every((mesh) => !mesh.castShadow)).toBe(true);
    expect(casters.length).toBeGreaterThan(0);
    expect(casters.every((mesh) => mesh.castShadow && mesh.name.includes("LOD2"))).toBe(true);
    expect(mirror.length).toBeGreaterThan(0);
    const leafDisplay = view.find((mesh) => mesh.name === "Pine LOD0" && mesh.instanceColor);
    expect(leafDisplay).toBeTruthy();
    expect(leafDisplay.material.positionNode).toBeTruthy(); // wind survives instancing
    // Only casters within the shadow distance (60 m on high) are in the shadow set.
    const casterCount = casters.find((mesh) => mesh.count > 0)?.count ?? 0;
    expect(casterCount).toBe(stats.shadowCasters);
    expect(casterCount).toBeLessThan(120);
    expect(casterCount).toBeGreaterThan(0);

    // Over its own budget (vegetation passes only) the distances shrink.
    const meshCount = system.instancedMeshes.length;
    system.setSettings(QUALITY_PRESETS.high.vegetation, 100); // the test boxes have a few dozen triangles
    for (let i = 0; i < 9; i++) {
      camera.position.x += 0.5;
      camera.updateMatrixWorld();
      system.update(camera); // the selection runs every few frames
    }
    expect(system.stats().budgetScale).toBeLessThan(1);

    // Balanced: the reflection set stays empty; no mesh is created or removed by a preset change.
    system.setSettings(QUALITY_PRESETS.balanced.vegetation, QUALITY_PRESETS.balanced.triangleBudget);
    system.update(camera);
    expect(system.instancedMeshes.length).toBe(meshCount);
    expect(system.group.children.filter((c) => c.isInstancedMesh && c.layers.mask === 1 << LAYERS.vegetationReflection && c.count > 0)).toHaveLength(0);

    // Priming shows one instance of every mesh, unculled, until the selection takes over again.
    system.beginPrime(new Vector3(0, 0, 0));
    expect(system.instancedMeshes.every((mesh) => mesh.visible && mesh.count === 1 && !mesh.frustumCulled)).toBe(true);
    system.update(camera); // paused while priming
    expect(system.instancedMeshes.every((mesh) => mesh.count === 1)).toBe(true);
    system.endPrime();
    system.update(camera);
    expect(system.instancedMeshes.every((mesh) => mesh.frustumCulled)).toBe(true);
    system.dispose();
  });

  it("keeps rigid species (wind 0) free of any wind node, and scales the others", async () => {
    const { VegetationSystem } = await import("./vegetation");
    const system = new VegetationSystem({ renderer: fakeRenderer(), time: uniform(0), windStrength: uniform(1), settings: QUALITY_PRESETS.high.vegetation });
    const rigid = {
      ...manifest,
      species: { Pine: { ...manifest.species.Pine, wind: 0 } },
    };
    system.addFile("vegetation-1.glb", vegetationFile(), rigid);
    const meshes = system.group.children.filter((child) => child.isInstancedMesh);
    expect(meshes.length).toBeGreaterThan(0);
    expect(meshes.every((mesh) => !mesh.material.positionNode)).toBe(true);
    const swaying = new VegetationSystem({ renderer: fakeRenderer(), time: uniform(0), windStrength: uniform(1), settings: QUALITY_PRESETS.high.vegetation });
    swaying.addFile("vegetation-1.glb", vegetationFile(), { ...manifest, species: { Pine: { ...manifest.species.Pine, wind: 0.5 } } });
    expect(swaying.group.children.filter((c) => c.isInstancedMesh).every((mesh) => mesh.material.positionNode)).toBe(true);
    system.dispose();
    swaying.dispose();
  });
});

describe("static scenery", () => {
  it("casts and receives shadows, keeps names and materials, no instancing", () => {
    const root = new Group();
    const material = new MeshStandardMaterial({ map: new Texture() });
    const geometry = new BoxGeometry();
    for (let i = 0; i < 4; i++) {
      const statue = new Mesh(geometry, material);
      statue.name = `Water_Haetae_${i}`; // name-based rules must not apply to scenery
      root.add(statue);
    }
    const result = prepareStaticScenery(root, { renderer: fakeRenderer() });
    expect(result.meshes).toBe(4);
    expect(root.children.every((mesh) => mesh.isMesh && !mesh.isInstancedMesh && mesh.castShadow && mesh.receiveShadow)).toBe(true);
    expect(root.children[0].material).toBe(material);
    expect(material.map.anisotropy).toBe(16);
  });

  it("keeps authored double-sided and alpha-clipped materials, clipped cards cast from both sides", () => {
    const timber = new MeshStandardMaterial({ side: DoubleSide });
    const lattice = new MeshStandardMaterial({ alphaTest: 0.5, side: FrontSide });
    const tiles = new MeshStandardMaterial();
    const root = new Group();
    for (const material of [timber, lattice, tiles]) root.add(new Mesh(new BoxGeometry(), material));
    prepareStaticScenery(root, { renderer: fakeRenderer() });
    expect(timber.side).toBe(DoubleSide);
    expect(lattice.alphaTest).toBe(0.5);
    expect(lattice.side).toBe(FrontSide);
    expect(lattice.shadowSide).toBe(DoubleSide);
    expect(tiles.shadowSide).toBeNull();
  });

  it("places a file by its scenery.json entry with any yaw, others as they are", () => {
    const gate = new Group();
    gate.add(new Mesh(new BoxGeometry()));
    const placed = placeScenery(gate, { position: [12, 0.5, -40], yawDeg: 37 }, "scenery-gate-1.glb");
    expect(placed).not.toBe(gate);
    expect(placed.children[0]).toBe(gate);
    expect(placed.position.toArray()).toEqual([12, 0.5, -40]);
    expect(placed.rotation.y).toBeCloseTo((37 * Math.PI) / 180, 9);
    const statue = new Group();
    expect(placeScenery(statue, undefined, "scenery-1.glb")).toBe(statue);
  });
});
