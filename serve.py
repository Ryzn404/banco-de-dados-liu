"""Servidor local do front-end.

python serve.py          ->  http://localhost:5173 (só neste computador)
python serve.py --rede   ->  também acessível pelo celular na mesma rede Wi-Fi
"""
import functools
import http.server
import pathlib
import socket
import sys

PORT = 5173
WEB = pathlib.Path(__file__).resolve().parent / "web"


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".webmanifest": "application/manifest+json",
    }

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def ip_local():
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
        s.connect(("10.255.255.255", 1))  # não envia nada; só descobre a interface de rede
        return s.getsockname()[0]


if __name__ == "__main__":
    rede = "--rede" in sys.argv
    handler = functools.partial(Handler, directory=str(WEB))
    with http.server.ThreadingHTTPServer(("0.0.0.0" if rede else "127.0.0.1", PORT), handler) as httpd:
        print(f"Servindo em http://localhost:{PORT}")
        if rede:
            print(f"No celular (mesmo Wi-Fi): http://{ip_local()}:{PORT}")
        httpd.serve_forever()
