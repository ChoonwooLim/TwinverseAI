import { test, expect } from "@playwright/test";
import { Buffer } from "node:buffer";

const CHAT_PATH = "/admin/openclaw-console/chat";
const API = "/api/admin/openclaw/console";
const tokenFor = (username) => `fixture.${Buffer.from(JSON.stringify({ exp: 9999999999, sub: username })).toString("base64")}.fixture`;

async function fixture(page, role = "admin") {
  const state = { sockets: [], closed: 0, requests: [], rpc: [], agents: [{ id: "main", displayName: "Session Agent", model: "test/model" }] };
  await page.addInitScript(({ token, role }) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify({ username: "admin", role }));
  }, { token: tokenFor("admin"), role });
  await page.context().route("**/api/**", async (route) => {
    const { pathname } = new URL(route.request().url());
    state.requests.push(pathname);
    let data = {};
    if (pathname === "/api/auth/me") data = { username: "admin", role };
    if (pathname === "/api/auth/login") {
      data = { access_token: tokenFor("second-admin"), user: { username: "second-admin", role: "admin" } };
    }
    if (pathname === `${API}/health`) data = { ok: true };
    if (pathname === `${API}/agents/main` && route.request().method() === "PATCH") {
      Object.assign(state.agents[0], route.request().postDataJSON());
    }
    if (pathname === `${API}/agents/main` && route.request().method() === "DELETE") state.agents = [];
    if (pathname === `${API}/agents`) data = { agents: state.agents };
    if (pathname === `${API}/models`) data = { models: [{ id: "test/model", supportsTools: true }, { id: "test/next-model", supportsTools: true }] };
    if (pathname === `${API}/conversations`) data = { conversations: [{ id: 41, title: "Saved conversation" }] };
    if (pathname === `${API}/conversations/41`) {
      data = { messages: Array.from({ length: 24 }, (_, i) => ({ role: "assistant", content: `History message ${i + 1}` })) };
    }
    await route.fulfill({ json: data });
  });
  await page.routeWebSocket(`**${API}/chat`, (socket) => {
    state.sockets.push(socket);
    socket.onClose(() => { state.closed += 1; });
    socket.onMessage((raw) => {
      const message = JSON.parse(raw);
      if (message.op === "auth") socket.send(JSON.stringify({ op: "ready" }));
      if (message.id) {
        state.rpc.push(message);
        socket.send(JSON.stringify({ id: message.id, result: message.method === "sessions.create" ? { key: "test-session" } : {} }));
      }
    });
  });
  return state;
}

async function openChat(page) {
  await page.locator("header").getByRole("link", { name: "OpenClaw", exact: true }).click();
  await page.getByRole("complementary", { name: "OpenClaw", exact: true }).getByRole("link", { name: "채팅", exact: true }).click();
  await expect(page.locator('a[aria-current="page"][href="/admin/openclaw-console/chat"]')).toBeVisible();
  await expect(page.getByRole("textbox")).toBeVisible();
}

async function selectAgent(page) {
  await page.getByText("Session Agent", { exact: true }).click();
  await expect(page.getByText("History message 24", { exact: true })).toBeVisible();
  await expect(page.getByText("연결됨", { exact: false })).toBeVisible();
}

test("keeps selection, draft, attachments, scroll and one connection across site and console navigation", async ({ page }) => {
  const state = await fixture(page);
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "관리자 대시보드" })).toBeVisible();
  expect(state.requests.filter((path) => path === `${API}/agents`)).toHaveLength(0);
  await openChat(page);
  await selectAgent(page);
  await page.getByRole("textbox").fill("Draft kept while navigating");
  await page.locator('input[type="file"]').setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("Attached notes") });
  await expect(page.getByText("notes.txt", { exact: true })).toBeVisible();
  const messages = page.locator('[class*="chatMessages"]');
  await messages.evaluate((el) => { el.scrollTop = 120; el.dispatchEvent(new Event("scroll")); });
  const scrollTop = await messages.evaluate((el) => el.scrollTop);
  const dataRequests = state.requests.filter((path) => path === `${API}/agents` || path.includes("/conversations")).length;
  const connections = state.sockets.length;

  for (const destination of ["관리자", "비전"]) {
    await page.locator("header").getByRole("link", { name: destination, exact: true }).click();
    await expect(page.getByRole("heading", { name: "OpenClaw 관리 콘솔" })).toBeHidden();
    await openChat(page);
    await expect(page.getByRole("textbox")).toHaveValue("Draft kept while navigating");
    await expect(page.getByText("notes.txt", { exact: true })).toBeVisible();
    await expect.poll(() => messages.evaluate((el) => el.scrollTop)).toBe(scrollTop);
  }
  await page.getByRole("complementary", { name: "OpenClaw", exact: true }).getByRole("link", { name: "플러그인", exact: true }).click();
  await expect(page.locator('a[aria-current="page"][href$="/plugins"]')).toBeVisible();
  await expect(page.getByRole("textbox")).toBeHidden();
  await page.getByRole("complementary", { name: "OpenClaw", exact: true }).getByRole("link", { name: "채팅", exact: true }).click();
  await expect(page.getByRole("textbox")).toHaveValue("Draft kept while navigating");
  expect(state.requests.filter((path) => path === `${API}/agents` || path.includes("/conversations"))).toHaveLength(dataRequests);
  expect(state.sockets).toHaveLength(connections);
  expect(state.closed).toBe(0);
});

test("retained chat reflects explicit agent edits and deletion without losing the current conversation on edit", async ({ page }) => {
  await fixture(page);
  await page.goto(CHAT_PATH);
  await selectAgent(page);
  await page.getByRole("textbox").fill("Retained draft");
  const sidebar = page.getByRole("complementary", { name: "OpenClaw", exact: true });
  await sidebar.getByRole("link", { name: "에이전트", exact: true }).click();
  await page.getByRole("button", { name: "편집", exact: true }).click();
  const modal = page.locator('[class*="modalBody"]');
  await modal.locator('input').first().fill("Renamed Agent");
  await modal.getByRole("button", { name: "저장", exact: true }).click();
  await expect(modal).toHaveCount(0);
  await sidebar.getByRole("link", { name: "채팅", exact: true }).click();
  await expect(page.locator('a[aria-current="page"][href="/admin/openclaw-console/chat"]')).toBeVisible();
  await expect(page.getByRole("complementary", { name: "에이전트", exact: true }).getByText("Renamed Agent", { exact: true })).toBeVisible();
  await expect(page.getByRole("textbox")).toHaveValue("Retained draft");
  await expect(page.getByText("Saved conversation", { exact: true })).toBeVisible();
  await sidebar.getByRole("link", { name: "에이전트", exact: true }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "삭제", exact: true }).click();
  await expect(page.getByText("deleted: main", { exact: true })).toBeVisible();
  await sidebar.getByRole("link", { name: "채팅", exact: true }).click();
  await expect(page.locator('a[aria-current="page"][href="/admin/openclaw-console/chat"]')).toBeVisible();
  await expect(page.getByText("Renamed Agent", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("textbox")).toBeDisabled();
});

test("receives a pending reply while away and reuses the gateway session on return", async ({ page }) => {
  const state = await fixture(page);
  await page.goto(CHAT_PATH);
  await selectAgent(page);
  await page.getByRole("textbox").fill("First question");
  await page.getByRole("button", { name: "전송", exact: true }).click();
  await expect.poll(() => state.rpc.filter((m) => m.method === "sessions.send").length).toBe(1);
  await page.locator("header").getByRole("link", { name: "관리자", exact: true }).click();
  await expect(page.getByRole("heading", { name: "관리자 대시보드" })).toBeVisible();
  expect(state.closed).toBe(0);
  state.sockets.at(-1).send(JSON.stringify({ method: "session.message", params: { sessionKey: "test-session", message: { role: "assistant", content: "Reply received while away" } } }));
  await openChat(page);
  await expect(page.getByText("Reply received while away", { exact: true })).toBeVisible();
  await page.getByRole("textbox").fill("Follow-up question");
  await page.getByRole("button", { name: "전송", exact: true }).click();
  await expect.poll(() => state.rpc.filter((m) => m.method === "sessions.send").length).toBe(2);
  expect(state.rpc.filter((m) => m.method === "sessions.create")).toHaveLength(1);
  expect(state.rpc.filter((m) => m.method === "sessions.send").every((m) => m.params.tvConversationId === 41)).toBe(true);
});

test("logout discards retained chat before a different administrator signs in", async ({ page }) => {
  const state = await fixture(page);
  await page.goto(CHAT_PATH);
  await selectAgent(page);
  await page.getByRole("textbox").fill("Private draft");
  await page.locator("header").getByRole("button", { name: "로그아웃" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect.poll(() => state.closed).toBe(1);
  await expect(page.getByText("Saved conversation", { exact: true })).toHaveCount(0);
  await page.locator("#login-username").fill("second-admin");
  await page.locator("#login-password").fill("fixture-password");
  await page.locator('button[type="submit"]').click();
  await expect(page.getByRole("heading", { name: "관리자 대시보드" })).toBeVisible();
  await openChat(page);
  await expect(page.getByRole("textbox")).toHaveValue("");
  await expect(page.getByRole("textbox")).toBeDisabled();
  await expect(page.getByText("Saved conversation", { exact: true })).toHaveCount(0);
});

test("a model change preserves the in-flight reply and creates a fresh session for the next message", async ({ page }) => {
  const state = await fixture(page);
  await page.goto(CHAT_PATH);
  await selectAgent(page);
  await page.getByRole("textbox").fill("Question before changing model");
  await page.getByRole("button", { name: "전송", exact: true }).click();
  await expect.poll(() => state.rpc.filter((m) => m.method === "sessions.send").length).toBe(1);
  const sidebar = page.getByRole("complementary", { name: "OpenClaw", exact: true });
  await sidebar.getByRole("link", { name: "에이전트", exact: true }).click();
  await page.getByRole("button", { name: "편집", exact: true }).click();
  const modal = page.locator('[class*="modalBody"]');
  await modal.getByRole("combobox").selectOption("test/next-model");
  await modal.getByRole("button", { name: "저장", exact: true }).click();
  await expect(modal).toHaveCount(0);
  state.sockets.at(-1).send(JSON.stringify({ method: "session.message", params: { sessionKey: "test-session", message: { role: "assistant", content: "Reply from the previous model" } } }));
  await sidebar.getByRole("link", { name: "채팅", exact: true }).click();
  await expect(page.getByText("Reply from the previous model", { exact: true })).toBeVisible();
  await expect(page.locator('[class*="msgPending"]')).toHaveCount(0);
  await page.getByRole("textbox").fill("Question for the new model");
  await page.getByRole("button", { name: "전송", exact: true }).click();
  await expect.poll(() => state.rpc.filter((m) => m.method === "sessions.send").length).toBe(2);
  expect(state.rpc.filter((m) => m.method === "sessions.create")).toHaveLength(2);
  expect(state.rpc.filter((m) => m.method === "sessions.send").at(-1).params.message).toContain("Reply from the previous model");
});

test("a logout in another browser tab also clears the retained console", async ({ page, context }) => {
  const state = await fixture(page);
  await page.goto(CHAT_PATH);
  await selectAgent(page);
  await page.locator("header").getByRole("link", { name: "관리자", exact: true }).click();
  await expect(page.getByRole("heading", { name: "관리자 대시보드" })).toBeVisible();
  const otherTab = await context.newPage();
  await otherTab.goto("/");
  await otherTab.evaluate(() => { localStorage.removeItem("token"); localStorage.removeItem("user"); });
  await expect.poll(() => state.closed).toBe(1);
  await expect(page.getByText("Saved conversation", { exact: true })).toHaveCount(0);
});

test("a non-administrator cannot initialize the retained console", async ({ page }) => {
  const state = await fixture(page, "user");
  await page.goto(CHAT_PATH);
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { name: "OpenClaw 관리 콘솔" })).toHaveCount(0);
  expect(state.requests.filter((path) => path.startsWith(API))).toHaveLength(0);
});
