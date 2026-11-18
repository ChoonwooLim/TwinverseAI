// Fountain jets as GPU particles. Each emitter (an object named `Fountain_*`) gets one instanced
// sprite whose particles follow analytic ballistic paths, so there is no per-frame CPU work.
// Optional glTF extras on the emitter: `jetHeight` (m, default 5) and `spread` (m/s, default 0.5).
import { AdditiveBlending, Color, Sprite, SpriteNodeMaterial, Vector3 } from "three/webgpu";
import { cos, float, fract, hash, instanceIndex, max, sin, smoothstep, uniform, vec3 } from "three/tsl";

const GRAVITY = 9.81;

function createJet(emitter, time, count) {
  const jetHeight = Number(emitter.userData?.jetHeight) > 0 ? Number(emitter.userData.jetHeight) : 5;
  const spreadSpeed = Number(emitter.userData?.spread) >= 0 && emitter.userData?.spread !== undefined
    ? Number(emitter.userData.spread)
    : 0.5;
  const launch = Math.sqrt(2 * GRAVITY * jetHeight);
  const flight = (2 * launch) / GRAVITY;

  const i = float(instanceIndex);
  const r1 = hash(i.add(11));
  const r2 = hash(i.add(100003));
  const r3 = hash(i.add(200003));
  const lifetime = float(flight).mul(r1.mul(0.25).add(0.85));
  const age = fract(time.div(lifetime).add(r3)).mul(lifetime);
  const speedUp = float(launch).mul(r1.mul(0.12).add(0.9));
  const angle = r2.mul(Math.PI * 2);
  const outward = float(spreadSpeed).mul(r3.mul(0.7).add(0.3));
  const height = speedUp.mul(age).sub(age.mul(age).mul(GRAVITY / 2));
  const alive = smoothstep(0, 0.05, max(height, 0));

  const material = new SpriteNodeMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending });
  material.name = "Fountain spray";
  material.positionNode = vec3(cos(angle).mul(outward).mul(age), max(height, 0), sin(angle).mul(outward).mul(age));
  material.scaleNode = float(0.05).add(r2.mul(0.05)).mul(alive).mul(age.div(lifetime).mul(1.5).add(0.6));
  const tint = uniform(new Color(0xdfeaf2));
  material.colorNode = tint.mul(0.35);
  material.opacityNode = alive.mul(float(1).sub(age.div(lifetime)).mul(0.6).add(0.2));
  material.userData.ssrStrength = 0;

  const sprite = new Sprite(material);
  sprite.name = `${emitter.name} spray`;
  sprite.count = count;
  sprite.frustumCulled = false;
  sprite.castShadow = false;
  sprite.receiveShadow = false;
  emitter.updateWorldMatrix(true, false);
  sprite.position.copy(emitter.getWorldPosition(new Vector3()));
  return { sprite, material };
}

/**
 * @param {import("three/webgpu").Object3D[]} emitters
 * @param {{ time: any, count: number }} options
 */
export function createFountains(emitters, { time, count }) {
  const jets = emitters.map((emitter) => createJet(emitter, time, count));
  return {
    sprites: jets.map((jet) => jet.sprite),
    setCount(value) {
      for (const jet of jets) jet.sprite.count = value;
    },
    setVisible(visible) {
      for (const jet of jets) jet.sprite.visible = visible;
    },
    dispose() {
      for (const jet of jets) {
        jet.sprite.removeFromParent();
        jet.material.dispose(); // the sprite quad geometry is shared by three.js; leave it
      }
    },
  };
}
