#!/usr/bin/env python3
"""
Petit service "Instagram vers MP4" pour l'appli Carnet de patrons.

Il tourne sur votre PC. L'appli lui envoie le lien d'une video Instagram,
il la telecharge avec yt-dlp et la renvoie a l'appli en MP4.

Lancement :
    python instagram_server.py
Options :
    --port 9000          port d'ecoute (9000 par defaut)
    --key MOTDEPASSE     exige une cle d'acces (a recopier dans l'appli)
    --cookies fichier    cookies Instagram (format Netscape) si la video
                         demande une connexion. Si un fichier cookies.txt
                         est a cote de ce script, il est utilise tout seul.

Pour l'utiliser depuis l'iPhone, il faut une adresse https vers ce serveur
(voir demarrer-instagram.bat : tunnel Cloudflare).
"""
import argparse
import json
import os
import re
import secrets
import shutil
import sys
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

try:
    sys.stdout.reconfigure(errors="replace")
    sys.stderr.reconfigure(errors="replace")
except Exception:
    pass

IG_RE = re.compile(r"^https?://([\w-]+\.)?instagram\.com/", re.I)
TTL = 3600  # les fichiers sont effaces au bout d'une heure
FILES = {}  # jeton -> (dossier, chemin, titre, expiration)
LOCK = threading.Lock()
ARGS = None
WORK = None


def classify(msg):
    m = msg.lower()
    if "no module named" in m and "yt_dlp" in m:
        return "error.api.server.yt-dlp-missing"
    if any(k in m for k in ("login", "log in", "private", "rate-limit", "rate limit", "cookies", "restricted")):
        return "error.api.content.post.private"
    if any(k in m for k in ("unsupported url", "invalid url")):
        return "error.api.link.invalid"
    if any(k in m for k in ("no video", "unavailable", "not found", "404", "empty media")):
        return "error.api.content.video.unavailable"
    return "error.api.server.failed"


def download(url):
    import yt_dlp  # import ici pour donner un message clair s'il manque

    folder = tempfile.mkdtemp(prefix="ig_", dir=WORK)
    opts = {
        "outtmpl": os.path.join(folder, "%(id)s.%(ext)s"),
        "format": "b[ext=mp4]/bv*[ext=mp4]+ba[ext=m4a]/b",
        "merge_output_format": "mp4",
        "playlist_items": "1",
        "quiet": True,
        "no_warnings": True,
        "restrictfilenames": True,
        "socket_timeout": 20,
    }
    if ARGS.cookies:
        opts["cookiefile"] = ARGS.cookies
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=True)
            if info and info.get("entries"):
                info = next((e for e in info["entries"] if e), info)
        files = [os.path.join(folder, f) for f in os.listdir(folder)]
        files = [f for f in files if os.path.isfile(f) and not f.endswith((".part", ".ytdl"))]
        if not files:
            raise RuntimeError("no video")
        path = max(files, key=os.path.getsize)
    except Exception:
        shutil.rmtree(folder, ignore_errors=True)
        raise
    title = (info or {}).get("title") or "Video Instagram"
    title = re.sub(r"[\\/:*?\"<>|\r\n]+", " ", str(title)).strip()[:80] or "Video Instagram"
    return folder, path, title


def cleaner():
    while True:
        time.sleep(300)
        now = time.time()
        with LOCK:
            old = [k for k, v in FILES.items() if v[3] < now]
            for k in old:
                shutil.rmtree(FILES.pop(k)[0], ignore_errors=True)


class Handler(BaseHTTPRequestHandler):
    server_version = "CarnetIG/1.0"

    def log_message(self, fmt, *args):
        sys.stderr.write("[%s] %s\n" % (time.strftime("%H:%M:%S"), fmt % args))

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept, Range")
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.send_header("Access-Control-Expose-Headers", "Content-Length, Content-Range")
        self.send_header("Access-Control-Max-Age", "86400")

    def _json(self, code, obj):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self._cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        path = self.path.split("?")[0]
        m = re.match(r"^/f/([A-Za-z0-9_-]+)\.mp4$", path)
        if not m:
            return self._json(200, {"status": "ok", "service": "carnet-instagram", "version": 1})
        with LOCK:
            item = FILES.get(m.group(1))
        if not item or not os.path.exists(item[1]):
            return self._json(404, {"status": "error", "error": {"code": "error.api.content.video.unavailable"}})
        size = os.path.getsize(item[1])
        start, end, code = 0, size - 1, 200
        rng = re.match(r"^bytes=(\d*)-(\d*)$", self.headers.get("Range", ""))
        if rng and (rng.group(1) or rng.group(2)):
            if rng.group(1):
                start = int(rng.group(1))
                end = int(rng.group(2)) if rng.group(2) else size - 1
            else:
                start = max(0, size - int(rng.group(2)))
            end = min(end, size - 1)
            if start > end:
                self.send_response(416)
                self._cors()
                self.send_header("Content-Range", "bytes */%d" % size)
                self.send_header("Content-Length", "0")
                self.end_headers()
                return
            code = 206
        self.send_response(code)
        self._cors()
        self.send_header("Content-Type", "video/mp4")
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Length", str(end - start + 1))
        if code == 206:
            self.send_header("Content-Range", "bytes %d-%d/%d" % (start, end, size))
        self.end_headers()
        with open(item[1], "rb") as f:
            f.seek(start)
            left = end - start + 1
            while left > 0:
                chunk = f.read(min(65536, left))
                if not chunk:
                    break
                try:
                    self.wfile.write(chunk)
                except (BrokenPipeError, ConnectionResetError):
                    break
                left -= len(chunk)

    def do_POST(self):
        if ARGS.key and self.headers.get("Authorization", "").strip() != "Api-Key " + ARGS.key:
            return self._json(401, {"status": "error", "error": {"code": "error.api.auth.key.invalid"}})
        try:
            n = int(self.headers.get("Content-Length") or 0)
            data = json.loads(self.rfile.read(min(n, 65536)) or b"{}")
        except Exception:
            return self._json(400, {"status": "error", "error": {"code": "error.api.invalid_body"}})
        url = str(data.get("url", "")).strip()
        if not IG_RE.match(url):
            return self._json(200, {"status": "error", "error": {"code": "error.api.link.invalid"}})
        self.log_message("Telechargement : %s", url)
        try:
            folder, path, title = download(url)
        except Exception as e:
            self.log_message("Echec : %s", str(e).strip().splitlines()[-1][:300] if str(e).strip() else repr(e))
            return self._json(200, {"status": "error", "error": {"code": classify(str(e))}})
        token = secrets.token_urlsafe(16)
        with LOCK:
            FILES[token] = (folder, path, title, time.time() + TTL)
        # URL relative : l'appli la complete avec l'adresse du service (aucun reglage a faire)
        self._json(200, {"status": "tunnel", "url": "/f/%s.mp4" % token, "filename": title + ".mp4"})


def main():
    global ARGS, WORK
    ap = argparse.ArgumentParser(description="Service Instagram vers MP4")
    ap.add_argument("--port", type=int, default=9000)
    ap.add_argument("--key", default="")
    ap.add_argument("--cookies", default="")
    ARGS = ap.parse_args()
    here = os.path.dirname(os.path.abspath(__file__))
    if not ARGS.cookies and os.path.exists(os.path.join(here, "cookies.txt")):
        ARGS.cookies = os.path.join(here, "cookies.txt")
    WORK = tempfile.mkdtemp(prefix="carnet_ig_")
    threading.Thread(target=cleaner, daemon=True).start()
    srv = ThreadingHTTPServer(("0.0.0.0", ARGS.port), Handler)
    print("Service Instagram pret sur http://localhost:%d" % ARGS.port)
    if ARGS.key:
        print("Cle d'acces exigee (a saisir dans l'appli).")
    if ARGS.cookies:
        print("Cookies utilises : " + ARGS.cookies)
    print("Laissez cette fenetre ouverte. Ctrl+C pour arreter.")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        shutil.rmtree(WORK, ignore_errors=True)


if __name__ == "__main__":
    main()
