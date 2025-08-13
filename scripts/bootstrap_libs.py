"""
Download AntV X6 UMD and antv/layout to frontend/static/libs for offline use.

Usage:
    python scripts/bootstrap_libs.py
"""
import os, sys, urllib.request, ssl

ROOT = os.path.dirname(os.path.dirname(__file__))
DEST = os.path.join(ROOT, "frontend", "static", "libs")
os.makedirs(DEST, exist_ok=True)

FILES = [
    ("https://unpkg.com/@antv/x6@2/dist/x6.js", "x6.js"),
    ("https://unpkg.com/@antv/layout@0.3.22/dist/layout.min.js", "layout.min.js"),
]

def download(url, filename):
    print("Downloading", url)
    ctx = ssl.create_default_context()
    data = urllib.request.urlopen(url, context=ctx, timeout=30).read()
    with open(os.path.join(DEST, filename), "wb") as f:
        f.write(data)
    print("Saved", filename)

def main():
    for url, fn in FILES:
        try:
            download(url, fn)
        except Exception as e:
            print("Failed:", url, "->", e)
            print("If your network blocks unpkg, please download manually and place into:", os.path.join(DEST, fn))
            return 1
    print("Done. You can now run the app fully offline.")
    return 0

if __name__ == "__main__":
    sys.exit(main())
