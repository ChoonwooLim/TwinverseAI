import { describe, expect, it } from "vitest";
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, PerspectiveCamera, Spherical, Vector3 } from "three/webgpu";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CAMERA_FLOOR, armBasis, placeCamera, reachableFloor, spawnViewOffset } from "./cameraRig";
import { CameraCollider } from "./engine/cameraCollision";
import { floorAt, heightAt } from "./walkPhysics";

const LIMITS = { minDistance: 4, maxDistance: 160, minPolarAngle: 0.12, maxPolarAngle: Math.PI * 0.62 };

describe("floor the camera could stand over", () => {
  const flat = () => 0;

  it("follows stairs and ramps, also well above the avatar's own floor", () => {
    // Avatar at the foot of a 1:2 ramp, camera 9 m up the slope: 4.5 m above the avatar's floor.
    const ramp = (x, z) => Math.max(0, z) * 0.5;
    expect(reachableFloor(0, 0, 0, 0, 9, ramp)).toBeCloseTo(4.5, 6);
    // Real stairs: 0.17 m risers on 0.3 m treads.
    const stairs = (x, z) => Math.floor(Math.max(0, z) / 0.3) * 0.17;
    expect(reachableFloor(0, 0, 0, 0, 6, stairs)).toBeCloseTo(stairs(0, 6), 6);
  });

  it("treats a wall top, a platform or a plinth as an obstacle", () => {
    const wall = (x, z) => (z >= 2 && z <= 4 ? 6 : 0);
    expect(reachableFloor(0, 0, 0, 0, 3, wall)).toBe(0);
    expect(reachableFloor(0, 0, 0, 0, 8, wall)).toBe(0); // beyond it too: the walk stopped at the wall
    const plinth = (x, z) => (z >= 1 && z <= 2 ? 1.6 : 0);
    expect(reachableFloor(0, 0, 0, 0, 1.5, plinth)).toBe(0);
    // A spot without floor (a wall cell in the heightfield) stops the walk as well.
    expect(reachableFloor(0, 0, 0, 0, 5, (x, z) => (z > 2 && z < 2.6 ? null : 0.5 * (z > 2.6)))).toBe(0);
  });

  it("follows drops (a terrace edge) and starts from the avatar's floor", () => {
    const terrace = (x, z) => (z < 3 ? 5 : 0);
    expect(reachableFloor(0, 0, 5, 0, 8, terrace)).toBe(0);
    expect(reachableFloor(0, 0, 5, 0, 0, terrace)).toBe(5);
    expect(reachableFloor(0, 0, 1.2, 0, 0.1, flat)).toBe(0);
  });

  it("keeps the walk short for far cameras", () => {
    let calls = 0;
    reachableFloor(0, 0, 0, 0, 150, () => {
      calls++;
      return 0;
    });
    expect(calls).toBe(CAMERA_FLOOR.maxSamples);
  });
});

describe("drawn camera placement", () => {
  it("never writes to the orbit offset", () => {
    const offset = Object.freeze({ x: 0, y: 3, z: 9 });
    const target = Object.freeze({ x: 1, y: 1.4, z: 2 });
    const placed = placeCamera(target, offset, {
      arm: { previous: null, dt: 1 / 60, cast: (rays) => rays.map(() => 2) },
      floorUnder: () => 5,
    });
    expect(placed.armLength).toBeCloseTo(1.7, 6);
    expect(placed.lifted).toBe(true);
    expect(placed.y).toBeCloseTo(5 + CAMERA_FLOOR.clearance, 9);
    expect(offset).toEqual({ x: 0, y: 3, z: 9 });
  });

  it("builds the cast circle like the camera's right and up axes", () => {
    const direction = new Vector3(0.3, 0.4, 0.866).normalize();
    const { right, up } = armBasis(direction);
    const forward = direction.clone().negate();
    const r = new Vector3().crossVectors(forward, new Vector3(0, 1, 0)).normalize();
    const u = new Vector3().crossVectors(r, forward).normalize();
    expect(right.x).toBeCloseTo(r.x, 9);
    expect(right.z).toBeCloseTo(r.z, 9);
    expect(up.x).toBeCloseTo(u.x, 9);
    expect(up.y).toBeCloseTo(u.y, 9);
    expect(up.z).toBeCloseTo(u.z, 9);
    // Straight down: any horizontal right axis.
    expect(armBasis({ x: 0, y: 1, z: 0 }).right).toEqual({ x: 1, y: 0, z: 0 });
  });
});

describe("spawn view", () => {
  it("defaults to 9 m back and 3 m up, behind the facing direction", () => {
    const offset = spawnViewOffset({}, Math.PI, LIMITS);
    expect(offset.x).toBeCloseTo(0, 9);
    expect(offset.y).toBeCloseTo(3, 9);
    expect(offset.z).toBeCloseTo(9, 9);
  });

  it("reads viewBackM and viewRiseM (the gate opening frame) and clamps to the orbit limits", () => {
    const gate = spawnViewOffset({ viewBackM: 9.4, viewRiseM: 0.6 }, 3.14, LIMITS);
    expect(Math.hypot(gate.x, gate.z)).toBeCloseTo(9.4, 9);
    expect(gate.y).toBeCloseTo(0.6, 9);
    expect((Math.atan2(gate.y, Math.hypot(gate.x, gate.z)) * 180) / Math.PI).toBeCloseTo(3.65, 2);
    const close = spawnViewOffset({ viewBackM: 1, viewRiseM: 0.5 }, 0, LIMITS);
    expect(Math.hypot(close.x, close.y, close.z)).toBeCloseTo(LIMITS.minDistance, 9);
    const below = spawnViewOffset({ viewBackM: 2, viewRiseM: -20 }, 0, LIMITS);
    expect(Math.acos(below.y / Math.hypot(below.x, below.y, below.z))).toBeCloseTo(LIMITS.maxPolarAngle, 9);
  });
});

/**
 * The engine's camera on a test site: OrbitControls drives its own orbit object, the drawn camera
 * is placed from it each frame (same order as SpaceEngine.followCamera / placeDrawnCamera).
 */
function createRig({ offset, target, damping = true }) {
  const orbit = new PerspectiveCamera(50, 1, 0.3, 2500);
  const controls = new OrbitControls(orbit, null);
  Object.assign(controls, { enableDamping: damping, dampingFactor: 0.1, minDistance: LIMITS.minDistance, maxDistance: LIMITS.maxDistance });
  Object.assign(controls, { minPolarAngle: LIMITS.minPolarAngle, maxPolarAngle: LIMITS.maxPolarAngle });
  controls.target.copy(target);
  orbit.position.copy(target).add(offset);
  controls.update();
  return { orbit, controls, drawn: new Vector3(), armLength: null, avatar: { x: target.x, z: target.z } };
}

function orbitState(rig) {
  const s = new Spherical().setFromVector3(rig.orbit.position.clone().sub(rig.controls.target));
  return { pitch: s.phi, yaw: s.theta, distance: s.radius };
}

function runFrame(rig, { dt = 1 / 60, move = null, collider, colliders }) {
  rig.controls.update(dt);
  if (move) {
    // The avatar moves; the orbit and its target follow by the same amount.
    rig.avatar.x += move.x;
    rig.avatar.z += move.z;
    const dy = move.y ?? 0;
    rig.orbit.position.add(new Vector3(move.x, dy, move.z));
    rig.controls.target.add(new Vector3(move.x, dy, move.z));
  }
  const { x, z } = rig.avatar;
  const avatarFloor = heightAt(x, z, colliders);
  const placed = placeCamera(rig.controls.target, rig.orbit.position.clone().sub(rig.controls.target), {
    arm: { previous: rig.armLength, dt, cast: (rays) => collider.castRays(rays) },
    floorUnder: (cx, cz) => reachableFloor(x, z, avatarFloor, cx, cz, (sx, sz) => floorAt(sx, sz, colliders)),
  });
  rig.armLength = placed.armLength;
  rig.drawn.set(placed.x, placed.y, placed.z);
  // OrbitControls also updates from its pointer handlers between frames; it must only ever see the orbit.
  rig.controls.update();
  return placed;
}

describe("the visitor's orbit survives collisions and floor lifts", () => {
  // A palace wall 6 m high whose front face is 2.2 m behind the avatar (2 m thick), and the walking
  // data a heightfield gives it: its top is a floor, rasterized a little past the face.
  const wallMesh = new Mesh(new BoxGeometry(40, 6, 2), new MeshStandardMaterial());
  wallMesh.position.set(0, 3, 3.2);
  const site = new Group();
  site.add(wallMesh);
  const collider = new CameraCollider();
  collider.addRoot(site);
  while (collider.building) collider.build(1000);
  const colliders = {
    ground: { minX: -200, maxX: 200, minZ: -200, maxZ: 200 },
    platforms: [{ minX: -20, maxX: 20, minZ: 1.75, maxZ: 4.45, y: 6 }],
    // Long stairs elsewhere: rising 0.5 m per metre behind the avatar's spot at x 60.
    ramps: [{ minX: 50, maxX: 70, zBottom: 0, zTop: 20, yBottom: 0, yTop: 10 }],
  };

  it("keeps the camera below the wall top in front of the wall, arm about 2 m", () => {
    const rig = createRig({ offset: new Vector3(0, 3, 9), target: new Vector3(0, 1.4, 0) });
    let placed;
    for (let i = 0; i < 20; i++) placed = runFrame(rig, { collider, colliders });
    expect(placed.armLength).toBeGreaterThan(1.8);
    expect(placed.armLength).toBeLessThan(2.2);
    expect(rig.drawn.y).toBeLessThan(6);
    expect(rig.drawn.z).toBeLessThan(2.2);
    expect(placed.lifted).toBe(false);
    // The rule it replaces (the floor straight under the camera) would have put it on the wall top.
    expect(heightAt(rig.drawn.x, rig.drawn.z, colliders)).toBe(6);
  });

  it("returns the same pitch, yaw and distance in open space, to 1e-6", () => {
    const rig = createRig({ offset: new Vector3(2, 3.2, 8.7), target: new Vector3(0, 1.4, 0) });
    const before = orbitState(rig);
    let collisions = 0;
    let lifts = 0;
    const count = (placed) => {
      if (placed.armLength < placed.wanted - 1e-3) collisions++;
      if (placed.lifted) lifts++;
    };
    // Back to the wall, sidling along it.
    for (let i = 0; i < 40; i++) count(runFrame(rig, { collider, colliders, move: { x: 0.05 * Math.sin(i / 5), z: 0 } }));
    // Over to the stairs: the floor rule lifts the camera above the steps behind.
    count(runFrame(rig, { collider, colliders, move: { x: 60 - rig.avatar.x, z: -rig.avatar.z } }));
    for (let i = 0; i < 40; i++) count(runFrame(rig, { collider, colliders, move: { x: 0, z: 0.04, y: 0.02 } }));
    // Back and forth between both a few times, then out into open space.
    for (let k = 0; k < 3; k++) {
      count(runFrame(rig, { collider, colliders, move: { x: -rig.avatar.x, z: -rig.avatar.z } }));
      for (let i = 0; i < 10; i++) count(runFrame(rig, { collider, colliders }));
      count(runFrame(rig, { collider, colliders, move: { x: 60, z: 1 } }));
      for (let i = 0; i < 10; i++) count(runFrame(rig, { collider, colliders }));
    }
    count(runFrame(rig, { collider, colliders, move: { x: -150 - rig.avatar.x, z: -rig.avatar.z } }));
    let placed;
    for (let i = 0; i < 60; i++) placed = runFrame(rig, { collider, colliders });
    expect(collisions).toBeGreaterThan(20);
    expect(lifts).toBeGreaterThan(20);
    const after = orbitState(rig);
    expect(Math.abs(after.pitch - before.pitch)).toBeLessThan(1e-6);
    expect(Math.abs(after.yaw - before.yaw)).toBeLessThan(1e-6);
    expect(Math.abs(after.distance - before.distance)).toBeLessThan(1e-6);
    // In open space the drawn camera is the orbit itself again.
    expect(placed.lifted).toBe(false);
    expect(rig.drawn.distanceTo(rig.orbit.position)).toBeLessThan(1e-9);
  });

  it("lets the first drag continue from the spawn view without a jump", () => {
    const target = new Vector3(0, 1.24, 344);
    const view = spawnViewOffset({ viewBackM: 9.4, viewRiseM: 0.6 }, 3.14, LIMITS);
    const rig = createRig({ offset: new Vector3(view.x, view.y, view.z), target });
    const spawn = orbitState(rig);
    expect(spawn.distance).toBeCloseTo(Math.hypot(9.4, 0.6), 9);
    const open = { ground: { minX: -500, maxX: 500, minZ: -500, maxZ: 500 } };
    for (let i = 0; i < 10; i++) runFrame(rig, { collider, colliders: open });
    const settled = orbitState(rig);
    expect(Math.abs(settled.pitch - spawn.pitch)).toBeLessThan(1e-9);
    expect(Math.abs(settled.yaw - spawn.yaw)).toBeLessThan(1e-9);
    // A drag: OrbitControls turns from the spawn view by the drag (damped), nothing else changes.
    rig.controls.rotateLeft(0.05);
    const first = orbitState(rig);
    expect(Math.abs(first.pitch - spawn.pitch)).toBeLessThan(1e-9);
    expect(Math.abs(first.distance - spawn.distance)).toBeLessThan(1e-9);
    const turned = Math.abs(((first.yaw - spawn.yaw + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
    expect(turned).toBeGreaterThan(0);
    expect(turned).toBeLessThanOrEqual(0.05 * 0.1 + 1e-9);
  });
});
