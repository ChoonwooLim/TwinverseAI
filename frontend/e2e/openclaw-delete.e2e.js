import { test, expect } from "@playwright/test";
import { Buffer } from "node:buffer";

const API = "/api/admin/openclaw/console";
async function fixture(page, status = 200) {
  let rows = [{ id: 41, title: "삭제 검증용 임시 대화" }];
  const state = { creates: 0, deletes: 0 };
  await page.addInitScript((token) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify({ username: "admin", role: "admin" }));
  }, `fixture.${Buffer.from(JSON.stringify({ exp: 9999999999, sub: "admin" })).toString("base64")}.fixture`);
  await page.route("**/api/**", async (route) => {
    const { pathname } = new URL(route.request().url());
    const method = route.request().method();
    let data = {};
    if (pathname === "/api/auth/me") data = { username: "admin", role: "admin" };
    if (pathname.startsWith("/api/boards/")) data = { items: [] };
    if (pathname === `${API}/agents`) data = { agents: [{ id: "main", displayName: "삭제 테스트 에이전트" }] };
    if (pathname === `${API}/conversations`) {
      if (method === "POST") state.creates++;
      data = { conversations: rows };
    }
    if (pathname === `${API}/conversations/41`) {
      data = { messages: [{ role: "assistant", content: "임시 대화 내용" }] };
      if (method === "DELETE") {
        state.deletes++;
        if (status === 200 || status === 404) rows = [];
        return route.fulfill({ status, json: status === 200 ? { ok: true } : { detail: status === 404 ? "conversation not found" : [{ msg: "삭제 요청 오류 검증" }] } });
      }
    }
    await route.fulfill({ json: data });
  });
  await page.routeWebSocket(`**${API}/chat`, (socket) => socket.onMessage((raw) => {
    const m = JSON.parse(raw);
    if (m.op === "auth") socket.send(JSON.stringify({ op: "ready" }));
    if (m.id) socket.send(JSON.stringify({ id: m.id, result: {} }));
  }));
  return state;
}
async function open(page) {
  await page.goto("/admin/openclaw-console/chat");
  await page.getByText("삭제 테스트 에이전트", { exact: true }).click();
}
for (const status of [200, 404]) {
  test(`trash removes saved conversation and reload stays empty (${status})`, async ({ page }) => {
    const state = await fixture(page, status);
    await open(page);
    await expect(page.getByText("임시 대화 내용", { exact: true })).toBeVisible();
    page.once("dialog", d => d.accept());
    await page.getByRole("button", { name: "대화 삭제", exact: true }).click();
    await expect(page.getByText("삭제 검증용 임시 대화", { exact: true })).toHaveCount(0);
    await expect(page.getByText("임시 대화 내용", { exact: true })).toHaveCount(0);
    await open(page);
    await expect(page.getByRole("button", { name: "대화 삭제", exact: true })).toHaveCount(0);
    expect(state.deletes).toBe(1);
    expect(state.creates).toBe(0);
  });
}
test("failed deletion retains conversation and displays structured error", async ({ page }) => {
  await fixture(page, 409);
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await open(page);
  page.once("dialog", d => d.accept());
  await page.getByRole("button", { name: "대화 삭제", exact: true }).click();
  await expect(page.getByText("삭제 요청 오류 검증", { exact: true })).toBeVisible();
  await expect(page.getByText("삭제 검증용 임시 대화", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
