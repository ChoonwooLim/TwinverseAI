/**
 * Reads an avatar sidecar (`avatar.json`) and maps logical humanoid bones to the node names in
 * the GLB. Pure functions, no three.js. Every field of the sidecar is optional: missing bones are
 * guessed from the skeleton's names (Mixamo / Ready Player Me and Unreal mannequin styles).
 */

export const LOGICAL_BONES = [
  "hips", "neck", "head",
  "leftUpLeg", "leftLeg", "leftFoot", "leftToe",
  "rightUpLeg", "rightLeg", "rightFoot", "rightToe",
  "leftShoulder", "leftArm", "leftForeArm", "leftHand",
  "rightShoulder", "rightArm", "rightForeArm", "rightHand",
];

/** Bones the gait cannot do without; the avatar stands still if any is missing. */
export const REQUIRED_BONES = ["hips", "leftUpLeg", "leftLeg", "rightUpLeg", "rightLeg"];

const SIDE_PATTERNS = {
  UpLeg: ["{s}upleg", "thigh{x}", "{x}thigh", "{s}thigh", "upperleg{x}", "{s}upperleg"],
  Leg: ["{s}leg", "calf{x}", "{x}calf", "{s}calf", "lowerleg{x}", "{s}lowerleg", "{s}knee", "shin{x}"],
  Foot: ["{s}foot", "foot{x}", "{x}foot", "{s}ankle"],
  Toe: ["{s}toebase", "{s}toe", "{s}toes", "ball{x}", "toe{x}", "{x}toe"],
  Shoulder: ["{s}shoulder", "clavicle{x}", "{x}clavicle", "{s}clavicle"],
  Arm: ["{s}arm", "upperarm{x}", "{x}upperarm", "{s}upperarm"],
  ForeArm: ["{s}forearm", "lowerarm{x}", "{x}forearm", "{s}lowerarm", "forearm{x}"],
  Hand: ["{s}hand", "hand{x}", "{x}hand"],
};

const CENTRE_PATTERNS = {
  hips: ["hips", "pelvis", "hip"],
  neck: ["neck", "neck01", "neck1"],
  head: ["head"],
};

const NAME_PREFIXES = ["mixamorig", "armature"];

/** Same sanitising three.js GLTFLoader applies to node names (PropertyBinding.sanitizeNodeName). */
export function sanitizeNodeName(name) {
  return String(name).replace(/\s/g, "_").replace(/[[\].:/]/g, "");
}

/** Lower-case, alphanumeric only, common rig prefixes removed. */
export function normalizeBoneName(name) {
  let key = String(name).toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const prefix of NAME_PREFIXES) {
    if (key.startsWith(prefix) && key.length > prefix.length + 2) {
      key = key.slice(prefix.length);
      break;
    }
  }
  return key;
}

function flattenBoneMap(bones) {
  const flat = new Map();
  if (!bones || typeof bones !== "object") return flat;
  for (const [key, value] of Object.entries(bones)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
    if ((normalizedKey === "left" || normalizedKey === "right") && value && typeof value === "object" && !Array.isArray(value)) {
      for (const [inner, innerValue] of Object.entries(value)) {
        flat.set(normalizedKey + inner.toLowerCase().replace(/[^a-z0-9]/g, ""), innerValue);
      }
    } else {
      flat.set(normalizedKey, value);
    }
  }
  return flat;
}

function asName(value) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && typeof value.name === "string") return value.name;
  return null;
}

function sideCandidates(side, part) {
  const s = side;
  const x = side === "left" ? "l" : "r";
  return SIDE_PATTERNS[part].map((pattern) => pattern.replace("{s}", s).replace("{x}", x));
}

/**
 * @param {string[]} boneNames node names of the skeleton's bones, as they appear after loading
 * @param {object} [config] the parsed avatar.json
 * @returns {{ bones: Record<string, string | null> & { spine: string[] }, missing: string[],
 *   yawDeg: number, heightM: number | null, restPose: string | null }}
 */
export function resolveAvatarBones(boneNames, config = {}) {
  const byExact = new Map();
  const byNormalized = new Map();
  for (const name of boneNames) {
    byExact.set(name, name);
    byExact.set(sanitizeNodeName(name), name);
    const key = normalizeBoneName(name);
    if (!byNormalized.has(key)) byNormalized.set(key, name);
  }
  const find = (name) => {
    if (typeof name !== "string" || !name) return null;
    return byExact.get(name) ?? byExact.get(sanitizeNodeName(name)) ?? byNormalized.get(normalizeBoneName(name)) ?? null;
  };
  const guess = (candidates) => {
    for (const candidate of candidates) {
      const hit = byNormalized.get(candidate);
      if (hit) return hit;
    }
    return null;
  };

  const declared = flattenBoneMap(config?.bones);
  const bones = { spine: [] };

  for (const logical of LOGICAL_BONES) {
    const key = logical.toLowerCase();
    const fromConfig = find(asName(declared.get(key)) ?? (key.endsWith("toe") ? asName(declared.get(`${key}base`)) : null));
    let guessed = null;
    if (!fromConfig) {
      const side = logical.startsWith("left") ? "left" : logical.startsWith("right") ? "right" : null;
      guessed = side
        ? guess(sideCandidates(side, logical.slice(side.length)))
        : guess(CENTRE_PATTERNS[logical] ?? []);
    }
    bones[logical] = fromConfig ?? guessed;
  }

  // Spine chain: declared list (or single name), otherwise spine, spine1, spine2... in order.
  const declaredSpine = declared.get("spine");
  const spineList = Array.isArray(declaredSpine) ? declaredSpine : declaredSpine ? [declaredSpine] : [];
  for (const entry of spineList) {
    const name = find(asName(entry));
    if (name && !bones.spine.includes(name)) bones.spine.push(name);
  }
  if (bones.spine.length === 0) {
    const chain = [];
    for (const name of boneNames) {
      const match = /^spine(\d*)$/.exec(normalizeBoneName(name));
      if (match) chain.push({ name, order: match[1] === "" ? 0 : Number(match[1]) + 0.1 });
    }
    chain.sort((a, b) => a.order - b.order);
    bones.spine = chain.map((entry) => entry.name);
  }

  const missing = LOGICAL_BONES.filter((logical) => !bones[logical]);
  const yaw = Number(config?.yawToFacePlusZDeg);
  const height = Number(config?.heightM);
  return {
    bones,
    missing,
    yawDeg: Number.isFinite(yaw) ? yaw : 0,
    heightM: Number.isFinite(height) && height > 0.5 && height < 3 ? height : null,
    restPose: typeof config?.restPose === "string" ? config.restPose : null,
  };
}

const AXIS_WORDS = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };

/**
 * Parses an axis from `boneAxes` data: "+X", "-y", "z", [0, 1, 0] or { x, y, z }.
 * @returns {[number, number, number] | null} unit vector, or null when unreadable
 */
export function parseAxis(value) {
  let v = null;
  if (Array.isArray(value) && value.length >= 3) v = value.slice(0, 3).map(Number);
  else if (value && typeof value === "object") v = [Number(value.x), Number(value.y), Number(value.z)];
  else if (typeof value === "string") {
    const match = /^\s*([+-]?)\s*([xyz])\s*$/i.exec(value);
    if (match) v = AXIS_WORDS[match[2].toLowerCase()].map((c) => (match[1] === "-" ? -c : c));
  }
  if (!v || v.some((c) => !Number.isFinite(c))) return null;
  const length = Math.hypot(v[0], v[1], v[2]);
  return length > 1e-6 ? [v[0] / length, v[1] / length, v[2] / length] : null;
}

const HINGE_FIELDS = ["hingeAxisLocal", "hingeAxisPositiveRotation", "hinge", "hingeAxis"];
const LOWER_FIELDS = ["lowerArmAxisLocal", "lowerArmAxisPositiveRotation", "lowerAxis"];

/**
 * Reads a bone-local axis from `boneAxes`, accepting the logical name or the node name as key
 * and returning the first readable field among `fields` (an exact local vector is listed first,
 * then the signed axis word).
 * @returns {[number, number, number] | null}
 */
export function readBoneAxis(boneAxes, logical, nodeName, fields = HINGE_FIELDS) {
  if (!boneAxes || typeof boneAxes !== "object") return null;
  const wanted = [logical, nodeName].filter(Boolean).map((key) => key.toLowerCase().replace(/[^a-z0-9]/g, ""));
  for (const [key, entry] of Object.entries(boneAxes)) {
    if (!wanted.includes(key.toLowerCase().replace(/[^a-z0-9]/g, ""))) continue;
    for (const field of fields) {
      const axis = parseAxis(entry?.[field]);
      if (axis) return axis;
    }
  }
  return null;
}

/** Local axis whose positive rotation produces the bone's natural hinge motion. */
export function readHingeAxis(boneAxes, logical, nodeName) {
  return readBoneAxis(boneAxes, logical, nodeName, HINGE_FIELDS);
}

/** Local axis whose positive rotation lowers an upper arm toward the body. */
export function readLowerArmAxis(boneAxes, logical, nodeName) {
  return readBoneAxis(boneAxes, logical, nodeName, LOWER_FIELDS);
}

/** Upper-arm angle below horizontal in the rest pose, in degrees, or null. */
export function readArmRestAngle(config, side) {
  const value = Number(config?.upperArmAngleBelowHorizontalDeg?.[side]);
  return Number.isFinite(value) && value >= 0 && value <= 90 ? value : null;
}
