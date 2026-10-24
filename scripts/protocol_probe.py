#!/usr/bin/python3
"""Harmless URI launch probe. Never execute commands or accept output paths from a URI."""
from pathlib import Path
from urllib.parse import urlsplit, parse_qs
import json
import os
import re
import sys
import time


def handle(uri, directory):
    parsed = urlsplit(uri)
    query = parse_qs(parsed.query, strict_parsing=True)
    if (parsed.scheme != "texkoi" or parsed.netloc != "probe" or parsed.path not in ("", "/")
            or parsed.fragment or set(query) != {"token"} or len(query["token"]) != 1
            or not re.fullmatch(r"[a-f0-9]{32}", query["token"][0])):
        raise ValueError("Unsupported TeXKoi probe URI")
    token = query["token"][0]
    directory.mkdir(mode=0o700, parents=True, exist_ok=True)
    target = directory / (token + ".json")
    temporary = directory / (token + ".tmp")
    temporary.write_text(json.dumps({"ok": True, "token": token, "python": sys.executable,
                                     "started_ms": int(time.time() * 1000)}))
    temporary.replace(target)
    return target


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Expected one texkoi://probe URI")
    cache = Path(os.environ.get("XDG_CACHE_HOME", str(Path.home() / ".cache")))
    try:
        handle(sys.argv[1], cache / "texkoi/protocol-probe")
    except (ValueError, OSError) as error:
        raise SystemExit(str(error))
