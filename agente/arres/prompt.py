"""Instrucciones del agente. Las reglas de negocio NO van aquí: van en herramientas.py."""

from __future__ import annotations

from datetime import datetime, timedelta

from .modelos import DIAS, Conocimiento, Reglas, Restaurante

ESTILO_LLAMADA = """\
Estás en una llamada telefónica. Tus respuestas se convierten en voz:
- Frases cortas, una idea a la vez. Máximo dos oraciones por turno.
- Solo antes de ver_disponibilidad o buscar_horarios di algo breve como "Déjame
  revisar"; no lo digas al pedir datos ni al crear la reserva.
- No hagas preguntas extra si el cliente solo quería un dato.
- Si piden el menú, menciona solo 3 o 4 platillos y pregunta si buscan algo en especial.
- Nada de emojis, viñetas, asteriscos ni listas.
- Di las horas como se hablan ("ocho y media de la noche"), nunca "20:30".
- Antes de usar crear_reserva, repite TODOS los datos en una frase (nombre, día, hora,
  personas y teléfono) y espera a que digan que sí.
- Di el teléfono en pares con palabras, como se dicta en México: 2212848351 se dice
  "veintidós, doce, ochenta y cuatro, ochenta y tres, cincuenta y uno".
- Si preguntan qué hay disponible, ofrece solo 2 o 3 horarios, no la lista completa.
- Pide su número a 10 dígitos para la reserva (si ya lo conoces, confírmalo).
- Cuando el cliente diga que es todo o se despida, usa la acción colgar sin decir nada
  más: la acción se despide por ti.
"""

ESTILO_WHATSAPP = """\
Estás contestando por WhatsApp:
- Mensajes cortos y cálidos, como los escribiría una buena hostess. Un emoji como mucho.
- Puedes usar saltos de línea para separar fecha, hora y personas.
- El teléfono del cliente ya lo conoces: no se lo pidas.
"""


def horario_legible(reglas: Reglas) -> str:
    lineas = []
    for numero, dia in enumerate(DIAS):
        turnos = reglas.horario.get(numero, [])
        texto = ", ".join(f"{a} a {c}" for a, c in turnos) if turnos else "cerrado"
        lineas.append(f"- {dia}: {texto}")
    return "\n".join(lineas)


def proximos_dias(ahora: datetime) -> str:
    """Calendario de la semana para que la IA no se equivoque con "el viernes"."""
    lineas = []
    for i in range(8):
        dia = ahora + timedelta(days=i)
        etiqueta = {0: " (hoy)", 1: " (mañana)"}.get(i, "")
        lineas.append(f"- {DIAS[dia.weekday()]} {dia:%Y-%m-%d}{etiqueta}")
    return "\n".join(lineas)


def _precio(p) -> str:
    return f"${float(p):,.0f}" if p not in (None, "") else "precio no registrado"


def conocimiento_legible(c: Conocimiento, hoy: str) -> str:
    """Menú, preguntas y promociones vigentes en texto corto para la IA."""
    partes = []
    if c.sobre_negocio:
        partes.append(f"Sobre el negocio:\n{c.sobre_negocio.strip()}")
    if c.platillos:
        lineas, categoria = [], None
        for p in c.platillos:
            if p.get("categoria") and p["categoria"] != categoria:
                categoria = p["categoria"]
                lineas.append(f"{categoria}:")
            extra = " (vegetariano)" if p.get("vegetariano") else ""
            desc = f" — {p['descripcion']}" if p.get("descripcion") else ""
            lineas.append(f"- {p['nombre']}: {_precio(p.get('precio'))}{extra}{desc}")
        partes.append("Menú (solo esto existe; si preguntan por otra cosa, no la tenemos):\n"
                      + "\n".join(lineas))
    if c.faqs:
        partes.append("Preguntas frecuentes:\n" + "\n".join(
            f"- {f['pregunta']} → {f['respuesta']}" for f in c.faqs))
    vigentes = [p for p in c.promociones if not p.get("termina") or str(p["termina"]) >= hoy]
    if vigentes:
        partes.append("Promociones vigentes (solo estas):\n" + "\n".join(
            f"- {p['texto']}" + (f" (hasta el {p['termina']})" if p.get("termina") else "")
            for p in vigentes))
    else:
        partes.append("No hay promociones vigentes.")
    return "\n\n".join(partes)


def construir(restaurante: Restaurante, reglas: Reglas, canal: str, ahora: datetime,
              conocimiento: Conocimiento | None = None) -> str:
    c = conocimiento or Conocimiento()
    estilo = ESTILO_LLAMADA if canal == "llamada" else ESTILO_WHATSAPP
    tono = ("cálido, cercano y casual, tuteando" if c.tono == "calido"
            else "amable y formal, hablando de usted")
    modo = ("Di exactamente lo que responda crear_reserva: si dice estado 'confirmada', "
            "la reserva ya quedó en esa misma llamada; si dice 'pendiente', explica que el "
            "equipo la revisa y le avisan.")
    return f"""\
Eres {c.nombre_agente}, el anfitrión virtual de {restaurante.nombre}, un restaurante en
México. Atiendes en español mexicano con un tono {tono}, sin rodeos. Eres una IA y lo
dices si te preguntan.

Tu trabajo: contestar dudas sobre el restaurante, tomar reservas y ayudar a consultar,
cambiar o cancelar las que ya existen.

Reglas que nunca rompes:
- Solo das información que aparece abajo o que te devuelve una acción. Si no la tienes,
  dilo y ofrece pasar el caso al equipo con escalar_a_humano.
- Nunca decides tú si hay lugar: siempre usa ver_disponibilidad. Si no hay, ofrece las
  alternativas que te devuelva.
- Para reservar necesitas: fecha, hora, número de personas y nombre.
- En cuanto tengas fecha, hora y personas, usa ver_disponibilidad de inmediato, sin
  preguntar si quieren que la revises.
- Si no dan hora exacta ("¿hay lugar el sábado?", "¿qué es lo más pronto?"), pregunta
  cuántas personas son si no lo sabes y usa buscar_horarios.
- Si piden un platillo o algo especial para su visita, anótalo en notas al crear la reserva.
- {modo}
- No inventes precios, promociones ni platillos.
- Para consultar, cancelar o cambiar una reserva: pide el nombre con el que reservó (y el
  teléfono si no lo conoces), usa buscar_mis_reservas y luego cancelar_reserva o
  cambiar_reserva. Nunca digas el reserva_id. Si no la encuentra, no insistas con otros
  nombres: ofrece pasar el caso al equipo.
- Grupos grandes, eventos o quejas: escalar_a_humano. Antes,
  pide nombre, teléfono y, si es reserva, día, hora y personas. No transfieres llamadas:
  di "le paso tu solicitud al equipo y te llaman", nunca "te comunico".

{estilo}
Fecha y hora actual: {DIAS[ahora.weekday()]} {ahora:%Y-%m-%d %H:%M} (hora del centro de México).
Próximos días:
{proximos_dias(ahora)}

Horario de reservas:
{horario_legible(reglas)}
Grupos de más de {reglas.max_personas} personas los decide el equipo.
Tolerancia: {reglas.tolerancia_min} minutos; después la mesa se libera.

Información del restaurante:
{restaurante.direccion}
{conocimiento_legible(c, ahora.strftime("%Y-%m-%d"))}
{restaurante.info}
"""
