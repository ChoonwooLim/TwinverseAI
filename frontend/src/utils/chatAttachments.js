// Pure attachment rules for the OpenClaw admin chat composer. Kept free of
// React and DOM readers so the limits can be unit-tested in plain Node.

export const IMAGE_MIMES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
export const DOC_MIMES = ["text/plain", "text/markdown", "application/json"];
export const DOC_EXTS = [".txt", ".md", ".json", ".log", ".csv"];

const MB = 1024 * 1024;
// The backend relays each `sessions.send` to the gateway as ONE WebSocket
// frame capped at 16MB. Base64 inflates images by 4/3, so 9MB of raw image
// bytes (~12MB encoded) is the most that fits alongside the message text.
export const MAX_ATTACH_BYTES = 9 * MB;
export const MAX_TOTAL_IMAGE_BYTES = 9 * MB;
export const MAX_IMAGE_COUNT = 6;

export const DEFAULT_IMAGE_PROMPT = "첨부한 이미지를 확인하고 내용을 설명해 주세요.";

const IMAGE_EXT_BY_MIME = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};

const formatMb = (bytes) => {
  const mb = bytes / MB;
  return `${mb >= 10 || Number.isInteger(mb) ? Math.round(mb) : mb.toFixed(1)}MB`;
};

const isImageType = (type) => typeof type === "string" && type.startsWith("image/");

export function classifyAttachment(file) {
  const mime = file?.type || "";
  if (IMAGE_MIMES.includes(mime)) return "image";
  if (isImageType(mime)) return "unsupported-image";
  const name = String(file?.name || "").toLowerCase();
  if (DOC_MIMES.includes(mime) || DOC_EXTS.some((ext) => name.endsWith(ext))) return "document";
  return "unsupported";
}

/**
 * Image files carried by a paste event, each exactly once.
 *
 * Browsers expose a copied bitmap through both `clipboardData.files` and
 * `clipboardData.items`, so reading both would attach it twice: `files` wins
 * and `items` is only the fallback. Returns [] when the paste should stay an
 * ordinary text paste — no image at all, or a rich-content copy (spreadsheet
 * cells, document text) where the app also put a rendered bitmap of that same
 * text on the clipboard.
 */
export function extractClipboardImages(clipboardData) {
  if (!clipboardData) return [];

  let images = Array.from(clipboardData.files || []).filter((file) => file && isImageType(file.type));
  if (images.length === 0) {
    images = Array.from(clipboardData.items || [])
      .filter((item) => item && item.kind === "file" && isImageType(item.type))
      .map((item) => item.getAsFile?.())
      .filter(Boolean);
  }
  if (images.length === 0) return [];

  const read = (type) => {
    try {
      return clipboardData.getData?.(type) || "";
    } catch {
      return "";
    }
  };
  if (read("text/plain").trim() && read("text/html").trim()) return [];

  return images;
}

/**
 * Clipboard bitmaps all arrive as "image.png", which makes several pasted
 * chips indistinguishable. Give those a timestamped name; real file names
 * are kept as they are.
 */
export function pastedImageName(file, now = new Date(), index = 0) {
  const name = String(file?.name || "").trim();
  if (name && !/^image\.[a-z0-9]+$/i.test(name)) return name;
  const pad = (n) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
    + `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const ext = IMAGE_EXT_BY_MIME[file?.type] || "png";
  return `붙여넣은-이미지-${stamp}${index > 0 ? `-${index + 1}` : ""}.${ext}`;
}

/**
 * Decide which incoming files may join the pending attachments.
 * `existing` items need `{ kind, size }`; `incoming` items need
 * `{ file: { type, size, name }, name }`. Returns the accepted entries (with
 * their `kind`) and one Korean message per rejected file.
 */
export function planAttachments(existing, incoming) {
  const accepted = [];
  const errors = [];
  const currentImages = (existing || []).filter((a) => a.kind === "image");
  let imageCount = currentImages.length;
  let imageBytes = currentImages.reduce((sum, a) => sum + (a.size || 0), 0);

  for (const entry of incoming || []) {
    const { file } = entry;
    const name = entry.name || file?.name || "파일";
    const kind = classifyAttachment(file);

    if (kind === "unsupported-image") {
      errors.push(`${name}: 지원하지 않는 이미지 형식입니다. PNG, JPEG, GIF, WebP만 첨부할 수 있습니다.`);
      continue;
    }
    if (kind === "unsupported") {
      errors.push(`${name}: 지원하지 않는 파일 형식입니다.`);
      continue;
    }
    if (!file.size) {
      errors.push(`${name}: 빈 파일은 첨부할 수 없습니다.`);
      continue;
    }
    if (file.size > MAX_ATTACH_BYTES) {
      errors.push(`${name}: 파일이 너무 큽니다 (${formatMb(file.size)}). 한 파일당 최대 ${formatMb(MAX_ATTACH_BYTES)}까지 첨부할 수 있습니다.`);
      continue;
    }
    if (kind === "image") {
      if (imageCount >= MAX_IMAGE_COUNT) {
        errors.push(`${name}: 이미지는 한 번에 최대 ${MAX_IMAGE_COUNT}장까지 첨부할 수 있습니다.`);
        continue;
      }
      if (imageBytes + file.size > MAX_TOTAL_IMAGE_BYTES) {
        errors.push(`${name}: 이미지 합계가 ${formatMb(MAX_TOTAL_IMAGE_BYTES)}를 넘어 첨부할 수 없습니다.`);
        continue;
      }
      imageCount += 1;
      imageBytes += file.size;
    }
    accepted.push({ ...entry, name, kind });
  }
  return { accepted, errors };
}

/** True when the same image bytes are already pending. */
export function isDuplicateImage(existing, candidate) {
  return (existing || []).some((a) => (
    a.kind === "image"
    && a.size === candidate.size
    && a.mimeType === candidate.mimeType
    && a.content === candidate.content
  ));
}

/**
 * The user-authored text for a send. The gateway needs a non-empty message,
 * so an image sent with no typed text gets a default instruction.
 */
export function buildUserText(draft, pending) {
  const text = String(draft || "").trim();
  const items = pending || [];
  const docBlocks = items
    .filter((a) => a.kind === "document")
    .map((d) => `--- 첨부 문서: ${d.fileName} ---\n\`\`\`\n${d.text}\n\`\`\``);
  const hasImage = items.some((a) => a.kind === "image");
  const prompt = text || (hasImage ? DEFAULT_IMAGE_PROMPT : "");
  return { prompt, rawUserText: [prompt, ...docBlocks].filter(Boolean).join("\n\n") };
}
