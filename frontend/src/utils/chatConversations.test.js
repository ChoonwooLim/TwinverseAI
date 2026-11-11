import { describe, expect, it } from "vitest";
import {
  apiErrorText,
  isAlreadyGone,
  resolveActiveConversation,
  sessionKeysForConversation,
  withoutDeleted,
} from "./chatConversations";

const httpError = (status, detail) => ({ message: `Request failed with status code ${status}`, response: { status, data: { detail } } });

describe("apiErrorText", () => {
  it("uses a string detail as-is", () => {
    expect(apiErrorText(httpError(409, "잠시 후 다시 삭제해 주세요."), "대화 삭제 실패")).toBe("잠시 후 다시 삭제해 주세요.");
  });

  it("flattens a FastAPI validation array instead of returning an object", () => {
    const text = apiErrorText(httpError(422, [{ loc: ["path", "conv_id"], msg: "value is not a valid integer" }]), "대화 삭제 실패");
    expect(text).toBe("value is not a valid integer");
  });

  it("never returns a non-string for object details", () => {
    expect(apiErrorText(httpError(500, { message: "boom" }), "대화 삭제 실패")).toBe("boom");
    expect(apiErrorText(httpError(500, { code: 1 }), "대화 삭제 실패")).toBe("대화 삭제 실패 (HTTP 500)");
  });

  it("names the action when the server sent no detail", () => {
    expect(apiErrorText(httpError(502, undefined), "대화 삭제 실패")).toBe("대화 삭제 실패 (HTTP 502)");
    expect(apiErrorText(new Error("Network Error"), "대화 삭제 실패")).toBe("대화 삭제 실패: Network Error");
    expect(apiErrorText(undefined, "대화 삭제 실패")).toBe("대화 삭제 실패");
  });
});

describe("isAlreadyGone", () => {
  it("treats only 404 as already deleted", () => {
    expect(isAlreadyGone(httpError(404, "conversation not found"))).toBe(true);
    expect(isAlreadyGone(httpError(409, "busy"))).toBe(false);
    // a 404 that is not the API's own answer (proxy, missing route) is a failure
    expect(isAlreadyGone(httpError(404, "Not Found"))).toBe(false);
    expect(isAlreadyGone(httpError(404, undefined))).toBe(false);
    expect(isAlreadyGone(httpError(500, "x"))).toBe(false);
    expect(isAlreadyGone(new Error("Network Error"))).toBe(false);
  });
});

describe("withoutDeleted", () => {
  const convs = [{ id: 3 }, { id: 2 }, { id: 1 }];

  it("filters a stale server list so a deleted conversation is not resurrected", () => {
    expect(withoutDeleted(convs, new Set([2]))).toEqual([{ id: 3 }, { id: 1 }]);
  });

  it("passes the list through when nothing was deleted, and tolerates a missing list", () => {
    expect(withoutDeleted(convs, new Set())).toBe(convs);
    expect(withoutDeleted(undefined, new Set([1]))).toEqual([]);
  });
});

describe("resolveActiveConversation", () => {
  const convs = [{ id: 3 }, { id: 2 }];

  it("keeps the current conversation while it still exists", () => {
    expect(resolveActiveConversation(convs, 2)).toBe(2);
  });

  it("falls back to the most recent when the current one is gone", () => {
    expect(resolveActiveConversation(convs, 9)).toBe(3);
    expect(resolveActiveConversation(convs, null)).toBe(3);
  });

  it("selects nothing for an empty list instead of asking for a new conversation", () => {
    expect(resolveActiveConversation([], 9)).toBeNull();
    expect(resolveActiveConversation(undefined, null)).toBeNull();
  });
});

describe("sessionKeysForConversation", () => {
  it("returns only the gateway sessions bound to that conversation", () => {
    const map = { "agent:a:dashboard:1": 7, "agent:a:dashboard:2": 8, "agent:a:dashboard:3": 7 };
    expect(sessionKeysForConversation(map, 7)).toEqual(["agent:a:dashboard:1", "agent:a:dashboard:3"]);
    expect(sessionKeysForConversation(map, 99)).toEqual([]);
    expect(sessionKeysForConversation(undefined, 7)).toEqual([]);
  });
});
