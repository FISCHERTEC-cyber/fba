#!/usr/bin/env python3
"""Scan all tracked Git index blobs, including symlink targets, without printing matches."""
import re
import subprocess
import sys

PATTERNS = (
    ("private key", re.compile(rb"-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----")),
    ("AWS access key", re.compile(rb"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b")),
    ("GitHub token", re.compile(rb"\bgh[pousr]_[A-Za-z0-9_]{30,}\b")),
)


def scan():
    result = subprocess.run(["git", "ls-files", "--stage", "-z"], stdout=subprocess.PIPE, check=True)
    failures = []
    for entry in result.stdout.split(b"\0"):
        if not entry:
            continue
        metadata, path = entry.split(b"\t", 1)
        mode, oid, stage = metadata.split(b" ")
        if stage != b"0" or mode == b"160000":
            raise RuntimeError("unmerged entry or submodule requires separate security review")
        blob = subprocess.run(["git", "cat-file", "blob", oid.decode("ascii")], stdout=subprocess.PIPE, check=True).stdout
        for name, pattern in PATTERNS:
            if pattern.search(blob):
                failures.append((path.decode("utf-8", "backslashreplace"), name))
    for path, name in failures:
        print(f"Potential {name} in tracked file: {path!r}", file=sys.stderr)
    return bool(failures)


if __name__ == "__main__":
    try:
        found = scan()
    except (OSError, subprocess.CalledProcessError, ValueError, RuntimeError) as exc:
        print(f"Secret scan failed: {exc}", file=sys.stderr)
        sys.exit(2)
    if found:
        sys.exit(1)
    print("Selected secret patterns: no matches in tracked index blobs; coverage is limited.")
