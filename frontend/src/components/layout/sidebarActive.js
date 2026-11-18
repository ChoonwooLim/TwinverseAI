/**
 * Which sidebar link is the current one. Pure functions, no React, so they can be unit tested.
 *
 * Sidebar link paths may carry a query and/or a hash, e.g. "/designs?category=fintech-crypto#design-catalog".
 */

function normalizeHash(hash) {
  return !hash || hash === "#" ? "" : hash;
}

/**
 * Split a link path into pathname, search ("?..." or "") and hash ("#..." or "").
 * @param {string} path
 * @returns {{ pathname: string, search: string, hash: string }}
 */
export function parseLinkPath(path) {
  const hashAt = path.indexOf("#");
  const beforeHash = hashAt === -1 ? path : path.slice(0, hashAt);
  const queryAt = beforeHash.indexOf("?");
  return {
    pathname: queryAt === -1 ? beforeHash : beforeHash.slice(0, queryAt),
    search: queryAt === -1 ? "" : beforeHash.slice(queryAt),
    hash: normalizeHash(hashAt === -1 ? "" : path.slice(hashAt)),
  };
}

/**
 * Pick the single best-matching link of a sidebar section for the current location.
 *
 * A link (top-level item or child) is a candidate when its pathname equals the location's,
 * its hash, if it has one, equals the location's hash, and each of its query params, if it has
 * any, has the same value in the location. The most specific candidate wins:
 * score = 2 x (has a matching query) + 1 x (has a matching hash); ties go to the first link in
 * menu order. A plain link therefore stays current when nothing more specific matches, even if
 * the URL carries an unrelated hash or query.
 *
 * @param {{ path: string, children?: { path: string }[] }[]} items  The section's items.
 * @param {{ pathname: string, search?: string, hash?: string }} location
 * @returns {{ path: string, ariaCurrent: "page" | "location" } | null}
 *   `path` is the winning link's path; every link with that same path is shown as current.
 *   `ariaCurrent` is "page" for a plain-path match and "location" for a hash/query match.
 */
export function findActiveLink(items, location) {
  const locationHash = normalizeHash(location.hash);
  const locationParams = new URLSearchParams(location.search || "");
  let best = null;
  let bestScore = -1;
  for (const link of items.flatMap((item) => [item, ...(item.children ?? [])])) {
    const target = parseLinkPath(link.path);
    if (target.pathname !== location.pathname) continue;
    if (target.hash && target.hash !== locationHash) continue;
    const params = [...new URLSearchParams(target.search)];
    if (params.some(([key, value]) => locationParams.get(key) !== value)) continue;
    const score = (params.length > 0 ? 2 : 0) + (target.hash ? 1 : 0);
    if (score > bestScore) {
      best = link;
      bestScore = score;
    }
  }
  return best ? { path: best.path, ariaCurrent: bestScore > 0 ? "location" : "page" } : null;
}

/**
 * Whether a group item holds the current link. A plain child also counts for its nested
 * routes (child path + "/..."), e.g. a dated page under /admin/docs/dev-plan.
 * @param {{ children?: { path: string }[] }} item
 * @param {{ pathname: string }} location
 * @param {string | undefined} activePath  `path` returned by findActiveLink.
 * @returns {boolean}
 */
export function isChildActive(item, location, activePath) {
  if (!Array.isArray(item.children)) return false;
  return item.children.some((child) => {
    if (child.path === activePath) return true;
    const target = parseLinkPath(child.path);
    return !target.search && !target.hash && location.pathname.startsWith(`${target.pathname}/`);
  });
}
