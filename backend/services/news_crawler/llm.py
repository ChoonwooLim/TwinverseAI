"""LLM analyzer for crawled news items.

Tier 1 (default): Ollama qwen2.5:7b @ twinverse-ai:11434 — free, fast, Korean OK.
Tier 2 (fallback): OpenClaw gpt-5.5 — frontier model, used when Ollama returns
  invalid JSON or low confidence (<0.7) or fails outright.

Design notes:
- We force JSON-only output. Ollama's `format: json` enforces this server-side;
  for OpenClaw (which doesn't have a JSON-mode flag), we instruct in the prompt
  and parse defensively.
- Prompt is pinned to a single role: classify + summarize + propose apply_action.
  No tool use. No multi-turn. Each call is stateless (random session key).
- Output language: Korean (title/summary/content) for the admin UI; English
  identifiers (category, apply_action.type) for code.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import uuid
from typing import Optional

import httpx

from services.openclaw_gateway import OpenClawGateway, OpenClawGatewayError
from services.news_crawler.types import (
    APPLY_ACTION_TYPES,
    CATEGORY_VALUES,
    NewsAnalysis,
    RawItem,
)

logger = logging.getLogger("news_crawler.llm")

# ── Config from env ─────────────────────────────────────────────

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://192.168.219.117:11434").rstrip("/")
OLLAMA_MODEL = os.getenv("NEWS_OLLAMA_MODEL", "qwen2.5:7b")
OLLAMA_TIMEOUT = float(os.getenv("NEWS_OLLAMA_TIMEOUT", "60"))

OPENCLAW_WS_URL = os.getenv("OPENCLAW_WS_URL", "")
OPENCLAW_TOKEN = os.getenv("OPENCLAW_TOKEN", "")
# News crawler uses this agent on OpenClaw for fallback analysis.
# Default 'main' (its model is openai-codex/gpt-5.5 per current config).
OPENCLAW_NEWS_AGENT_ID = os.getenv("OPENCLAW_NEWS_AGENT_ID", "main")
# gpt-5.5 first-call warmup is occasionally >3min; give the fallback path margin.
OPENCLAW_CHAT_TIMEOUT = float(os.getenv("NEWS_OPENCLAW_TIMEOUT", "300"))

# Confidence threshold below which we escalate to OpenClaw fallback.
CONFIDENCE_FLOOR = float(os.getenv("NEWS_LLM_CONFIDENCE_FLOOR", "0.7"))

# Truncate raw content before sending to LLM (qwen2.5:7b context is ~32k but we
# trim aggressively to keep latency low and avoid drift on long pages).
MAX_RAW_CHARS = int(os.getenv("NEWS_LLM_MAX_RAW_CHARS", "8000"))


# ── Prompt ──────────────────────────────────────────────────────

_PROMPT_TEMPLATE = """You analyze a single news/release-note about Claude Code, the Claude API, or related AI dev tooling.

Decide if it is RELEVANT for a Korean developer who uses Claude Code daily on the TwinverseAI codebase. RELEVANT means: a new skill, plugin, mode, feature, model release, configuration change, or noteworthy SDK update. NOT RELEVANT means: marketing fluff, hardware reviews, unrelated AI products, business news without dev impact.

Output STRICT JSON ONLY (no prose, no markdown fence). Schema:
{{
  "is_relevant": true|false,
  "category": "skill"|"mode"|"plugin"|"feature"|"update"|"general",
  "title_ko": "Korean title, max 60 chars",
  "summary_ko": "1-2 sentence Korean summary",
  "content_md": "Korean markdown body. Use ## headings, lists, code blocks. End with a 출처: line that includes the source URL.",
  "apply_action": {{ "type": "...", ... }},
  "confidence": 0.0
}}

apply_action.type rules:
- "info_only": informational only, no action. Default for category=update or general. Fields: {{"type": "info_only"}}.
- "install_skill": a new Claude Code skill we should install. Fields: {{"type": "install_skill", "skill_name": "<slug>", "repo": "https://github.com/owner/name", "install_method": "marketplace"|"clone"|"curl"}}.
- "install_plugin": a Claude Code plugin. Fields: {{"type": "install_plugin", "marketplace": "<owner/repo or url>", "plugin_id": "<id>"}}.
- "edit_claude_md": suggests adding rules to CLAUDE.md. Fields: {{"type": "edit_claude_md", "section_title": "...", "content_md": "the snippet to add"}}.
- "edit_settings": suggests settings.json changes. Fields: {{"type": "edit_settings", "keys": {{"path.to.key": "value"}}}}.

If is_relevant=false, set category="general", apply_action={{"type":"info_only"}}, and keep title_ko/summary_ko terse.

Rules:
- Output ONLY the JSON object. No explanation. No code fences.
- All Korean text in title_ko/summary_ko/content_md.
- All identifiers (category, type) in English exactly as listed.
- confidence is your self-rated certainty about the classification (0..1).

Source URL: {source_url}
Original title: {title_raw}

Source body:
---
{content_raw}
---
"""


def _build_prompt(item: RawItem) -> str:
    body = item.content_raw or ""
    if len(body) > MAX_RAW_CHARS:
        body = body[:MAX_RAW_CHARS] + "\n[…truncated…]"
    return _PROMPT_TEMPLATE.format(
        source_url=item.source_url or "(no url)",
        title_raw=item.title_raw or "(no title)",
        content_raw=body,
    )


# ── JSON parsing & validation ───────────────────────────────────

_JSON_OBJECT_RE = re.compile(r"\{[\s\S]*\}", re.MULTILINE)


def _extract_json_object(text: str) -> Optional[dict]:
    """Defensive JSON extraction: handles bare JSON, fenced ```json blocks, or
    JSON embedded in prose. Returns None if unparseable."""
    text = (text or "").strip()
    if not text:
        return None

    # Try direct parse first
    try:
        v = json.loads(text)
        return v if isinstance(v, dict) else None
    except json.JSONDecodeError:
        pass

    # Strip ```json ... ``` fences if present
    fence_match = re.search(r"```(?:json)?\s*([\s\S]+?)\s*```", text)
    if fence_match:
        try:
            v = json.loads(fence_match.group(1))
            return v if isinstance(v, dict) else None
        except json.JSONDecodeError:
            pass

    # Find the largest brace-delimited object substring
    m = _JSON_OBJECT_RE.search(text)
    if m:
        try:
            v = json.loads(m.group(0))
            return v if isinstance(v, dict) else None
        except json.JSONDecodeError:
            pass

    return None


def _coerce_analysis(data: dict, *, llm_engine: str, raw: str) -> Optional[NewsAnalysis]:
    """Validate the raw dict against the schema. Returns None on hard failure."""
    if not isinstance(data, dict):
        return None

    is_relevant = bool(data.get("is_relevant", False))
    category = str(data.get("category", "general")).strip().lower()
    if category not in CATEGORY_VALUES:
        category = "general"

    title_ko = str(data.get("title_ko", "")).strip()[:200]
    summary_ko = str(data.get("summary_ko", "")).strip()
    content_md = str(data.get("content_md", "")).strip()

    apply_action = data.get("apply_action") or {"type": "info_only"}
    if not isinstance(apply_action, dict):
        apply_action = {"type": "info_only"}
    action_type = str(apply_action.get("type", "info_only")).strip().lower()
    if action_type not in APPLY_ACTION_TYPES:
        action_type = "info_only"
        apply_action = {"type": "info_only"}
    else:
        apply_action["type"] = action_type

    requires_approval = action_type in ("edit_claude_md", "edit_settings")

    try:
        confidence = float(data.get("confidence", 0.5))
    except (TypeError, ValueError):
        confidence = 0.5
    confidence = max(0.0, min(1.0, confidence))

    if not title_ko:
        # missing critical field → reject so caller can escalate
        return None

    return NewsAnalysis(
        is_relevant=is_relevant,
        category=category,
        title_ko=title_ko,
        summary_ko=summary_ko,
        content_md=content_md,
        apply_action=apply_action,
        requires_approval=requires_approval,
        confidence=confidence,
        llm_engine=llm_engine,
        raw_response=raw[:4000],
    )


# ── Tier 1: Ollama ──────────────────────────────────────────────


async def _call_ollama(prompt: str) -> tuple[str, str]:
    """Call Ollama. Returns (raw_text, engine_label). Raises on transport errors."""
    payload = {
        "model": OLLAMA_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "format": "json",  # qwen2.5 supports server-side JSON enforcement
        "stream": False,
        "options": {
            "temperature": 0.2,
            "num_ctx": 16384,
        },
    }
    async with httpx.AsyncClient(timeout=OLLAMA_TIMEOUT) as client:
        resp = await client.post(f"{OLLAMA_URL}/api/chat", json=payload)
    resp.raise_for_status()
    body = resp.json()
    text = (body.get("message") or {}).get("content", "") or ""
    return text, f"ollama:{OLLAMA_MODEL}"


# ── Tier 2: OpenClaw gpt-5.5 fallback ───────────────────────────


async def _call_openclaw(prompt: str) -> tuple[str, str]:
    """Call OpenClaw chat.send via existing agent. Returns (raw_text, engine_label).
    Caller is expected to parse JSON from the response (no server-side enforcement).

    Env is read at call-time (not import-time) so callers that load .env after
    importing this module (CLI smoke scripts, tests) still see configured values.
    """
    ws_url = os.getenv("OPENCLAW_WS_URL", "") or OPENCLAW_WS_URL
    token = os.getenv("OPENCLAW_TOKEN", "") or OPENCLAW_TOKEN
    agent_id = os.getenv("OPENCLAW_NEWS_AGENT_ID", "") or OPENCLAW_NEWS_AGENT_ID
    chat_timeout = float(os.getenv("NEWS_OPENCLAW_TIMEOUT", "") or OPENCLAW_CHAT_TIMEOUT)

    if not (ws_url and token):
        raise OpenClawGatewayError("OPENCLAW_WS_URL/TOKEN not configured")
    if not agent_id:
        raise OpenClawGatewayError("OPENCLAW_NEWS_AGENT_ID not configured")

    # Wrap with a JSON-only nudge since OpenClaw lacks Ollama's `format: json`.
    nudge = (
        "Reply with ONLY the JSON object described below. "
        "No prose, no markdown fence, no explanation.\n\n"
    )
    full_prompt = nudge + prompt

    session_key = f"news-analyzer-{uuid.uuid4().hex[:12]}"
    async with OpenClawGateway(ws_url, token, chat_timeout=chat_timeout) as gw:
        text = await gw.chat_send(agent_id, session_key, full_prompt)
    return text, f"openclaw:{agent_id}"


# ── Public entry point ──────────────────────────────────────────


async def analyze_item(item: RawItem) -> Optional[NewsAnalysis]:
    """Run the LLM analysis pipeline.

    Tier 1 → Ollama qwen2.5:7b (JSON-mode).
    Escalate to Tier 2 → OpenClaw gpt-5.5 if:
      - Ollama transport fails
      - JSON parse fails
      - schema coercion fails (missing title_ko etc.)
      - confidence < CONFIDENCE_FLOOR

    Returns None only if BOTH tiers fail; logs a warning in that case.
    """
    prompt = _build_prompt(item)

    # ── Tier 1: Ollama ──────────────────────────────────────────
    tier1_result: Optional[NewsAnalysis] = None
    try:
        raw1, engine1 = await _call_ollama(prompt)
        data1 = _extract_json_object(raw1)
        if data1 is not None:
            tier1_result = _coerce_analysis(data1, llm_engine=engine1, raw=raw1)
        if tier1_result is not None and tier1_result.confidence >= CONFIDENCE_FLOOR:
            return tier1_result
        if tier1_result is not None:
            logger.info(
                "ollama confidence %.2f below floor %.2f; escalating to OpenClaw [%s]",
                tier1_result.confidence,
                CONFIDENCE_FLOOR,
                item.source_url,
            )
    except (httpx.HTTPError, OSError) as e:
        logger.warning("ollama call failed: %s [%s]", e, item.source_url)

    # ── Tier 2: OpenClaw ────────────────────────────────────────
    try:
        raw2, engine2 = await _call_openclaw(prompt)
        data2 = _extract_json_object(raw2)
        if data2 is None:
            logger.warning("openclaw returned non-JSON [%s]: %s", item.source_url, raw2[:200])
        else:
            result2 = _coerce_analysis(data2, llm_engine=engine2, raw=raw2)
            if result2 is not None:
                return result2
            logger.warning("openclaw response failed schema coercion [%s]", item.source_url)
    except OpenClawGatewayError as e:
        logger.warning("openclaw call failed [%s]: %s", item.source_url, e)
    except Exception:
        logger.exception("openclaw unexpected error [%s]", item.source_url)

    # Tier 1 result is better than nothing if it exists, even if confidence was low
    if tier1_result is not None:
        logger.info(
            "tier 2 failed; falling back to tier 1 result with confidence %.2f [%s]",
            tier1_result.confidence,
            item.source_url,
        )
        return tier1_result

    return None


# ── Smoke test (`python -m services.news_crawler.llm`) ──────────


_SAMPLE = RawItem(
    source="smoke_test",
    source_url="https://docs.claude.com/en/docs/claude-code/example",
    title_raw="Ultraplan: Claude Code's new cloud-based plan mode",
    content_raw=(
        "Ultraplan runs your plan on Anthropic's cloud (CCR) using Opus 4.6, "
        "with up to 30 minutes of dedicated compute. It returns a richer plan with "
        "diagrams, inline comments, and risk analysis. Invoke via /ultraplan in "
        "Claude Code, or upgrade an existing /plan result to ultraplan."
    ),
)


async def _smoke() -> int:
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--engine", choices=["ollama", "openclaw", "auto"], default="auto")
    parser.add_argument("--from-url", help="fetch a URL as the source body (raw text)")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

    item = _SAMPLE
    if args.from_url:
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.get(args.from_url, follow_redirects=True)
            r.raise_for_status()
            item = RawItem(
                source="smoke_test",
                source_url=args.from_url,
                title_raw=args.from_url,
                content_raw=r.text,
            )

    if args.engine == "ollama":
        raw, engine = await _call_ollama(_build_prompt(item))
        print(f"raw from {engine}:\n{raw[:1000]}\n")
        data = _extract_json_object(raw)
        result = _coerce_analysis(data or {}, llm_engine=engine, raw=raw) if data else None
    elif args.engine == "openclaw":
        raw, engine = await _call_openclaw(_build_prompt(item))
        print(f"raw from {engine}:\n{raw[:1000]}\n")
        data = _extract_json_object(raw)
        result = _coerce_analysis(data or {}, llm_engine=engine, raw=raw) if data else None
    else:
        result = await analyze_item(item)

    if result is None:
        print("FAIL: no analysis")
        return 1
    print("=== NewsAnalysis ===")
    print(f"engine        : {result.llm_engine}")
    print(f"is_relevant   : {result.is_relevant}")
    print(f"category      : {result.category}")
    print(f"confidence    : {result.confidence}")
    print(f"title_ko      : {result.title_ko}")
    print(f"summary_ko    : {result.summary_ko}")
    print(f"apply_action  : {json.dumps(result.apply_action, ensure_ascii=False)}")
    print(f"req approval  : {result.requires_approval}")
    print(f"content_md (first 400 chars):\n{result.content_md[:400]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(_smoke()))
