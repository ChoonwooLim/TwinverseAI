"""news_crawler package — Claude Code news automation.

Layout:
- types.py     : RawItem (crawler output) + NewsAnalysis (LLM output) dataclasses
- llm.py       : analyze_item() — Ollama 1차 + OpenClaw gpt-5.5 폴백
- (future) sources/, persistence.py, runner.py
"""
