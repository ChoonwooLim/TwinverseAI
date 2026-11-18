#!/usr/bin/env node
// Asset pipeline for a walkable space: delivered GLBs (never edited) -> optimised runtime GLBs.
//
//   node scripts/spaces/optimize-assets.mjs --source <delivered dir> [--out <runtime dir>]
//                                           [--only a.glb,b.glb] [--dry-run] [--no-check]
//                                           [--install-manifest vegetation.json,...]
//                                           [--no-textures] [--workers N]
//
// Run `npm install` in scripts/spaces once (pinned dev-only tools; nothing here ships in the page).
// Deterministic: the same delivery gives byte-identical output. Steps per file:
//   1. read with gltf-transform (meshopt-compressed deliveries are decoded),
//   2. reorder vertices and indices for compression (meshoptimizer, lossless),
//   3. textures to KTX2 / Basis Universal with mips (lib/ktx2.mjs): hero textures (config.hero)
//      keep their size and get the strongest UASTC rate-distortion step that meets the hero
//      thresholds; all others are right-sized to the texel-density caps (lib/density.mjs) and
//      encoded ETC1S (UASTC only for config.uastcOverrides). Every candidate is decoded and
//      measured; results are cached by content under scripts/spaces/.cache, so a re-run only
//      encodes what changed. Textures are written as content-addressed files in the runtime
//      folder's textures/ (the GLBs reference them), so an image shared by several files is stored,
//      downloaded and uploaded once; no runtime file may exceed config.maxFileBytes,
//   4. EXT_meshopt_compression with per-accessor precision (lib/meshopt-glb.mjs); every compressed
//      view is decoded again and checked against its tolerance,
//   5. node, mesh and material names compared with the delivery (any loss fails the run), plus the
//      names the viewer looks up (scenery.json, vegetation.json, code prefixes),
// then the whole set is checked the way the viewer uses it (check-assets.mjs, three.js's decoder):
// collision probes, static merge counts, vegetation levels, door pivots, world bounds. Only when
// everything passes are the files copied into the runtime folder (unchanged files are not
// rewritten). A before/after table is printed and saved under scripts/spaces/reports/.
// Exit code 1 on any failure; the runtime folder is then left untouched.
//
// JSON manifests in the runtime folder (scenery.json, vegetation.json, colliders.json) carry hand
// edits and are never written, except a manifest named with --install-manifest: it is then read
// from the delivery for every check and copied into the runtime folder together with the GLBs.
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { NodeIO, VertexLayout } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { reorder } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";
import config, { GEOMETRY_PROFILES } from "./national-assembly.config.mjs";
import { checkAssets } from "./check-assets.mjs";
import { glbNames, glbStats, parseGlb } from "./lib/glb.mjs";
import { compressGlb } from "./lib/meshopt-glb.mjs";
import { ktx2GpuBytes } from "./lib/ktx2.mjs";
import { TexturePool, defaultWorkers } from "./lib/texture-pool.mjs";
import { applyKtx2, finishTextureExtensions, textureJobs } from "./lib/textures.mjs";
import { densityUses, rightSize, walkGrid } from "./lib/density.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../..");

const args = process.argv.slice(2);
const option = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
};
const sourceDir = option("--source") ? resolve(option("--source")) : null;
const outDir = resolve(repo, option("--out") ?? config.out);
const only = option("--only") ? new Set(option("--only").split(",")) : null;
const dryRun = args.includes("--dry-run");
const skipCheck = args.includes("--no-check");
const skipTextures = args.includes("--no-textures");
const workerCount = option("--workers") ? Math.max(1, Number(option("--workers"))) : defaultWorkers();
const installManifests = option("--install-manifest") ? option("--install-manifest").split(",") : [];
for (const name of installManifests) {
  if (!Object.values(config.manifests).includes(name)) {
    console.error(`--install-manifest: ${name} is not one of ${Object.values(config.manifests).join(", ")}`);
    process.exit(2);
  }
}
if (!sourceDir || !existsSync(sourceDir)) {
  console.error("usage: node scripts/spaces/optimize-assets.mjs --source <delivered dir> [--out <runtime dir>] [--only a.glb,b.glb] [--dry-run] [--no-check]");
  process.exit(2);
}

const MB = (n) => (n / 1048576).toFixed(2);
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const quiet = { warn: () => {}, info: () => {}, debug: () => {}, error: (...a) => console.error(...a) };

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder })
  .setVertexLayout(VertexLayout.SEPARATE);

// ── Names the viewer needs ──
const manifestPath = (name) => join(installManifests.includes(name) ? sourceDir : outDir, name);
const readManifest = (name) => {
  const path = manifestPath(name);
  if (installManifests.includes(name) && !existsSync(path)) {
    console.error(`--install-manifest: ${path} does not exist`);
    process.exit(2);
  }
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null;
};
const scenery = readManifest(config.manifests.scenery);
const vegetation = readManifest(config.manifests.vegetation);

/** Node names that this file must provide, from the manifests. */
function manifestNames(file) {
  const names = new Set();
  const placement = scenery?.placements?.[file] ?? scenery?.optional?.[file];
  for (const door of placement?.doors ?? []) for (const leaf of door.leaves ?? []) names.add(leaf.node);
  for (const name of placement?.hide ?? []) names.add(name);
  for (const entry of Object.values(vegetation?.species ?? {})) if (entry?.file === file) for (const lod of entry.lods ?? []) names.add(lod);
  return names;
}

function countMap(list) {
  const map = new Map();
  for (const name of list) map.set(name, (map.get(name) ?? 0) + 1);
  return map;
}

/** Problems with names: anything the delivery had that the output lost, and required names. */
function nameProblems(file, sourceJson, outJson) {
  const problems = [];
  const warnings = [];
  const before = glbNames(sourceJson);
  const after = glbNames(outJson);
  for (const kind of ["nodes", "meshes", "materials"]) {
    const have = countMap(after[kind]);
    for (const [name, count] of countMap(before[kind])) {
      if ((have.get(name) ?? 0) < count) problems.push(`${kind.slice(0, -1)} "${name}" lost (${count} -> ${have.get(name) ?? 0})`);
    }
  }
  const outNodes = new Set(after.nodes);
  const sourceNodes = new Set(before.nodes);
  for (const name of [...manifestNames(file), ...config.requiredNames]) {
    if (outNodes.has(name)) continue;
    if (sourceNodes.has(name)) problems.push(`required node "${name}" lost`);
    else if (manifestNames(file).has(name)) warnings.push(`manifest names node "${name}", which the delivery does not contain`);
  }
  const prefixed = after.nodes.filter((name) => config.requiredPrefixes.some((prefix) => name.startsWith(prefix)));
  return { problems, warnings, prefixed: prefixed.length, manifest: [...manifestNames(file)].filter((n) => outNodes.has(n)).length };
}

/** Largest decoded error per use (position in m, texcoord in uv units, normal in unit length). */
function precisionSummary(accessors) {
  const summary = {};
  for (const a of accessors) {
    const key = a.use.startsWith("TEXCOORD") ? "texcoord" : a.use.startsWith("COLOR") ? "color" : a.use.split("/")[0].toLowerCase();
    const entry = (summary[key] ??= { filter: new Set(), bits: new Set(), maxError: 0, decoded: 0, compressed: 0 });
    entry.filter.add(a.filter);
    if (a.bits) entry.bits.add(a.bits);
    entry.maxError = Math.max(entry.maxError, a.maxError);
    entry.decoded += a.decoded;
    entry.compressed += a.compressed;
  }
  return Object.fromEntries(Object.entries(summary).map(([k, v]) => [k, { filter: [...v.filter].join("+"), bits: [...v.bits].sort((a, b) => a - b), maxError: v.maxError, decoded: v.decoded, compressed: v.compressed }]));
}

// ── Run ──
const work = mkdtempSync(join(tmpdir(), `space-assets-${config.name}-`));
const files = readdirSync(sourceDir).filter((name) => name.endsWith(".glb") && (!only || only.has(name))).sort();
const rows = [];
const textureRows = [];
const textureFiles = new Map(); // file name -> bytes (content-addressed, shared between GLBs)
let failed = false;
const started = Date.now();
const imageExtension = { "image/ktx2": "ktx2", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
const externalImage = (bytes, mimeType) => {
  const name = `${createHash("sha256").update(bytes).digest("hex").slice(0, 24)}.${imageExtension[mimeType] ?? "bin"}`;
  if (!textureFiles.has(name)) textureFiles.set(name, new Uint8Array(bytes));
  return `${config.textureDir}/${name}`;
};
const resolveImage = (uri) => {
  const name = uri.split("/").pop();
  if (textureFiles.has(name)) return textureFiles.get(name);
  const runtime = join(outDir, config.textureDir, name);
  return existsSync(runtime) ? new Uint8Array(readFileSync(runtime)) : null;
};
const statsOptions = { ktx2GpuBytes, resolveImage };

// Walking floors for the density rule (the runtime walking data: colliders.json and its grids).
let grid = null;
if (!skipTextures) {
  const colliders = JSON.parse(readFileSync(join(outDir, "colliders.json"), "utf8"));
  const { decodeHeightfield, heightfieldList } = await import(pathToFileURL(join(repo, "frontend/src/spaces/heightfield.js")).href);
  const grids = heightfieldList(colliders).map((meta) => decodeHeightfield(readFileSync(join(outDir, meta.file)), meta));
  grid = await walkGrid(join(repo, "frontend"), { ...colliders, heightfields: grids });
  console.log(`Walking floor: ${grid.reachableCells.toLocaleString("en-US")} reachable 1 m cells from the spawn.`);
}

// 1. Read every file, reorder its geometry, list its textures with their roles and target sizes.
const loaded = [];
for (const file of files) {
  const sourceBytes = new Uint8Array(readFileSync(join(sourceDir, file)));
  const document = await io.readBinary(sourceBytes);
  document.setLogger(quiet);
  for (const extension of document.getRoot().listExtensionsUsed()) {
    if (extension.extensionName === "EXT_meshopt_compression") extension.dispose();
  }
  await document.transform(reorder({ encoder: MeshoptEncoder, target: "size" }));
  const overrides = new Set(config.uastcOverrides);
  const jobs = skipTextures ? [] : textureJobs(document, { isHero: (material) => config.hero(material, file), isOverride: (name) => overrides.has(name) });
  if (jobs.length) {
    const placement = scenery?.placements?.[file] ?? scenery?.optional?.[file];
    const vegetationLevel = (node) => {
      for (let n = node; n; n = n.getParentNode?.() ?? null) {
        const match = /^VegLib_.+_LOD(\d+)$/.exec(n.getName());
        if (match) return Number(match[1]) === 0 ? "near" : "distant";
      }
      return null;
    };
    const uses = densityUses(document, {
      offset: placement?.position ?? [0, 0, 0],
      grid,
      nearM: config.density.nearM,
      distantM: config.density.distantM,
      classOf: file.startsWith("vegetation") ? (node) => vegetationLevel(node) ?? "near" : null,
    });
    for (const job of jobs) {
      if (job.skip || job.hero || job.override) continue;
      const size = job.texture.getSize() ?? [0, 0];
      const plan = rightSize(size, uses.get(job.texture), config.density);
      job.density = { ...plan, size };
      if (plan.scale < 1) job.resize = [Math.max(4, Math.round(size[0] * plan.scale)), Math.max(4, Math.round(size[1] * plan.scale))];
    }
  }
  loaded.push({ file, sourceJson: parseGlb(sourceBytes).json, before: glbStats(sourceBytes), document, jobs });
}

// 2. Encode every texture (in parallel, cached, each distinct image and target once).
if (!skipTextures) {
  const pool = new TexturePool({ cacheDir: join(here, ".cache", "textures"), workers: workerCount });
  const all = loaded.flatMap((entry) => entry.jobs.filter((job) => !job.skip).map((job) => ({ entry, job })));
  console.log(`Encoding ${all.length} textures to KTX2 with up to ${pool.size} workers (cached results are reused)...`);
  let done = 0;
  const t0 = Date.now();
  await Promise.all(all.map(async ({ entry, job }) => {
    const source = job.texture.getImage();
    const sourceMime = job.texture.getMimeType();
    const result = await pool.encode(source, { role: job.role, srgb: job.srgb, alphaCutoff: job.alphaCutoff, channels: job.channels, resize: job.resize ?? null });
    applyKtx2(entry.document, job, result.bytes);
    textureRows.push({
      file: entry.file, texture: job.name, role: job.role, hero: job.hero, override: job.override, slots: job.slots,
      sourceSize: result.sourceSize ?? null, width: result.width, height: result.height, density: job.density ?? null,
      sourceBytes: source.byteLength, sourceMime, bytes: result.bytes.byteLength, candidate: result.candidate,
      passed: result.passed, gpu: ktx2GpuBytes(result.bytes), cached: result.cached, trials: result.trials,
    });
    done++;
    if (done % 40 === 0 || done === all.length) console.log(`  ${done}/${all.length} textures (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  }));
  await pool.close();
  textureRows.sort((a, b) => a.file.localeCompare(b.file) || a.texture.localeCompare(b.texture));
  for (const entry of loaded) {
    finishTextureExtensions(entry.document);
    for (const job of entry.jobs) if (job.skip && job.skip !== "already KTX2") console.log(`  ${entry.file}: texture "${job.name}" left as it is: ${job.skip}`);
  }
}

// 3. Geometry, names, write (textures go to their own content-addressed files).
for (const { file, sourceJson, before, document } of loaded) {
  const t0 = Date.now();
  const plain = await io.writeBinary(document);
  const profileName = config.geometryProfile(file);
  const { glb, accessors } = compressGlb(plain, { ...GEOMETRY_PROFILES[profileName], encoder: MeshoptEncoder, decoder: MeshoptDecoder }, { externalImage });
  const after = glbStats(glb, statsOptions);
  const names = nameProblems(file, sourceJson, parseGlb(glb).json);
  if (after.triangles !== before.triangles) names.problems.push(`triangles ${before.triangles} -> ${after.triangles}`);
  if (glb.byteLength > config.maxFileBytes) names.problems.push(`GLB is ${MB(glb.byteLength)} MB, over the ${MB(config.maxFileBytes)} MB file limit`);
  if (names.problems.length) failed = true;
  writeFileSync(join(work, file), glb);
  rows.push({ file, profile: profileName, before, after, sha256: sha256(glb), names, precision: precisionSummary(accessors), seconds: (Date.now() - t0) / 1000 });
  console.log(`${file}: ${MB(before.fileBytes)} -> ${MB(after.fileBytes)} MB GLB (images ${MB(before.imageBytes)} -> ${MB(after.imageBytes)} referenced, geometry ${MB(before.geometryBytes)} -> ${MB(after.geometryBytes)}, GPU textures ${MB(before.gpuTextureBytes)} -> ${MB(after.gpuTextureBytes)})${names.problems.length ? `  PROBLEMS: ${names.problems.join("; ")}` : ""}`);
  for (const warning of names.warnings) console.log(`  warning: ${warning}`);
}
mkdirSync(join(work, config.textureDir), { recursive: true });
for (const [name, bytes] of textureFiles) {
  if (bytes.byteLength > config.maxFileBytes) {
    failed = true;
    console.log(`  PROBLEM: texture ${name} is ${MB(bytes.byteLength)} MB, over the file limit`);
  }
  writeFileSync(join(work, config.textureDir, name), bytes);
}
// Runtime textures still referenced by GLBs not processed this run (--only) take part in the check.
if (existsSync(join(outDir, config.textureDir))) {
  for (const name of readdirSync(join(outDir, config.textureDir))) {
    if (!existsSync(join(work, config.textureDir, name))) copyFileSync(join(outDir, config.textureDir, name), join(work, config.textureDir, name));
  }
}

// Files not processed this run (--only) take part in the check as they are in the runtime folder.
for (const name of readdirSync(outDir).filter((n) => n.endsWith(".glb"))) {
  if (!existsSync(join(work, name))) copyFileSync(join(outDir, name), join(work, name));
}

let check = { ok: true, lines: ["(skipped)"] };
if (!failed && !skipCheck) {
  console.log("\nChecking the optimised set the way the viewer uses it...");
  const manifestPaths = Object.fromEntries(Object.values(config.manifests).map((name) => [name, manifestPath(name)]));
  check = await checkAssets({ dir: work, source: sourceDir, manifestDir: outDir, manifestPaths });
  for (const line of check.lines) console.log(`  ${line}`);
  if (!check.ok) failed = true;
}

// ── Report ──
/** Textures per role and chosen encoding, with sizes (every trial's metrics are in the JSON report). */
function textureSummary() {
  if (!textureRows.length) return [];
  const unique = [...textureFiles.values()].reduce((sum, bytes) => sum + bytes.byteLength, 0);
  const glbs = rows.reduce((sum, r) => sum + r.after.fileBytes, 0);
  const largest = Math.max(...rows.map((r) => r.after.fileBytes), ...[...textureFiles.values()].map((b) => b.byteLength));
  const lines = [
    "",
    `Download at full resolution: ${MB(glbs)} MB GLBs + ${MB(unique)} MB in ${textureFiles.size} texture files = ${MB(glbs + unique)} MB; largest file ${MB(largest)} MB (limit ${MB(config.maxFileBytes)} MB).`,
    "",
    "Textures (KTX2, transcoded on the GPU to BC7 on desktop / ASTC 4x4 elsewhere, 1 byte per texel plus mips):",
  ];
  const groups = new Map();
  for (const row of textureRows) {
    const key = `${row.role} -> ${row.candidate}`;
    const g = groups.get(key) ?? { count: 0, source: 0, bytes: 0, gpu: 0, failed: 0 };
    g.count++;
    g.source += row.sourceBytes;
    g.bytes += row.bytes;
    g.gpu += row.gpu;
    if (!row.passed) g.failed++;
    groups.set(key, g);
  }
  for (const [key, g] of [...groups].sort()) lines.push(`- ${key}: ${g.count} textures, ${MB(g.source)} MB source -> ${MB(g.bytes)} MB KTX2, ${MB(g.gpu)} MB on the GPU${g.failed ? `, ${g.failed} met no threshold` : ""}`);
  const resized = textureRows.filter((row) => row.sourceSize && (row.sourceSize[0] !== row.width || row.sourceSize[1] !== row.height));
  lines.push("", `Right-sized to the density caps (${resized.length}): texture, from -> to, texels per metre at full size (near / far / distant):`);
  for (const row of resized) {
    const d = row.density?.densities ?? {};
    lines.push(`- ${row.file} ${row.texture}: ${row.sourceSize.join("x")} -> ${row.width}x${row.height} (${["near", "far", "distant"].map((k) => d[k] ?? "-").join(" / ")})`);
  }
  const kept = textureRows.filter((row) => row.density && row.density.reason);
  lines.push("", `Kept at full size by rule (${kept.length}): ${kept.map((row) => `${row.texture} (${row.density.reason})`).join("; ")}`);
  lines.push("", `Hero textures (${textureRows.filter((r) => r.hero).length}): ${textureRows.filter((r) => r.hero).map((r) => `${r.texture} ${r.width} ${r.candidate} ${MB(r.bytes)} MB`).join("; ")}`);
  lines.push("", `UASTC overrides: ${config.uastcOverrides.length ? config.uastcOverrides.join(", ") : "none"}`);
  return lines;
}

const sum = (key, side) => rows.reduce((s, r) => s + r[side][key], 0);
const header = "| file | size before | size after | images | geometry before | geometry after | GPU textures before | GPU textures after | triangles |";
const table = [header, "|---|---:|---:|---:|---:|---:|---:|---:|---:|"];
for (const r of rows) {
  table.push(`| ${r.file} | ${MB(r.before.fileBytes)} | ${MB(r.after.fileBytes)} | ${MB(r.before.imageBytes)} -> ${MB(r.after.imageBytes)} | ${MB(r.before.geometryBytes)} | ${MB(r.after.geometryBytes)} | ${MB(r.before.gpuTextureBytes)} | ${MB(r.after.gpuTextureBytes)} | ${r.before.triangles.toLocaleString("en-US")} -> ${r.after.triangles.toLocaleString("en-US")} |`);
}
table.push(`| **total** | ${MB(sum("fileBytes", "before"))} | ${MB(sum("fileBytes", "after"))} | ${MB(sum("imageBytes", "before"))} -> ${MB(sum("imageBytes", "after"))} | ${MB(sum("geometryBytes", "before"))} | ${MB(sum("geometryBytes", "after"))} | ${MB(sum("gpuTextureBytes", "before"))} | ${MB(sum("gpuTextureBytes", "after"))} | ${sum("triangles", "before").toLocaleString("en-US")} -> ${sum("triangles", "after").toLocaleString("en-US")} |`);
const precisionLines = rows.map((r) => {
  const p = r.precision;
  const fmt = (k, unit, scale = 1) => (p[k] ? `${k} ${p[k].filter}${p[k].bits.length ? ` ${p[k].bits[0]}-${p[k].bits[p[k].bits.length - 1]} bits` : ""} max error ${(p[k].maxError * scale).toPrecision(2)} ${unit}` : null);
  return `- ${r.file} (${r.profile}): ${[fmt("position", "mm", 1000), fmt("normal", ""), fmt("tangent", ""), fmt("texcoord", "uv"), fmt("color", "")].filter(Boolean).join("; ")}; names kept: ${r.names.prefixed} prefixed, ${r.names.manifest} from manifests`;
});
const report = [
  `# ${config.name} asset pipeline`,
  "",
  `Source: ${sourceDir}`,
  `Output: ${outDir}`,
  `Run: ${new Date(started).toISOString()} (${((Date.now() - started) / 1000).toFixed(0)} s)`,
  "",
  "Sizes in MB. Geometry = non-image bytes stored in the GLB (data-less meshopt fallback views are not counted). GPU textures = as uploaded (plain images: RGBA8 with mips; KTX2: BC7 / ASTC 4x4 with its mips).",
  "",
  ...table,
  "",
  "Precision (decoded and checked per accessor):",
  ...precisionLines,
  "",
  ...textureSummary(),
  "",
  "Viewer check:",
  ...check.lines.map((l) => `- ${l}`),
  "",
  "SHA-256:",
  ...rows.map((r) => `- ${r.file} ${r.sha256}`),
].join("\n");
console.log(`\n${table.join("\n")}\n`);
for (const line of precisionLines) console.log(line);

{
  mkdirSync(join(here, "reports"), { recursive: true });
  writeFileSync(join(here, "reports", `${config.name}.md`), `${report}\n`);
  writeFileSync(join(here, "reports", `${config.name}.json`), `${JSON.stringify({ source: sourceDir, out: outDir, rows, textures: textureRows, textureFiles: [...textureFiles].map(([name, bytes]) => ({ name, bytes: bytes.byteLength })), check }, (k, v) => (v instanceof Set ? [...v] : v), 2)}\n`);
}

if (failed) {
  console.error("\noptimize-assets: FAILED; the runtime folder was not changed.");
  rmSync(work, { recursive: true, force: true });
  process.exit(1);
}
if (dryRun) {
  console.log(`\nDry run: optimised files left in ${work}`);
} else {
  let written = 0;
  for (const r of rows) {
    const target = join(outDir, r.file);
    if (existsSync(target) && sha256(readFileSync(target)) === r.sha256) continue;
    copyFileSync(join(work, r.file), target);
    written++;
  }
  const textureOut = join(outDir, config.textureDir);
  mkdirSync(textureOut, { recursive: true });
  for (const [name, bytes] of textureFiles) {
    const target = join(textureOut, name);
    if (existsSync(target)) continue; // content-addressed: same name, same bytes
    writeFileSync(target, bytes);
    written++;
  }
  const referenced = new Set();
  for (const name of readdirSync(outDir).filter((n) => n.endsWith(".glb"))) {
    for (const image of parseGlb(new Uint8Array(readFileSync(join(outDir, name)))).json.images ?? []) if (image.uri) referenced.add(image.uri.split("/").pop());
  }
  let removed = 0;
  for (const name of readdirSync(textureOut)) {
    if (!referenced.has(name)) {
      rmSync(join(textureOut, name));
      removed++;
    }
  }
  if (removed) console.log(`Removed ${removed} texture file(s) no GLB references any more.`);
  for (const name of installManifests) {
    const from = join(sourceDir, name);
    const target = join(outDir, name);
    if (existsSync(target) && sha256(readFileSync(target)) === sha256(readFileSync(from))) continue;
    copyFileSync(from, target);
    written++;
    console.log(`Installed ${name} from the delivery.`);
  }
  rmSync(work, { recursive: true, force: true });
  console.log(`\nWrote ${written} file(s) to ${outDir}; report in scripts/spaces/reports/${config.name}.md`);
}
