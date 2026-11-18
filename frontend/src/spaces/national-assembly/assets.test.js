// The asset module must resolve whether or not optional scenery files exist.
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ASSETS, numberedFiles, sceneryFiles } from "./assets";
import { spawnViewOffset } from "../cameraRig";
import { blockerActive, createDoor, updateDoor } from "../doors";
import { decodeHeightfield, heightfieldList } from "../heightfield";
import { findNearestFloor, floorAt } from "../walkPhysics";

describe("numberedFiles", () => {
  it("maps numbered files by name in numeric order and ignores everything else", () => {
    const glob = {
      "./assets/scenery-10.glb": "/a/scenery-10-x.glb",
      "./assets/scenery-2.glb": "/a/scenery-2-y.glb",
      "./assets/vegetation-1.glb": "/a/vegetation-1-z.glb",
      "./assets/sky_bg_8k.jpg": "/a/sky.jpg",
    };
    expect(numberedFiles(glob, "scenery")).toEqual({ "scenery-2.glb": "/a/scenery-2-y.glb", "scenery-10.glb": "/a/scenery-10-x.glb" });
    expect(Object.keys(numberedFiles(glob, "scenery"))).toEqual(["scenery-2.glb", "scenery-10.glb"]);
    expect(numberedFiles({}, "scenery")).toEqual({});
  });
});

describe("sceneryFiles", () => {
  it("accepts numbered and named scenery files, numbered first", () => {
    const glob = {
      "./assets/scenery-gate-2.glb": "/a/g2.glb",
      "./assets/scenery-2.glb": "/a/s2.glb",
      "./assets/scenery-gate-1.glb": "/a/g1.glb",
      "./assets/vegetation-1.glb": "/a/v1.glb",
    };
    expect(Object.keys(sceneryFiles(glob))).toEqual(["scenery-2.glb", "scenery-gate-1.glb", "scenery-gate-2.glb"]);
  });
});

describe("national-assembly assets", () => {
  it("resolves with the scenery files that exist (none is fine)", () => {
    expect(ASSETS.scenery.files).toBeTypeOf("object");
    for (const name of Object.keys(ASSETS.scenery.files)) expect(name).toMatch(/^scenery-[^/]+\.glb$/);
    expect(ASSETS.scenery.placements).toBeTypeOf("object");
    expect(ASSETS.heightfieldUrls).toBeTypeOf("object");
    expect(ASSETS.vegetation.files).toBeTypeOf("object");
  });

  it("picks up a scenery file once one is present", async () => {
    const standIn = fileURLToPath(new URL("./assets/scenery-999.glb", import.meta.url));
    expect(existsSync(standIn)).toBe(false);
    writeFileSync(standIn, new Uint8Array(8192).fill(83));
    try {
      // A query string gives a fresh module instance, so the glob is evaluated again.
      const fresh = await import(/* @vite-ignore */ `./assets.js?standin=${Date.now()}`);
      expect(Object.keys(fresh.ASSETS.scenery.files)).toContain("scenery-999.glb");
      expect(fresh.ASSETS.scenery.files["scenery-999.glb"]).toMatch(/scenery-999/);
    } finally {
      rmSync(standIn, { force: true });
    }
    expect(existsSync(standIn)).toBe(false);
  });
});

describe("the spawn in front of Gwanghwamun", () => {
  const grids = heightfieldList(ASSETS.colliders).map((meta) =>
    decodeHeightfield(readFileSync(fileURLToPath(new URL(`./assets/${meta.file}`, import.meta.url))), meta),
  );
  const colliders = { ...ASSETS.colliders, heightfields: grids };
  const spawn = ASSETS.colliders.spawn;

  it("stands on the stone approach, where the body fits without a rescue", () => {
    expect(floorAt(spawn.x, spawn.z, colliders)).toBeCloseTo(spawn.y, 1);
    expect(findNearestFloor(spawn.x, spawn.z, colliders, { radius: 0.4 })).toMatchObject({ x: spawn.x, z: spawn.z });
  });

  it("opens with the whole gate and its roof in the frame", () => {
    const limits = { minDistance: 4, maxDistance: 160, minPolarAngle: 0.12, maxPolarAngle: Math.PI * 0.62 };
    const offset = spawnViewOffset(spawn, spawn.faceYaw, limits);
    const target = { x: spawn.x, y: floorAt(spawn.x, spawn.z, colliders) + ASSETS.avatarConfig.heightM * 0.8, z: spawn.z };
    const camera = { x: target.x + offset.x, y: target.y + offset.y, z: target.z + offset.z };
    expect(camera.y).toBeCloseTo(1.84, 1);
    expect(camera.z).toBeCloseTo(353.4, 1);
    const angleTo = (point) => {
      const a = [target.x - camera.x, target.y - camera.y, target.z - camera.z];
      const b = [point.x - camera.x, point.y - camera.y, point.z - camera.z];
      const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      return (Math.acos(dot / (Math.hypot(...a) * Math.hypot(...b))) * 180) / Math.PI;
    };
    // The roof ridge (y 18.43 above the gate's centre line) inside the 25 degree half field of view.
    expect(angleTo({ x: 0, y: 18.43, z: 300 })).toBeLessThan(25);
  });

  it("keeps the doors closed at the spawn and opens them as the visitor walks up", () => {
    const doors = Object.values(ASSETS.scenery.placements).flatMap((placement) => (placement.doors ?? []).map((spec) => createDoor(spec, placement)));
    expect(doors).toHaveLength(3);
    const dt = 1 / 60;
    for (let i = 0; i < 300; i++) for (const door of doors) updateDoor(door, dt, { visitor: { x: spawn.x, z: spawn.z } });
    for (const door of doors) {
      expect(door.phase).toBe("closed");
      expect(blockerActive(door)).toBe(true);
    }
    // Running (4 m/s) up the centre line: the centre door is open before the body reaches it.
    const centre = doors.find((door) => door.name === "center");
    const visitor = { x: centre.trigger.x, z: spawn.z };
    while (visitor.z - 0.4 > centre.blocker.maxZ) {
      visitor.z -= 4 * dt;
      for (const door of doors) updateDoor(door, dt, { visitor });
    }
    expect(blockerActive(centre)).toBe(false);
  });
});
