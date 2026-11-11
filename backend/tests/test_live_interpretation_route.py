"""Verify /ws/interpretation/{meeting_id} is registered as a WebSocket route.

The route proxies to the GPU `live_interpretation` service. The test only
asserts that the backend registers the route and that auth/validation
responses come back before the upstream is contacted — the upstream proxy
path is covered by services/live_interpretation/tests/.
"""
from __future__ import annotations

import os
import sys
import unittest
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))

os.environ.setdefault("DATABASE_URL", "sqlite:///./_test_interp.db")

from fastapi.testclient import TestClient  # noqa: E402

from main import app  # noqa: E402


class InterpretationRouteTests(unittest.TestCase):
    def test_websocket_route_is_registered(self):
        paths = []
        for inc in app.router.routes:
            if type(inc).__name__ != "_IncludedRouter":
                continue
            ctx = inc.include_context
            for sub in ctx.included_router.routes:
                paths.append(ctx.prefix + getattr(sub, "path", ""))
        self.assertIn("/ws/interpretation/{meeting_id}", paths)

    def test_invalid_meeting_id_is_rejected_before_auth(self):
        with TestClient(app) as client:
            with client.websocket_connect("/ws/interpretation/BAD@ID") as ws:
                msg = ws.receive_json()
        self.assertEqual(msg["type"], "caption.error")
        self.assertEqual(msg["code"], "invalid_meeting_id")

    def test_invalid_jwt_closes_with_auth_error(self):
        with TestClient(app) as client:
            with client.websocket_connect("/ws/interpretation/test") as ws:
                ws.send_json({"op": "auth", "token": "not-a-real-jwt"})
                msg = ws.receive_json()
        self.assertEqual(msg["op"], "auth.error")


if __name__ == "__main__":
    unittest.main()
