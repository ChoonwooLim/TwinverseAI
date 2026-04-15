"""
NPC Chat API — Office metaverse NPC 대화용 LLM 엔드포인트.

UE5 Listen Server 호스트(= GPU PC 컨테이너) 가 Player Server RPC 수신 후 이 엔드포인트로
HTTP POST 요청을 보내고, 응답을 Multicast RPC 로 말풍선/채팅에 표시한다.

공유 AI 정책 (C:\\WORK\\infra-docs\\ai-shared-registry.md SSOT 준수):
- 1차: twinverse-ai (192.168.219.117) Ollama — 로컬, 무료, 기본 모델 gemma3:12b
- 2차(폴백): Anthropic Claude API (NPC_LLM_FALLBACK=anthropic 일 때만)
"""

import os
import logging
from typing import Optional
from fastapi import APIRouter, Request
from pydantic import BaseModel
from rate_limit import limiter
import httpx

logger = logging.getLogger("twinverse.npc")

router = APIRouter()

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://192.168.219.117:11434")
OLLAMA_MODEL = os.getenv("NPC_OLLAMA_MODEL", "gemma3:12b")
OLLAMA_TIMEOUT = float(os.getenv("NPC_OLLAMA_TIMEOUT", "30.0"))

FALLBACK = os.getenv("NPC_LLM_FALLBACK", "").lower()
FALLBACK_API_KEY = os.getenv("NPC_LLM_FALLBACK_API_KEY", "")
FALLBACK_MODEL = os.getenv("NPC_LLM_FALLBACK_MODEL", "claude-sonnet-4-5")
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
    provider: str


DEFAULT_SYSTEM_PROMPT = """You are {npc_name}, a {npc_role} working in a virtual office.
Stay in character. Be helpful, professional, and concise.
Respond in the same language the user speaks.
Keep responses under 200 characters for speech bubble display."""


@router.post("/chat", response_model=NPCChatResponse)
@limiter.limit("120/minute")
async def npc_chat(request: Request, body: NPCChatRequest):
    """슬롯당 6 플레이어 × NPC 10명 동시 대화를 감안해 120/min rate limit."""
    system_prompt = body.system_prompt or DEFAULT_SYSTEM_PROMPT.format(
        npc_name=body.npc_name,
        npc_role=body.npc_role,
    )

    messages: list[dict] = []
    for msg in body.history[-20:]:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": f"[{body.sender_name}]: {body.message}"})

    try:
        text = await _call_ollama(system_prompt, messages)
        return NPCChatResponse(response=text, npc_id=body.npc_id, provider="ollama")
    except Exception as e:
        logger.warning(f"Ollama call failed ({e}); fallback={FALLBACK}")

    if FALLBACK == "anthropic" and FALLBACK_API_KEY:
        try:
            text = await _call_anthropic(system_prompt, messages)
            return NPCChatResponse(response=text, npc_id=body.npc_id, provider="anthropic")
        except Exception as e:
            logger.error(f"Anthropic fallback failed: {e}")

    return NPCChatResponse(
        response=f"*{body.npc_name} seems distracted and doesn't respond.*",
        npc_id=body.npc_id,
        provider="none",
    )


async def _call_ollama(system_prompt: str, messages: list[dict]) -> str:
    """Ollama /api/chat — twinverse-ai 공유 서버 (gemma3:12b 기본)."""
    full_messages = [{"role": "system", "content": system_prompt}] + messages
    async with httpx.AsyncClient(timeout=OLLAMA_TIMEOUT) as client:
        resp = await client.post(
            f"{OLLAMA_URL}/api/chat",
            json={
                "model": OLLAMA_MODEL,
                "messages": full_messages,
                "stream": False,
                "options": {"num_predict": LLM_MAX_TOKENS},
            },
        )
        resp.raise_for_status()
        data = resp.json()
        return data["message"]["content"].strip()


async def _call_anthropic(system_prompt: str, messages: list[dict]) -> str:
    """Anthropic Messages API — 로컬 Ollama 실패 시 폴백."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": FALLBACK_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": FALLBACK_MODEL,
                "max_tokens": LLM_MAX_TOKENS,
                "system": system_prompt,
                "messages": messages,
            },
        )
        resp.raise_for_status()
        data = resp.json()
        return data["content"][0]["text"]
