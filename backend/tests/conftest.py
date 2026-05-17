"""Pytest 셋업 — backend/ 를 sys.path 에 추가해 import 가 작동하게."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
