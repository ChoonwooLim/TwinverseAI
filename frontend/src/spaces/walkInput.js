/**
 * Keyboard helpers for walkable spaces. Pure functions, no DOM access beyond the passed target.
 * Keys are tracked by `KeyboardEvent.code`, so W/A/S/D keep working with a Korean IME layout.
 */

const FORWARD = ["KeyW", "ArrowUp"];
const BACK = ["KeyS", "ArrowDown"];
const LEFT = ["KeyA", "ArrowLeft"];
const RIGHT = ["KeyD", "ArrowRight"];
const RUN = ["ShiftLeft", "ShiftRight"];
const RISE = ["Space", "KeyE"];
const SINK = ["KeyQ", "KeyC"];
const FLIGHT_TOGGLE = "KeyF";

const WALK_KEYS = new Set([...FORWARD, ...BACK, ...LEFT, ...RIGHT, ...RUN]);
const FLIGHT_KEYS = new Set([...RISE, ...SINK]);
const SCROLL_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "PageUp", "PageDown"]);

/** True for the movement and run keys the avatar listens to. */
export function isWalkKey(code) {
  return WALK_KEYS.has(code);
}

/** True for the rise / descend keys used while flying (Space, E, Q, C). Ctrl is never used. */
export function isFlightKey(code) {
  return FLIGHT_KEYS.has(code);
}

/** True for the key that toggles flight (F). */
export function isFlightToggleKey(code) {
  return code === FLIGHT_TOGGLE;
}

/** True for the key that hides or shows the avatar (H). */
export function isAvatarToggleKey(code) {
  return code === "KeyH";
}

/** True for keys whose default action would scroll the page. */
export function scrollsPage(code) {
  return SCROLL_KEYS.has(code);
}

const anyHeld = (keys, codes) => codes.some((code) => keys.has(code));

/**
 * Converts the held keys into a movement intent: `forward` and `right` are -1, 0 or 1
 * (opposite keys cancel out) and `run` is true while Shift is held.
 * @param {Set<string> | null | undefined} keys
 */
export function readMoveIntent(keys) {
  if (!keys || keys.size === 0) return { forward: 0, right: 0, run: false };
  const forward = (anyHeld(keys, FORWARD) ? 1 : 0) - (anyHeld(keys, BACK) ? 1 : 0);
  const right = (anyHeld(keys, RIGHT) ? 1 : 0) - (anyHeld(keys, LEFT) ? 1 : 0);
  return { forward, right, run: anyHeld(keys, RUN) };
}

/**
 * Vertical flight intent: 1 while Space or E is held, -1 for Q or C (opposites cancel out).
 * @param {Set<string> | null | undefined} keys
 */
export function readFlightIntent(keys) {
  if (!keys || keys.size === 0) return { vertical: 0 };
  return { vertical: (anyHeld(keys, RISE) ? 1 : 0) - (anyHeld(keys, SINK) ? 1 : 0) };
}

/** True while the jump key (Space) is held; while flying the same key means "rise". */
export function readJumpIntent(keys) {
  return Boolean(keys?.has("Space"));
}

/** True when the event target is somewhere the user types text. */
export function isEditableTarget(target) {
  if (!target) return false;
  if (target.isContentEditable) return true;
  const tag = typeof target.tagName === "string" ? target.tagName.toUpperCase() : "";
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (typeof target.closest === "function") {
    return Boolean(target.closest('[contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]'));
  }
  return false;
}
