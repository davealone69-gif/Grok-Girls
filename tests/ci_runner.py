#!/usr/bin/env python3
"""CI runner: executes the browser test suites and fails on any failing check.

- audit_suite.py prints a JSON array of [name, pass, detail] rows.
- stress_suite.py prints a JSON object of sections -> [rows] where each row is
  {name, value, detail}. Only checks listed in STRESS_CHECKS are gating;
  other rows (load times, axe tallies, …) are reported as informational.

Exit code: 0 = every gating check passed, 1 = any failure or crash.
"""
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
SUITES = ["audit_suite.py", "stress_suite.py"]
TIMEOUT_S = 900

# Gating criteria for stress-suite rows. Rows not listed here are
# informational metrics (timings, sizes, a11y tallies) and never fail CI.
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
    "persona photo migrated to previewAssetKey": bool,
    "persona localStorage has no data URL": bool,
    "IndexedDB image records": lambda v: isinstance(v, int) and v >= 3,
}


def rows_for(name: str, stdout: str):
    """Return (gating_rows, info_rows) for a suite's stdout."""
    try:
        data = json.loads(stdout)
    except json.JSONDecodeError:
        return None, None
    if isinstance(data, list):
        gating, info = [], []
        for row in data:
            ok = bool(row[1])
            (gating if not ok else info).append((row[0], row[1], row[2]))
        return gating, info
    if isinstance(data, dict):
        gating, info = [], []
        for section, entries in data.items():
            for e in entries:
                name_e, value = e["name"], e["value"]
                check = STRESS_CHECKS.get(name_e)
                if check is None:
                    info.append((name_e, value, e.get("detail", "")))
                else:
                    try:
                        ok = check(value)
                    except Exception:
                        ok = False
                    detail = e.get("detail", "")
                    (info if ok else gating).append((name_e, value, detail))
        return gating, info
    return None, None


def main() -> int:
    failed = False
    for name in SUITES:
        path = os.path.join(ROOT, name)
        print(f"\n=== {name} ===", flush=True)
        try:
            r = subprocess.run(
                [sys.executable, path],
                capture_output=True,
                text=True,
                cwd=ROOT,
                timeout=TIMEOUT_S,
            )
        except subprocess.TimeoutExpired:
            print(f"!! {name} timed out after {TIMEOUT_S}s")
            failed = True
            continue
        if r.returncode != 0:
            print(f"!! {name} crashed (exit {r.returncode})")
            print((r.stdout or "")[-2000:])
            print((r.stderr or "")[-2000:])
            failed = True
            continue
        gating, info = rows_for(name, r.stdout)
        if gating is None:
            print(f"!! {name}: stdout is not JSON")
            print((r.stdout or "")[-2000:])
            failed = True
            continue
        print(f"{name}: {len(gating)} failing / {len(gating) + len(info)} checks")
        for n, v, d in gating:
            print(f"  FAIL  {n}  ::  value={str(v)[:80]} detail={str(d)[:80]}")
        for n, v, d in info:
            print(f"  ok    {n}  =  {str(v)[:70]} {str(d)[:30]}")
        if gating:
            failed = True
    print("\nRESULT:", "FAIL" if failed else "ALL GREEN", flush=True)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
