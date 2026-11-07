"""Acciones que puede usar el agente, iguales para llamadas y WhatsApp.

Cada acción recibe argumentos que eligió la IA y devuelve un dict que la IA lee para
contestar. Las reglas viven aquí, en código, no en el prompt.
"""

from __future__ import annotations

import logging
import unicodedata
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Callable
from zoneinfo import ZoneInfo

from . import disponibilidad, notificaciones
from .almacen import Almacen
from .modelos import CANCELADA, CONFIRMADA, ESCALADA, PENDIENTE, Reserva, Restaurante
from .textos import dia_legible, fecha_legible, hora_legible, normalizar_telefono

log = logging.getLogger("arres.herramientas")


@dataclass
class Contexto:
    almacen: Almacen
    restaurante: Restaurante
    canal: str  # "llamada" o "whatsapp"
    telefono: str = ""  # número del cliente si ya lo conocemos (identificador de llamada o WhatsApp)
    reloj: Callable[[], datetime] = field(default=lambda: datetime.now(timezone.utc))
    # Reservas creadas en esta conversación (para no duplicar si la IA repite la acción).
    creadas: list[str] = field(default_factory=list)

    @property
    def tz(self) -> ZoneInfo:
        return ZoneInfo(self.restaurante.zona_horaria)

    def ahora(self) -> datetime:
        return self.reloj().astimezone(self.tz)


# ---------------------------------------------------------------------------
# Utilidades
# ---------------------------------------------------------------------------

def _leer_momento(ctx: Contexto, fecha: str, hora: str) -> datetime:
    try:
        dia = datetime.strptime(fecha.strip(), "%Y-%m-%d").date()
        h, m = (int(x) for x in hora.strip().split(":"))
        return datetime(dia.year, dia.month, dia.day, h, m, tzinfo=ctx.tz)
    except (ValueError, AttributeError) as error:
        raise ValueError("Usa fecha AAAA-MM-DD y hora HH:MM en formato de 24 horas.") from error


async def _reservas_semana(ctx: Contexto, desde: datetime) -> list[Reserva]:
    # Una semana de reservas, para poder buscar alternativas en días siguientes.
    dia = desde.replace(hour=0, minute=0, second=0, microsecond=0)
    return await ctx.almacen.reservas_entre(
        ctx.restaurante.id, dia - timedelta(days=1), dia + timedelta(days=8)
    )


async def _revisar(
    ctx: Contexto, inicio: datetime, personas: int, excluir: str = ""
) -> disponibilidad.Revision:
    reglas = await ctx.almacen.reglas(ctx.restaurante.id)
    # Al cambiar una reserva, su propio lugar no cuenta como ocupado.
    reservas = [r for r in await _reservas_semana(ctx, inicio) if r.id != excluir]
    return disponibilidad.revisar(reglas, reservas, inicio, personas, ctx.ahora())


def _respuesta_revision(revision: disponibilidad.Revision) -> dict[str, Any]:
    datos: dict[str, Any] = {
        "disponible": revision.disponible,
        "motivo": revision.motivo,
        "mensaje": revision.mensaje,
    }
    if revision.alternativas:
        datos["alternativas"] = [
            {"fecha": a.strftime("%Y-%m-%d"), "hora": a.strftime("%H:%M"),
             "como_decirlo": fecha_legible(a)}
            for a in revision.alternativas
        ]
    if revision.motivo == "grupo_grande":
        datos["siguiente_paso"] = "Usa escalar_a_humano con los datos del grupo."
    return datos


# ---------------------------------------------------------------------------
# Acciones
# ---------------------------------------------------------------------------

async def ver_disponibilidad(ctx: Contexto, fecha: str, hora: str, personas: int) -> dict:
    inicio = _leer_momento(ctx, fecha, hora)
    revision = await _revisar(ctx, inicio, int(personas))
    return {"solicitado": fecha_legible(inicio), **_respuesta_revision(revision)}


MAX_HORARIOS = 8


async def buscar_horarios(
    ctx: Contexto, personas: int, fecha: str = "", desde_hora: str = ""
) -> dict:
    """Horarios libres de un día, o los más próximos si no dan fecha."""
    personas = int(personas)
    reglas = await ctx.almacen.reglas(ctx.restaurante.id)
    if personas > reglas.max_personas:
        return {"motivo": "grupo_grande",
                "mensaje": f"Grupos de más de {reglas.max_personas} los revisa el equipo.",
                "siguiente_paso": "Usa escalar_a_humano con los datos del grupo."}
    ahora = ctx.ahora()
    if fecha:
        inicio = _leer_momento(ctx, fecha, desde_hora or "00:00")
    else:
        inicio = ahora
    reservas = await _reservas_semana(ctx, inicio)
    dia = inicio.date()
    for intento in range(8):
        libres = [h for h in disponibilidad.horarios_libres(
            reglas, reservas, dia, ctx.tz, personas, ahora) if h >= inicio]
        if libres:
            datos = {
                "dia": dia_legible(libres[0]),
                "fecha": dia.isoformat(),
                "horarios": [{"hora": h.strftime("%H:%M"), "como_decirlo": hora_legible(h)}
                             for h in libres[:MAX_HORARIOS]],
                "primero": hora_legible(libres[0]),
                "ultimo": hora_legible(libres[-1]),
            }
            if fecha and intento:
                datos["aviso"] = "Ese día ya no hay lugar; este es el siguiente día disponible."
            return datos
        dia += timedelta(days=1)
        reservas = await _reservas_semana(ctx, datetime.combine(dia, datetime.min.time(), ctx.tz))
    return {"mensaje": "No encontré lugar en los próximos días.",
            "siguiente_paso": "Ofrece pasar el caso al equipo con escalar_a_humano."}


async def crear_reserva(
    ctx: Contexto, nombre: str, personas: int, fecha: str, hora: str,
    telefono: str = "", notas: str = "", confirmado_por_cliente: bool = False,
) -> dict:
    if not confirmado_por_cliente:
        return {"registrada": False,
                "siguiente_paso": "Antes de registrar, repite nombre, día, hora, personas y "
                                  "teléfono en una frase, espera el sí y vuelve a usar "
                                  "crear_reserva con confirmado_por_cliente=true."}
    telefono = normalizar_telefono(telefono or ctx.telefono)
    if not telefono:
        return {"error": "Falta el teléfono del cliente. Pídeselo para mandarle la confirmación."}
    inicio = _leer_momento(ctx, fecha, hora)
    personas = int(personas)

    # Si la IA repite la acción con los mismos datos, no se duplica la reserva.
    for reserva_id in ctx.creadas:
        previa = await ctx.almacen.reserva(reserva_id)
        if previa and previa.inicio == inicio and previa.personas == personas:
            return {"estado": previa.estado, "reserva_id": previa.id, "nota": "Ya estaba registrada."}

    # Se vuelve a revisar justo antes de guardar: pudo entrar otra reserva mientras hablaban.
    revision = await _revisar(ctx, inicio, personas)
    if not revision.disponible:
        return {"registrada": False, **_respuesta_revision(revision)}

    reglas = await ctx.almacen.reglas(ctx.restaurante.id)
    estado = CONFIRMADA if personas <= reglas.auto_aprobar_hasta else PENDIENTE
    # Quien ya faltó varias veces no se confirma solo: lo decide el equipo.
    faltas = await ctx.almacen.contar_faltas(ctx.restaurante.id, telefono)
    motivo = ""
    if faltas >= reglas.max_faltas:
        estado = PENDIENTE
        motivo = f"El cliente tiene {faltas} inasistencias previas."
    reserva = await ctx.almacen.crear_reserva(Reserva(
        restaurante_id=ctx.restaurante.id,
        nombre=nombre.strip(),
        telefono=telefono,
        personas=personas,
        inicio=inicio,
        fin=inicio + timedelta(minutes=reglas.duracion_min),
        estado=estado,
        canal=ctx.canal,
        notas=notas.strip(),
        motivo_escalada=motivo,
    ))
    ctx.creadas.append(reserva.id)
    if estado == CONFIRMADA:
        # Se confirmó en la llamada (regla auto_aprobar_hasta). Si hay WhatsApp
        # configurado, además se manda el comprobante; si no, no pasa nada.
        try:
            await notificaciones.avisar_cambio(ctx.almacen, reserva)
        except Exception:  # la reserva ya quedó; un fallo de WhatsApp no la deshace
            log.exception("No se pudo mandar la confirmación de %s", reserva.id)
        que_decir = (f"¡Listo! Tu reserva quedó confirmada para el {fecha_legible(inicio)}, "
                     f"{personas} personas, a nombre de {nombre.strip()}. Tienes "
                     f"{reglas.tolerancia_min} minutos de tolerancia; después la mesa se "
                     "libera. Te esperamos.")
    elif motivo:
        # No se le dice "faltaste": solo que esta reserva la confirma el equipo.
        que_decir = (f"Tu solicitud para el {fecha_legible(inicio)} quedó apartada. Para "
                     "este horario el equipo te llama para confirmar al número que "
                     f"termina en {telefono[-4:]}.")
    else:
        que_decir = (f"La solicitud para el {fecha_legible(inicio)} quedó registrada y apartada. "
                     "El equipo te llama para confirmar al "
                     f"número que termina en {telefono[-4:]}.")
    return {"registrada": True, "estado": estado, "reserva_id": reserva.id, "que_decir": que_decir}


async def escalar_a_humano(
    ctx: Contexto, motivo: str, nombre: str = "", telefono: str = "",
    personas: int = 0, fecha: str = "", hora: str = "",
) -> dict:
    telefono = normalizar_telefono(telefono or ctx.telefono)
    if not nombre.strip() or not telefono:
        return {"registrada": False,
                "siguiente_paso": "Antes de pasar el caso, pide nombre y teléfono a 10 dígitos "
                                  "(y día, hora y personas si es una reserva), repítelos y "
                                  "vuelve a usar escalar_a_humano."}
    inicio = fin = None
    if fecha and hora:
        inicio = _leer_momento(ctx, fecha, hora)
        reglas = await ctx.almacen.reglas(ctx.restaurante.id)
        fin = inicio + timedelta(minutes=reglas.duracion_min)
    reserva = await ctx.almacen.crear_reserva(Reserva(
        restaurante_id=ctx.restaurante.id,
        nombre=(nombre or "Sin nombre").strip(),
        telefono=telefono,
        personas=int(personas or 0),
        inicio=inicio,
        fin=fin,
        estado=ESCALADA,
        canal=ctx.canal,
        motivo_escalada=motivo.strip(),
    ))
    ctx.creadas.append(reserva.id)
    return {
        "registrada": True,
        "estado": ESCALADA,
        "que_decir": "Listo, ya le pasé tu solicitud al equipo; te llaman al número "
                     f"que termina en {telefono[-4:]} en cuanto la revisen.",
    }


# ---------------------------------------------------------------------------
# Consultar, cancelar y cambiar reservas existentes
# Seguridad: solo se ven y tocan reservas del teléfono del cliente y con su nombre.
# ---------------------------------------------------------------------------

ACTIVAS = (CONFIRMADA, PENDIENTE, ESCALADA)


def _palabras(nombre: str) -> set[str]:
    sin_acentos = unicodedata.normalize("NFKD", nombre.lower())
    sin_acentos = "".join(c for c in sin_acentos if not unicodedata.combining(c))
    return {p for p in sin_acentos.replace(".", " ").split() if len(p) >= 3}


def nombre_coincide(dicho: str, registrado: str) -> bool:
    """'Miguel' coincide con 'Miguel Ángel Cruz'; 'Sara' no."""
    return bool(_palabras(dicho) & _palabras(registrado))


async def _reservas_del_cliente(ctx: Contexto, nombre: str, telefono: str) -> list[Reserva]:
    reglas = await ctx.almacen.reglas(ctx.restaurante.id)
    # Se incluyen las de hace un rato, mientras siga corriendo la tolerancia.
    desde = ctx.ahora() - timedelta(minutes=reglas.tolerancia_min)
    reservas = await ctx.almacen.reservas_de_telefono(ctx.restaurante.id, telefono, desde)
    return [r for r in reservas if r.estado in ACTIVAS and nombre_coincide(nombre, r.nombre)]


def _sin_datos(nombre: str, telefono: str) -> dict | None:
    # Falta un dato: todavía no se buscó nada, así que no hay que decir "no encontré".
    faltan = [d for d, v in (("nombre", nombre.strip()), ("teléfono a 10 dígitos", telefono))
              if not v]
    if faltan:
        return {"falta_dato": " y ".join(faltan),
                "siguiente_paso": f"Todavía no busques ni digas que no encontraste nada: pide "
                                  f"{' y '.join(faltan)} y vuelve a intentar."}
    return None


async def buscar_mis_reservas(ctx: Contexto, nombre: str, telefono: str = "") -> dict:
    telefono = normalizar_telefono(telefono or ctx.telefono)
    if falta := _sin_datos(nombre, telefono):
        return falta
    reservas = await _reservas_del_cliente(ctx, nombre, telefono)
    if not reservas:
        # No se dice si el teléfono existe: así nadie averigua reservas ajenas.
        return {"encontrada": False,
                "mensaje": "No encontré reservas próximas con ese nombre y teléfono."}
    como_decirlo = {CONFIRMADA: "confirmada", PENDIENTE: "por confirmar; el equipo te llama",
                    ESCALADA: "en revisión con el equipo"}
    return {"encontrada": True, "reservas": [{
        "reserva_id": r.id,
        "cuando": fecha_legible(r.inicio.astimezone(ctx.tz)),
        "personas": r.personas,
        "estado": como_decirlo.get(r.estado, r.estado),
    } for r in reservas], "nota": "No digas el reserva_id en voz alta."}


async def _reserva_verificada(
    ctx: Contexto, reserva_id: str, nombre: str, telefono: str
) -> tuple[Reserva | None, dict | None]:
    telefono = normalizar_telefono(telefono or ctx.telefono)
    if falta := _sin_datos(nombre, telefono):
        return None, falta
    reserva = await ctx.almacen.reserva(reserva_id)
    valida = (reserva and reserva.restaurante_id == ctx.restaurante.id
              and reserva.telefono == telefono and nombre_coincide(nombre, reserva.nombre)
              and reserva.estado in ACTIVAS and reserva.inicio)
    if not valida:
        return None, {"encontrada": False,
                      "siguiente_paso": "Usa buscar_mis_reservas con el nombre y teléfono."}
    if reserva.inicio <= ctx.ahora():
        return None, {"encontrada": True, "mensaje": "Esa reserva ya empezó; no se puede "
                      "modificar por teléfono.",
                      "siguiente_paso": "Ofrece pasar el caso al equipo."}
    return reserva, None


async def cancelar_reserva(
    ctx: Contexto, reserva_id: str, nombre: str, telefono: str = "",
    confirmado_por_cliente: bool = False,
) -> dict:
    reserva, problema = await _reserva_verificada(ctx, reserva_id, nombre, telefono)
    if problema:
        return problema
    cuando = fecha_legible(reserva.inicio.astimezone(ctx.tz))
    if not confirmado_por_cliente:
        return {"cancelada": False,
                "siguiente_paso": f"Pregunta: ¿confirmas que cancelo tu reserva del {cuando}? "
                                  "Si dice que sí, vuelve a usar cancelar_reserva con "
                                  "confirmado_por_cliente=true."}
    await ctx.almacen.cambiar_estado(reserva.id, CANCELADA)
    return {"cancelada": True,
            "que_decir": f"Listo, cancelé tu reserva del {cuando}. Gracias por avisarnos."}


async def cambiar_reserva(
    ctx: Contexto, reserva_id: str, nombre: str, fecha: str = "", hora: str = "",
    personas: int = 0, telefono: str = "", confirmado_por_cliente: bool = False,
) -> dict:
    reserva, problema = await _reserva_verificada(ctx, reserva_id, nombre, telefono)
    if problema:
        return problema
    actual = reserva.inicio.astimezone(ctx.tz)
    inicio = _leer_momento(ctx, fecha or actual.strftime("%Y-%m-%d"),
                           hora or actual.strftime("%H:%M"))
    personas = int(personas) or reserva.personas
    if inicio == reserva.inicio and personas == reserva.personas:
        return {"cambiada": False, "mensaje": "Es igual a la reserva que ya tiene."}

    revision = await _revisar(ctx, inicio, personas, excluir=reserva.id)
    if not revision.disponible:
        return {"cambiada": False, **_respuesta_revision(revision)}
    if not confirmado_por_cliente:
        return {"cambiada": False,
                "siguiente_paso": f"Sí hay lugar. Pregunta: ¿cambio tu reserva al "
                                  f"{fecha_legible(inicio)} para {personas} personas? Si dice "
                                  "que sí, vuelve a usar cambiar_reserva con "
                                  "confirmado_por_cliente=true."}

    reglas = await ctx.almacen.reglas(ctx.restaurante.id)
    faltas = await ctx.almacen.contar_faltas(ctx.restaurante.id, reserva.telefono)
    sigue_sola = (reserva.estado == CONFIRMADA and personas <= reglas.auto_aprobar_hasta
                  and faltas < reglas.max_faltas)
    estado = CONFIRMADA if sigue_sola else PENDIENTE
    cambios = {"inicio": inicio, "fin": inicio + timedelta(minutes=reglas.duracion_min),
               "personas": personas, "estado": estado}
    if estado == PENDIENTE:
        cambios["motivo_escalada"] = (f"Cambio pedido por el cliente; antes: "
                                      f"{fecha_legible(actual)}, {reserva.personas} personas.")
    await ctx.almacen.actualizar_reserva(reserva.id, cambios)
    if estado == CONFIRMADA:
        que_decir = (f"¡Listo! Cambié tu reserva al {fecha_legible(inicio)}, {personas} "
                     f"personas. Tienes {reglas.tolerancia_min} minutos de tolerancia.")
    else:
        que_decir = (f"Tu cambio al {fecha_legible(inicio)} quedó apartado. El equipo te llama "
                     f"para confirmar al número que termina en {reserva.telefono[-4:]}.")
    return {"cambiada": True, "estado": estado, "que_decir": que_decir}


# ---------------------------------------------------------------------------
# Definición para la IA (formato JSON Schema, sirve para OpenAI, Gemini y Pipecat)
# ---------------------------------------------------------------------------

_FECHA = {"type": "string", "description": "Fecha en formato AAAA-MM-DD"}
_HORA = {"type": "string", "description": "Hora de llegada en formato HH:MM de 24 horas"}
_PERSONAS = {"type": "integer", "description": "Número de personas"}

ESQUEMAS: list[dict[str, Any]] = [
    {
        "name": "buscar_horarios",
        "description": "Busca los horarios libres para cierto número de personas. Úsala cuando "
                       "no dan una hora exacta: '¿hay lugar el sábado?', '¿qué es lo más pronto?', "
                       "'¿todavía alcanzo hoy?'. Sin fecha busca desde ahora.",
        "parameters": {
            "type": "object",
            "properties": {
                "personas": _PERSONAS,
                "fecha": {"type": "string",
                          "description": "Fecha AAAA-MM-DD. Omítela para buscar lo más pronto."},
                "desde_hora": {"type": "string",
                               "description": "HH:MM; solo si piden 'después de cierta hora'."},
            },
            "required": ["personas"],
        },
    },
    {
        "name": "ver_disponibilidad",
        "description": "Revisa si hay lugar para cierta fecha, hora y número de personas. "
                       "Úsala siempre antes de ofrecer o confirmar un horario.",
        "parameters": {
            "type": "object",
            "properties": {"fecha": _FECHA, "hora": _HORA, "personas": _PERSONAS},
            "required": ["fecha", "hora", "personas"],
        },
    },
    {
        "name": "crear_reserva",
        "description": "Registra la reserva cuando el cliente ya confirmó fecha, hora, personas "
                       "y nombre. Vuelve a revisar el cupo antes de guardarla.",
        "parameters": {
            "type": "object",
            "properties": {
                "nombre": {"type": "string", "description": "Nombre de quien reserva"},
                "personas": _PERSONAS,
                "fecha": _FECHA,
                "hora": _HORA,
                "telefono": {"type": "string",
                             "description": "Teléfono a 10 dígitos. Omítelo si ya se conoce."},
                "notas": {"type": "string",
                          "description": "Peticiones especiales: silla para bebé, cumpleaños..."},
                "confirmado_por_cliente": {
                    "type": "boolean",
                    "description": "true solo si ya le repetiste TODOS los datos al cliente y "
                                   "dijo que sí."},
            },
            "required": ["nombre", "personas", "fecha", "hora", "confirmado_por_cliente"],
        },
    },
    {
        "name": "escalar_a_humano",
        "description": "Pasa el caso al equipo cuando no puedes resolverlo: grupos grandes, "
                       "eventos, quejas, cancelaciones o cambios, o si el cliente pide hablar "
                       "con una persona.",
        "parameters": {
            "type": "object",
            "properties": {
                "motivo": {"type": "string", "description": "Qué necesita el cliente, en una frase"},
                "nombre": {"type": "string"},
                "telefono": {"type": "string"},
                "personas": _PERSONAS,
                "fecha": _FECHA,
                "hora": _HORA,
            },
            "required": ["motivo"],
        },
    },
    {
        "name": "buscar_mis_reservas",
        "description": "Busca las reservas próximas del cliente para consultarlas, "
                       "cancelarlas o cambiarlas. Necesita el nombre con el que reservó.",
        "parameters": {
            "type": "object",
            "properties": {
                "nombre": {"type": "string", "description": "Nombre con el que reservó"},
                "telefono": {"type": "string",
                             "description": "Teléfono a 10 dígitos. Omítelo si ya se conoce."},
            },
            "required": ["nombre"],
        },
    },
    {
        "name": "cancelar_reserva",
        "description": "Cancela una reserva encontrada con buscar_mis_reservas. Antes pregunta "
                       "si confirma la cancelación.",
        "parameters": {
            "type": "object",
            "properties": {
                "reserva_id": {"type": "string", "description": "El reserva_id que devolvió "
                                                                "buscar_mis_reservas"},
                "nombre": {"type": "string"},
                "telefono": {"type": "string"},
                "confirmado_por_cliente": {"type": "boolean",
                                           "description": "true solo si el cliente ya dijo que "
                                                          "sí a cancelar."},
            },
            "required": ["reserva_id", "nombre", "confirmado_por_cliente"],
        },
    },
    {
        "name": "cambiar_reserva",
        "description": "Cambia día, hora o personas de una reserva encontrada con "
                       "buscar_mis_reservas. Revisa que haya lugar. Manda solo lo que cambia.",
        "parameters": {
            "type": "object",
            "properties": {
                "reserva_id": {"type": "string"},
                "nombre": {"type": "string"},
                "fecha": _FECHA,
                "hora": _HORA,
                "personas": _PERSONAS,
                "telefono": {"type": "string"},
                "confirmado_por_cliente": {"type": "boolean",
                                           "description": "true solo si el cliente ya dijo que "
                                                          "sí al cambio."},
            },
            "required": ["reserva_id", "nombre", "confirmado_por_cliente"],
        },
    },
]

ACCIONES: dict[str, Callable[..., Any]] = {
    "buscar_mis_reservas": buscar_mis_reservas,
    "cancelar_reserva": cancelar_reserva,
    "cambiar_reserva": cambiar_reserva,
    "buscar_horarios": buscar_horarios,
    "ver_disponibilidad": ver_disponibilidad,
    "crear_reserva": crear_reserva,
    "escalar_a_humano": escalar_a_humano,
}


async def ejecutar(ctx: Contexto, nombre: str, argumentos: dict[str, Any]) -> dict:
    """Ejecuta una acción. Los errores se devuelven como texto para que la IA los explique."""
    accion = ACCIONES.get(nombre)
    if not accion:
        return {"error": f"No existe la acción {nombre}."}
    try:
        return await accion(ctx, **argumentos)
    except (ValueError, TypeError) as error:
        return {"error": str(error)}
