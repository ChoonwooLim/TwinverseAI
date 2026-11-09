const KST_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const AD_WORDS = ["광고", "프로모션", "뉴스레터", "마케팅", "수신 거부", "할인"];
const AUTO_TRASH_WORDS = ["자동 삭제", "자동삭제", "삭제함 이동", "휴지통 이동"];
const IMMEDIATE_WORDS = ["즉시", "긴급", "오늘", "바로", "마감"];

function textOf(item) {
  return [
    item?.subject,
    item?.sender,
    item?.summary,
    item?.reason,
    item?.urgency,
    item?.recommendedAction,
    item?.classificationBasis,
  ].filter(Boolean).join(" ").toLowerCase();
}

function kstDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return KST_DATE_FORMATTER.format(parsed);
}

function isExcludedFromReview(item, inferredLegacyImportant = false) {
  const text = textOf(item);
  return (item?.priority === "reference" && !inferredLegacyImportant)
    || (item?.riskTags || []).includes("deletion")
    || AD_WORDS.some((word) => text.includes(word))
    || AUTO_TRASH_WORDS.some((word) => text.includes(word));
}

/**
 * Builds a safe review digest from structured report fields only. The return
 * value is plain data, never server-provided markup.
 */
export function buildEmailReviewDigest(report) {
  const byId = new Map();
  for (const [section, sectionItems] of [
    ["important", report?.importantItems || []],
    ["action", report?.actionRequiredItems || []],
  ]) {
    for (const item of sectionItems) {
      const key = item?.id || [item?.account, item?.sender, item?.subject, item?.receivedAt].join("|");
      if (item && !byId.has(key)) byId.set(key, { item, section });
    }
  }

  const reportDate = typeof report?.reportDate === "string" ? report.reportDate.slice(0, 10) : "";
  const reviewItems = [];
  let excludedCount = 0;
  let olderCount = 0;

  for (const { item, section } of byId.values()) {
    const receivedDate = kstDate(item.receivedAt);
    const inferredLegacyImportant = !receivedDate && section === "important" && item.priority === "reference";
    if (isExcludedFromReview(item, inferredLegacyImportant)) {
      excludedCount += 1;
      continue;
    }
    const importantLegacy = !receivedDate
      && (["urgent", "important"].includes(item.priority) || inferredLegacyImportant);
    if (receivedDate === reportDate || importantLegacy) {
      reviewItems.push({
        ...item,
        priority: inferredLegacyImportant ? "important" : item.priority,
        receivedTimeUnknown: !receivedDate,
      });
    } else {
      olderCount += 1;
    }
  }

  reviewItems.sort((a, b) => {
    const priority = { urgent: 0, important: 1 };
    const priorityDiff = (priority[a.priority] ?? 2) - (priority[b.priority] ?? 2);
    if (priorityDiff) return priorityDiff;
    return String(b.receivedAt || "").localeCompare(String(a.receivedAt || ""));
  });

  const immediateCount = reviewItems.filter((item) => {
    if (item.priority === "urgent") return true;
    const urgency = String(item.urgency || "").toLowerCase();
    return IMMEDIATE_WORDS.some((word) => urgency.includes(word));
  }).length;

  return { reportDate, reviewItems, immediateCount, excludedCount, olderCount };
}

export function groupEmailReportsByMonth(items) {
  const years = new Map();
  for (const item of items || []) {
    const date = typeof item?.reportDate === "string" ? item.reportDate.slice(0, 10) : "";
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    const year = match?.[1] || "날짜 미상";
    const month = match?.[2] || "기타";
    if (!years.has(year)) years.set(year, new Map());
    const months = years.get(year);
    if (!months.has(month)) months.set(month, []);
    months.get(month).push(item);
  }
  return Array.from(years, ([year, months]) => ({
    year,
    months: Array.from(months, ([month, reports]) => ({ month, reports })),
  }));
}
