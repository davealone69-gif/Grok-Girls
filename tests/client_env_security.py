"""Build-time regression gate: client API keys must never enter shipped assets.

The key values below are fake sentinels, not credentials. A public model setting
is checked at the same time to ensure the safe VITE allowlist still works.
"""
from __future__ import annotations

import os
from pathlib import Path
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
API_KEY_SENTINELS = {
    "VITE_OPENROUTER_API_KEY": "FAKE_SENTINEL_OPENROUTER_61D7B90E",
    "VITE_GEMINI_API_KEY": "FAKE_SENTINEL_GEMINI_2F488A13",
    "VITE_CUSTOM_API_KEY": "FAKE_SENTINEL_CUSTOM_904BC6D2",
}
PUBLIC_MODEL_SENTINEL = "safe-public-model-sentinel-2026"


def main() -> int:
    build_env = os.environ.copy()
    build_env.update(API_KEY_SENTINELS)
    build_env["VITE_OPENROUTER_IMAGE_MODEL"] = PUBLIC_MODEL_SENTINEL
    with tempfile.TemporaryDirectory(prefix="grok-girls-client-security-") as temp_dir:
        dist = Path(temp_dir) / "dist"
        result = subprocess.run(
            ["npm", "run", "build", "--", "--outDir", str(dist)],
            cwd=ROOT,
            env=build_env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            check=False,
        )
        if result.returncode != 0:
            print(f"FAIL: npm run build exited {result.returncode}")
            print(result.stdout[-4000:])
            return result.returncode or 1

        assets = [p for p in dist.rglob("*") if p.is_file()]
        bundled = b"".join(p.read_bytes() for p in assets)
        leaked = [name for name, sentinel in API_KEY_SENTINELS.items() if sentinel.encode() in bundled]
        if leaked:
            print("FAIL: client API-key environment variables were embedded in dist: " + ", ".join(leaked))
            return 1
        if PUBLIC_MODEL_SENTINEL.encode() not in bundled:
            print("FAIL: safe public model configuration was not retained in the client bundle")
            return 1

    print("PASS: fake API-key sentinels are absent from built assets; safe public model configuration remains available")
    return 0


if __name__ == "__main__":
    sys.exit(main())
