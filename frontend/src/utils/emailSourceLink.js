const GMAIL_ORIGIN = "https://mail.google.com";
const NAVER_MAIL_ORIGIN = "https://mail.naver.com";

function normalizedAccount(value) {
  return String(value || "").trim();
}

function normalizedSubject(value) {
  return String(value || "").trim().replace(/["\\]/g, " ").replace(/\s+/g, " ");
}

function senderAddress(value) {
  return String(value || "").match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/)?.[0] || "";
}

function isNaverAccount(account) {
  return account.toLowerCase().endsWith("@naver.com");
}

function naverSourceLink(item, account) {
  const subject = normalizedSubject(item?.subject);
  const sender = senderAddress(item?.sender);
  const query = [subject, sender].filter(Boolean).join(" ");
  if (!query) return null;

  const params = new URLSearchParams({
    searchType: "all",
    query,
  });
  return {
    href: `${NAVER_MAIL_ORIGIN}/v2/search?${params.toString()}`,
    label: "네이버 메일에서 원본 찾기",
    title: `${account} 계정의 네이버 메일 검색 결과를 새 창으로 엽니다.`,
    exact: false,
    provider: "naver",
  };
}

function gmailSourceLink(item, account) {
  const base = `${GMAIL_ORIGIN}/mail/u/?authuser=${encodeURIComponent(account)}`;
  const threadId = String(item?.sourceThreadId || "").trim();
  if (/^\d{1,20}$/.test(threadId)) {
    try {
      return {
        href: `${base}#all/${BigInt(threadId).toString(16)}`,
        label: "원본 메일 열기",
        title: "이 계정의 Gmail에서 원본 메일을 새 창으로 엽니다.",
        exact: true,
        provider: "gmail",
      };
    } catch {
      // Fall through to a bounded Gmail search for malformed legacy values.
    }
  }

  const subject = normalizedSubject(item?.subject);
  const sender = senderAddress(item?.sender);
  const terms = [subject && `subject:"${subject}"`, sender && `from:${sender}`].filter(Boolean);
  if (!terms.length) return null;
  return {
    href: `${base}#search/${encodeURIComponent(terms.join(" "))}`,
    label: "Gmail에서 원본 찾기",
    title: "구형 보고서 항목입니다. 제목과 발신자로 Gmail 검색 결과를 엽니다.",
    exact: false,
    provider: "gmail",
  };
}

/**
 * Builds a provider-owned mailbox URL from bounded report metadata only.
 * Server-supplied URLs are deliberately ignored.
 */
export function buildEmailSourceLink(item) {
  const account = normalizedAccount(item?.account);
  if (!account) return null;
  return isNaverAccount(account)
    ? naverSourceLink(item, account)
    : gmailSourceLink(item, account);
}
