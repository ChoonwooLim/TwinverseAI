import { useEffect } from "react";
import { useLocation } from "react-router-dom";

// Navigation state flag for URL updates that must not move the page
// (e.g. a filter written to the query while a hash is present).
export const KEEP_SCROLL_STATE_KEY = "keepScroll";

// Pages are lazy-loaded, so the target may appear a little after the navigation.
const MAX_WAIT_MS = 2000;

function findHashTarget(hash) {
  let id = hash.slice(1);
  try {
    id = decodeURIComponent(id);
  } catch {
    /* keep the raw id */
  }
  return id ? document.getElementById(id) : null;
}

/**
 * react-router does not scroll to a hash. On every navigation that carries one (including a
 * repeated click on the same link, which gets a new location key), scroll its element to the
 * top. The root scroll-padding-top in global.css keeps it clear of the sticky top bar.
 */
export default function ScrollToHash() {
  const { hash, key, state } = useLocation();
  const keepScroll = Boolean(state?.[KEEP_SCROLL_STATE_KEY]);

  useEffect(() => {
    if (!hash || hash === "#" || keepScroll) return undefined;
    const deadline = performance.now() + MAX_WAIT_MS;
    let frame = 0;
    const attempt = () => {
      const target = findHashTarget(hash);
      if (target) {
        const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        target.scrollIntoView({ block: "start", behavior: reduceMotion ? "instant" : "smooth" });
      } else if (performance.now() < deadline) {
        frame = requestAnimationFrame(attempt);
      }
    };
    attempt();
    return () => cancelAnimationFrame(frame);
  }, [hash, key, keepScroll]);

  return null;
}
