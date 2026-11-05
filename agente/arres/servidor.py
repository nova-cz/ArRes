"""Servidor de ArRES para WhatsApp y avisos del panel.

Correr en local:  uvicorn arres.servidor:app --reload --port 8000
"""

from __future__ import annotations

import hmac
import logging
from collections import deque
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import BackgroundTasks, FastAPI, Header, HTTPException, Request
from fastapi.responses import HTMLResponse, PlainTextResponse
from pydantic import BaseModel

from . import cerebro, config, notificaciones, whatsapp
from .herramientas import Contexto
from .modelos import CONFIRMADA, RECHAZADA
from .textos import fecha_legible, normalizar_telefono

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s")
log = logging.getLogger("arres.servidor")

app = FastAPI(title="ArRES agente")
_vistos: deque[str] = deque(maxlen=1000)  # Meta reintenta avisos: no contestar dos veces


@app.get("/salud")
async def salud() -> dict:
    return {"ok": True, "whatsapp": whatsapp.configurado(), "modo_prueba": _modo_prueba()}


# ---------------------------------------------------------------------------
# WhatsApp
# ---------------------------------------------------------------------------

@app.get("/whatsapp")
async def verificar_webhook(request: Request) -> PlainTextResponse:
    """Meta llama aquí una vez al registrar el webhook."""
    p = request.query_params
    if p.get("hub.mode") == "subscribe" and p.get("hub.verify_token") == config.env(
        "WHATSAPP_VERIFY_TOKEN"
    ):
        return PlainTextResponse(p.get("hub.challenge", ""))
    raise HTTPException(403, "Token de verificación incorrecto")


@app.post("/whatsapp")
async def recibir_whatsapp(request: Request, tareas: BackgroundTasks) -> dict:
    cuerpo = await request.body()
    if not whatsapp.firma_valida(cuerpo, request.headers.get("x-hub-signature-256", "")):
        raise HTTPException(401, "Firma inválida")
    for mensaje in whatsapp.mensajes_de_texto(await request.json()):
        if mensaje["id"] in _vistos:
            continue
        _vistos.append(mensaje["id"])
        # Se contesta en segundo plano: Meta exige respuesta HTTP rápida.
        tareas.add_task(_atender_whatsapp, mensaje)
    return {"ok": True}


async def _atender_whatsapp(mensaje: dict) -> None:
    almacen = config.almacen()
    restaurante = await almacen.restaurante_por_whatsapp(mensaje["phone_number_id"])
    if not restaurante:
        log.warning("Ningún restaurante tiene el número de WhatsApp %s", mensaje["phone_number_id"])
        return
    telefono = normalizar_telefono(mensaje["telefono"])
    ctx = Contexto(almacen, restaurante, "whatsapp", telefono)
    try:
        respuesta = await cerebro.responder(ctx, mensaje["texto"])
    except Exception:
        log.exception("Falló el agente con el mensaje de %s", telefono)
        respuesta = ("Perdón, tuve un problema técnico. En un momento te contesta alguien "
                     "del equipo.")
    await whatsapp.enviar_texto(restaurante.whatsapp_phone_number_id, telefono, respuesta)


# ---------------------------------------------------------------------------
# Avisos del panel (Supabase Database Webhook en la tabla reservas, evento UPDATE)
# ---------------------------------------------------------------------------

@app.post("/eventos/reserva")
async def reserva_actualizada(
    evento: dict, x_arres_secreto: str = Header(default="")
) -> dict:
    secreto = config.env("EVENTOS_SECRETO")
    if not secreto or not hmac.compare_digest(secreto, x_arres_secreto):
        raise HTTPException(401, "Secreto inválido")
    nuevo, viejo = evento.get("record") or {}, evento.get("old_record") or {}
    if evento.get("type") != "UPDATE" or nuevo.get("estado") == viejo.get("estado"):
        return {"enviado": None}
    if nuevo.get("estado") not in (CONFIRMADA, RECHAZADA):
        return {"enviado": None}
    almacen = config.almacen()
    reserva = await almacen.reserva(nuevo["id"])
    if not reserva:
        raise HTTPException(404, "Reserva no encontrada")
    return {"enviado": await notificaciones.avisar_cambio(almacen, reserva)}


# ---------------------------------------------------------------------------
# Modo prueba: chat tipo WhatsApp + mini panel, sin Meta ni panel web.
# Solo se activa con MODO_PRUEBA=1. Nunca lo actives en el servidor público.
# ---------------------------------------------------------------------------

def _modo_prueba() -> bool:
    return config.env("MODO_PRUEBA") == "1"


def _exigir_modo_prueba() -> None:
    if not _modo_prueba():
        raise HTTPException(404)


async def _restaurante_prueba():
    almacen = config.almacen()
    restaurante_id = config.env("RESTAURANTE_ID")
    restaurante = (await almacen.restaurante(restaurante_id) if restaurante_id
                   else await almacen.restaurante_por_defecto())
    if not restaurante:
        raise HTTPException(500, "No hay restaurantes en la base")
    return almacen, restaurante


class MensajePrueba(BaseModel):
    telefono: str
    texto: str


class EstadoPrueba(BaseModel):
    estado: str


@app.get("/prueba", response_class=HTMLResponse)
async def pagina_prueba() -> str:
    _exigir_modo_prueba()
    return (Path(__file__).parent / "estatico" / "prueba.html").read_text(encoding="utf-8")


@app.post("/prueba/chat")
async def chat_prueba(datos: MensajePrueba) -> dict:
    _exigir_modo_prueba()
    almacen, restaurante = await _restaurante_prueba()
    ctx = Contexto(almacen, restaurante, "whatsapp", normalizar_telefono(datos.telefono))
    return {"respuesta": await cerebro.responder(ctx, datos.texto)}


@app.get("/prueba/mensajes")
async def mensajes_prueba(telefono: str) -> list[dict]:
    _exigir_modo_prueba()
    almacen, restaurante = await _restaurante_prueba()
    return await almacen.mensajes(restaurante.id, normalizar_telefono(telefono), "whatsapp", 100)


@app.get("/prueba/reservas")
async def reservas_prueba() -> list[dict]:
    _exigir_modo_prueba()
    almacen, restaurante = await _restaurante_prueba()
    ahora = datetime.now(timezone.utc)
    reservas = await almacen.reservas_entre(restaurante.id, ahora - timedelta(days=1),
                                            ahora + timedelta(days=60))
    tz = notificaciones.restaurante_tz(restaurante)
    return [{
        "id": r.id, "nombre": r.nombre, "telefono": r.telefono, "personas": r.personas,
        "cuando": fecha_legible(r.inicio.astimezone(tz)), "estado": r.estado, "canal": r.canal,
        "notas": r.notas, "motivo": r.motivo_escalada,
        "creado_en": r.creado_en.isoformat() if r.creado_en else None,
    } for r in reservas]


@app.post("/prueba/reservas/{reserva_id}")
async def cambiar_estado_prueba(reserva_id: str, datos: EstadoPrueba) -> dict:
    _exigir_modo_prueba()
    if datos.estado not in (CONFIRMADA, RECHAZADA):
        raise HTTPException(400, "Estado no válido")
    almacen = config.almacen()
    reserva = await almacen.cambiar_estado(reserva_id, datos.estado)
    if not reserva:
        raise HTTPException(404, "Reserva no encontrada")
    return {"enviado": await notificaciones.avisar_cambio(almacen, reserva)}
