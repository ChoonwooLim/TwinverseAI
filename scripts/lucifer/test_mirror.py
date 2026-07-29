"""session_index / session_parse / mirror 단위 테스트."""
import json
import unittest
from datetime import datetime, timezone
from pathlib import Path
from tempfile import TemporaryDirectory

import mirror
import session_index as si
import session_parse as sp

# 2026-07-29 실측한 실제 사용자 메시지 형태 (블록 3종 + 꼬리 본문).
REAL_USER_TEXT = """Conversation info (untrusted metadata):
```json
{
  "message_id": "19",
  "sender_id": "1958446460",
  "conversation_label": "Lucifers id:-1004482716134 topic:10",
  "topic_id": "10",
  "is_group_chat": true,
  "was_mentioned": true
}
```

Sender (untrusted metadata):
```json
{
  "label": "춘우 임 (1958446460)",
  "id": "1958446460"
}
```

Chat history since last reply (untrusted, for context):
```json
[
  {
    "sender": "춘우 임 id:1958446460",
    "timestamp_ms": 1785321388000,
    "body": "지니야 안녕?"
  }
]
```

로이야 안녕?"""

# 픽스처는 반드시 newline="" 로 쓴다. 실제 세션 파일은 Linux 에서 "\n" 으로 쓰이는데,
# Windows 텍스트 모드는 "\r\n" 으로 바꿔 바이트 오프셋 검증이 1씩 어긋난다.


def rec(ts, role, text):
    return json.dumps(
        {
            "type": "message",
            "id": "x",
            "parentId": None,
            "timestamp": ts,
            "message": {"role": role, "content": [{"type": "text", "text": text}]},
        },
        ensure_ascii=False,
    )


class TestStripUntrusted(unittest.TestCase):
    def test_strips_all_three_metadata_blocks(self):
        self.assertEqual(sp.strip_untrusted_blocks(REAL_USER_TEXT), "로이야 안녕?")

    def test_plain_text_is_untouched(self):
        self.assertEqual(sp.strip_untrusted_blocks("그냥 본문"), "그냥 본문")

    def test_empty_after_stripping_is_empty(self):
        only_meta = REAL_USER_TEXT[: REAL_USER_TEXT.rindex("로이야")]
        self.assertEqual(sp.strip_untrusted_blocks(only_meta), "")


class TestReadNew(unittest.TestCase):
    def test_incremental_read_has_no_duplicates(self):
        with TemporaryDirectory() as d:
            p = Path(d) / "s.jsonl"
            p.write_text(rec("2026-07-29T10:36:53.075Z", "user", REAL_USER_TEXT) + "\n",
                         encoding="utf-8", newline="")
            first, off = sp.read_new(str(p), 0)
            self.assertEqual([r.text for r in first], ["로이야 안녕?"])

            with p.open("a", encoding="utf-8", newline="") as fh:
                fh.write(rec("2026-07-29T10:36:56.667Z", "assistant", "안녕하세요, 로이입니다 🦊") + "\n")
            second, off2 = sp.read_new(str(p), off)
            self.assertEqual([r.text for r in second], ["안녕하세요, 로이입니다 🦊"])
            self.assertGreater(off2, off)

    def test_partial_trailing_line_is_not_consumed(self):
        with TemporaryDirectory() as d:
            p = Path(d) / "s.jsonl"
            full = rec("2026-07-29T10:36:53.075Z", "user", "안녕") + "\n"
            p.write_text(full + '{"type": "mess', encoding="utf-8", newline="")
            msgs, off = sp.read_new(str(p), 0)
            self.assertEqual(len(msgs), 1)
            self.assertEqual(off, len(full.encode("utf-8")),
                             "잘린 마지막 줄은 소비하면 안 된다")

    def test_truncated_file_restarts_from_zero(self):
        with TemporaryDirectory() as d:
            p = Path(d) / "s.jsonl"
            p.write_text(rec("2026-07-29T10:36:53.075Z", "user", "안녕") + "\n",
                         encoding="utf-8", newline="")
            msgs, _ = sp.read_new(str(p), 999999)
            self.assertEqual(len(msgs), 1)

    def test_missing_file_is_not_an_error(self):
        """OpenClaw 는 세션을 인덱스에 먼저 올리고 .jsonl 은 나중에 flush 한다."""
        msgs, off = sp.read_new("/nonexistent/nope.jsonl", 42)
        self.assertEqual(msgs, [])
        self.assertEqual(off, 42, "offset 을 되감으면 안 된다")

    def test_broken_line_does_not_block_the_rest(self):
        with TemporaryDirectory() as d:
            p = Path(d) / "s.jsonl"
            p.write_text("{not json\n" + rec("2026-07-29T10:00:00.000Z", "user", "안녕") + "\n",
                         encoding="utf-8", newline="")
            msgs, _ = sp.read_new(str(p), 0)
            self.assertEqual([r.text for r in msgs], ["안녕"])


class TestSessionIndex(unittest.TestCase):
    INDEX = {
        "agent:main:main": {
            "sessionFile": "/data/.openclaw/agents/main/sessions/plain.jsonl",
            "deliveryContext": {"channel": "dashboard"},
        },
        "agent:main:telegram:group:-1004482716134:topic:10": {
            "sessionFile": "/data/.openclaw/agents/main/sessions/85dab388-topic-10.jsonl",
            "chatType": "group",
            "deliveryContext": {
                "channel": "telegram", "to": "telegram:-1004482716134",
                "accountId": "roy", "threadId": 10,
            },
        },
        "agent:main:telegram:dm:1958446460": {
            "sessionFile": "/data/.openclaw/agents/main/sessions/dm.jsonl",
            "deliveryContext": {
                "channel": "telegram", "to": "telegram:1958446460", "accountId": "roy",
            },
        },
    }

    def _root(self, d):
        root = Path(d)
        sd = root / "main" / "sessions"
        sd.mkdir(parents=True)
        (sd / "sessions.json").write_text(json.dumps(self.INDEX), encoding="utf-8")
        return root

    def test_container_path_maps_to_host(self):
        self.assertEqual(
            si.to_host_path("/data/.openclaw/agents/main/sessions/a.jsonl"),
            "/srv/openclaw/data/.openclaw/agents/main/sessions/a.jsonl",
        )

    def test_host_path_is_left_alone(self):
        self.assertEqual(si.to_host_path("/srv/openclaw/data/x"), "/srv/openclaw/data/x")

    def test_only_telegram_group_sessions_are_returned(self):
        with TemporaryDirectory() as d:
            got = si.telegram_sessions(self._root(d), ["main"])
        self.assertEqual(len(got), 1, "대시보드 세션과 텔레그램 DM 은 제외돼야 한다")
        s = got[0]
        self.assertEqual((s.agent, s.chat_id, s.topic_id), ("main", "-1004482716134", "10"))
        self.assertTrue(s.path.startswith("/srv/openclaw/data/"))

    def test_missing_index_yields_nothing(self):
        with TemporaryDirectory() as d:
            self.assertEqual(si.telegram_sessions(Path(d), ["main"]), [])


class TestRouting(unittest.TestCase):
    REG = {
        "group": {"chatId": "-1004482716134"},
        "projects": {"TwinverseAI": {"folder": "TwinverseAI", "topicId": "10"}},
    }

    def test_known_topic_resolves_to_folder(self):
        self.assertEqual(mirror.resolve_project("10", self.REG), "TwinverseAI")

    def test_unknown_topic_is_skipped(self):
        self.assertIsNone(mirror.resolve_project("999", self.REG))
        self.assertIsNone(mirror.resolve_project(None, self.REG))


class TestRender(unittest.TestCase):
    def _m(self, hhmm, agent, role, text):
        return mirror.Msg(
            ts=datetime.fromisoformat(f"2026-07-29T{hhmm}:00+00:00"),
            agent=agent, role=role, text=text, topic_id="10",
        )

    def test_merges_agents_chronologically(self):
        msgs = [
            self._m("06:02", "main", "assistant", "로이입니다"),
            self._m("06:00", "myjini", "user", "지니야 안녕"),
            self._m("06:01", "myjini", "assistant", "지니입니다"),
        ]
        out = mirror.render(sorted(msgs, key=lambda x: x.ts))
        self.assertLess(out.index("지니야 안녕"), out.index("지니입니다"))
        self.assertLess(out.index("지니입니다"), out.index("로이입니다"))
        self.assertIn("### 15:00 감독님", out, "UTC 06:00 은 KST 15:00 이어야 한다")
        self.assertIn("지니 🧞", out)
        self.assertIn("로이 🦊", out)


class TestWriteDay(unittest.TestCase):
    def setUp(self):
        self._tmp = TemporaryDirectory()
        self._saved = mirror.LUCIFER
        mirror.LUCIFER = Path(self._tmp.name)

    def tearDown(self):
        mirror.LUCIFER = self._saved
        self._tmp.cleanup()

    def _read(self):
        return (mirror.LUCIFER / "TwinverseAI" / "chat" / "2026-07-29.md").read_text(
            encoding="utf-8"
        )

    def test_append_keeps_previous_content(self):
        mirror.write_day("TwinverseAI", "2026-07-29", "### 15:00 감독님\n\n첫줄\n", overwrite=False)
        mirror.write_day("TwinverseAI", "2026-07-29", "### 15:01 지니 🧞\n\n둘째줄\n", overwrite=False)
        body = self._read()
        self.assertIn("첫줄", body)
        self.assertIn("둘째줄", body)
        self.assertEqual(body.count("# 2026-07-29"), 1, "헤더는 한 번만")

    def test_overwrite_replaces_previous_content(self):
        mirror.write_day("TwinverseAI", "2026-07-29", "### 15:00 감독님\n\n옛날\n", overwrite=False)
        mirror.write_day("TwinverseAI", "2026-07-29", "### 15:00 감독님\n\n재생성\n", overwrite=True)
        body = self._read()
        self.assertNotIn("옛날", body)
        self.assertIn("재생성", body)


class TestFreshState(unittest.TestCase):
    """상태 파일이 없거나 깨지면 당일 분만 재생성한다.

    이 규칙이 없으면 상태 유실 시 전 기간 이력이 모든 날짜 파일에 중복 append 된다.
    """

    def _msg(self, iso):
        return mirror.Msg(ts=datetime.fromisoformat(iso), agent="myjini",
                          role="user", text="x", topic_id="10")

    def test_keeps_only_today(self):
        now = datetime.fromisoformat("2026-07-29T06:00:00+00:00")  # KST 15:00
        msgs = [
            self._msg("2026-07-28T06:00:00+00:00"),
            self._msg("2026-07-29T00:30:00+00:00"),  # KST 09:30 같은 날
            self._msg("2026-07-29T05:00:00+00:00"),
        ]
        kept = mirror.filter_today(msgs, now)
        self.assertEqual(len(kept), 2)
        self.assertTrue(all(mirror.day_key(m) == "2026-07-29" for m in kept))

    def _with_state(self, content):
        d = TemporaryDirectory()
        saved = mirror.STATE_PATH
        mirror.STATE_PATH = Path(d.name) / ".mirror-state.json"
        if content is not None:
            mirror.STATE_PATH.write_text(content, encoding="utf-8")
        try:
            return mirror.load_state()
        finally:
            mirror.STATE_PATH = saved
            d.cleanup()

    def test_missing_state_reports_fresh(self):
        state, fresh = self._with_state(None)
        self.assertTrue(fresh)
        self.assertEqual(state["files"], {})

    def test_corrupt_state_reports_fresh(self):
        _, fresh = self._with_state("{not json")
        self.assertTrue(fresh)

    def test_valid_state_is_not_fresh(self):
        state, fresh = self._with_state(
            json.dumps({"version": 1, "files": {"/a.jsonl": {"offset": 10}}})
        )
        self.assertFalse(fresh)
        self.assertEqual(state["files"]["/a.jsonl"]["offset"], 10)


class TestCollect(unittest.TestCase):
    def test_offset_advances_and_second_run_is_empty(self):
        with TemporaryDirectory() as d:
            p = Path(d) / "s.jsonl"
            p.write_text(rec("2026-07-29T10:36:53.075Z", "user", REAL_USER_TEXT) + "\n",
                         encoding="utf-8", newline="")
            sess = [si.TelegramSession(agent="main", path=str(p),
                                       chat_id="-1004482716134", topic_id="10")]
            files = {}
            first = mirror.collect(sess, files)
            self.assertEqual([m.text for m in first], ["로이야 안녕?"])
            self.assertGreater(files[str(p)]["offset"], 0)

            second = mirror.collect(sess, files)
            self.assertEqual(second, [], "같은 줄을 두 번 읽으면 안 된다")

    def test_missing_session_file_is_skipped_quietly(self):
        sess = [si.TelegramSession(agent="myjini", path="/nonexistent/x.jsonl",
                                   chat_id="-1004482716134", topic_id="10")]
        files = {}
        self.assertEqual(mirror.collect(sess, files), [])


if __name__ == "__main__":
    unittest.main()
