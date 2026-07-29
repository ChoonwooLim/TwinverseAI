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
            self.assertEqual(got_dst, data / "_ai" / "기획" / "deck.pdf")

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
    def test_converts_txt_to_pdf(self):
        with tempfile.TemporaryDirectory() as d:
            src = Path(d) / "hello.txt"
            src.write_text("Lucifer\n", encoding="utf-8")
            out_dir = Path(d) / "_ai"
            result = converters.convert_document(src, out_dir)
            self.assertTrue(result.exists())
            self.assertGreater(result.stat().st_size, 0)
            self.assertEqual(result.suffix, ".pdf")


if __name__ == "__main__":
    unittest.main()
