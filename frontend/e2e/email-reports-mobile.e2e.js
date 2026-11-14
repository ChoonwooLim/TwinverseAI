import { test, expect } from "@playwright/test";
import { Buffer } from "node:buffer";

// Mocked fixtures only: no request in this file reaches a real backend, mailbox or decision queue.
const REPORTS_PATH = "/admin/email-reports";
const REPORTS_API = "/api/admin/email-reports";
const LINK = { name: "이메일 보고서", exact: true };
const MOBILE = { width: 390, height: 844 };
const LONG_TOKEN = "A".repeat(180);
const LONG_SUBJECT = `[긴급] 결제수단확인요청-${LONG_TOKEN}`;

const item = (id, overrides = {}) => ({
  id,
  account: `very.long.fixture.account.name.for.mobile.layout.${id}@example.com`,
  sender: `"Fixture Sender With A Long Display Name" <no-reply-${LONG_TOKEN.slice(0, 60)}@example.com>`,
  subject: `${id} 확인 요청`,
  priority: "important",
  receivedAt: "2026-11-09T01:00:00Z",
  summary: `요약 https://example.com/${LONG_TOKEN}?fixture=${LONG_TOKEN}`,
  reason: `사유 ${LONG_TOKEN}`,
  urgency: "오늘 중 확인",
  recommendedAction: "관리자 검토 후 결정",
  classificationBasis: `근거 ${LONG_TOKEN}`,
  riskTags: ["payment", "security", "account", "automation"],
  ...overrides,
});

const ITEMS = [
  item("mail-1", { subject: LONG_SUBJECT, priority: "urgent", deadline: "2026-11-10T09:00:00+09:00" }),
  item("mail-2"),
  item("mail-3", { priority: "reference", riskTags: ["deletion"] }),
];

const LIST = {
  total: 45,
  items: [
    { id: 7, reportDate: "2026-11-09", reportKey: `daily-${"long-report-key-".repeat(4)}fixture`, accountCount: 2, generatedAt: "2026-11-09T22:00:00Z",
      totalCounts: { total: 1234567, important: 23456, actionRequired: 12345 },
      summaryCounts: { immediate: 1234, review: 2345, automation: 3456 } },
    { id: 6, reportDate: "2026-10-31", reportKey: "daily", accountCount: 1, generatedAt: "2026-10-31T22:00:00Z",
      totalCounts: { total: 10, important: 2, actionRequired: 1 }, summaryCounts: {} },
  ],
};

const DETAIL = {
  id: 7,
  reportDate: "2026-11-09",
  reportKey: LIST.items[0].reportKey,
  metadata: { source: `fixture-collector-${LONG_TOKEN.slice(0, 80)}`, generatedAt: "2026-11-09T22:00:00Z" },
  totalCounts: { total: 1234567, important: 23456, actionRequired: 12345, cleaned: 98765 },
  summaryCounts: { immediate: 1234, review: 2345, automation: 3456, todayActionable: 12, deadlineSoon: 3, paymentOrSecurityRisk: 4, deletionSuggested: 5, automationSuggested: 6 },
  executionCounts: { pending: 1, processing: 0, succeeded: 0, failed: 0, not_applicable: 0 },
  accountSummaries: [
    { account: ITEMS[0].account, total: 1234567, important: 23456, actionRequired: 12345, note: `메모 ${LONG_TOKEN}` },
    { account: "second@example.com", total: 3, important: 1, actionRequired: 1 },
  ],
  importantItems: ITEMS,
  actionRequiredItems: ITEMS.slice(0, 2),
  cleanupResults: { archived: 12, deleted: 3, skipped: 1, notes: `정리 ${LONG_TOKEN}` },
  decisions: [{ itemId: "mail-2", decision: "keep", status: "pending", action: "archive", attempts: 0, decidedByUsername: "admin" }],
};

async function mockApp(page, role) {
  const calls = [];
  if (role) {
    const token = `fixture.${Buffer.from(JSON.stringify({ exp: 9999999999, sub: "fixture" })).toString("base64")}.fixture`;
    await page.addInitScript(({ token, role }) => {
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify({ username: "fixture", role }));
    }, { token, role });
  }
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    calls.push({ method: request.method(), pathname });
    if (request.method() !== "GET") return route.fulfill({ status: 405, json: { detail: "fixture is read-only" } });
    let data = {};
    if (pathname === "/api/auth/me") data = { username: "fixture", role };
    if (pathname.startsWith("/api/boards/")) data = { items: [], total: 0 };
    if (pathname === REPORTS_API) data = LIST;
    if (pathname === `${REPORTS_API}/7`) data = DETAIL;
    return route.fulfill({ json: data });
  });
  return calls;
}

const reportCalls = (calls) => calls.filter(({ pathname }) => pathname.startsWith(REPORTS_API));
const mainNav = (page) => page.getByRole("navigation", { name: "메인 메뉴" });

/**
 * Fails when the page scrolls sideways, or when any visible element or text run in `scope`
 * pokes out of the viewport or of the nearest container that clips or side-scrolls it.
 * Text deliberately truncated with an ellipsis is the only accepted exception.
 */
async function expectNoHorizontalOverflow(page, scope) {
  const result = await page.evaluate((selector) => {
    const width = document.documentElement.clientWidth;
    const describe = (el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)}`;
    const truncated = (el) => {
      for (let node = el; node && node !== document.body; node = node.parentElement) {
        if (getComputedStyle(node).textOverflow === "ellipsis") return true;
      }
      return false;
    };
    const clipper = (el) => {
      for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
        if (getComputedStyle(node).overflowX !== "visible") return node;
      }
      return null;
    };
    const offenders = new Set();
    const check = (owner, box, kind) => {
      if (!box.width || !box.height || truncated(owner)) return;
      const container = clipper(kind === "text" ? { parentElement: owner } : owner);
      const frame = container?.getBoundingClientRect();
      const left = Math.max(0, frame ? frame.left : 0);
      const right = Math.min(width, frame ? frame.right : width);
      if (box.right > right + 1 || box.left < left - 1) {
        offenders.add(`${describe(owner)} ${kind} ${Math.round(box.left)}..${Math.round(box.right)} outside ${Math.round(left)}..${Math.round(right)}`);
      }
    };
    for (const root of document.querySelectorAll(selector)) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
      for (let node = walker.currentNode; node; node = walker.nextNode()) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (node.tagName !== "OPTION") check(node, node.getBoundingClientRect(), "box");
        } else if (node.nodeValue.trim() && !node.parentElement.closest("select")) {
          const range = document.createRange();
          range.selectNodeContents(node);
          check(node.parentElement, range.getBoundingClientRect(), "text");
        }
      }
    }
    return { width, scrollWidth: document.documentElement.scrollWidth, offenders: [...offenders].slice(0, 8) };
  }, scope);
  expect(result.offenders, "content wider than its mobile container").toEqual([]);
  expect(result.scrollWidth, "page must not scroll horizontally").toBeLessThanOrEqual(result.width);
}

async function expectTouchTargets(locator, minimum = 44) {
  const count = await locator.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i += 1) {
    const box = await locator.nth(i).boundingBox();
    if (!box) continue;
    expect(box.height, `touch target ${i} height`).toBeGreaterThanOrEqual(minimum);
  }
}

test.describe("이메일 보고서 메뉴 권한", () => {
  test.use({ viewport: MOBILE });

  for (const role of ["admin", "superadmin"]) {
    test(`${role} 계정은 모바일 햄버거 메뉴에서 이메일 보고서로 이동한다`, async ({ page }) => {
      await mockApp(page, role);
      await page.goto("/");
      const link = mainNav(page).getByRole("link", LINK);
      await expect(link).toBeHidden();

      await page.getByRole("button", { name: "메뉴 열기" }).click();
      await expect(link).toBeVisible();
      await expectTouchTargets(link);
      await link.click();

      await expect(page).toHaveURL(REPORTS_PATH);
      await expect(page.getByRole("heading", { name: "이메일 의사결정 보고서" })).toBeVisible();
      await expect(link).toBeHidden();
    });
  }

  test("비로그인 방문자에게는 메뉴가 없고 직접 접근하면 로그인으로 이동한다", async ({ page }) => {
    const calls = await mockApp(page, null);
    await page.goto("/");
    await page.getByRole("button", { name: "메뉴 열기" }).click();
    await expect(mainNav(page).getByRole("link", { name: "홈", exact: true })).toBeVisible();
    await expect(page.getByRole("link", LINK)).toHaveCount(0);

    await page.goto("/community/notice");
    await expect(page.getByRole("link", LINK)).toHaveCount(0);

    await page.goto(`${REPORTS_PATH}/7`);
    await expect(page).toHaveURL("/login");
    await expect(page.getByRole("link", LINK)).toHaveCount(0);
    expect(reportCalls(calls)).toEqual([]);
  });

  test("일반 사용자에게는 메뉴가 없고 직접 접근해도 보고서를 요청하지 않는다", async ({ page }) => {
    const calls = await mockApp(page, "user");
    await page.goto("/");
    await page.getByRole("button", { name: "메뉴 열기" }).click();
    await expect(mainNav(page).getByRole("link", { name: "홈", exact: true })).toBeVisible();
    await expect(page.getByRole("link", LINK)).toHaveCount(0);

    await page.goto("/community/notice");
    await expect(page.getByRole("link", LINK)).toHaveCount(0);

    await page.goto(`${REPORTS_PATH}/7`);
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: "이메일 의사결정 보고서" })).toHaveCount(0);
    await expect(page.getByText(ITEMS[0].account)).toHaveCount(0);
    expect(reportCalls(calls)).toEqual([]);
  });
});

test.describe("이메일 보고서 데스크톱 메뉴", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("관리자 메뉴가 한 줄 상단바 안에 들어가고 현재 위치를 표시한다", async ({ page }) => {
    await mockApp(page, "admin");
    await page.goto(REPORTS_PATH);
    const link = mainNav(page).getByRole("link", LINK);
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("button", { name: "로그아웃" })).toBeInViewport({ ratio: 1 });
    await expectNoHorizontalOverflow(page, "header");
  });

  test("일반 사용자 상단바에는 관리자 전용 링크가 없다", async ({ page }) => {
    await mockApp(page, "user");
    await page.goto("/");
    await expect(mainNav(page).getByRole("link", { name: "홈", exact: true })).toBeVisible();
    await expect(page.getByRole("link", LINK)).toHaveCount(0);
  });
});

test.describe("이메일 보고서 390px 레이아웃", () => {
  test.use({ viewport: MOBILE });

  test("목록 화면: 관리자 메뉴 스트립과 날짜별 보고서가 가로로 넘치지 않는다", async ({ page }) => {
    await mockApp(page, "admin");
    await page.goto(REPORTS_PATH);

    const strip = page.getByRole("navigation", { name: "관리자 메뉴" });
    const current = strip.getByRole("link", LINK);
    await expect(current).toHaveAttribute("aria-current", "page");
    await expect(current).toBeInViewport({ ratio: 1 });
    await expectTouchTargets(strip.getByRole("link"));

    const rows = page.getByRole("button", { name: /일일 보고서$/ });
    await expect(rows).toHaveCount(2);
    await expectTouchTargets(rows);
    await expectTouchTargets(page.getByRole("button", { name: /^(이전|다음)$/ }));
    await expectNoHorizontalOverflow(page, "main");
    await expectNoHorizontalOverflow(page, "header");

    await page.getByRole("button", { name: "다음", exact: true }).click();
    await expect(page.getByText("2 / 3", { exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page, "main");
  });

  test("상세 화면: 긴 제목·주소·카드·결정 버튼이 화면 안에서 줄바꿈된다", async ({ page }) => {
    const calls = await mockApp(page, "admin");
    await page.goto(REPORTS_PATH);
    await page.getByRole("button", { name: /^2026\. 11\. 09\./ }).click();
    await expect(page).toHaveURL(`${REPORTS_PATH}/7`);

    const decisions = page.getByRole("group", { name: `${LONG_SUBJECT} 결정` });
    await expect(decisions).toBeVisible();
    await expect(page.getByRole("heading", { name: LONG_SUBJECT }).first()).toBeVisible();
    await expectNoHorizontalOverflow(page, "main");

    await expectTouchTargets(page.getByRole("button", { name: "← 목록으로" }));
    await expectTouchTargets(decisions.getByRole("button"));
    await expectTouchTargets(page.getByRole("toolbar", { name: "목록 표시, 정렬과 전체 선택" }).locator("button, select"));
    await expectTouchTargets(page.getByRole("link", { name: /원본|검색/ }));

    // A pending choice stays local to the page; the bulk bar must fit without saving anything.
    await decisions.getByRole("button", { name: "나중 결정", exact: true }).click();
    await page.getByRole("checkbox", { name: `${LONG_SUBJECT} 선택` }).check({ force: true });
    const bulk = page.getByRole("region", { name: "일괄 결정 도구" });
    await expect(bulk).toBeVisible();
    await expectTouchTargets(bulk.locator("button, select"));
    await expectNoHorizontalOverflow(page, "main");

    await page.getByRole("button", { name: "← 목록으로" }).click();
    await expect(page).toHaveURL(REPORTS_PATH);
    await expect(page.getByRole("button", { name: /일일 보고서$/ })).toHaveCount(2);
    expect(calls.filter(({ method }) => method !== "GET")).toEqual([]);
  });
});
