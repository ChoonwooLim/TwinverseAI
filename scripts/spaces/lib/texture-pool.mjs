// Parallel, cached texture encoding. A result is cached under the hash of the source bytes, the
// options and the encoder settings, so re-running the pipeline only encodes what changed.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { availableParallelism, freemem } from "node:os";
import { join } from "node:path";
import { Worker } from "node:worker_threads";
import { CHAINS, THRESHOLDS } from "./ktx2.mjs";

const ENCODER_VERSION = ["ktx2-encoder", "ktx2-encoder-legacy"]
  .map((name) => JSON.parse(readFileSync(new URL(`../node_modules/${name}/package.json`, import.meta.url), "utf8")).version)
  .join("+");
const SETTINGS_HASH = createHash("sha256").update(JSON.stringify({ ENCODER_VERSION, CHAINS, THRESHOLDS, v: 3 })).digest("hex").slice(0, 16);

/** Worker count: leaves room for the main thread; a 4096 x 4096 encode needs about 1 GB. */
export function defaultWorkers() {
  const byCpu = Math.max(1, availableParallelism() - 2);
  const byMemory = Math.max(1, Math.floor(freemem() / 1.2e9));
  return Math.min(byCpu, byMemory, 32);
}

export class TexturePool {
  constructor({ cacheDir, workers = defaultWorkers() }) {
    this.cacheDir = cacheDir;
    this.trialDir = join(cacheDir, "trials");
    mkdirSync(this.trialDir, { recursive: true });
    this.size = workers;
    this.workers = [];
    this.idle = [];
    this.queue = [];
    this.pending = new Map();
    this.nextId = 1;
    this.hits = 0;
    this.encoded = 0;
  }

  key(bytes, options) {
    return createHash("sha256").update(bytes).update(JSON.stringify(options)).update(SETTINGS_HASH).digest("hex");
  }

  /**
   * Encodes (or reads from the cache) one texture; resolves with { bytes, candidate, ... }. The
   * same image with the same options (e.g. in two files) is encoded once.
   */
  encode(bytes, options) {
    const key = this.key(bytes, options);
    this.inflight ??= new Map();
    if (!this.inflight.has(key)) this.inflight.set(key, this.encodeOnce(key, bytes, options));
    return this.inflight.get(key);
  }

  async encodeOnce(key, bytes, options) {
    const ktx2 = join(this.cacheDir, `${key}.ktx2`);
    const meta = join(this.cacheDir, `${key}.json`);
    if (existsSync(ktx2) && existsSync(meta)) {
      // Same image, options, chains and thresholds as a finished earlier run.
      this.hits++;
      return { ...JSON.parse(readFileSync(meta, "utf8")), bytes: new Uint8Array(readFileSync(ktx2)), cached: true };
    }
    const result = await this.run(bytes, options);
    writeFileSync(ktx2, result.bytes);
    const { bytes: _bytes, ...rest } = result;
    writeFileSync(meta, JSON.stringify(rest));
    this.encoded++;
    return { ...result, cached: false };
  }

  run(bytes, options) {
    return new Promise((resolve, reject) => {
      this.queue.push({ bytes, options, resolve, reject });
      this.pump();
    });
  }

  pump() {
    while (this.queue.length) {
      let worker = this.idle.pop();
      if (!worker && this.workers.length < this.size) {
        worker = new Worker(new URL("./texture-worker.mjs", import.meta.url));
        worker.on("message", ({ id, result, error }) => {
          const job = this.pending.get(id);
          this.pending.delete(id);
          this.idle.push(worker);
          if (error) job.reject(new Error(error));
          else job.resolve(result);
          this.pump();
        });
        worker.on("error", (error) => {
          for (const job of this.pending.values()) job.reject(error);
        });
        this.workers.push(worker);
      }
      if (!worker) return;
      const job = this.queue.shift();
      const id = this.nextId++;
      this.pending.set(id, job);
      worker.postMessage({ id, bytes: job.bytes, options: job.options, trialDir: this.trialDir, version: ENCODER_VERSION });
    }
  }

  async close() {
    await Promise.all(this.workers.map((worker) => worker.terminate()));
  }
}
