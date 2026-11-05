"""Cálculo de disponibilidad.

La IA nunca decide si hay lugar: solo pregunta aquí. Este código revisa las reglas
de la casa y las reservas que ya existen, y siempre da la misma respuesta para la
misma pregunta. Eso evita que el agente invente o se contradiga.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from .modelos import ESTADOS_QUE_OCUPAN, Reglas, Reserva

MAX_ALTERNATIVAS = 3


@dataclass
class Revision:
    disponible: bool
    motivo: str  # ok, grupo_grande, muy_pronto, muy_lejos, cerrado, fuera_de_horario, sin_cupo
    mensaje: str  # explicación corta para el agente
    alternativas: list[datetime] = field(default_factory=list)


def _hora(texto: str) -> time:
    horas, minutos = texto.split(":")
    return time(int(horas), int(minutos))


def turnos_del_dia(reglas: Reglas, dia: date, tz: ZoneInfo) -> list[tuple[datetime, datetime]]:
    """Turnos de ese día como fechas completas. Un cierre a las 00:00 o antes de abrir
    se interpreta como cierre después de medianoche."""
    turnos = []
    for abre, cierra in reglas.horario.get(dia.weekday(), []):
        inicio = datetime.combine(dia, _hora(abre), tz)
        fin = datetime.combine(dia, _hora(cierra), tz)
        if fin <= inicio:
            fin += timedelta(days=1)
        turnos.append((inicio, fin))
    return turnos


def horarios_del_dia(reglas: Reglas, dia: date, tz: ZoneInfo) -> list[datetime]:
    """Todas las horas de llegada posibles ese día (la mesa debe liberarse antes del cierre)."""
    paso = timedelta(minutes=reglas.intervalo_min)
    duracion = timedelta(minutes=reglas.duracion_min)
    horarios = []
    for abre, cierra in turnos_del_dia(reglas, dia, tz):
        actual = abre
        while actual + duracion <= cierra:
            horarios.append(actual)
            actual += paso
    return horarios


def ocupacion_maxima(reservas: list[Reserva], inicio: datetime, fin: datetime) -> int:
    """Máximo de personas con reserva al mismo tiempo dentro de [inicio, fin)."""
    activas = [
        r for r in reservas if r.estado in ESTADOS_QUE_OCUPAN and r.inicio < fin and r.fin > inicio
    ]
    # La ocupación solo sube cuando llega una reserva, así que basta revisar esos momentos.
    momentos = {inicio} | {r.inicio for r in activas if r.inicio > inicio}
    return max(
        (sum(r.personas for r in activas if r.inicio <= m < r.fin) for m in momentos), default=0
    )


def _revisar_sin_alternativas(
    reglas: Reglas, reservas: list[Reserva], inicio: datetime, personas: int, ahora: datetime
) -> Revision:
    tz = inicio.tzinfo
    if personas < 1:
        return Revision(False, "personas_invalidas", "El número de personas debe ser al menos 1.")
    if personas > reglas.max_personas:
        return Revision(
            False,
            "grupo_grande",
            f"Grupos de más de {reglas.max_personas} personas los revisa el equipo en persona.",
        )
    if inicio < ahora + timedelta(minutes=reglas.anticipacion_min):
        return Revision(
            False,
            "muy_pronto",
            f"Las reservas se hacen con al menos {reglas.anticipacion_min} minutos de anticipación.",
        )
    if inicio.date() > (ahora.astimezone(tz) + timedelta(days=reglas.dias_max_adelanto)).date():
        return Revision(
            False,
            "muy_lejos",
            f"Solo se reserva con hasta {reglas.dias_max_adelanto} días de anticipación.",
        )
    # Un turno que cruza la medianoche pertenece al día en que abrió.
    dias = (inicio.date(), inicio.date() - timedelta(days=1))
    medianoche = datetime.combine(inicio.date(), time(0), tz)
    abre_ese_dia = turnos_del_dia(reglas, dias[0], tz) or [
        t for t in turnos_del_dia(reglas, dias[1], tz) if t[1] > medianoche
    ]
    if not abre_ese_dia:
        return Revision(False, "cerrado", "Ese día el restaurante no abre.")
    if not any(inicio in horarios_del_dia(reglas, d, tz) for d in dias):
        return Revision(
            False, "fuera_de_horario", "A esa hora no se reciben reservas (fuera de horario)."
        )
    fin = inicio + timedelta(minutes=reglas.duracion_min)
    ocupadas = ocupacion_maxima(reservas, inicio, fin)
    if ocupadas + personas > reglas.cupo_personas:
        return Revision(False, "sin_cupo", "A esa hora ya no hay lugar.")
    return Revision(True, "ok", "Hay lugar.")


def horarios_libres(
    reglas: Reglas, reservas: list[Reserva], dia: date, tz, personas: int, ahora: datetime
) -> list[datetime]:
    """Horas de llegada con lugar para `personas` ese día."""
    return [
        h for h in horarios_del_dia(reglas, dia, tz)
        if _revisar_sin_alternativas(reglas, reservas, h, personas, ahora).disponible
    ]


def revisar(
    reglas: Reglas,
    reservas: list[Reserva],
    inicio: datetime,
    personas: int,
    ahora: datetime,
) -> Revision:
    """¿Hay lugar para `personas` a la hora `inicio`? Si no, propone hasta 3 horarios cercanos."""
    revision = _revisar_sin_alternativas(reglas, reservas, inicio, personas, ahora)
    if revision.disponible or revision.motivo in ("personas_invalidas", "grupo_grande"):
        return revision

    tz = inicio.tzinfo
    candidatos = horarios_del_dia(reglas, inicio.date(), tz)
    # Si ese día no hay nada, se buscan los siguientes días.
    dia = inicio.date()
    for _ in range(7):
        candidatos.sort(key=lambda h: abs(h - inicio))
        for horario in candidatos:
            if horario == inicio:
                continue
            if _revisar_sin_alternativas(reglas, reservas, horario, personas, ahora).disponible:
                revision.alternativas.append(horario)
                if len(revision.alternativas) == MAX_ALTERNATIVAS:
                    break
        if revision.alternativas:
            break
        dia += timedelta(days=1)
        candidatos = horarios_del_dia(reglas, dia, tz)
    revision.alternativas.sort()
    return revision
