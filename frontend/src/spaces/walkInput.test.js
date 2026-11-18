import { describe, expect, it } from "vitest";
import { isAvatarToggleKey, isEditableTarget, isFlightKey, isFlightToggleKey, isWalkKey, readFlightIntent, readJumpIntent, readMoveIntent, scrollsPage } from "./walkInput";

describe("flight keys", () => {
  it("rises with Space or E, descends with Q or C, toggles with F and never uses Ctrl", () => {
    expect(readFlightIntent(new Set(["Space"]))).toEqual({ vertical: 1 });
    expect(readFlightIntent(new Set(["KeyE"]))).toEqual({ vertical: 1 });
    expect(readFlightIntent(new Set(["KeyQ"]))).toEqual({ vertical: -1 });
    expect(readFlightIntent(new Set(["KeyC", "KeyE"]))).toEqual({ vertical: 0 });
    expect(readFlightIntent(null)).toEqual({ vertical: 0 });
    expect(isFlightKey("Space")).toBe(true);
    expect(isFlightKey("ControlLeft")).toBe(false);
    expect(isFlightToggleKey("KeyF")).toBe(true);
    expect(scrollsPage("Space")).toBe(true);
    expect(readJumpIntent(new Set(["Space"]))).toBe(true);
    expect(readJumpIntent(new Set(["KeyE"]))).toBe(false);
    expect(isAvatarToggleKey("KeyH")).toBe(true);
    expect(isAvatarToggleKey("KeyF")).toBe(false);
  });
});

describe("readMoveIntent", () => {
  it("is idle with no keys", () => {
    expect(readMoveIntent(new Set())).toEqual({ forward: 0, right: 0, run: false });
    expect(readMoveIntent(null)).toEqual({ forward: 0, right: 0, run: false });
  });

  it("maps WASD and the arrow keys", () => {
    expect(readMoveIntent(new Set(["KeyW"]))).toEqual({ forward: 1, right: 0, run: false });
    expect(readMoveIntent(new Set(["ArrowDown"]))).toEqual({ forward: -1, right: 0, run: false });
    expect(readMoveIntent(new Set(["KeyA", "ArrowUp"]))).toEqual({ forward: 1, right: -1, run: false });
    expect(readMoveIntent(new Set(["KeyD", "ShiftRight"]))).toEqual({ forward: 0, right: 1, run: true });
  });

  it("cancels opposite keys", () => {
    expect(readMoveIntent(new Set(["KeyW", "KeyS", "KeyA", "KeyD"]))).toEqual({ forward: 0, right: 0, run: false });
  });
});

describe("key classification", () => {
  it("knows the walk keys and the scrolling keys", () => {
    expect(isWalkKey("KeyW")).toBe(true);
    expect(isWalkKey("ShiftLeft")).toBe(true);
    expect(isWalkKey("KeyQ")).toBe(false);
    expect(scrollsPage("Space")).toBe(true);
    expect(scrollsPage("ArrowLeft")).toBe(true);
    expect(scrollsPage("KeyW")).toBe(false);
  });
});

describe("isEditableTarget", () => {
  it("detects form fields and contenteditable", () => {
    expect(isEditableTarget({ tagName: "INPUT" })).toBe(true);
    expect(isEditableTarget({ tagName: "textarea" })).toBe(true);
    expect(isEditableTarget({ tagName: "DIV", isContentEditable: true })).toBe(true);
    expect(isEditableTarget({ tagName: "SPAN", closest: () => ({}) })).toBe(true);
    expect(isEditableTarget({ tagName: "DIV", closest: () => null })).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});
