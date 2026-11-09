import { test, expect } from "@playwright/test";

const ROUTES = [
  { path: "/", title: /TwinverseAI.*사람과 AI/, screenshot: "home" },
  { path: "/vision", title: /TwinverseAI.*비전/ },
  { path: "/about", title: /TwinverseAI.*회사소개/ },
  { path: "/services", title: /TwinverseAI.*서비스/ },
  { path: "/designs", title: /TwinverseAI.*디자인/, screenshot: "design" },
  { path: "/twinversedesk/analysis", title: /TwinverseAI.*TwinverseDesk.*분석/ },
  { path: "/twinversedesk/plan", title: /TwinverseAI.*TwinverseDesk.*개발계획/ },
  { path: "/twinversedesk/launch", title: /TwinverseAI.*TwinverseDesk.*실행/ },
  { path: "/twinversedesk/run", title: /TwinverseAI.*TVDesk.*실행/ },
];

const POSTS = {
  notice: { id: 901, title: "테스트 공지: 작업 공간 업데이트", content: "공지 상세 본문입니다.", author: "운영팀" },
  qna: { id: 902, title: "테스트 질문: 디자인 참고안 사용법", content: "질문 상세 본문입니다.", author: "방문자" },
};
const diagnostics = new WeakMap();

test.beforeEach(async ({ page, baseURL }) => {
  const state = { errors: [], writes: [], externalDocuments: [], popups: 0, documents: 0 };
  diagnostics.set(page, state);
  page.on("pageerror", (error) => state.errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") state.errors.push(`${message.text()} (${message.location().url})`);
  });
  page.on("popup", () => { state.popups += 1; });
  page.on("request", (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) state.documents += 1;
  });
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    // The isolated browser cannot reach Google Fonts. Verify the supported
    // system-font fallback without hiding any application console errors.
    if (url.hostname === "fonts.googleapis.com") {
      await route.fulfill({ contentType: "text/css", body: "" });
      return;
    }
    if (url.pathname.startsWith("/api/")) {
      if (!["GET", "HEAD"].includes(request.method())) {
        state.writes.push(`${request.method()} ${url.pathname}`);
        await route.fulfill({ status: 405, json: { detail: "Read-only browser test" } });
        return;
      }
      let data = {};
      const board = url.pathname.match(/^\/api\/boards\/(notice|qna)(?:\/(\d+))?$/);
      if (board) {
        const post = { ...POSTS[board[1]], created_at: "2026-11-09T00:00:00Z", view_count: 0, files: [], comment_count: 0 };
        data = board[2] ? post : { items: [post], total: 1, page: 1, size: 20 };
      }
      if (url.pathname.startsWith("/api/comments/")) data = [];
      if (url.pathname === "/api/ps2/health") data = { available: true, active_instances: 0, max_instances: 2 };
      if (url.pathname === "/api/ps2/sessions") data = [];
      await route.fulfill({ json: data });
      return;
    }
    if (url.origin !== new URL(baseURL).origin) {
      // TVDesk checks reachability on mount; never contact its real service.
      if (request.method() === "HEAD") {
        await route.fulfill({ status: 200, body: "" });
        return;
      }
      if (request.resourceType() === "document") {
        state.externalDocuments.push(request.url());
        await route.fulfill({ contentType: "text/plain", body: "External launch blocked by browser test" });
        return;
      }
    }
    await route.continue();
  });
});

test.afterEach(async ({ page }) => {
  const state = diagnostics.get(page);
  expect(state.errors, "Browser errors").toEqual([]);
  expect(state.writes, "Public introductions must not start or mutate a session").toEqual([]);
  expect(state.externalDocuments, "No external office or player is opened").toEqual([]);
  expect(state.popups).toBe(0);
});

async function expectNoHorizontalOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(dimensions.document, JSON.stringify(dimensions)).toBeLessThanOrEqual(dimensions.viewport + 1);
  expect(dimensions.body, JSON.stringify(dimensions)).toBeLessThanOrEqual(dimensions.viewport + 1);
}

for (const device of [
  { name: "desktop", viewport: { width: 1600, height: 1100 } },
  { name: "mobile", viewport: { width: 390, height: 844 } },
]) {
  test.describe(device.name, () => {
    test.use({ viewport: device.viewport });

    for (const route of ROUTES) {
      test(`${route.path} has a readable title and fits the viewport`, async ({ page }) => {
        await page.goto(route.path);
        const heading = page.locator("main h1:visible");
        await expect(heading).toHaveCount(1);
        await expect(heading).toBeVisible();
        await expect(page).toHaveTitle(route.title);
        await expect(page.locator("iframe")).toHaveCount(0);
        await expectNoHorizontalOverflow(page);
        if (route.screenshot) {
          if (route.path === "/") await expect(page.getByRole("link", { name: POSTS.notice.title })).toBeVisible();
          await page.screenshot({ path: `test-results/intro-${route.screenshot}-${device.name}.png`, fullPage: true, animations: "disabled" });
        }
      });
    }

    test("design search, keyboard detail and saved reference work across navigation", async ({ page }) => {
      await page.goto("/designs");
      const search = page.getByRole("searchbox");
      const openClaude = page.getByRole("button", { name: "Claude 디자인 상세 보기", exact: true });
      await search.fill("no-such-design-browser-fixture");
      await expect(page.getByRole("status")).toHaveText("0개의 참고 디자인");
      await page.getByRole("button", { name: "검색·필터 초기화" }).click();
      await expect(search).toHaveValue("");
      await page.getByRole("button", { name: /^Developer Tools & Platforms/ }).click();
      await expect(openClaude).toHaveCount(0);
      await page.getByRole("button", { name: /^AI & Machine Learning/ }).click();
      await search.fill("Claude");
      await expect(openClaude).toBeVisible();
      await expect(page.getByRole("status")).toHaveText("1개의 참고 디자인");

      await openClaude.focus();
      await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog", { name: "Claude", exact: true });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole("button", { name: "닫기", exact: true })).toBeFocused();
      await page.keyboard.press("Shift+Tab");
      await expect(dialog.getByRole("link", { name: /GitHub 폴더/ })).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(dialog.getByRole("button", { name: "닫기", exact: true })).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await expect(openClaude).toBeFocused();

      await page.getByRole("button", { name: "Claude 참고 디자인 선택", exact: true }).click();
      await expect(page.getByRole("button", { name: "Claude 참고 디자인 선택 해제", exact: true })).toHaveAttribute("aria-pressed", "true");
      await page.locator('footer a[href="/services"]').click();
      await expect(page).toHaveURL("/services");
      await page.locator('footer a[href="/designs"]').click();
      await expect(page.getByRole("button", { name: "Claude 참고 디자인 선택 해제", exact: true })).toHaveAttribute("aria-pressed", "true");
      await page.reload();
      await expect(page.getByRole("button", { name: "Claude 참고 디자인 상세 보기", exact: true })).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });

    test("service questions expand and every internal action opens a real page", async ({ page, baseURL }) => {
      await page.goto("/services");
      const questions = page.locator("main details");
      await expect(questions.first().locator("summary")).toBeVisible();
      expect(await questions.count()).toBeGreaterThan(0);
      const first = questions.first();
      await expect(first.locator("p")).toBeHidden();
      await first.locator("summary").focus();
      await page.keyboard.press("Enter");
      await expect(first.locator("p")).toBeVisible();
      await page.keyboard.press("Enter");
      await expect(first.locator("p")).toBeHidden();
      for (const question of await questions.all()) {
        await question.locator("summary").click();
        await expect(question.locator("p")).toBeVisible();
      }
      await expectNoHorizontalOverflow(page);

      const hrefs = await page.locator("main a").evaluateAll((links) => links.map((link) => link.getAttribute("href")));
      const allowed = new Set([...ROUTES.map((route) => route.path), "/login", "/community/qna"]);
      for (const href of new Set(hrefs)) {
        expect(href, "Actions have an actual destination").toBeTruthy();
        expect(href).not.toMatch(/^(#|javascript:)/);
        const url = new URL(href, baseURL);
        if (url.origin !== new URL(baseURL).origin) continue;
        expect(allowed.has(url.pathname), `Recognized application route: ${href}`).toBe(true);
        await page.locator(`main a[href="${href}"]`).first().click();
        await expect(page).toHaveURL(url.href);
        if (url.pathname === "/login") {
          await expect(page.getByRole("textbox", { name: "Username", exact: true })).toBeVisible();
        } else {
          await expect(page.locator("main h1:visible")).toHaveCount(1);
        }
        await page.goBack();
        await expect(page).toHaveURL("/services");
      }
    });

    test("home community entries open and footer navigation stays in the same document", async ({ page }) => {
      await page.goto("/");
      for (const post of Object.values(POSTS)) {
        await expect(page.getByRole("link", { name: new RegExp(post.title) })).toBeVisible();
      }
      const initialDocuments = diagnostics.get(page).documents;
      for (const [board, post] of Object.entries(POSTS)) {
        await page.locator(`main a[href="/community/${board}/${post.id}"]`).click();
        await expect(page).toHaveURL(`/community/${board}/${post.id}`);
        await expect(page.getByRole("heading", { level: 1, name: post.title, exact: true })).toBeVisible();
        await expect(page.getByText(post.content, { exact: true })).toBeVisible();
        await page.locator('footer a[href="/"]').click();
        await expect(page.getByRole("link", { name: new RegExp(POSTS.notice.title) })).toBeVisible();
      }
      for (const path of ["/about", "/vision", "/services", "/designs", "/community/qna"]) {
        await page.locator(`footer a[href="${path}"]`).click();
        await expect(page).toHaveURL(path);
        await expect(page.locator("main h1:visible")).toHaveCount(1);
      }
      expect(diagnostics.get(page).documents).toBe(initialDocuments);
    });

    test("administrator service actions point directly to the authorized tools", async ({ page }) => {
      await page.addInitScript(() => {
        const payload = btoa(JSON.stringify({ exp: 9999999999, sub: "intro-admin" }));
        localStorage.setItem("token", `fixture.${payload}.fixture`);
        localStorage.setItem("user", JSON.stringify({ username: "intro-admin", role: "admin" }));
      });
      await page.goto("/services");
      await expect(page.locator('#agents a[href="/admin/openclaw-console"]')).toBeVisible();
      await expect(page.locator('#reports a[href="/admin/email-reports"]')).toBeVisible();
      await expect(page.locator('#agents a[href="/login"], #reports a[href="/login"]')).toHaveCount(0);
      await expectNoHorizontalOverflow(page);
    });
  });
}
