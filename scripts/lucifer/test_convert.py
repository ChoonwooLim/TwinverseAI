"""Lucifer 변환 파이프라인 테스트. pytest 없이 표준 unittest 로 돌린다."""
import tempfile
import unittest
from pathlib import Path

import convert
import converters


class TestNeedsConversion(unittest.TestCase):
    def test_missing_target_needs_conversion(self):
        with tempfile.TemporaryDirectory() as d:
            src = Path(d) / "a.pptx"
            src.write_bytes(b"x")
            dst = Path(d) / "_ai" / "a.pdf"
            self.assertTrue(convert.needs_conversion(src, dst))

    def test_fresh_target_skipped(self):
        with tempfile.TemporaryDirectory() as d:
            src = Path(d) / "a.pptx"
            src.write_bytes(b"x")
            dst = Path(d) / "a.pdf"
            dst.write_bytes(b"y")  # src 보다 나중에 생성 -> 최신
            self.assertFalse(convert.needs_conversion(src, dst))


class TestPlanTargets(unittest.TestCase):
    def test_maps_pptx_to_pdf_under_ai(self):
        with tempfile.TemporaryDirectory() as d:
            data = Path(d)
            (data / "기획").mkdir()
            src = data / "기획" / "deck.pptx"
            src.write_bytes(b"x")
            pairs = convert.plan_targets(data)
            self.assertEqual(len(pairs), 1)
            got_src, got_dst = pairs[0]
            self.assertEqual(got_src, src)
            # 원본 확장자를 이름에 남긴다 (deck.pdf 가 아니라 deck.pptx.pdf)
            self.assertEqual(got_dst, data / "_ai" / "기획" / "deck.pptx.pdf")

    def test_same_stem_different_suffix_do_not_collide(self):
        # report.docx 와 report.pptx 가 같은 목적지로 가면 두 번째가
        # "이미 최신" 으로 조용히 건너뛰어진다. 목적지가 달라야 한다.
        with tempfile.TemporaryDirectory() as d:
            data = Path(d)
            (data / "report.docx").write_bytes(b"x")
            (data / "report.pptx").write_bytes(b"x")
            targets = {dst for _, dst in convert.plan_targets(data)}
            self.assertEqual(len(targets), 2)

    def test_ignores_files_already_under_ai(self):
        # _ai/ 안의 pptx 를 쓴다. pdf 로 하면 "변환 대상 아님" 때문에
        # 걸러져서 _ai 제외 로직을 실제로 검증하지 못한다.
        with tempfile.TemporaryDirectory() as d:
            data = Path(d)
            (data / "_ai").mkdir()
            (data / "_ai" / "stale.pptx").write_bytes(b"x")
            self.assertEqual(convert.plan_targets(data), [])

    def test_pdf_needs_no_conversion(self):
        with tempfile.TemporaryDirectory() as d:
            data = Path(d)
            (data / "already.pdf").write_bytes(b"x")
            self.assertEqual(convert.plan_targets(data), [])


class TestConvertDocument(unittest.TestCase):
    def test_converts_txt_to_requested_path(self):
        # soffice 는 <stem>.pdf 로 만들지만, 우리가 요청한 이름으로 와야 한다.
        with tempfile.TemporaryDirectory() as d:
            src = Path(d) / "hello.txt"
            src.write_text("Lucifer\n", encoding="utf-8")
            dst = Path(d) / "_ai" / "hello.txt.pdf"
            result = converters.convert_document(src, dst)
            self.assertEqual(result, dst)
            self.assertTrue(dst.exists())
            self.assertGreater(dst.stat().st_size, 0)
            # 원본은 그대로 남아야 한다
            self.assertTrue(src.exists())


class TestVideoTargets(unittest.TestCase):
    def test_maps_mp4_to_markdown_under_ai(self):
        with tempfile.TemporaryDirectory() as d:
            data = Path(d)
            src = data / "demo.mp4"
            src.write_bytes(b"x")
            pairs = convert.plan_targets(data)
            self.assertEqual(len(pairs), 1)
            self.assertEqual(pairs[0][1], data / "_ai" / "demo.mp4.md")

    def test_frame_cap_is_twenty(self):
        self.assertEqual(converters.MAX_FRAMES, 20)


class TestVideoFrameHygiene(unittest.TestCase):
    """ffmpeg 가 필요하므로 서버에서만 통과한다."""

    def test_stale_frames_from_previous_run_are_cleared(self):
        import subprocess

        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            src = root / "clip.mp4"
            # 단일 연속 testsrc 는 프레임 간 변화가 너무 미세해 scene 점수가
            # 0.3 문턱을 절대 넘지 않는다 (실측 최댓값 ~0.02) -> ffmpeg 가 프레임을
            # 하나도 못 뽑아 convert_video 가 위생 검사 이전에 RuntimeError 로
            # 죽는다. Step 6 스모크 테스트와 같은 방식으로 뚜렷한 장면 전환을
            # 하나 만들어 실제로 프레임이 뽑히도록 한다.
            subprocess.run(
                ["ffmpeg", "-nostdin", "-y",
                 "-f", "lavfi", "-i", "testsrc=duration=1:size=160x120:rate=5",
                 "-f", "lavfi", "-i", "color=c=blue:duration=1:size=160x120:rate=5",
                 "-filter_complex", "[0:v][1:v]concat=n=2:v=1", str(src)],
                capture_output=True, timeout=120,
            )
            self.assertTrue(src.exists(), "테스트 영상 생성 실패")

            dst = root / "_ai" / "clip.mp4.md"
            frames_dir = dst.parent / "clip.mp4.frames"
            frames_dir.mkdir(parents=True)
            # 지난 실행이 남긴 것처럼 높은 번호의 프레임을 심어둔다.
            stale = frames_dir / "frame_099.jpg"
            stale.write_bytes(b"stale")

            # Ollama 호출은 느리고 네트워크에 의존하므로 대체한다.
            original = converters._describe_image
            converters._describe_image = lambda p: "테스트 설명"
            try:
                converters.convert_video(src, dst)
            finally:
                converters._describe_image = original

            self.assertFalse(
                stale.exists(),
                "이전 실행의 프레임이 남아 새 문서에 섞인다",
            )
            self.assertNotIn("frame_099", dst.read_text(encoding="utf-8"))


class TestFailureIsolation(unittest.TestCase):
    def test_convert_one_rejects_unknown_suffix(self):
        with tempfile.TemporaryDirectory() as d:
            src = Path(d) / "mystery.xyz"
            src.write_bytes(b"x")
            with self.assertRaises(RuntimeError):
                convert.convert_one(src, Path(d) / "_ai" / "mystery.xyz.pdf")

    def test_one_failing_file_does_not_stop_the_others(self):
        """한 파일이 터져도 나머지는 계속 변환돼야 한다."""
        original = converters.convert_document
        attempted = []

        def flaky(src: Path, dst: Path) -> Path:
            attempted.append(src.name)
            if src.name == "bad.txt":
                raise RuntimeError("의도된 실패")
            return original(src, dst)

        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            data = root / "Proj" / "data"
            data.mkdir(parents=True)
            (root / "_common").mkdir()
            for name in ("aaa.txt", "bad.txt", "zzz.txt"):
                (data / name).write_text("x\n", encoding="utf-8")

            converters.convert_document = flaky
            original_error_log = convert.ERROR_LOG
            convert.ERROR_LOG = root / "_common" / "_convert-errors.log"
            try:
                converted = convert.run_once(root)
            finally:
                converters.convert_document = original
                convert.ERROR_LOG = original_error_log

        # bad.txt 가 터졌지만 앞뒤 파일은 모두 시도·성공했어야 한다
        self.assertEqual(attempted, ["aaa.txt", "bad.txt", "zzz.txt"])
        self.assertEqual(converted, 2)

    def test_missing_root_returns_zero_without_raising(self):
        self.assertEqual(convert.run_once(Path("/nonexistent-lucifer-xyz")), 0)


if __name__ == "__main__":
    unittest.main()
