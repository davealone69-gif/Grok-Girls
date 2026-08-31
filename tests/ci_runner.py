#!/usr/bin/env python3
"""CI runner: executes browser test suites and the real GLB GPU gate."""
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
SUITES = ["audit_suite.py", "stress_suite.py"]
TIMEOUT_S = 900
STRESS_CHECKS = {
    "double-click -> gallery items": lambda v: v == 1,
    "mid-flight engine switch: no crash": bool,
    "mid-flight gallery items": lambda v: v == 0,
    "mid-flight button state": lambda v: v == "RENDERING…",
    "slow render lands after switch": lambda v: v == 1,
    "boot with corrupted persona store": bool,
    "seed fallback after corruption": bool,
    "chat survives reload": bool,
    "persona rename survives reload": lambda v: v == "Persist Test",
    "gallery item migrated to assetKey": bool,
    "gallery localStorage has no data URL": bool,
    "gallery localStorage has no prompt text (M3)": bool,
    "persona photo migrated to previewAssetKey": bool,
    "persona localStorage has no data URL": bool,
    "IndexedDB image records": lambda v: isinstance(v, int) and v >= 3,
}


def rows_for(name: str, stdout: str):
    try:
        data = json.loads(stdout)
    except json.JSONDecodeError:
        return None, None
    if isinstance(data, list):
        gating, info = [], []
        for row in data:
            (gating if not bool(row[1]) else info).append((row[0], row[1], row[2]))
        return gating, info
    if isinstance(data, dict):
        gating, info = [], []
        for entries in data.values():
            for e in entries:
                name_e, value = e["name"], e["value"]
                check = STRESS_CHECKS.get(name_e)
                if check is None:
                    info.append((name_e, value, e.get("detail", "")))
                    continue
                try:
                    ok = check(value)
                except Exception:
                    ok = False
                (info if ok else gating).append((name_e, value, e.get("detail", "")))
        return gating, info
    return None, None


def run_suite(name: str) -> bool:
    path = os.path.join(ROOT, name)
    print(f"\n=== {name} ===", flush=True)
    try:
        r = subprocess.run([sys.executable, path], capture_output=True, text=True, cwd=ROOT, timeout=TIMEOUT_S)
    except subprocess.TimeoutExpired:
        print(f"!! {name} timed out after {TIMEOUT_S}s")
        return False
    if r.returncode != 0:
        print(f"!! {name} crashed (exit {r.returncode})")
        print((r.stdout or "")[-2000:])
        print((r.stderr or "")[-2000:])
        return False
    gating, info = rows_for(name, r.stdout)
    if gating is None:
        print(f"!! {name}: stdout is not JSON")
        print((r.stdout or "")[-2000:])
        return False
    print(f"{name}: {len(gating)} failing / {len(gating) + len(info)} checks")
    for n, v, d in gating:
        print(f"  FAIL  {n}  :: value={str(v)[:80]} detail={str(d)[:80]}")
    for n, v, d in info:
        print(f"  ok    {n} = {str(v)[:70]} {str(d)[:30]}")
    return not gating


def main() -> int:
    failed = False
    for suite in SUITES:
        failed |= not run_suite(suite)

    print("\n=== glb_renderer_gate.py ===", flush=True)
    try:
        r = subprocess.run([sys.executable, os.path.join(ROOT, "glb_renderer_gate.py")], capture_output=True, text=True, cwd=ROOT, timeout=TIMEOUT_S)
    except subprocess.TimeoutExpired:
        print("!! glb_renderer_gate.py timed out")
        failed = True
    else:
        if r.returncode != 0:
            print("!! glb_renderer_gate.py FAILED")
            print((r.stdout or "")[-3000:])
            print((r.stderr or "")[-3000:])
            failed = True
        else:
            print("glb_renderer_gate.py: PASS")
            print((r.stdout or "")[-2000:])

    print("\nRESULT:", "FAIL" if failed else "ALL GREEN", flush=True)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
