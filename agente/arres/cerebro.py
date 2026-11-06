"""El agente para texto (WhatsApp y el chat de prueba).

La voz usa el mismo prompt y las mismas acciones, pero dentro de Pipecat (voz/bot.py).
"""

from __future__ import annotations

import json
import logging

from openai import AsyncOpenAI

from . import config, herramientas, prompt
from .herramientas import Contexto

log = logging.getLogger("arres.cerebro")

MAX_RONDAS = 5  # máximo de acciones seguidas antes de contestar
HISTORIAL = 20  # mensajes previos que se le muestran a la IA

HERRAMIENTAS_OPENAI = [{"type": "function", "function": e} for e in herramientas.ESQUEMAS]


def cliente_llm() -> tuple[AsyncOpenAI, str]:
    datos = config.llm()
    if not datos["api_key"]:
        raise RuntimeError("Falta la llave de la IA (GEMINI_API_KEY u OPENAI_API_KEY en .env)")
    return AsyncOpenAI(api_key=datos["api_key"], base_url=datos["base_url"]), datos["modelo"]


async def responder(ctx: Contexto, texto: str, cliente=None, modelo: str | None = None) -> str:
    """Contesta un mensaje del cliente y guarda la conversación."""
    if cliente is None:
        cliente, modelo = cliente_llm()

    almacen, restaurante = ctx.almacen, ctx.restaurante
    previos = await almacen.mensajes(restaurante.id, ctx.telefono, ctx.canal, HISTORIAL)
    await almacen.guardar_mensaje(restaurante.id, ctx.telefono, ctx.canal, "cliente", texto)

    reglas = await almacen.reglas(restaurante.id)
    conocimiento = await almacen.conocimiento(restaurante.id)
    instrucciones = prompt.construir(restaurante, reglas, ctx.canal, ctx.ahora(), conocimiento)
    mensajes: list[dict] = [{"role": "system", "content": instrucciones}]
    for m in previos:
        rol = {"cliente": "user", "agente": "assistant"}.get(m["rol"])
        if rol:
            mensajes.append({"role": rol, "content": m["texto"]})
    mensajes.append({"role": "user", "content": texto})

    respuesta = "Perdón, tuve un problema. ¿Me lo repites, por favor?"
    for _ in range(MAX_RONDAS):
        completado = await cliente.chat.completions.create(
            model=modelo, messages=mensajes, tools=HERRAMIENTAS_OPENAI
        )
        mensaje = completado.choices[0].message
        llamadas = mensaje.tool_calls or []
        if not llamadas:
            respuesta = (mensaje.content or "").strip() or respuesta
            break
        mensajes.append({
            "role": "assistant",
            "content": mensaje.content or "",
            "tool_calls": [
                {"id": l.id, "type": "function",
                 "function": {"name": l.function.name, "arguments": l.function.arguments}}
                for l in llamadas
            ],
        })
        for llamada in llamadas:
            try:
                argumentos = json.loads(llamada.function.arguments or "{}")
            except json.JSONDecodeError:
                argumentos = {}
            resultado = await herramientas.ejecutar(ctx, llamada.function.name, argumentos)
            log.info("acción %s %s -> %s", llamada.function.name, argumentos, resultado)
            mensajes.append({
                "role": "tool",
                "tool_call_id": llamada.id,
                "content": json.dumps(resultado, ensure_ascii=False),
            })

    await almacen.guardar_mensaje(restaurante.id, ctx.telefono, ctx.canal, "agente", respuesta)
    return respuesta
