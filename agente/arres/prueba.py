"""Llamada de prueba desde el panel: que conteste como el restaurante de quien prueba.

El panel abre /probar?token=<sesión de Supabase>. Aquí se comprueba con Supabase quién es y
a qué restaurante pertenece, y se deja una cookie firmada. Las llamadas del navegador que
traigan esa cookie usan ese restaurante; sin ella, el de la demo.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
from contextvars import ContextVar

import httpx

from . import config

# Restaurante de la llamada de prueba en curso (lo lee voz/bot.py).
restaurante_prueba: ContextVar[str] = ContextVar("restaurante_prueba", default="")

COOKIE = "arres_prueba"
_SECRETO = (config.env("EVENTOS_SECRETO") or secrets.token_hex(16)).encode()


def firmar(restaurante_id: str) -> str:
    firma = hmac.new(_SECRETO, restaurante_id.encode(), hashlib.sha256).hexdigest()
    return f"{restaurante_id}.{firma}"


def verificar(valor: str) -> str:
    """Devuelve el restaurante si la cookie es auténtica; si no, vacío."""
    restaurante_id, _, firma = (valor or "").partition(".")
    esperado = hmac.new(_SECRETO, restaurante_id.encode(), hashlib.sha256).hexdigest()
    return restaurante_id if restaurante_id and hmac.compare_digest(firma, esperado) else ""


async def restaurante_de(token: str) -> str:
    """Restaurante del usuario dueño de ese token de Supabase (vacío si no es válido)."""
    url = config.env("SUPABASE_URL").rstrip("/").removesuffix("/rest/v1")
    llave = config.env("SUPABASE_SECRET_KEY") or config.env("SUPABASE_SERVICE_ROLE_KEY")
    if not (url and llave and token):
        return ""
    async with httpx.AsyncClient(timeout=10) as http:
        usuario = await http.get(f"{url}/auth/v1/user",
                                 headers={"apikey": llave, "Authorization": f"Bearer {token}"})
        if usuario.status_code != 200:
            return ""
        cabeceras = {"apikey": llave}
        if not llave.startswith("sb_"):
            cabeceras["Authorization"] = f"Bearer {llave}"
        filas = await http.get(f"{url}/rest/v1/miembros", headers=cabeceras, params={
            "user_id": f"eq.{usuario.json()['id']}", "select": "restaurante_id", "limit": 1})
    datos = filas.json() if filas.status_code == 200 else []
    return datos[0]["restaurante_id"] if datos else ""
