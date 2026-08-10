"""ASGI entry point for the live interpretation service."""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, Request, WebSocket
from fastapi.responses import JSONResponse

from .config import Settings
from .interfaces import Transcriber, Translator
from .runtime import Runtime
from .session import handle_stream
from .transcriber import FasterWhisperTranscriber
from .translator import OllamaTranslator


def create_app(
    *,
    settings: Settings | None = None,
    transcriber: Transcriber | None = None,
    translator: Translator | None = None,
) -> FastAPI:
    configured = settings or Settings.from_env()
    runtime = Runtime(
        configured,
        transcriber or FasterWhisperTranscriber(configured),
        translator or OllamaTranslator(configured),
    )

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        await runtime.start()
        try:
            yield
        finally:
            await runtime.close()

    application = FastAPI(
        title="Twinverse Live Interpretation",
        version="1.0.0",
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
        lifespan=lifespan,
    )
    application.state.runtime = runtime

    @application.middleware("http")
    async def no_store(request: Request, call_next):  # type: ignore[no-untyped-def]
        response = await call_next(request)
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response

    @application.get("/health", include_in_schema=False)
    async def health() -> dict[str, str]:
        return {"status": "ok", "service": "live-interpretation"}

    @application.get("/ready", include_in_schema=False)
    async def ready() -> JSONResponse:
        if runtime.ready:
            return JSONResponse(
                {"status": "ready", "active_sessions": runtime.active_sessions}
            )
        return JSONResponse({"status": "unavailable"}, status_code=503)

    @application.websocket("/v1/stream")
    async def stream(websocket: WebSocket) -> None:
        await handle_stream(websocket, runtime)

    return application


app = create_app()
