import { describe, expect, it } from "vitest";
import {
  DEFAULT_IMAGE_PROMPT,
  MAX_ATTACH_BYTES,
  MAX_IMAGE_COUNT,
  MAX_TOTAL_IMAGE_BYTES,
  buildUserText,
  classifyAttachment,
  extractClipboardImages,
  isDuplicateImage,
  pastedImageName,
  planAttachments,
} from "./chatAttachments";

const MB = 1024 * 1024;
const file = (name, type, size = 1024) => ({ name, type, size });
const entry = (name, type, size) => ({ file: file(name, type, size) });
const clipboard = ({ files = [], items = [], data = {} } = {}) => ({
  files,
  items,
  getData: (type) => data[type] || "",
});
const fileItem = (f) => ({ kind: "file", type: f.type, getAsFile: () => f });

describe("extractClipboardImages", () => {
  it("returns a pasted screenshot once even though files and items both expose it", () => {
    const shot = file("image.png", "image/png");
    const images = extractClipboardImages(clipboard({ files: [shot], items: [fileItem(shot)] }));
    expect(images).toEqual([shot]);
  });

  it("falls back to items when the browser leaves files empty", () => {
    const shot = file("image.png", "image/png");
    const images = extractClipboardImages(clipboard({
      items: [{ kind: "string", type: "text/html" }, fileItem(shot)],
    }));
    expect(images).toEqual([shot]);
  });

  it("leaves ordinary text pastes alone", () => {
    expect(extractClipboardImages(clipboard({
      items: [{ kind: "string", type: "text/plain" }],
      data: { "text/plain": "hello" },
    }))).toEqual([]);
    expect(extractClipboardImages(null)).toEqual([]);
  });

  it("ignores non-image files on the clipboard", () => {
    expect(extractClipboardImages(clipboard({ files: [file("notes.txt", "text/plain")] }))).toEqual([]);
  });

  it("keeps a rich-text copy (text + html + rendered bitmap) as a text paste", () => {
    const rendered = file("image.png", "image/png");
    expect(extractClipboardImages(clipboard({
      files: [rendered],
      data: { "text/plain": "A1\tB1", "text/html": "<table><tr><td>A1</td></tr></table>" },
    }))).toEqual([]);
  });

  it("attaches an image copied from a web page, which carries html but no plain text", () => {
    const copied = file("image.png", "image/png");
    expect(extractClipboardImages(clipboard({
      files: [copied],
      data: { "text/html": '<img src="https://example.com/a.png">' },
    }))).toEqual([copied]);
  });

  it("passes unsupported image types through so they get a visible error", () => {
    const bmp = file("image.bmp", "image/bmp");
    expect(extractClipboardImages(clipboard({ files: [bmp] }))).toEqual([bmp]);
  });
});

describe("pastedImageName", () => {
  const now = new Date(2026, 10, 11, 9, 5, 7);

  it("replaces the generic clipboard name with a timestamped one", () => {
    expect(pastedImageName(file("image.png", "image/png"), now)).toBe("붙여넣은-이미지-20261111-090507.png");
    expect(pastedImageName(file("", "image/jpeg"), now, 1)).toBe("붙여넣은-이미지-20261111-090507-2.jpg");
  });

  it("keeps a real file name", () => {
    expect(pastedImageName(file("diagram-final.webp", "image/webp"), now)).toBe("diagram-final.webp");
  });
});

describe("classifyAttachment", () => {
  it("accepts exactly PNG, JPEG, GIF and WebP as images", () => {
    for (const type of ["image/png", "image/jpeg", "image/gif", "image/webp"]) {
      expect(classifyAttachment(file("a", type))).toBe("image");
    }
    for (const type of ["image/bmp", "image/svg+xml", "image/tiff", "image/heic"]) {
      expect(classifyAttachment(file("a", type))).toBe("unsupported-image");
    }
  });

  it("recognises documents by mime or extension and rejects the rest", () => {
    expect(classifyAttachment(file("a.json", "application/json"))).toBe("document");
    expect(classifyAttachment(file("server.LOG", ""))).toBe("document");
    expect(classifyAttachment(file("a.zip", "application/zip"))).toBe("unsupported");
  });
});

describe("planAttachments", () => {
  it("accepts supported images and documents", () => {
    const { accepted, errors } = planAttachments([], [
      entry("a.png", "image/png", MB),
      entry("notes.txt", "text/plain", 10),
    ]);
    expect(errors).toEqual([]);
    expect(accepted.map((a) => [a.name, a.kind])).toEqual([["a.png", "image"], ["notes.txt", "document"]]);
  });

  it("rejects unsupported formats with Korean messages", () => {
    const { accepted, errors } = planAttachments([], [
      entry("a.bmp", "image/bmp"),
      entry("a.zip", "application/zip"),
    ]);
    expect(accepted).toEqual([]);
    expect(errors).toEqual([
      "a.bmp: 지원하지 않는 이미지 형식입니다. PNG, JPEG, GIF, WebP만 첨부할 수 있습니다.",
      "a.zip: 지원하지 않는 파일 형식입니다.",
    ]);
  });

  it("enforces the 9MB per-file limit at the boundary", () => {
    const ok = planAttachments([], [entry("max.png", "image/png", MAX_ATTACH_BYTES)]);
    expect(ok.errors).toEqual([]);
    expect(ok.accepted).toHaveLength(1);

    const over = planAttachments([], [entry("big.png", "image/png", MAX_ATTACH_BYTES + 1)]);
    expect(over.accepted).toEqual([]);
    expect(over.errors).toEqual(["big.png: 파일이 너무 큽니다 (9.0MB). 한 파일당 최대 9MB까지 첨부할 수 있습니다."]);
  });

  it("enforces the 9MB image total across already-pending and new images", () => {
    const existing = [{ kind: "image", size: 5 * MB }];
    const { accepted, errors } = planAttachments(existing, [
      entry("b.png", "image/png", 3 * MB),
      entry("c.png", "image/png", 2 * MB),
      entry("d.png", "image/png", MB),
    ]);
    // 5 + 3 fits, +2 would be 10MB, +1 lands exactly on the 9MB limit.
    expect(accepted.map((a) => a.name)).toEqual(["b.png", "d.png"]);
    expect(errors).toEqual(["c.png: 이미지 합계가 9MB를 넘어 첨부할 수 없습니다."]);
    expect(5 * MB + 3 * MB + MB).toBe(MAX_TOTAL_IMAGE_BYTES);
  });

  it("enforces the 6-image limit", () => {
    const existing = Array.from({ length: MAX_IMAGE_COUNT - 1 }, () => ({ kind: "image", size: 1024 }));
    const { accepted, errors } = planAttachments(existing, [
      entry("sixth.png", "image/png"),
      entry("seventh.png", "image/png"),
    ]);
    expect(accepted.map((a) => a.name)).toEqual(["sixth.png"]);
    expect(errors).toEqual(["seventh.png: 이미지는 한 번에 최대 6장까지 첨부할 수 있습니다."]);
  });

  it("does not count documents against the image limits", () => {
    const existing = [
      ...Array.from({ length: MAX_IMAGE_COUNT }, () => ({ kind: "image", size: 1024 })),
      { kind: "document", size: 8 * MB },
    ];
    const { accepted, errors } = planAttachments(existing, [entry("more.md", "text/markdown", MB)]);
    expect(errors).toEqual([]);
    expect(accepted).toHaveLength(1);
  });

  it("rejects empty files and uses the display name in messages", () => {
    const { errors } = planAttachments([], [
      { file: file("image.png", "image/png", 0), name: "붙여넣은-이미지-1.png" },
    ]);
    expect(errors).toEqual(["붙여넣은-이미지-1.png: 빈 파일은 첨부할 수 없습니다."]);
  });

  it("keeps the worst-case encoded images inside the 16MB relay frame", () => {
    const encoded = Math.ceil(MAX_TOTAL_IMAGE_BYTES / 3) * 4;
    expect(encoded).toBeLessThan(16 * MB - MB);
  });
});

describe("isDuplicateImage", () => {
  const pending = [{ kind: "image", mimeType: "image/png", size: 4, content: "AAAA" }];

  it("matches identical bytes only", () => {
    expect(isDuplicateImage(pending, { mimeType: "image/png", size: 4, content: "AAAA" })).toBe(true);
    expect(isDuplicateImage(pending, { mimeType: "image/png", size: 4, content: "BBBB" })).toBe(false);
    expect(isDuplicateImage([], { mimeType: "image/png", size: 4, content: "AAAA" })).toBe(false);
  });
});

describe("buildUserText", () => {
  const image = { kind: "image", fileName: "a.png" };
  const doc = { kind: "document", fileName: "notes.txt", text: "hello" };

  it("uses the default prompt for an image-only send", () => {
    expect(buildUserText("   ", [image])).toEqual({
      prompt: DEFAULT_IMAGE_PROMPT,
      rawUserText: DEFAULT_IMAGE_PROMPT,
    });
  });

  it("keeps the typed text when there is some", () => {
    expect(buildUserText(" 이 차트 분석해줘 ", [image])).toEqual({
      prompt: "이 차트 분석해줘",
      rawUserText: "이 차트 분석해줘",
    });
  });

  it("does not invent a prompt for text-only or document-only sends", () => {
    expect(buildUserText("안녕", [])).toEqual({ prompt: "안녕", rawUserText: "안녕" });
    expect(buildUserText("", [doc])).toEqual({
      prompt: "",
      rawUserText: "--- 첨부 문서: notes.txt ---\n```\nhello\n```",
    });
  });

  it("appends document blocks after the prompt", () => {
    expect(buildUserText("", [image, doc]).rawUserText).toBe(
      `${DEFAULT_IMAGE_PROMPT}\n\n--- 첨부 문서: notes.txt ---\n\`\`\`\nhello\n\`\`\``,
    );
  });
});
