// Pure helpers for the admin OpenClaw chat conversation list (ChatTab).

/**
 * Human-readable text for a failed request. FastAPI `detail` can be a string,
 * a validation array or an object; rendering a non-string in React throws.
 */
export function apiErrorText(error, fallback = "요청 실패") {
  if (typeof error === "string") return error || fallback;
  const detail = error?.response?.data?.detail;
  if (typeof detail === "string" && detail) return detail;
  if (Array.isArray(detail)) {
    const text = detail
      .map((d) => (typeof d === "string" ? d : d?.msg))
      .filter(Boolean)
      .join(", ");
    if (text) return text;
  } else if (detail && typeof detail === "object") {
    if (typeof detail.message === "string" && detail.message) return detail.message;
  }
  const status = error?.response?.status;
  if (status) return `${fallback} (HTTP ${status})`;
  if (typeof error?.message === "string" && error.message) return `${fallback}: ${error.message}`;
  return fallback;
}

/**
 * The server no longer has it (deleted in another tab or by an earlier click).
 * Only the API's own answer counts: a 404 from a proxy or a missing route must
 * not make a conversation that still exists vanish from the list.
 */
export function isAlreadyGone(error) {
  return error?.response?.status === 404
    && error?.response?.data?.detail === "conversation not found";
}

/** Drops conversations deleted in this tab from a (possibly stale) server list. */
export function withoutDeleted(conversations, deletedIds) {
  const list = Array.isArray(conversations) ? conversations : [];
  if (!deletedIds || deletedIds.size === 0) return list;
  return list.filter((c) => !deletedIds.has(c.id));
}

/**
 * Which conversation should be active for an agent given its current list.
 * Keeps the current one while it still exists, else the most recent (lists
 * arrive newest-first), else none.
 */
export function resolveActiveConversation(conversations, currentId) {
  const list = Array.isArray(conversations) ? conversations : [];
  if (currentId != null && list.some((c) => c.id === currentId)) return currentId;
  return list.length > 0 ? list[0].id : null;
}

/** Gateway session keys that the reverse map routes to a conversation. */
export function sessionKeysForConversation(convBySessionKey, convId) {
  return Object.keys(convBySessionKey || {}).filter((k) => convBySessionKey[k] === convId);
}
