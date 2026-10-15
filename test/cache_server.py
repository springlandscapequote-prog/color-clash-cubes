import http.server, sys, functools
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control','public, max-age=86400')   # aggressive caching, worse than GitHub Pages
        super().end_headers()
    def log_message(self,*a): pass
d=sys.argv[2]
http.server.ThreadingHTTPServer(('127.0.0.1',int(sys.argv[1])), functools.partial(H, directory=d)).serve_forever()
