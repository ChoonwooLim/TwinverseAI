from __future__ import annotations

import importlib
import sys
from dataclasses import replace
from pathlib import Path
from types import SimpleNamespace

import pytest

from app.cuda_paths import CudaLibraryPathError, resolve_nvidia_library_paths
from app.transcriber import FasterWhisperTranscriber

SERVICE_ROOT = Path(__file__).resolve().parents[1]
REPOSITORY_ROOT = SERVICE_ROOT.parents[1]


def test_linux_requirements_and_systemd_launcher_supply_private_cudnn() -> None:
    requirements = (SERVICE_ROOT / "requirements.txt").read_text(encoding="utf-8")
    launcher = (SERVICE_ROOT / "scripts" / "launch.sh").read_text(encoding="utf-8")
    unit = (SERVICE_ROOT / "systemd" / "live-interpretation.service").read_text(
        encoding="utf-8"
    )

    assert "nvidia-cublas-cu12" in requirements
    assert "nvidia-cudnn-cu12" in requirements
    assert "-m app.cuda_paths" in launcher
    assert "import_module" not in launcher and ".__file__" not in launcher
    assert "LD_LIBRARY_PATH" in launcher
    assert "--port 8201" in launcher
    assert "--workers 1" in launcher
    assert "--ws-max-size 65536" in launcher
    assert "--no-access-log" in launcher
    assert "ExecStart=/srv/live-interpretation/scripts/launch.sh" in unit
    assert "Restart=on-failure" in unit


def test_cuda_path_resolver_supports_real_namespace_packages(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    package_root = tmp_path / "site-packages"
    cublas = package_root / "nvidia" / "cublas" / "lib"
    cudnn = package_root / "nvidia" / "cudnn" / "lib"
    cublas.mkdir(parents=True)
    cudnn.mkdir(parents=True)
    assert not any(path.name == "__init__.py" for path in package_root.rglob("*"))

    saved_modules = {
        name: module
        for name, module in sys.modules.items()
        if name == "nvidia" or name.startswith("nvidia.")
    }
    for name in saved_modules:
        sys.modules.pop(name, None)
    monkeypatch.setattr(sys, "path", [str(package_root)])
    importlib.invalidate_caches()
    try:
        assert resolve_nvidia_library_paths() == (cublas.resolve(), cudnn.resolve())
    finally:
        for name in tuple(sys.modules):
            if name == "nvidia" or name.startswith("nvidia."):
                sys.modules.pop(name, None)
        sys.modules.update(saved_modules)
        importlib.invalidate_caches()


def test_cuda_path_resolver_fails_closed_when_package_is_missing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("app.cuda_paths.find_spec", lambda _name: None)
    with pytest.raises(CudaLibraryPathError, match="unavailable"):
        resolve_nvidia_library_paths()


def test_deploy_normalizes_untrusted_staging_metadata_and_preserves_venv() -> None:
    deploy = (SERVICE_ROOT / "scripts" / "deploy.sh").read_text(encoding="utf-8")

    rsync = "sudo rsync -rltp --delete"
    ownership = 'sudo chown -R root:root "$INSTALL_DIR"'
    root_mode = 'sudo chmod 0755 "$INSTALL_DIR"'
    assert rsync in deploy
    assert "--exclude='venv/'" in deploy
    assert "--chown=root:root" in deploy
    assert "--chmod=Du=rwx,Dgo=rx,Fu=rw,Fgo=r" in deploy
    assert ownership in deploy
    assert root_mode in deploy
    assert deploy.index(rsync) < deploy.index(ownership) < deploy.index(root_mode)
    assert "sudo rsync -a --delete" not in deploy


@pytest.mark.parametrize("relative_path", ["scripts/deploy.sh", "scripts/launch.sh"])
def test_service_shell_entrypoints_are_lf_shebangs(relative_path: str) -> None:
    script = SERVICE_ROOT / relative_path
    contents = script.read_bytes()

    assert contents.startswith(b"#!/usr/bin/env bash\n")
    assert b"\r" not in contents
    attributes = (REPOSITORY_ROOT / ".gitattributes").read_text(encoding="utf-8")
    assert "*.sh text eol=lf" in attributes.splitlines()


def test_cpu_fallback_requires_explicit_opt_in(
    settings, monkeypatch: pytest.MonkeyPatch
) -> None:  # type: ignore[no-untyped-def]
    attempts: list[tuple[str, str]] = []

    class FakeWhisperModel:
        def __init__(self, _model: str, *, device: str, compute_type: str) -> None:
            attempts.append((device, compute_type))
            if device == "cuda":
                raise RuntimeError("simulated missing CUDA runtime")

        def transcribe(self, *_args, **_kwargs):  # type: ignore[no-untyped-def]
            return iter(()), SimpleNamespace(language="en")

    monkeypatch.setitem(
        sys.modules, "faster_whisper", SimpleNamespace(WhisperModel=FakeWhisperModel)
    )

    disabled = FasterWhisperTranscriber(settings)
    with pytest.raises(RuntimeError):
        disabled._load_model()
    assert attempts == [("cuda", "float16")]

    attempts.clear()
    enabled = FasterWhisperTranscriber(
        replace(settings, whisper_allow_cpu_fallback=True)
    )
    enabled._load_model()
    assert attempts == [("cuda", "float16"), ("cpu", "int8")]
