"""Fail-fast systemd preflight that never prints configuration values."""

from .config import Settings


def main() -> None:
    Settings.from_env().validate()
    print("live-interpretation configuration valid")


if __name__ == "__main__":
    main()
