#!/usr/bin/env python3
"""Regression tests for the local 3D worker contract; no model weights required."""
from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import threading
import urllib.error
import urllib.request
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
SERVER_PATH = ROOT / "tools" / "triposr-worker" / "server.py"
SPEC = importlib.util.spec_from_file_location("grokgirls_triposr_worker", SERVER_PATH)
assert SPEC and SPEC.loader
worker = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = worker
SPEC.loader.exec_module(worker)


def fetch_health(url: str) -> tuple[int, dict]:
    try:
        response = urllib.request.urlopen(url, timeout=3)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        return response.status, json.loads(response.read().decode("utf-8"))


def test_worker_ports_are_isolated() -> None:
    hunyuan = (ROOT / "android/app/src/main/java/ai/grokgirls/studio/Hunyuan3DLocalPlugin.kt").read_text()
    plugin = (ROOT / "android/app/src/main/java/ai/grokgirls/studio/TripoSRLocalPlugin.java").read_text()
    server = SERVER_PATH.read_text()
    start = (ROOT / "tools/triposr-worker/start-triposr.sh").read_text()
    assert 'DEFAULT_BASE = "http://127.0.0.1:8081"' in hunyuan
    assert 'BASE = "http://127.0.0.1:8082"' in plugin
    assert 'TRIPOSR_PORT", "8082"' in server
    assert 'TRIPOSR_PORT:-8082' in start
    assert '"triposr".equalsIgnoreCase' in plugin


def test_health_does_not_claim_generation_was_verified() -> None:
    with tempfile.TemporaryDirectory(prefix="gg-3d-contract-") as tmp:
        home = Path(tmp)
        run_py = home / "run.py"
        with patch.object(worker, "TRIPOSR_HOME", home), patch.object(worker, "RUN_PY", run_py):
            httpd = worker.ThreadingHTTPServer(("127.0.0.1", 0), worker.Handler)
            thread = threading.Thread(target=httpd.serve_forever, daemon=True)
            thread.start()
            url = f"http://127.0.0.1:{httpd.server_address[1]}/health"
            try:
                status, payload = fetch_health(url)
                assert status == 503, (status, payload)
                assert payload["engine"] == "triposr" and payload["ok"] is False, payload
                run_py.write_text("# test fixture only; not executed\n")
                status, payload = fetch_health(url)
                assert status == 200 and payload["ok"] is True, (status, payload)
                assert payload["state"] == "configured", payload
                assert payload["generation_verified"] is False, payload
                assert "not yet verified" in payload["message"], payload
            finally:
                httpd.shutdown()
                httpd.server_close()
                thread.join(timeout=3)


def test_generated_glb_reaches_native_viewport() -> None:
    plugin = (ROOT / "android/app/src/main/java/ai/grokgirls/studio/TripoSRLocalPlugin.java").read_text()
    bridge = (ROOT / "android/app/src/main/java/ai/grokgirls/studio/AvatarStudioPlugin.kt").read_text()
    app = (ROOT / "src/App.tsx").read_text()
    assert 'r.put("file", outputFile.getAbsolutePath())' in plugin
    assert ".putExtra(NativeAvatarActivity.EXTRA_FILE, file)" in bridge
    assert "await generateTripoSR(image.dataUrl" in app
    assert "openNativeHdAvatar(avatarVm.get() ?? toAvatarDefinition(draft), glb.file)" in app
    manager = (ROOT / "src/components/ServerManagerModal.tsx").read_text()
    activity = (ROOT / "android/app/src/main/java/ai/grokgirls/studio/MainActivity.java").read_text()
    assert 'className="server-manager-launcher"' in app
    assert "127.0.0.1:8082" in manager and "▶ START 3D WORKER" in manager
    assert "registerPlugin(ComfyUiLocalPlugin.class);" in activity


if __name__ == "__main__":
    test_worker_ports_are_isolated()
    test_health_does_not_claim_generation_was_verified()
    test_generated_glb_reaches_native_viewport()
    print("PASS: 3D worker ports are isolated; health is configuration-only, not inference proof.")
