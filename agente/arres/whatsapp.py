"""WhatsApp Cloud API (Meta): recibir mensajes y mandar respuestas o confirmaciones."""

from __future__ import annotations

import hashlib
import hmac
import logging
import re

import httpx

from . import config

log = logging.getLogger("arres.whatsapp")


def configurado() -> bool:
    return bool(config.env("WHATSAPP_TOKEN"))


def firma_valida(cuerpo: bytes, firma: str) -> bool:
    """Meta firma cada aviso con el App Secret. Sin secreto configurado se acepta (solo en local)."""
    secreto = config.env("WHATSAPP_APP_SECRET")
    if not secreto:
        return True
    esperado = "sha256=" + hmac.new(secreto.encode(), cuerpo, hashlib.sha256).hexdigest()
    return hmac.compare_digest(esperado, firma or "")


def mensajes_de_texto(aviso: dict) -> list[dict]:
    """Saca los mensajes de texto del aviso de Meta: [{id, telefono, texto, phone_number_id}]."""
    encontrados = []
    for entrada in aviso.get("entry", []):
        for cambio in entrada.get("changes", []):
            valor = cambio.get("value", {})
            phone_number_id = valor.get("metadata", {}).get("phone_number_id", "")
            for mensaje in valor.get("messages", []):
                if mensaje.get("type") == "text":
                    texto = mensaje["text"]["body"]
                elif mensaje.get("type") == "button":
                    texto = mensaje["button"].get("text", "")
                else:
                    texto = "[El cliente mandó un archivo o audio que no puedo leer]"
                encontrados.append({
                    "id": mensaje.get("id", ""),
                    "telefono": mensaje.get("from", ""),
                    "texto": texto,
                    "phone_number_id": phone_number_id,
                })
    return encontrados


def _destino(telefono: str) -> str:
    """Formato que pide Meta: solo dígitos. En México se usa 52 + 10 dígitos."""
    digitos = re.sub(r"\D", "", telefono)
    if digitos.startswith("521") and len(digitos) == 13:
        digitos = "52" + digitos[3:]
    return digitos


async def _enviar(phone_number_id: str, datos: dict) -> None:
    version = config.env("WHATSAPP_API_VERSION", "v23.0")
    url = f"https://graph.facebook.com/{version}/{phone_number_id}/messages"
    async with httpx.AsyncClient(timeout=15) as http:
        respuesta = await http.post(
            url,
            json={"messaging_product": "whatsapp", **datos},
            headers={"Authorization": f"Bearer {config.env('WHATSAPP_TOKEN')}"},
        )
    if respuesta.status_code >= 400:
        log.error("WhatsApp respondió %s: %s", respuesta.status_code, respuesta.text)
        respuesta.raise_for_status()


async def enviar_texto(phone_number_id: str, telefono: str, texto: str) -> None:
    await _enviar(phone_number_id, {
        "to": _destino(telefono), "type": "text", "text": {"body": texto},
    })


async def enviar_plantilla(
    phone_number_id: str, telefono: str, plantilla: str, parametros: list[str]
) -> None:
    """Las plantillas se aprueban antes en Meta. Se usan fuera de la ventana de 24 h."""
    await _enviar(phone_number_id, {
        "to": _destino(telefono),
        "type": "template",
        "template": {
            "name": plantilla,
            "language": {"code": config.env("WHATSAPP_IDIOMA_PLANTILLAS", "es_MX")},
            "components": [{
                "type": "body",
                "parameters": [{"type": "text", "text": p} for p in parametros],
            }],
        },
    })
