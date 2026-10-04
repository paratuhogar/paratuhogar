"""Local fixture server, never production. No database or external HTTP calls."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
import re
root = Path(__file__).resolve().parents[2]
source = (root/'tests/startup-browser.cjs').read_text()
sdk = re.search(r'const sdk=`(.*?)`;\n', source, re.S).group(1)
class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs): super().__init__(*args,directory=str(root),**kwargs)
    def do_GET(self):
        path=urlsplit(self.path).path
        if path=='/service-worker.js':self.send_error(404);return
        if path=='/':
            body=(root/'index.html').read_text().replace('<head>','<head><meta http-equiv="Content-Security-Policy" content="connect-src \'self\';"><script src="/qa/ranking/storefront-init.js"></script>')
            self.send_response(200);self.send_header('Content-Type','text/html; charset=utf-8');self.end_headers();self.wfile.write(body.encode());return
        if path=='/js/vendor/supabase-2.57.4.js':
            self.send_response(200);self.send_header('Content-Type','application/javascript');self.end_headers();self.wfile.write(sdk.encode());return
        return super().do_GET()
ThreadingHTTPServer(('127.0.0.1',8766),Handler).serve_forever()
