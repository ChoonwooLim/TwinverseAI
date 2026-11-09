import { describe, expect, it } from "vitest";
import { buildEmailSourceLink } from "./emailSourceLink";

describe("buildEmailSourceLink", () => {
  it("keeps the exact Gmail thread link for a valid sourceThreadId", () => {
    const link = buildEmailSourceLink({
      account: "owner@gmail.com",
      subject: "결제 확인",
      sender: "Billing <billing@example.com>",
      sourceThreadId: "1847352912345678901",
    });

    expect(link).toMatchObject({ provider: "gmail", exact: true, label: "원본 메일 열기" });
    expect(link.href).toBe(
      `https://mail.google.com/mail/u/?authuser=owner%40gmail.com#all/${BigInt("1847352912345678901").toString(16)}`,
    );
  });

  it("uses a Gmail metadata search when no exact thread id exists", () => {
    const link = buildEmailSourceLink({
      account: "owner@example.com",
      subject: '월간 "보안" 보고서',
      sender: "Security <alerts@example.com>",
    });

    expect(link).toMatchObject({ provider: "gmail", exact: false, label: "Gmail에서 원본 찾기" });
    expect(link.href).toContain("https://mail.google.com/mail/u/?authuser=owner%40example.com#search/");
    expect(decodeURIComponent(link.href.split("#search/")[1])).toBe(
      'subject:"월간 보안 보고서" from:alerts@example.com',
    );
  });

  it("routes @naver.com accounts to a Naver Mail metadata search", () => {
    const link = buildEmailSourceLink({
      account: "Owner@NAVER.COM",
      subject: "계약서 검토 요청",
      sender: "파트너 <partner@example.org>",
      sourceThreadId: "1847352912345678901",
    });
    const url = new URL(link.href);

    expect(link).toMatchObject({
      provider: "naver",
      exact: false,
      label: "네이버 메일에서 원본 찾기",
    });
    expect(url.origin).toBe("https://mail.naver.com");
    expect(url.pathname).toBe("/v2/search");
    expect(url.searchParams.get("searchType")).toBe("all");
    expect(url.searchParams.get("query")).toBe("계약서 검토 요청 partner@example.org");
    expect(link.href).not.toContain("1847352912345678901");
  });

  it("ignores arbitrary URL-shaped fields and always returns an allowlisted provider origin", () => {
    const link = buildEmailSourceLink({
      account: "owner@naver.com",
      subject: "알림",
      sender: "alerts@example.com",
      sourceUrl: "javascript:alert(1)",
      url: "https://evil.example/mail",
    });

    expect(new URL(link.href).origin).toBe("https://mail.naver.com");
    expect(link.href).not.toContain("evil.example");
    expect(link.href).not.toContain("javascript");
  });

  it("returns null without an account or searchable metadata", () => {
    expect(buildEmailSourceLink({ subject: "제목" })).toBeNull();
    expect(buildEmailSourceLink({ account: "owner@naver.com" })).toBeNull();
  });
});
