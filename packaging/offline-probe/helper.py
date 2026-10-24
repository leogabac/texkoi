#!/usr/bin/python3
"""Offline proof only: record a direct, argument-free process launch."""
from pathlib import Path
import json
import sys
import time

started = Path(__file__).with_name("helper-started.json")
started.write_text(json.dumps({"python": sys.executable, "argv": sys.argv,
                               "started_ms": int(time.time() * 1000)}))
output = Path(sys.argv[1]) if len(sys.argv) == 2 else Path(__file__).with_name("helper-result.json")
temporary = output.with_suffix(".tmp")
temporary.write_text(json.dumps({"ok": True, "python": sys.executable,
                                  "started_ms": int(time.time() * 1000)}))
temporary.replace(output)
