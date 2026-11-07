"""Servidor local de desarrollo: la misma API que en Lambda, en http://localhost:8000.

    PYTHONPATH=src python -m zombie.servidor

Lee las claves de backend/.env (por ejemplo GROQ_API_KEY=...), que git ignora.
"""
import json
import os
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ENV = Path(__file__).resolve().parents[2] / ".env"

PUERTO = 8000


def cargar_env(ruta: Path = ENV) -> None:
    """Pasa las líneas CLAVE=valor de .env al entorno, sin pisar lo que ya esté definido."""
    if not ruta.is_file():
        return
    for linea in ruta.read_text(encoding="utf-8").splitlines():
        linea = linea.strip()
        if not linea or linea.startswith("#") or "=" not in linea:
            continue
        clave, valor = linea.split("=", 1)
        os.environ.setdefault(clave.strip(), valor.strip().strip("'\""))


# Antes de importar la API: algunos módulos leen su configuración (modelos, IA_ACTIVA) al importarse.
cargar_env()

from .api import atender, atender_stream, es_stream  # noqa: E402


class Manejador(BaseHTTPRequestHandler):
    def _cabeceras_cors(self) -> None:
        # Solo para desarrollo: la interfaz corre en otro puerto (ng serve).
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _responder(self, codigo: int, datos: dict) -> None:
        cuerpo = json.dumps(datos, ensure_ascii=False).encode("utf-8")
        self.send_response(codigo)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(cuerpo)))
        self._cabeceras_cors()
        self.end_headers()
        self.wfile.write(cuerpo)

    def _transmitir(self, eventos) -> None:
        """Server-Sent Events: cada trozo se envía en cuanto la IA lo escribe."""
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-cache")
        self._cabeceras_cors()
        self.end_headers()   # sin Content-Length: con HTTP/1.0 la respuesta termina al cerrar
        for evento in eventos:
            self.wfile.write(evento.encode("utf-8"))
            self.wfile.flush()

    def do_OPTIONS(self):
        self._responder(204, {})

    def do_GET(self):
        self._responder(*atender("GET", self.path, None))

    def do_POST(self):
        largo = int(self.headers.get("Content-Length", 0))
        cuerpo = self.rfile.read(largo).decode("utf-8") if largo else None
        if es_stream("POST", self.path):
            codigo, respuesta = atender_stream(cuerpo)
            if codigo == 200:
                self._transmitir(respuesta)
            else:
                self._responder(codigo, respuesta)
            return
        self._responder(*atender("POST", self.path, cuerpo))


def main() -> None:
    print(f"API local en http://localhost:{PUERTO}/api/simular")
    ThreadingHTTPServer(("127.0.0.1", PUERTO), Manejador).serve_forever()


if __name__ == "__main__":
    main()
