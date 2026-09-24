"""Local-only, read-only visual comparison server; no checkout/worktree mutation."""
import argparse
import functools
import http.server
import pathlib
import subprocess
import urllib.parse

ROOT = pathlib.Path(__file__).resolve().parent.parent
OVERRIDES = {"galaxy-universe-renderer.mjs", "galaxy-workspace-renderer.mjs", "galaxy-celestial-materials.mjs"}


class Baseline(http.server.SimpleHTTPRequestHandler):
    revision = "HEAD"

    def do_GET(self):
        name = urllib.parse.urlsplit(self.path).path.lstrip("/")
        if name not in OVERRIDES:
            return super().do_GET()
        data = subprocess.check_output(["git", "show", self.revision + ":" + name], cwd=ROOT)
        self.send_response(200)
        self.send_header("Content-Type", "text/javascript; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8768)
    parser.add_argument("--ref", default="HEAD", help="Committed baseline revision")
    args = parser.parse_args()
    Baseline.revision = subprocess.check_output(["git", "rev-parse", "--verify", args.ref + "^{commit}"], cwd=ROOT, text=True).strip()
    http.server.ThreadingHTTPServer(("127.0.0.1", args.port), functools.partial(Baseline, directory=str(ROOT))).serve_forever()
