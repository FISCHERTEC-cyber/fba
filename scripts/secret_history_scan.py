"""Fail-closed history scan of reachable Git blobs; never prints candidate values.

GitHub Actions checkout must fetch complete repository refs (fetch-depth: 0).
Unfetched or unreachable history cannot be scanned.
"""
from __future__ import annotations
import os
import subprocess
import sys

from secret_pattern_scan import PATTERNS

# Historical test source fixture, confirmed against its immutable Git blob ID.
# The exact blob contains a synthetic header, not a real private key payload.
KNOWN_FIXTURE_BLOBS = {}


def git(*args: str, input_data: bytes | None = None) -> bytes:
    return subprocess.run(
        ["git", *args], input=input_data, stdout=subprocess.PIPE,
        stderr=subprocess.PIPE, check=True,
    ).stdout


def scan_history() -> bool:
    if os.environ.get("FWA_REQUIRE_COMPLETE_HISTORY") == "1":
        if git("rev-parse", "--is-shallow-repository").strip() != b"false":
            raise RuntimeError("incomplete shallow repository history")
        if not git("for-each-ref", "--format=%(refname)", "refs/remotes/origin").strip():
            raise RuntimeError("no fetched remote branch refs")
    refs = git("show-ref")
    if not refs.strip():
        raise RuntimeError("no Git refs available")
    objects = git("rev-list", "--objects", "--all")
    ids = list(dict.fromkeys(line.split(b" ", 1)[0] for line in objects.splitlines() if line))
    if not ids:
        raise RuntimeError("no reachable Git objects to scan")
    descriptions = git("cat-file", "--batch-check=%(objectname) %(objecttype) %(objectsize)", input_data=b"\n".join(ids) + b"\n")
    findings = 0
    known_fixtures = 0
    blobs = 0
    for line in descriptions.splitlines():
        parts = line.split(b" ")
        if len(parts) != 3 or len(parts[0]) != 40 or not parts[2].isdigit():
            raise RuntimeError("unexpected git object metadata")
        oid, kind, size_raw = parts
        if kind != b"blob":
            continue
        size = int(size_raw)
        if size > 64 * 1024 * 1024:
            raise RuntimeError("oversized history blob needs explicit manual review: " + oid.decode("ascii"))
        blob = git("cat-file", "blob", oid.decode("ascii"))
        if len(blob) != size:
            raise RuntimeError("git blob size mismatch")
        blobs += 1
        for name, pattern in PATTERNS:
            if pattern.search(blob):
                # Only the audited, content-addressed synthetic test blob is exempted.
                if name in KNOWN_FIXTURE_BLOBS.get(oid.decode("ascii"), set()):
                    known_fixtures += 1
                    continue
                # Output only immutable object reference and finding category, never contents.
                print(f"Potential {name} in history blob {oid.decode('ascii')}", file=sys.stderr)
                findings += 1
    print(f"Checked {blobs} reachable history blobs; synthetic fixture exceptions: {known_fixtures}; candidate classes: {len(PATTERNS)}")
    return bool(findings)


if __name__ == "__main__":
    try:
        found = scan_history()
    except (OSError, subprocess.CalledProcessError, ValueError, RuntimeError) as exc:
        print(f"History scan failed (closed): {exc.__class__.__name__}", file=sys.stderr)
        sys.exit(2)
    sys.exit(1 if found else 0)
