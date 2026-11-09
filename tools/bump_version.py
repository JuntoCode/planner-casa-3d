"""Give every file a new version in index.html (?v=...) before uploading a release.

Phones keep files in cache: with a new version they always load the new set together,
never a new page with an old script. Run from the project folder:

    python tools/bump_version.py
"""
import re
import time
from pathlib import Path

index = Path(__file__).resolve().parent.parent / 'index.html'
html = index.read_text(encoding='utf-8')
version = time.strftime('%Y%m%d%H%M')
html, n = re.subn(r'\?v=[0-9a-z]+', '?v=' + version, html)
index.write_text(html, encoding='utf-8')
print(f'version {version} on {n} files')
