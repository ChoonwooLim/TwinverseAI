import { describe, expect, it } from "vitest";
import {
  buildEmailListPreview,
  buildEmailReviewDigest,
  groupEmailReportsByMonth,
} from "./emailReviewReport";

const report = (items) => ({
  reportDate: "2026-11-09",
  importantItems: items,
  actionRequiredItems: items,
});

const item = (overrides = {}) => ({
  id: "mail-1",
  subject: "결제 확인 요청",
  priority: "important",
  receivedAt: "2026-11-09T01:00:00Z",
  riskTags: ["payment"],
  ...overrides,
});

describe("buildEmailReviewDigest", () => {
  it("보고일의 긴급·중요 메일만 중복 없이 우선순위로 정리한다", () => {
    const result = buildEmailReviewDigest(report([
      item({ id: "important" }),
      item({ id: "urgent", priority: "urgent", urgency: "즉시 확인" }),
      item({ id: "old", receivedAt: "2026-11-08T01:00:00Z" }),
    ]));

    expect(result.reviewItems.map(({ id }) => id)).toEqual(["urgent", "important"]);
    expect(result.immediateCount).toBe(1);
    expect(result.olderCount).toBe(1);
  });

  it("수신시각과 새 우선순위가 없는 구형 중요 항목은 포함하고 확인 필요로 표시한다", () => {
    const result = buildEmailReviewDigest(report([item({ receivedAt: undefined, priority: "reference" })]));
    expect(result.reviewItems).toHaveLength(1);
    expect(result.reviewItems[0].priority).toBe("important");
    expect(result.reviewItems[0].receivedTimeUnknown).toBe(true);
  });

  it("참고·광고·자동 삭제 후보는 핵심 본문에서 제외한다", () => {
    const result = buildEmailReviewDigest(report([
      item({ id: "ref", priority: "reference" }),
      item({ id: "ad", subject: "광고 할인 안내" }),
      item({ id: "trash", riskTags: ["deletion"], recommendedAction: "자동 삭제" }),
    ]));
    expect(result.reviewItems).toHaveLength(0);
    expect(result.excludedCount).toBe(3);
  });

  it("서버 문자열은 가공하지 않고 평문 구조화 값으로만 반환한다", () => {
    const subject = '<img src=x onerror="alert(1)">';
    const result = buildEmailReviewDigest(report([item({ subject })]));
    expect(result.reviewItems[0].subject).toBe(subject);
    expect(result).not.toHaveProperty("html");
  });
});

describe("groupEmailReportsByMonth", () => {
  it("목록 순서를 보존하며 연도와 월로 일일 보고서를 묶는다", () => {
    const items = [
      { id: 3, reportDate: "2026-11-09" },
      { id: 2, reportDate: "2026-11-08" },
      { id: 1, reportDate: "2025-12-31" },
    ];
    expect(groupEmailReportsByMonth(items)).toEqual([
      { year: "2026", months: [{ month: "11", reports: items.slice(0, 2) }] },
      { year: "2025", months: [{ month: "12", reports: items.slice(2) }] },
    ]);
  });
});


describe("buildEmailListPreview", () => {
  it("접힌 긴 목록에서도 모든 긴급·즉시 항목을 먼저 표시한다", () => {
    const items = [
      item({ id: "normal-1" }),
      item({ id: "normal-2" }),
      item({ id: "urgent-1", priority: "urgent" }),
      item({ id: "normal-3" }),
      item({ id: "urgent-2", urgency: "오늘 바로 확인" }),
      item({ id: "normal-4" }),
    ];

    const result = buildEmailListPreview(items, false, 3);

    expect(result.visibleItems.map(({ id }) => id)).toEqual(["urgent-1", "urgent-2", "normal-1"]);
    expect(result).toMatchObject({ visibleCount: 3, hiddenCount: 3, totalCount: 6 });
  });

  it("긴급 항목이 제한보다 많으면 긴급 항목을 숨기지 않는다", () => {
    const items = [
      item({ id: "urgent-1", priority: "urgent" }),
      item({ id: "urgent-2", priority: "urgent" }),
      item({ id: "urgent-3", priority: "urgent" }),
      item({ id: "normal" }),
    ];

    const result = buildEmailListPreview(items, false, 2);

    expect(result.visibleItems.map(({ id }) => id)).toEqual(["urgent-1", "urgent-2", "urgent-3"]);
    expect(result.hiddenCount).toBe(1);
  });

  it("펼친 목록은 원래 순서와 전체 건수를 보존한다", () => {
    const items = [item({ id: "one" }), item({ id: "two", priority: "urgent" })];
    const result = buildEmailListPreview(items, true, 1);

    expect(result.visibleItems).toBe(items);
    expect(result).toMatchObject({ visibleCount: 2, hiddenCount: 0, totalCount: 2 });
  });
});
