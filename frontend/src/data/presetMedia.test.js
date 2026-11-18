import { describe, expect, it } from "vitest";
import {
  canViewAdminMedia,
  describeLoadError,
  describeProgress,
  mediaAspect,
  parseNotes,
  presetMediaUrl,
} from "./presetMedia";

const ID = "cine-recast-dragon-rider";

describe("presetMediaUrl", () => {
  it("points admin media at the protected API route", () => {
    expect(presetMediaUrl(ID, "final.mp4", "admin")).toBe(`/api/presets/media/${ID}/final.mp4`);
    expect(presetMediaUrl(ID, "notes.json", "admin")).toBe(`/api/presets/media/${ID}/notes.json`);
  });

  it("points public media at the uploads folder", () => {
    expect(presetMediaUrl(ID, "final-poster.jpg", "public")).toBe(`/uploads/presets/${ID}/final-poster.jpg`);
  });

  it("returns null for an unknown access level instead of guessing", () => {
    expect(presetMediaUrl(ID, "final.mp4", "secret")).toBeNull();
    expect(presetMediaUrl(ID, "final.mp4", undefined)).toBeNull();
  });

  it("encodes anything that is not a plain name, so a bad value cannot change the path", () => {
    expect(presetMediaUrl(ID, "../x.mp4", "admin")).toBe(`/api/presets/media/${ID}/..%2Fx.mp4`);
  });
});

describe("canViewAdminMedia", () => {
  it("allows admin and superadmin with a token", () => {
    expect(canViewAdminMedia({ role: "admin" }, "token")).toBe(true);
    expect(canViewAdminMedia({ role: "superadmin" }, "token")).toBe(true);
  });

  it("refuses other roles", () => {
    expect(canViewAdminMedia({ role: "user" }, "token")).toBe(false);
    expect(canViewAdminMedia({ role: "Admin" }, "token")).toBe(false);
    expect(canViewAdminMedia({}, "token")).toBe(false);
  });

  it("refuses without a token, even with an admin user stored", () => {
    expect(canViewAdminMedia({ role: "admin" }, null)).toBe(false);
    expect(canViewAdminMedia({ role: "admin" }, undefined)).toBe(false);
    expect(canViewAdminMedia({ role: "admin" }, "")).toBe(false);
  });

  it("refuses when no user is stored", () => {
    expect(canViewAdminMedia(null, "token")).toBe(false);
    expect(canViewAdminMedia(undefined, "token")).toBe(false);
    expect(canViewAdminMedia(null, null)).toBe(false);
  });
});

describe("mediaAspect", () => {
  it("keeps well-formed ratios and falls back to 16 / 9", () => {
    expect(mediaAspect("24 / 5")).toBe("24 / 5");
    expect(mediaAspect("2.39 / 1")).toBe("2.39 / 1");
    expect(mediaAspect("16/9; color: red")).toBe("16 / 9");
    expect(mediaAspect(undefined)).toBe("16 / 9");
  });
});

describe("parseNotes", () => {
  it("keeps only { title: string, body: string } entries", () => {
    const data = [
      { title: "a", body: "b", extra: 1 },
      { title: "no body" },
      { title: 1, body: "x" },
      null,
      "text",
      { title: "", body: "" },
    ];
    expect(parseNotes(data)).toEqual([
      { title: "a", body: "b" },
      { title: "", body: "" },
    ]);
  });

  it("returns null when the file is not an array", () => {
    expect(parseNotes({ title: "a", body: "b" })).toBeNull();
    expect(parseNotes("[]")).toBeNull();
    expect(parseNotes(null)).toBeNull();
  });
});

describe("describeLoadError", () => {
  it("explains a missing video or notes file without offering a retry", () => {
    expect(describeLoadError(404, "video")).toEqual({ message: "영상 파일이 아직 서버에 없습니다.", retry: false });
    expect(describeLoadError(404, "notes")).toEqual({ message: "메모 파일이 아직 서버에 없습니다.", retry: false });
  });

  it("explains a refused request", () => {
    expect(describeLoadError(403, "video")).toEqual({ message: "관리자 권한이 필요합니다.", retry: false });
    expect(describeLoadError(403, "notes")).toEqual({ message: "관리자 권한이 필요합니다.", retry: false });
  });

  it("offers a retry for anything else", () => {
    expect(describeLoadError(500, "video")).toEqual({ message: "영상을 불러오지 못했습니다.", retry: true });
    expect(describeLoadError(undefined, "notes")).toEqual({ message: "메모를 불러오지 못했습니다.", retry: true });
  });
});

describe("describeProgress", () => {
  it("shows percent and sizes when the total is known", () => {
    expect(describeProgress(5 * 1024 * 1024, 10 * 1024 * 1024)).toEqual({ percent: 50, text: "50% · 5.0 MB / 10.0 MB" });
    expect(describeProgress(20, 10).percent).toBe(100);
  });

  it("shows received size only when the total is unknown", () => {
    expect(describeProgress(1024 * 1024, 0)).toEqual({ percent: null, text: "1.0 MB 받음" });
    expect(describeProgress(undefined, undefined)).toEqual({ percent: null, text: "0.0 MB 받음" });
  });
});
