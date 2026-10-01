#!/usr/bin/env python3
"""Loopback-only preview of reviewed feedback files; never serves the repository."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from tempfile import TemporaryDirectory
import shutil

ROOT = Path(__file__).resolve().parents[1]
FILES = ('feedback.html', 'css/feedback.css', 'js/feedback.mjs', 'js/secure-data.js')
LOGIN = '''<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer">
<title>Prueba privada · ParaTuHogar</title><link rel="stylesheet" href="css/feedback.css"></head>
<body><main><h1>Prueba privada de problemas y mejoras</h1>
<p>Esta página está en tu equipo. El inicio de sesión y los envíos usan el servicio real de ParaTuHogar. Usa tu cuenta existente; no compartas contraseñas ni incluyas datos de clientes.</p>
<form id="login"><label>Usuario habitual<input id="username" autocomplete="username" required maxlength="200"></label>
<label>Contraseña<input id="password" type="password" autocomplete="current-password" required maxlength="512"></label>
<button id="submit">Entrar</button></form><p id="status" role="status" aria-live="polite"></p>
<a href="feedback.html" id="open" hidden>Abrir problemas y mejoras</a>
<button id="logout" type="button" hidden>Cerrar esta sesión de prueba</button>
<p>Al terminar, cierra la sesión aquí y detén el servidor local con Ctrl+C.</p></main>
<script src="js/secure-data.js?v=20261001-feedback1"></script><script>
const $=id=>document.getElementById(id);
function show(profile){$('status').textContent=profile?'Sesión de '+profile.nombre:'Sin sesión.';$('open').hidden=!profile;$('logout').hidden=!profile;$('login').hidden=!!profile;}
$('login').onsubmit=async event=>{event.preventDefault();$('submit').disabled=true;try{const profile=await PTHSecureData.login($('username').value,$('password').value);$('password').value='';show(profile);}catch(error){$('status').textContent=error.message;}finally{$('password').value='';$('submit').disabled=false;}};
$('logout').onclick=async()=>{const result=await PTHSecureData.logout();show(null);if(result?.error)$('status').textContent='La sesión se borró de este navegador, pero no se confirmó su cierre en el servidor. No compartas este perfil.';};
PTHSecureData.restore().then(show).catch(error=>{$('status').textContent=error.message;});
</script></body></html>'''

class PrivatePreview(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        super().end_headers()

    def list_directory(self, path):
        self.send_error(404)
        return None

    def log_message(self, format, *args):
        pass


def main():
    with TemporaryDirectory(prefix='pth-feedback-preview-') as directory:
        target = Path(directory)
        for name in FILES:
            (target / name).parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT / name, target / name)
        (target / 'index.html').write_text(LOGIN, encoding='utf-8')
        handler = partial(PrivatePreview, directory=directory)
        try:
            with ThreadingHTTPServer(('127.0.0.1', 8080), handler) as server:
                print('Vista local: http://127.0.0.1:8080/ — usa el backend real. Ctrl+C para detener.', flush=True)
                server.serve_forever()
        except KeyboardInterrupt:
            print('\nVista local detenida; archivos temporales eliminados.')
        except OSError as error:
            raise SystemExit('No se pudo abrir 127.0.0.1:8080. Cierra otro servidor local en ese puerto; no cambies el origen permitido. '+str(error))

if __name__ == '__main__':
    main()
