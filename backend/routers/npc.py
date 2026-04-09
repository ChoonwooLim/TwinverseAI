"""
NPC Chat API — handles LLM conversations for Office metaverse NPCs.
UE5 Dedicated Server sends HTTP requests here, receives LLM responses.
Replaces DeskRPG's OpenClaw NPC chat via Socket.IO.
"""

import os
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from rate_limit import limiter
import httpx

logger = logging.getLogger("twinverse.npc")

router = APIRouter()

# LLM Provider config
LLM_PROVIDER = os.getenv("NPC_LLM_PROVIDER", "anthropic")  # anthropic | openai
LLM_API_KEY = os.getenv("NPC_LLM_API_KEY", "")
LLM_MODEL = os.getenv("NPC_LLM_MODEL", "claude-sonnet-4-20250514")
LLM_MAX_TOKENS = int(os.getenv("NPC_LLM_MAX_TOKENS", "512"))


class NPCChatRequest(BaseModel):
    npc_id: str
    npc_name: str
    npc_role: str
    system_prompt: Optional[str] = None
    sender_name: str
    message: str
    history: list[dict] = []


class NPCChatResponse(BaseModel):
    response: str
    npc_id: str


DEFAULT_SYSTEM_PROMPT = """You are {npc_name}, a {npc_role} working in a virtual office.
Stay in character. Be helpful, professional, and concise.
Respond in the same language the user speaks.
Keep responses under 200 characters for speech bubble display."""


@router.post("/chat", response_model=NPCChatResponse)
@limiter.limit("30/minute")
async def npc_chat(request: Request, body: NPCChatRequest):
    """Process NPC chat message through LLM."""
    system_prompt = body.system_prompt or DEFAULT_SYSTEM_PROMPT.format(
        npc_name=body.npc_name,
        npc_role=body.npc_role
    )

    # Build message array
    messages = []
    for msg in body.history[-20:]:  # Last 20 messages
        role = msg.get("role", "user")
        content = msg.get("content", "")
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})

    # Add current message
    messages.append({"role": "user", "content": f"[{body.sender_name}]: {body.message}"})

    try:
        if LLM_PROVIDER == "anthropic":
            response_text = await _call_anthropic(system_prompt, messages)
        else:
            response_text = await _call_openai(system_prompt, messages)
    except Exception as e:
        logger.error(f"LLM call failed: {e}")
        response_text = f"*{body.npc_name} seems distracted and doesn't respond.*"

    return NPCChatResponse(response=response_text, npc_id=body.npc_id)


async def _call_anthropic(system_prompt: str, messages: list[dict]) -> str:
    """Call Anthropic Claude API."""
    if not LLM_API_KEY:
        return "*No API key configured for NPC conversations.*"

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": LLM_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": LLM_MODEL,
                "max_tokens": LLM_MAX_TOKENS,
                "system": system_prompt,
                "messages": messages,
            },
        )
        resp.raise_for_status()
        data = resp.json()
        return data["content"][0]["text"]


async def _call_openai(system_prompt: str, messages: list[dict]) -> str:
    """Call OpenAI API (fallback)."""
    if not LLM_API_KEY:
        return "*No API key configured for NPC conversations.*"

    full_messages = [{"role": "system", "content": system_prompt}] + messages

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {LLM_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": LLM_MODEL,
                "max_tokens": LLM_MAX_TOKENS,
                "messages": full_messages,
            },
        )
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"]
