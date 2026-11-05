"""Datos con los que trabaja el agente: restaurante, reglas y reservas."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime

# Estados de una reserva. "pendiente" y "escalada" esperan a una persona del equipo.
PENDIENTE = "pendiente"  # cumple las reglas; solo falta que alguien la apruebe
ESCALADA = "escalada"  # necesita criterio humano (grupo grande, queja, petición especial)
CONFIRMADA = "confirmada"
RECHAZADA = "rechazada"
CANCELADA = "cancelada"
LLEGO = "llego"  # el equipo marca que el cliente ya está en su mesa
NO_LLEGO = "no_llego"  # pasó la tolerancia y no llegó: la mesa se libera

# Estas reservas ocupan lugar: así nunca se promete la misma mesa dos veces.
ESTADOS_QUE_OCUPAN = (PENDIENTE, ESCALADA, CONFIRMADA, LLEGO)

DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]


@dataclass
class Reglas:
    """Reglas de la casa. El equipo las cambia desde el panel."""

    # Horario por día de la semana (0 = lunes ... 6 = domingo): lista de turnos [abre, cierra].
    horario: dict[int, list[tuple[str, str]]]
    duracion_min: int = 90  # cuánto dura una mesa ocupada
    intervalo_min: int = 30  # cada cuánto se ofrecen horarios (13:00, 13:30...)
    cupo_personas: int = 60  # personas que pueden tener reserva al mismo tiempo
    max_personas: int = 8  # más que esto es "grupo grande": lo decide una persona
    anticipacion_min: int = 60  # minutos mínimos entre ahora y la reserva
    dias_max_adelanto: int = 30
    # Reservas de hasta este número de personas se confirman en la misma llamada.
    # 0 = todo espera a que el equipo apruebe (modo supervisado).
    auto_aprobar_hasta: int = 8
    minutos_alerta: int = 10  # el panel marca en rojo si nadie aprueba en este tiempo
    tolerancia_min: int = 15  # minutos de espera; después el equipo puede marcar "no llegó"
    max_faltas: int = 2  # con estas inasistencias, la reserva ya no se confirma sola


@dataclass
class Restaurante:
    id: str
    nombre: str
    zona_horaria: str = "America/Mexico_City"
    direccion: str = ""
    telefono_agente: str = ""  # número de Twilio al que se desvían las llamadas
    whatsapp_phone_number_id: str = ""  # identificador del número en WhatsApp Cloud API
    info: str = ""  # menú, estacionamiento, FAQs... texto libre que el agente puede citar


@dataclass
class Reserva:
    restaurante_id: str
    nombre: str
    telefono: str
    personas: int
    inicio: datetime | None  # vacío solo en casos escalados que no son de una fecha concreta
    fin: datetime | None
    estado: str = PENDIENTE
    canal: str = "llamada"
    notas: str = ""
    motivo_escalada: str = ""
    id: str = ""
    creado_en: datetime | None = None
    extra: dict = field(default_factory=dict)
