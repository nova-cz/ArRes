"""Avisar al cliente por WhatsApp cuando el equipo aprueba o rechaza su reserva."""

from __future__ import annotations

import logging
from zoneinfo import ZoneInfo

from . import config, whatsapp
from .almacen import Almacen, ventana_abierta
from .modelos import CONFIRMADA, RECHAZADA, Reserva, Restaurante
from .textos import fecha_legible

log = logging.getLogger("arres.notificaciones")


def texto_para(reserva: Reserva, restaurante: Restaurante) -> str | None:
    cuando = fecha_legible(reserva.inicio.astimezone(restaurante_tz(restaurante))) \
        if reserva.inicio else "la fecha que pediste"
    if reserva.estado == CONFIRMADA:
        return (f"✅ ¡Listo, {reserva.nombre}! Tu reserva en {restaurante.nombre} quedó "
                f"confirmada: {cuando}, {reserva.personas} personas.\n"
                "Si necesitas cambiarla, responde a este mensaje.")
    if reserva.estado == RECHAZADA:
        return (f"Lo sentimos, {reserva.nombre}: no pudimos confirmar tu reserva en "
                f"{restaurante.nombre} para el {cuando}.\n"
                "Responde a este mensaje y te ayudamos a encontrar otro horario.")
    return None


def restaurante_tz(restaurante: Restaurante) -> ZoneInfo:
    return ZoneInfo(restaurante.zona_horaria)


async def avisar_cambio(almacen: Almacen, reserva: Reserva) -> str | None:
    """Manda el aviso que corresponda al estado actual. Devuelve el texto enviado (o None)."""
    restaurante = await almacen.restaurante(reserva.restaurante_id)
    texto = texto_para(reserva, restaurante) if restaurante else None
    if not texto or not reserva.telefono:
        return None

    historial = await almacen.mensajes(restaurante.id, reserva.telefono, "whatsapp")
    if whatsapp.configurado() and restaurante.whatsapp_phone_number_id:
        if ventana_abierta(historial):
            await whatsapp.enviar_texto(restaurante.whatsapp_phone_number_id, reserva.telefono, texto)
        else:
            # Fuera de la ventana de 24 h (por ejemplo, reservó por llamada) Meta exige plantilla.
            clave = "WHATSAPP_PLANTILLA_CONFIRMADA" if reserva.estado == CONFIRMADA \
                else "WHATSAPP_PLANTILLA_RECHAZADA"
            plantilla = config.env(clave)
            if not plantilla:
                log.warning("Falta %s en .env: no se pudo avisar a %s", clave, reserva.telefono)
                return None
            cuando = fecha_legible(reserva.inicio.astimezone(restaurante_tz(restaurante))) \
                if reserva.inicio else ""
            await whatsapp.enviar_plantilla(
                restaurante.whatsapp_phone_number_id, reserva.telefono, plantilla,
                [reserva.nombre, cuando, str(reserva.personas)],
            )
    else:
        log.info("WhatsApp sin configurar; aviso solo guardado: %s", texto)

    # Se guarda siempre: así el agente sabe qué se le dijo al cliente si vuelve a escribir.
    await almacen.guardar_mensaje(restaurante.id, reserva.telefono, "whatsapp", "agente", texto)
    await almacen.marcar_notificada(reserva.id)
    return texto
