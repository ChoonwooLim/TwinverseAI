#!/usr/bin/env node
// Checks a space's runtime GLBs the way the viewer uses them, with three.js's own GLTFLoader and
// meshopt decoder (the runtime decoder, not the encoder's): every file parses, the scenery placed
// per scenery.json blocks the camera at every collision probe, static merging gives the same draw
// calls, vegetation library nodes keep their size and triangles, door leaves keep their pivots.
// With --source, every figure is compared with the delivered files.
//
//   node scripts/spaces/check-assets.mjs [--dir <runtime dir>] [--source <delivered dir>]
//
// Exits with code 1 if any check fails. Textures are not decoded (geometry only).
import { existsSync, readFileSync, readdirSync } from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseGlb, viewBytes, writeGlb } from "./lib/glb.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../..");
const frontend = join(repo, "frontend");

export const SPACE = {
  runtime: join(frontend, "src/spaces/national-assembly/assets"),
  probes: join(frontend, "src/spaces/national-assembly/collisionProbes.js"),
};

/** Position tolerance between delivered and optimised geometry (m). */
const BOUNDS_TOLERANCE = 0.0005;
const PROBE_TOLERANCE = 0.001;

async function loadThree() {
  globalThis.self ??= globalThis;
  const require = createRequire(join(frontend, "package.json"));
  const url = (spec) => pathToFileURL(require.resolve(spec)).href;
  const THREE = await import(url("three/webgpu"));
  const { GLTFLoader } = await import(url("three/addons/loaders/GLTFLoader.js"));
  const { MeshoptDecoder } = await import(url("three/addons/libs/meshopt_decoder.module.js"));
  const { CameraCollider } = await import(pathToFileURL(join(frontend, "src/spaces/engine/cameraCollision.js")).href);
  const { mergeStaticMeshesNow } = await import(pathToFileURL(join(frontend, "src/spaces/engine/staticMerge.js")).href);
  const { COLLISION_PROBES } = await import(pathToFileURL(SPACE.probes).href);
  await MeshoptDecoder.ready;
  return { THREE, GLTFLoader, MeshoptDecoder, CameraCollider, mergeStaticMeshesNow, COLLISION_PROBES };
}

/**
 * three.js's own Basis transcoder (the files the viewer serves), loaded the way KTX2Loader does:
 * the wrapper source is evaluated and given the WebAssembly binary.
 */
async function threeTranscoder() {
  const dir = join(frontend, "node_modules/three/examples/jsm/libs/basis");
  const context = { console, WebAssembly, performance, TextDecoder, URL, setTimeout, clearTimeout };
  vm.createContext(context);
  vm.runInContext(`${readFileSync(join(dir, "basis_transcoder.js"), "utf8")}
this.BASIS = BASIS;`, context);
  const module = await context.BASIS({ wasmBinary: readFileSync(join(dir, "basis_transcoder.wasm")) });
  module.initializeBasis();
  return module;
}

/** Every KTX2 image transcodes to BC7 with three.js's transcoder (first and last mip level). */
async function checkKtx2Images(dir) {
  const files = readdirSync(dir).filter((name) => name.endsWith(".glb")).sort();
  let transcoder = null;
  let count = 0;
  const failures = [];
  for (const name of files) {
    const { json, bin } = parseGlb(new Uint8Array(readFileSync(join(dir, name))));
    for (const [index, image] of (json.images ?? []).entries()) {
      if (image.uri && !existsSync(join(dir, image.uri))) {
        failures.push(`${name} image ${index}: ${image.uri} is missing`);
        continue;
      }
      if (image.mimeType !== "image/ktx2") continue;
      transcoder ??= await threeTranscoder();
      const data = image.uri ? new Uint8Array(readFileSync(join(dir, image.uri))) : viewBytes(json, bin, image.bufferView);
      const file = new transcoder.KTX2File(data);
      try {
        const format = transcoder.transcoder_texture_format.cTFBC7_RGBA.value;
        if (!file.isValid() || !file.startTranscoding()) throw new Error("not a valid KTX2 file");
        // Block formats need whole 4x4 blocks at the base level (WebGL refuses, WebGPU fails validation).
        if (file.getWidth() % 4 || file.getHeight() % 4) throw new Error(`${file.getWidth()} x ${file.getHeight()} is not a multiple of 4`);
        for (const level of [0, file.getLevels() - 1]) {
          const out = new Uint8Array(file.getImageTranscodedSizeInBytes(level, 0, 0, format));
          if (!file.transcodeImage(out, level, 0, 0, format, 0, -1, -1)) throw new Error(`level ${level} did not transcode`);
        }
        count++;
      } catch (error) {
        failures.push(`${name} image ${index} (${image.name ?? ""}): ${error.message}`);
      } finally {
        file.close();
        file.delete();
      }
    }
  }
  return { count, failures };
}

/** The GLB without any image or texture reference, so it parses in Node. */
function geometryOnly(bytes) {
  const { json, bin } = parseGlb(bytes);
  const strip = (value) => {
    if (Array.isArray(value)) return value.map(strip);
    if (!value || typeof value !== "object") return value;
    const out = {};
    for (const [key, entry] of Object.entries(value)) {
      if (/Texture$/.test(key) || key === "extensions") continue;
      out[key] = strip(entry);
    }
    return out;
  };
  json.materials = (json.materials ?? []).map(strip);
  delete json.images;
  delete json.textures;
  delete json.samplers;
  const textureExtensions = /^(EXT_texture_webp|KHR_texture_basisu|KHR_texture_transform|EXT_texture_avif|KHR_materials_)/;
  json.extensionsUsed = (json.extensionsUsed ?? []).filter((name) => !textureExtensions.test(name));
  json.extensionsRequired = (json.extensionsRequired ?? []).filter((name) => !textureExtensions.test(name));
  return writeGlb(json, bin);
}

async function parse(lib, bytes) {
  const data = geometryOnly(bytes);
  const loader = new lib.GLTFLoader().setMeshoptDecoder(lib.MeshoptDecoder);
  return new Promise((ok, fail) => loader.parse(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), "", ok, fail));
}

const readJson = (dir, name) => JSON.parse(readFileSync(join(dir, name), "utf8"));

function triangleCount(root) {
  let count = 0;
  root.traverse((object) => {
    if (!object.isMesh || !object.geometry) return;
    const g = object.geometry;
    count += (g.index ? g.index.count : g.attributes.position.count) / 3;
  });
  return Math.round(count);
}

/** Everything the viewer derives from one directory of GLBs. */
async function measureDir(lib, dir, manifests) {
  const { THREE } = lib;
  const files = readdirSync(dir).filter((name) => name.endsWith(".glb")).sort();
  const scenery = manifests.scenery?.placements ?? {};
  const optional = manifests.scenery?.optional ?? {};
  const result = { files: {}, probes: {}, vegetation: {}, doors: {} };
  const collider = new lib.CameraCollider();
  const leafNames = new Set(Object.values(scenery).flatMap((p) => (p.doors ?? []).flatMap((d) => (d.leaves ?? []).map((l) => l.node))));
  for (const name of files) {
    const gltf = await parse(lib, readFileSync(join(dir, name)));
    const root = gltf.scene;
    const placement = scenery[name] ?? optional[name] ?? null;
    const holder = new THREE.Group();
    if (placement?.position) holder.position.set(...placement.position);
    if (placement?.yawDeg) holder.rotation.y = (placement.yawDeg * Math.PI) / 180;
    holder.add(root);
    holder.updateWorldMatrix(true, true);
    root.traverse((object) => {
      if (leafNames.has(object.name)) object.userData.cameraDynamic = true;
    });
    const bounds = {};
    const seen = new Map();
    root.traverse((object) => {
      if (!object.name || object === root) return;
      const box = new THREE.Box3().setFromObject(object);
      const key = seen.has(object.name) ? `${object.name}#${seen.get(object.name) + 1}` : object.name;
      seen.set(object.name, (seen.get(object.name) ?? 0) + 1);
      if (!box.isEmpty()) bounds[key] = [...box.min.toArray(), ...box.max.toArray()];
    });
    // Door leaves: pivot transforms as authored.
    root.traverse((object) => {
      if (leafNames.has(object.name)) {
        let meshes = 0;
        object.traverse((o) => { if (o.isMesh) meshes++; });
        result.doors[object.name] = { matrix: object.matrix.toArray(), meshes };
      }
    });
    // Vegetation library levels: bounds relative to the level node, as vegetation.js computes them.
    for (const [species, entry] of Object.entries(manifests.vegetation?.species ?? {})) {
      if (entry?.file !== name) continue;
      for (const lodName of entry.lods ?? []) {
        let node = null;
        root.traverse((object) => { if (!node && object.name === lodName) node = object; });
        if (!node) continue;
        const inverse = new THREE.Matrix4().copy(node.matrixWorld).invert();
        const box = new THREE.Box3();
        node.traverse((object) => {
          if (!object.isMesh) return;
          object.geometry.computeBoundingBox();
          box.union(object.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, object.matrixWorld)));
        });
        result.vegetation[lodName] = { species, triangles: triangleCount(node), box: [...box.min.toArray(), ...box.max.toArray()] };
      }
    }
    const triangles = triangleCount(root);
    if (!name.startsWith("vegetation") && name !== "avatar.glb") collider.addRoot(root);
    const skip = (mesh) => {
      for (let n = mesh; n; n = n.parent) if (/^(Water_|Flag_|Fountain_)/.test(n.name ?? "") || n.userData?.cameraDynamic) return true;
      return false;
    };
    // As vegetation.js does: library nodes are instanced, never drawn (or merged) where authored.
    const library = [];
    root.traverse((object) => {
      if (/^VegLib_/.test(object.name ?? "") && !/^VegLib_/.test(object.parent?.name ?? "")) library.push(object);
    });
    for (const node of library) node.removeFromParent();
    const merge = lib.mergeStaticMeshesNow(root, { skip });
    result.files[name] = { triangles, bounds, merged: merge };
  }
  while (collider.building) collider.build(1000);
  for (const probe of lib.COLLISION_PROBES) {
    const [hit] = collider.castRays([{ origin: new THREE.Vector3(...probe.from), end: new THREE.Vector3(...probe.to) }]);
    result.probes[probe.name] = Number.isFinite(hit) ? hit : null;
  }
  return result;
}

function maxBoundsDelta(a, b) {
  let max = 0;
  for (let i = 0; i < 6; i++) max = Math.max(max, Math.abs(a[i] - b[i]));
  return max;
}

/**
 * Runs the checks on `dir` (and compares with `source` when given).
 * @returns {Promise<{ ok: boolean, lines: string[], summary: object }>}
 */
export async function checkAssets({ dir = SPACE.runtime, source = null, manifestDir = SPACE.runtime, manifestPaths = {} } = {}) {
  const lib = await loadThree();
  const manifest = (name) => (manifestPaths[name] ? JSON.parse(readFileSync(manifestPaths[name], "utf8")) : readJson(manifestDir, name));
  const manifests = { scenery: manifest("scenery.json"), vegetation: manifest("vegetation.json") };
  const quiet = { error: console.error, warn: console.warn };
  console.error = () => {};
  console.warn = () => {};
  let after;
  let before = null;
  try {
    after = await measureDir(lib, dir, manifests);
    if (source) before = await measureDir(lib, source, manifests);
  } finally {
    console.error = quiet.error;
    console.warn = quiet.warn;
  }
  const lines = [];
  let ok = true;
  const fail = (text) => {
    ok = false;
    lines.push(`FAIL ${text}`);
  };
  const ktx2 = await checkKtx2Images(dir);
  for (const failure of ktx2.failures) fail(`KTX2 ${failure}`);
  if (ktx2.count || ktx2.failures.length) lines.push(`KTX2 textures: ${ktx2.count} transcode to BC7 with three.js's transcoder (first and last mip)`);
  for (const [name, hit] of Object.entries(after.probes)) {
    if (hit === null) fail(`collision probe "${name}" hits nothing`);
    else if (before && before.probes[name] !== null && Math.abs(hit - before.probes[name]) > PROBE_TOLERANCE) fail(`collision probe "${name}" moved: ${before.probes[name].toFixed(4)} -> ${hit.toFixed(4)} m`);
  }
  lines.push(`collision probes: ${Object.values(after.probes).filter((h) => h !== null).length}/${Object.keys(after.probes).length} hit`);
  for (const [leaf, door] of Object.entries(after.doors)) {
    if (!door.meshes) fail(`door leaf ${leaf} has no mesh below it`);
    const was = before?.doors[leaf];
    if (was && Math.max(...door.matrix.map((v, i) => Math.abs(v - was.matrix[i]))) > 1e-6) fail(`door leaf ${leaf} pivot changed`);
  }
  const leaves = Object.values(manifests.scenery?.placements ?? {}).flatMap((p) => (p.doors ?? []).flatMap((d) => (d.leaves ?? []).map((l) => l.node)));
  for (const leaf of leaves) if (!after.doors[leaf]) fail(`door leaf ${leaf} not found`);
  lines.push(`door leaves: ${Object.keys(after.doors).length}/${leaves.length} found with their pivots`);
  let worstBounds = { delta: 0, node: "" };
  let mergeLine = [];
  for (const [name, file] of Object.entries(after.files)) {
    const was = before?.files[name];
    if (!was) continue;
    if (file.triangles !== was.triangles) fail(`${name}: triangles ${was.triangles} -> ${file.triangles}`);
    // Draw calls must not grow; a mesh centred exactly on a 60 m merge-cell boundary may change
    // cells over sub-millimetre noise, which can only regroup, so equality is not required.
    if (file.merged.before !== was.merged.before || file.merged.after > was.merged.after) fail(`${name}: static merge ${was.merged.before}->${was.merged.after} became ${file.merged.before}->${file.merged.after}`);
    mergeLine.push(`${name} ${file.merged.before}->${file.merged.after}`);
    for (const [node, box] of Object.entries(file.bounds)) {
      if (!was.bounds[node]) {
        fail(`${name}: node ${node} has geometry now but had none`);
        continue;
      }
      const delta = maxBoundsDelta(box, was.bounds[node]);
      if (delta > worstBounds.delta) worstBounds = { delta, node: `${name}:${node}` };
    }
    for (const node of Object.keys(was.bounds)) if (!file.bounds[node]) fail(`${name}: node ${node} lost its geometry`);
  }
  if (before) {
    if (worstBounds.delta > BOUNDS_TOLERANCE) fail(`world bounds moved by ${(worstBounds.delta * 1000).toFixed(3)} mm at ${worstBounds.node}`);
    lines.push(`world bounds of every named node: largest change ${(worstBounds.delta * 1000).toFixed(3)} mm${worstBounds.node ? ` (${worstBounds.node})` : ""}`);
    lines.push(`static merge (meshes before -> after merging): ${mergeLine.join(", ")}`);
  }
  let worstVeg = 0;
  for (const [lod, entry] of Object.entries(after.vegetation)) {
    const was = before?.vegetation[lod];
    if (!was) continue;
    if (entry.triangles !== was.triangles) fail(`${lod}: triangles ${was.triangles} -> ${entry.triangles}`);
    worstVeg = Math.max(worstVeg, maxBoundsDelta(entry.box, was.box));
  }
  const expectedLods = Object.values(manifests.vegetation?.species ?? {}).flatMap((s) => s.lods ?? []);
  const missing = expectedLods.filter((lod) => before ? before.vegetation[lod] && !after.vegetation[lod] : !after.vegetation[lod]);
  for (const lod of missing) fail(`vegetation level ${lod} not found`);
  if (before && worstVeg > BOUNDS_TOLERANCE) fail(`vegetation level bounds moved by ${(worstVeg * 1000).toFixed(3)} mm`);
  lines.push(`vegetation levels: ${Object.keys(after.vegetation).length} found${before ? `, largest bounds change ${(worstVeg * 1000).toFixed(3)} mm` : ""}`);
  return { ok, lines, summary: { probes: after.probes, files: Object.fromEntries(Object.entries(after.files).map(([n, f]) => [n, { triangles: f.triangles, merged: f.merged }])) } };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (flag) => {
    const i = process.argv.indexOf(flag);
    return i > 0 ? process.argv[i + 1] : null;
  };
  const result = await checkAssets({ dir: arg("--dir") ?? SPACE.runtime, source: arg("--source") });
  for (const line of result.lines) console.log(line);
  console.log(result.ok ? "check-assets: all checks passed" : "check-assets: FAILED");
  process.exit(result.ok ? 0 : 1);
}
