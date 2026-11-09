import { test, expect } from "@playwright/test";
import { Buffer } from "node:buffer";

const API = "/api/admin/openclaw/console";

async function mockSession(page) {
  const token = `fixture.${Buffer.from(JSON.stringify({ exp: 9999999999, sub: "admin" })).toString("base64")}.fixture`;
  const sockets = [];
  let closed = 0;
  await page.addInitScript((value) => {
    localStorage.setItem("token", value);
    localStorage.setItem("user", JSON.stringify({ username: "admin", role: "admin" }));
  }, token);
  await page.route("**/api/**", async (route) => {
    const { pathname } = new URL(route.request().url());
    let data = {};
    if (pathname === "/api/auth/me") data = { username: "admin", role: "admin" };
    if (pathname === "/api/admin/stats") data = { total_users: 1, active_users: 1, total_posts: 0, total_comments: 0 };
    if (pathname === `${API}/agents`) data = { agents: [{ id: "main", displayName: "Recovery Agent", model: "test/model" }] };
    if (pathname === `${API}/models`) data = { models: [{ id: "test/model", supportsTools: true }] };
    if (pathname === `${API}/conversations`) data = { conversations: [{ id: 41, title: "Saved conversation" }] };
    if (pathname === `${API}/conversations/41`) data = { messages: [{ role: "assistant", content: "Retained conversation" }] };
    await route.fulfill({ json: data });
  });
  await page.routeWebSocket(`**${API}/chat`, (socket) => {
    sockets.push(socket);
    socket.onClose(() => { closed += 1; });
    socket.onMessage((raw) => {
      const message = JSON.parse(raw);
      if (message.op === "auth") socket.send(JSON.stringify({ op: "ready" }));
      if (message.id) socket.send(JSON.stringify({ id: message.id, result: {} }));
    });
  });
  return { sockets, closed: () => closed };
}

test("a failed route chunk keeps navigation and the console draft alive until manual reload", async ({ page }) => {
  const session = await mockSession(page);
  let documents = 0;
  page.on("request", (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents += 1;
  });
  await page.goto("/admin/openclaw-console/chat");
  await page.getByText("Recovery Agent", { exact: true }).click();
  await expect(page.getByText("Retained conversation", { exact: true })).toBeVisible();
  await expect(page.getByText("연결됨", { exact: false })).toBeVisible();
  await page.getByRole("textbox").fill("Keep this unsaved draft");
  const connections = session.sockets.length;
  const initialDocuments = documents;

  // Reproduce an old hashed JS URL receiving the SPA HTML after a deployment.
  const chunk = /\/(?:src\/pages\/admin\/AdminDashboard\.jsx|assets\/AdminDashboard-[^/]+\.js)(?:\?|$)/;
  await page.route(chunk, (route) => route.fulfill({
    contentType: "text/html", body: "<!doctype html><html><body>New deployment shell</body></html>",
  }));
  await page.locator("header").getByRole("link", { name: "관리자", exact: true }).click();
  await expect(page.getByRole("heading", { name: "페이지를 불러오지 못했습니다" })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "관리자", exact: true })).toBeVisible();
  await expect(page.locator("header").getByRole("link", { name: "홈", exact: true })).toBeVisible();

  await page.clock.install();
  await page.clock.fastForward(30_000);
  expect(documents).toBe(initialDocuments);
  expect(session.closed()).toBe(0);
  await expect(page.getByRole("button", { name: "최신 버전 다시 불러오기" })).toBeVisible();

  await page.locator("header").getByRole("link", { name: "OpenClaw", exact: true }).click();
  await page.getByRole("complementary", { name: "OpenClaw", exact: true }).getByRole("link", { name: "채팅", exact: true }).click();
  await expect(page.getByRole("textbox")).toHaveValue("Keep this unsaved draft");
  await expect(page.getByText("Retained conversation", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "페이지를 불러오지 못했습니다" })).toHaveCount(0);
  expect(session.sockets).toHaveLength(connections);
  expect(session.closed()).toBe(0);
  expect(documents).toBe(initialDocuments);

  await page.locator("header").getByRole("link", { name: "관리자", exact: true }).click();
  await expect(page.getByRole("heading", { name: "페이지를 불러오지 못했습니다" })).toBeVisible();
  await page.unroute(chunk);
  await page.getByRole("button", { name: "최신 버전 다시 불러오기" }).click();
  await expect(page.getByRole("heading", { name: "관리자 대시보드" })).toBeVisible();
  expect(documents).toBe(initialDocuments + 1);
});

test("a shell render failure shows explicit recovery instead of a blank application", async ({ page }) => {
  await page.route("**/api/**", (route) => route.fulfill({ json: {} }));
  await page.addInitScript(() => localStorage.setItem("user", "invalid json"));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "화면을 표시하지 못했습니다" })).toBeVisible();
  await expect(page.getByRole("button", { name: "최신 버전 다시 불러오기" })).toBeVisible();
});
