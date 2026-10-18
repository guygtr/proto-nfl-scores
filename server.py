#!/usr/bin/env python3
"""Mini-serveur sans dépendance : sert la page et relaie /api/scoreboard vers ESPN
(contourne le CORS parfois absent côté ESPN). Usage : python3 server.py [port]"""
import http.server, socketserver, sys, time, urllib.request, os

ESPN = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.environ.get("PORT", 8000))
_cache = {"t": 0, "body": b""}

class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.split("?")[0] == "/api/scoreboard":
            try:
                if time.time() - _cache["t"] > 10:  # petite cache de 10 s
                    req = urllib.request.Request(ESPN, headers={"User-Agent": "proto-nfl-scores"})
                    with urllib.request.urlopen(req, timeout=10) as r:
                        _cache.update(t=time.time(), body=r.read())
                body, code = _cache["body"], 200
            except Exception as e:
                body, code = f'{{"error":"{type(e).__name__}"}}'.encode(), 502
            self.send_response(code)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(("0.0.0.0", PORT), Handler) as s:
        print(f"Pointage NFL : http://localhost:{PORT}")
        s.serve_forever()
