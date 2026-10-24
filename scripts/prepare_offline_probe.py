"""Stage an isolated WPS publishing project; does not install or register it."""
from pathlib import Path
import shutil

root = Path(__file__).resolve().parents[1]
destination = root / "dist/offline-probe/project"
if destination.exists():
    raise SystemExit("Probe project already exists: " + str(destination) + ". Use it as-is or move it aside before staging again.")
shutil.copytree(root / "packaging/offline-probe", destination)
shutil.copy2(root / "LICENSE", destination / "LICENSE")
print(destination)
