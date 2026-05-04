"""Crawler source modules. Each source is a `BaseCrawler` subclass."""
from .base import BaseCrawler
from .claude_code_releases import ClaudeCodeReleasesCrawler
from .plugin_marketplace import PluginMarketplaceCrawler, SkillMarketplaceCrawler
from .curator_repos import CuratorReposCrawler

__all__ = [
    "BaseCrawler",
    "ClaudeCodeReleasesCrawler",
    "PluginMarketplaceCrawler",
    "SkillMarketplaceCrawler",
    "CuratorReposCrawler",
]
