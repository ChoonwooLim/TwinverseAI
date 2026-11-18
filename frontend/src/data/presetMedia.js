/**
 * Pure helpers for preset media (videos, posters, private notes).
 *
 * Media with access "admin" is served by GET /api/presets/media/{presetId}/{file}, which the
 * backend answers only for administrator tokens. Media with access "public" is served from
 * /uploads/presets/{presetId}/{file}. Nothing here touches the network or storage.
 */

/** Allowed media and notes file names; the backend enforces the same pattern. */
export const MEDIA_FILE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;

/** CSS aspect-ratio written as "<number> / <number>". */
export const ASPECT_PATTERN = /^\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?$/;

export const MEDIA_ACCESS = Object.freeze(["admin", "public"]);

const ADMIN_ROLES = new Set(["admin", "superadmin"]);
const DEFAULT_ASPECT = "16 / 9";

/**
 * @param {string} presetId
 * @param {string} file
 * @param {"admin" | "public"} access
 * @returns {string | null} null for an unknown access level, so nothing is requested.
 */
export function presetMediaUrl(presetId, file, access) {
  const path = `${encodeURIComponent(presetId)}/${encodeURIComponent(file)}`;
  if (access === "admin") return `/api/presets/media/${path}`;
  if (access === "public") return `/uploads/presets/${path}`;
  return null;
}

/**
 * True only for a stored token plus an administrator role. The server still checks the token;
 * this only decides whether the page asks at all.
 *
 * @param {{ role?: string } | null | undefined} user
 * @param {string | null | undefined} token
 */
export function canViewAdminMedia(user, token) {
  return typeof token === "string" && token.length > 0 && ADMIN_ROLES.has(user?.role);
}

/** The item's aspect ratio if well formed, otherwise 16 / 9. */
export function mediaAspect(aspect) {
  return typeof aspect === "string" && ASPECT_PATTERN.test(aspect) ? aspect : DEFAULT_ASPECT;
}

/**
 * Keep only well-formed notes entries.
 *
 * @param {unknown} data Parsed notes file.
 * @returns {{ title: string, body: string }[] | null} null when the file is not an array at all.
 */
export function parseNotes(data) {
  if (!Array.isArray(data)) return null;
  return data
    .filter(
      (entry) =>
        entry !== null &&
        typeof entry === "object" &&
        typeof entry.title === "string" &&
        typeof entry.body === "string",
    )
    .map(({ title, body }) => ({ title, body }));
}

const LOAD_ERRORS = {
  video: { 404: "영상 파일이 아직 서버에 없습니다.", other: "영상을 불러오지 못했습니다." },
  notes: { 404: "메모 파일이 아직 서버에 없습니다.", other: "메모를 불러오지 못했습니다." },
};

/**
 * What to tell the viewer when a media or notes request fails.
 *
 * @param {number | undefined} status HTTP status, undefined for network errors.
 * @param {"video" | "notes"} subject
 * @returns {{ message: string, retry: boolean }}
 */
export function describeLoadError(status, subject = "video") {
  const copy = LOAD_ERRORS[subject] ?? LOAD_ERRORS.video;
  if (status === 404) return { message: copy[404], retry: false };
  if (status === 403) return { message: "관리자 권한이 필요합니다.", retry: false };
  return { message: copy.other, retry: true };
}

function megabytes(bytes) {
  return `${(Math.max(0, bytes) / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Download progress for display.
 *
 * @param {number} loaded Bytes received.
 * @param {number} [total] Bytes expected; 0 or missing when unknown.
 * @returns {{ percent: number | null, text: string }}
 */
export function describeProgress(loaded, total) {
  const got = Number.isFinite(loaded) ? loaded : 0;
  if (Number.isFinite(total) && total > 0) {
    const percent = Math.min(100, Math.max(0, Math.round((got / total) * 100)));
    return { percent, text: `${percent}% · ${megabytes(got)} / ${megabytes(total)}` };
  }
  return { percent: null, text: `${megabytes(got)} 받음` };
}
