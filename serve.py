"""Servidor local do front-end: python serve.py  ->  http://localhost:5173"""
import functools
import http.server
import pathlib

PORT = 5173
WEB = pathlib.Path(__file__).resolve().parent / "web"


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, ".js": "text/javascript"}

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    handler = functools.partial(Handler, directory=str(WEB))
    with http.server.ThreadingHTTPServer(("127.0.0.1", PORT), handler) as httpd:
        print(f"Servindo em http://localhost:{PORT}")
        httpd.serve_forever()
