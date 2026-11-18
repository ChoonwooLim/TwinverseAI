// Worker thread: encodes one texture per message (see texture-pool.mjs). Every candidate encoding
// is kept in the trial cache under the source pixels, the candidate and the colour space.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parentPort } from "node:worker_threads";
import sharp from "sharp";
import { MIP_FILTER, encodeForRole } from "./ktx2.mjs";

async function trialCache(dir, bytes, options, version) {
  // Images resampled to whole 4x4 blocks (alignToBlocks) are keyed apart from their raw pixels.
  const { width = 0, height = 0 } = await sharp(bytes).metadata();
  const aligned = width % 4 || height % 4 ? "|align4" : "";
  // Everything that changes an encoding besides the candidate: colour space, target size, mips.
  const normal = /normal/i.test(options.role);
  const settings = `${options.srgb ? "srgb" : "linear"}|${version}${aligned}|${options.resize ? options.resize.join("x") : "full"}|mip${MIP_FILTER}${normal ? "|renormalize" : ""}|v3`;
  const base = createHash("sha256").update(bytes).update(settings).digest("hex");
  const path = (candidate) => join(dir, `${base}-${candidate}.ktx2`);
  return {
    get: (candidate) => (existsSync(path(candidate)) ? new Uint8Array(readFileSync(path(candidate))) : null),
    set: (candidate, data) => {
      const target = path(candidate);
      writeFileSync(`${target}.part`, data);
      renameSync(`${target}.part`, target); // a killed run never leaves half a file under the real name
    },
  };
}

parentPort.on("message", async ({ id, bytes, options, trialDir, version }) => {
  try {
    const result = await encodeForRole(bytes, options, trialDir ? await trialCache(trialDir, bytes, options, version) : null);
    parentPort.postMessage({ id, result }, [result.bytes.buffer]);
  } catch (error) {
    parentPort.postMessage({ id, error: String(error?.stack ?? error) });
  }
});
