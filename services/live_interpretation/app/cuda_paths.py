"""Resolve CUDA wheel library directories, including PEP 420 namespaces."""

from __future__ import annotations

from importlib.util import find_spec
from pathlib import Path

_CUDA_LIBRARY_PACKAGES = ("nvidia.cublas.lib", "nvidia.cudnn.lib")


class CudaLibraryPathError(RuntimeError):
    """A CUDA runtime package did not resolve to one unambiguous directory."""


def resolve_package_directory(package_name: str) -> Path:
    """Return one existing package directory without relying on ``__file__``."""

    try:
        spec = find_spec(package_name)
    except (AttributeError, ImportError, ValueError) as exc:
        raise CudaLibraryPathError("CUDA package discovery failed") from exc
    if spec is None:
        raise CudaLibraryPathError("CUDA package is unavailable")

    locations = spec.submodule_search_locations
    if locations is not None:
        candidates = {Path(location).resolve() for location in locations if location}
    elif spec.origin and spec.origin not in {"built-in", "frozen"}:
        candidates = {Path(spec.origin).resolve().parent}
    else:
        candidates = set()

    existing = sorted(path for path in candidates if path.is_dir())
    if len(existing) != 1:
        raise CudaLibraryPathError(
            "CUDA package must resolve to exactly one library directory"
        )
    return existing[0]


def resolve_nvidia_library_paths() -> tuple[Path, ...]:
    paths = tuple(resolve_package_directory(name) for name in _CUDA_LIBRARY_PACKAGES)
    if len(set(paths)) != len(paths):
        raise CudaLibraryPathError("CUDA library directories must be distinct")
    return paths


def main() -> None:
    try:
        paths = resolve_nvidia_library_paths()
    except Exception as exc:
        raise SystemExit(
            f"NVIDIA runtime library path resolution failed ({type(exc).__name__})"
        ) from None
    print(":".join(str(path) for path in paths))


if __name__ == "__main__":
    main()
