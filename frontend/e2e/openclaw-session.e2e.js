import { test, expect } from "@playwright/test";
import { Buffer } from "node:buffer";

const CHAT_PATH = "/admin/openclaw-console/chat";
const API = "/api/admin/openclaw/console";
const tokenFor = (username) => `fixture.${Buffer.from(JSON.stringify({ exp: 9999999999, sub: username })).toString("base64")}.fixture`;
const browserErrors = new WeakMap();

test.beforeEach(({ context }) => {
  const errors = [];
  browserErrors.set(context, errors);
  context.on("weberror", (event) => errors.push(event.error().message));
});

test.afterEach(({ context }) => {
  expect(browserErrors.get(context), "Unexpected browser errors").toEqual([]);
});

async function fixture(page, role = "admin") {
  const state = {
    sockets: [], closed: 0, logSockets: [], logsClosed: 0, requests: [], rpc: [],
    agents: [{ id: "main", displayName: "Session Agent", model: "test/model" }],
    models: [{ id: "test/model", supportsTools: true }, { id: "test/next-model", supportsTools: true }],
  };
  await page.addInitScript(({ token, role }) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify({ username: "admin", role }));
  }, { token: tokenFor("admin"), role });
  await page.context().route("**/api/**", async (route) => {
    const { pathname } = new URL(route.request().url());
    state.requests.push(pathname);
    let data = {};
    if (pathname.startsWith("/api/boards/")) data = { items: [] };
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
    if (pathname === `${API}/models`) data = { models: state.models };
    if (pathname === `${API}/plugins`) data = { plugins: [{ id: "fixture-plugin", enabled: true }] };
    if (pathname === `${API}/plugins/fixture-plugin/config`) data = { config: { enabled: true } };
    if (pathname === `${API}/config`) data = { value: { fixture: true } };
    if (pathname === `${API}/gateway/token`) data = { token: "fixture-token-for-browser-tests", backendSynced: true };
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
  await page.routeWebSocket(`**${API}/logs`, (socket) => {
    state.logSockets.push(socket);
    socket.onClose(() => { state.logsClosed += 1; });
    socket.onMessage((raw) => {
      if (JSON.parse(raw).op === "auth") socket.send(JSON.stringify({ op: "log.ready" }));
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

// 1x1 PNGs with different pixels, so they are distinct images.
const PNG_RED = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==";
const PNG_BLUE = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPj/HwADBwIAMCbHYQAAAABJRU5ErkJggg==";

// Dispatch a real paste event carrying files, the way a screenshot paste does.
async function pasteFiles(page, files, text = {}) {
  await page.getByRole("textbox").evaluate((textarea, { files, text }) => {
    const data = new DataTransfer();
    for (const f of files) {
      const bytes = f.base64
        ? Uint8Array.from(atob(f.base64), (c) => c.charCodeAt(0))
        : new Uint8Array(f.size || 0);
      data.items.add(new File([bytes], f.name, { type: f.type }));
    }
    for (const [type, value] of Object.entries(text)) data.setData(type, value);
    textarea.focus();
    textarea.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  }, { files, text });
}

test("pasting clipboard images attaches previews once, enforces limits and sends them as attachments", async ({ page }) => {
  const state = await fixture(page);
  await page.goto(CHAT_PATH);
  await selectAgent(page);
  const thumbs = page.locator('img[alt$="미리보기"]');
  const alert = page.getByRole("alert");

  // One screenshot is exposed through both clipboard files and items: one chip.
  await pasteFiles(page, [{ name: "image.png", type: "image/png", base64: PNG_RED }]);
  await expect(thumbs).toHaveCount(1);
  await expect(page.getByRole("textbox")).toHaveValue("");
  await expect(thumbs.first()).toHaveJSProperty("naturalWidth", 1);

  // The same image again is not attached twice.
  await pasteFiles(page, [{ name: "image.png", type: "image/png", base64: PNG_RED }]);
  await expect(alert).toContainText("이미 첨부된 이미지입니다.");
  await expect(thumbs).toHaveCount(1);

  // Unsupported type and an over-limit image are rejected inline in Korean.
  await pasteFiles(page, [{ name: "image.bmp", type: "image/bmp", size: 16 }]);
  await expect(alert).toContainText("PNG, JPEG, GIF, WebP만 첨부할 수 있습니다.");
  await pasteFiles(page, [{ name: "huge.png", type: "image/png", size: 9 * 1024 * 1024 + 1 }]);
  await expect(alert).toContainText("한 파일당 최대 9MB까지 첨부할 수 있습니다.");
  await expect(thumbs).toHaveCount(1);

  // A second, different image can be added and then removed again.
  await pasteFiles(page, [{ name: "image.png", type: "image/png", base64: PNG_BLUE }]);
  await expect(thumbs).toHaveCount(2);
  await expect(alert).toHaveCount(0);
  await page.getByRole("button", { name: /첨부 제거$/ }).last().click();
  await expect(thumbs).toHaveCount(1);

  // Image-only send: default prompt plus the base64 attachment over sessions.send.
  await page.getByRole("button", { name: "전송", exact: true }).click();
  await expect.poll(() => state.rpc.filter((m) => m.method === "sessions.send").length).toBe(1);
  const { params } = state.rpc.find((m) => m.method === "sessions.send");
  expect(params.tvRawUserText).toBe("첨부한 이미지를 확인하고 내용을 설명해 주세요.");
  expect(params.message).toContain("첨부한 이미지를 확인하고 내용을 설명해 주세요.");
  expect(params.attachments).toHaveLength(1);
  expect(params.attachments[0]).toMatchObject({ type: "image", mimeType: "image/png", content: PNG_RED });
  expect(params.attachments[0].fileName).toMatch(/^붙여넣은-이미지-\d{8}-\d{6}\.png$/);
  await expect(thumbs).toHaveCount(0);
});

test("pasting text into the chat box stays an ordinary text paste", async ({ page }) => {
  await fixture(page);
  await page.goto(CHAT_PATH);
  await selectAgent(page);
  const textbox = page.getByRole("textbox");

  // A plain-text paste is not intercepted by the composer.
  const plainPrevented = await textbox.evaluate((textarea) => {
    const data = new DataTransfer();
    data.setData("text/plain", "just text");
    const event = new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true });
    textarea.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(plainPrevented).toBe(false);

  // A rich copy (cells with a rendered bitmap) is also left to the browser.
  await pasteFiles(
    page,
    [{ name: "image.png", type: "image/png", base64: PNG_RED }],
    { "text/plain": "A1\tB1", "text/html": "<table><tr><td>A1</td><td>B1</td></tr></table>" },
  );
  await textbox.fill("typed after paste");
  await expect(page.locator('img[alt$="미리보기"]')).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
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
  await expect(page.locator("main h1")).toBeVisible();
  await expect(page.getByRole("heading", { name: "OpenClaw 관리 콘솔" })).toHaveCount(0);
  expect(state.requests.filter((path) => path.startsWith(API))).toHaveLength(0);
});

test("agent list and model choices are cached across console aliases and site navigation until explicit refresh", async ({ page }) => {
  const state = await fixture(page);
  await page.goto("/admin/openclaw-console/agents");
  await expect(page.getByRole("cell", { name: "Session Agent", exact: true })).toBeVisible();
  const sidebar = page.getByRole("complementary", { name: "OpenClaw", exact: true });
  const reads = () => state.requests.filter((path) => path === `${API}/agents` || path === `${API}/models`).length;
  const initialReads = reads();
  await sidebar.getByRole("link", { name: "플러그인", exact: true }).click();
  await expect(page.getByRole("heading", { name: "플러그인 (1)" })).toBeVisible();
  await sidebar.getByRole("link", { name: "콘솔", exact: true }).click();
  await expect(page.getByRole("cell", { name: "Session Agent", exact: true })).toBeVisible();
  expect(reads()).toBe(initialReads);
  await page.locator("header").getByRole("link", { name: "관리자", exact: true }).click();
  await expect(page.getByRole("heading", { name: "관리자 대시보드" })).toBeVisible();
  await page.locator("header").getByRole("link", { name: "OpenClaw", exact: true }).click();
  await sidebar.getByRole("link", { name: "에이전트", exact: true }).click();
  await expect(page.getByRole("cell", { name: "Session Agent", exact: true })).toBeVisible();
  expect(reads()).toBe(initialReads);
  state.agents[0].displayName = "Updated after explicit refresh";
  state.models.push({ id: "test/new-model", supportsTools: true });
  await page.getByRole("button", { name: "새로고침", exact: true }).click();
  await expect(page.getByRole("cell", { name: "Updated after explicit refresh", exact: true })).toBeVisible();
  expect(reads()).toBe(initialReads + 2);
  await page.getByRole("button", { name: "편집", exact: true }).click();
  await expect(page.getByRole("combobox").locator('option[value="test/new-model"]')).toHaveCount(1);
});

for (const mode of ["edit", "create"]) {
  test(`agent ${mode} form survives back/forward navigation and is discarded on logout`, async ({ page }) => {
    const state = await fixture(page);
    await page.goto("/admin");
    await page.locator("header").getByRole("link", { name: "OpenClaw", exact: true }).click();
    await page.getByRole("complementary", { name: "OpenClaw", exact: true }).getByRole("link", { name: "에이전트", exact: true }).click();
    await page.getByRole("button", { name: mode === "edit" ? "편집" : "+ 에이전트 생성", exact: true }).click();
    const modal = page.locator('[class*="modalBody"]');
    await modal.locator("input").first().fill(mode === "edit" ? "Unsaved display name" : "unsaved-agent");
    await modal.locator("textarea").fill("Unsaved system prompt");
    const reads = state.requests.filter((path) => path.startsWith(`${API}/agents`) || path === `${API}/models`).length;
    await page.goBack();
    await expect(modal).toBeHidden();
    await page.goForward();
    await expect(modal.locator("input").first()).toHaveValue(mode === "edit" ? "Unsaved display name" : "unsaved-agent");
    await expect(modal.locator("textarea")).toHaveValue("Unsaved system prompt");
    expect(state.requests.filter((path) => path.startsWith(`${API}/agents`) || path === `${API}/models`)).toHaveLength(reads);
    await page.goBack();
    await expect(modal).toBeHidden();
    await page.locator("header").getByRole("button", { name: "로그아웃" }).click();
    await expect(modal).toHaveCount(0);
  });
}

test("all console tabs retain their data, drafts and log stream across site navigation", async ({ page }) => {
  const state = await fixture(page);
  await page.goto("/admin/openclaw-console/plugins");
  await page.getByText("fixture-plugin", { exact: true }).click();
  const pluginDraft = '{"enabled":false,"note":"unsaved"}';
  await expect(page.getByRole("textbox")).toHaveValue(JSON.stringify({ enabled: true }, null, 2));
  await page.getByRole("textbox").fill(pluginDraft);
  const sidebar = page.getByRole("complementary", { name: "OpenClaw", exact: true });
  await sidebar.getByRole("link", { name: "설정", exact: true }).click();
  await page.getByPlaceholder("plugins.entries.ollama.enabled=true", { exact: true }).fill("fixture.enabled=false");
  await sidebar.getByRole("link", { name: "토큰", exact: true }).click();
  await expect(page.getByRole("tabpanel", { name: "토큰", exact: true }).getByRole("textbox")).not.toHaveValue("");
  await sidebar.getByRole("link", { name: "로그", exact: true }).click();
  await expect(page.getByText("● 연결됨", { exact: true })).toBeVisible();
  await page.getByPlaceholder("필터 (대소문자 무시)").fill("retained");
  state.logSockets.at(-1).send(JSON.stringify({ op: "log.line", line: "retained original log" }));
  await expect(page.getByText("retained original log", { exact: true })).toBeVisible();
  const reads = state.requests.filter((path) => path.startsWith(API) && !path.endsWith("/health")).length;
  const logConnections = state.logSockets.length;
  await page.locator("header").getByRole("link", { name: "관리자", exact: true }).click();
  await expect(page.getByRole("heading", { name: "관리자 대시보드" })).toBeVisible();
  expect(state.logsClosed).toBe(0);
  state.logSockets.at(-1).send(JSON.stringify({ op: "log.line", line: "retained background log" }));
  await page.locator("header").getByRole("link", { name: "OpenClaw", exact: true }).click();
  await sidebar.getByRole("link", { name: "로그", exact: true }).click();
  await expect(page.getByPlaceholder("필터 (대소문자 무시)")).toHaveValue("retained");
  await expect(page.getByText("retained original log", { exact: true })).toBeVisible();
  await expect(page.getByText("retained background log", { exact: true })).toBeVisible();
  await sidebar.getByRole("link", { name: "플러그인", exact: true }).click();
  await expect(page.getByRole("tabpanel", { name: "플러그인", exact: true }).getByRole("textbox")).toHaveValue(pluginDraft);
  await sidebar.getByRole("link", { name: "설정", exact: true }).click();
  await expect(page.getByPlaceholder("plugins.entries.ollama.enabled=true", { exact: true })).toHaveValue("fixture.enabled=false");
  await sidebar.getByRole("link", { name: "토큰", exact: true }).click();
  await expect(page.getByRole("tabpanel", { name: "토큰", exact: true }).getByRole("textbox")).not.toHaveValue("");
  expect(state.requests.filter((path) => path.startsWith(API) && !path.endsWith("/health"))).toHaveLength(reads);
  expect(state.logSockets).toHaveLength(logConnections);
  await page.locator("header").getByRole("button", { name: "로그아웃" }).click();
  await expect.poll(() => state.logsClosed).toBe(logConnections);
  await expect(page.getByPlaceholder("plugins.entries.ollama.enabled=true", { exact: true })).toHaveCount(0);
});
