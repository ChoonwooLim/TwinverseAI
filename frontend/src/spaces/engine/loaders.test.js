import { describe, expect, it } from "vitest";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";
import { createGLTFLoader, shareLoads, textureUrlModifier, transcoderWorkerCount } from "./loaders";

describe("createGLTFLoader", () => {
  it("registers the meshopt decoder on every loader it creates", () => {
    const a = createGLTFLoader();
    const b = createGLTFLoader();
    expect(a).not.toBe(b);
    expect(a.meshoptDecoder).toBe(MeshoptDecoder);
    expect(b.meshoptDecoder).toBe(MeshoptDecoder);
    expect(typeof MeshoptDecoder.decodeGltfBufferAsync).toBe("function");
  });

  it("hands KTX2 textures to the given KTX2 loader", () => {
    const ktx2 = new KTX2Loader();
    expect(createGLTFLoader(ktx2).ktx2Loader).toBe(ktx2);
    expect(createGLTFLoader().ktx2Loader).toBeFalsy();
    ktx2.dispose();
  });
});

describe("texture files", () => {
  it("maps texture names the GLBs reference to their bundled URLs", () => {
    const modify = textureUrlModifier({ "ab12.ktx2": "/assets/ab12-Hash1234.ktx2" });
    expect(modify("https://site/assets/releases-v2/textures/ab12.ktx2")).toBe("/assets/ab12-Hash1234.ktx2");
    expect(modify("https://site/assets/other.ktx2")).toBe("https://site/assets/other.ktx2");
    expect(modify("basis/basis_transcoder.wasm")).toMatch(/basis_transcoder/);
  });

  it("loads a texture file once for every caller and shares the result", async () => {
    let fetches = 0;
    const loader = shareLoads({ load: (url, onLoad) => setTimeout(() => onLoad({ url, n: ++fetches }), 0) });
    const results = await Promise.all(["a/x.ktx2", "b/x.ktx2", "c/y.ktx2"].map((url) => new Promise((resolve) => loader.load(url, resolve))));
    expect(fetches).toBe(2);
    expect(results[0]).toBe(results[1]);
    expect(results[2]).not.toBe(results[0]);
  });
});

describe("transcoder workers", () => {
  it("uses half the cores, between 2 and 4", () => {
    expect(transcoderWorkerCount(2)).toBe(2);
    expect(transcoderWorkerCount(6)).toBe(3);
    expect(transcoderWorkerCount(64)).toBe(4);
    expect(transcoderWorkerCount(Number.NaN)).toBe(2); // unknown core count
  });
});
