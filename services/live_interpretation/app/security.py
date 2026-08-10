"""Authentication helpers. Token values are never included in errors or logs."""

from __future__ import annotations

import hmac
import string

_DIGEST_KEY = b"twinverse-live-interpretation-auth-v1"
_TOKEN_CHARACTERS = frozenset(string.ascii_letters + string.digits + "-._~")


def service_token_is_well_formed(token: str) -> bool:
    return 32 <= len(token) <= 512 and all(
        character in _TOKEN_CHARACTERS for character in token
    )


def bearer_token_is_valid(authorization: str | None, expected_token: str) -> bool:
    """Validate a Bearer token using a fixed-length timing-safe comparison."""

    candidate = ""
    if authorization:
        scheme, separator, value = authorization.partition(" ")
        if separator and scheme.casefold() == "bearer" and value and " " not in value:
            candidate = value

    candidate_digest = hmac.digest(_DIGEST_KEY, candidate.encode("utf-8"), "sha256")
    expected_digest = hmac.digest(_DIGEST_KEY, expected_token.encode("utf-8"), "sha256")
    matched = hmac.compare_digest(candidate_digest, expected_digest)
    expected_is_configured = service_token_is_well_formed(expected_token)
    return expected_is_configured and matched
