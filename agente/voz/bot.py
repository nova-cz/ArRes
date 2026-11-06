"""Agente de voz de ArRES (Pipecat).

Oído: Deepgram · Cerebro: Gemini u OpenAI · Voz: Deepgram (gratis con su crédito) o Cartesia.
Usa las mismas acciones y reglas que WhatsApp (paquete `arres`).

Correr en local (desde la carpeta agente/):
    python voz/bot.py                      → abre http://localhost:7860/client y habla
    python voz/bot.py -t twilio -x TU_DOMINIO_NGROK   → contesta llamadas de Twilio
"""

from __future__ import annotations

import asyncio
import sys
import time
from pathlib import Path

import httpx
from loguru import logger

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))  # para importar `arres`

from pipecat.adapters.llm.schemas.function_schema import FunctionSchema  # noqa: E402
from pipecat.adapters.llm.schemas.tools_schema import ToolsSchema  # noqa: E402
from pipecat.audio.turn.smart_turn.base_smart_turn import SmartTurnParams  # noqa: E402
from pipecat.audio.turn.smart_turn.local_smart_turn_v3 import (  # noqa: E402
    LocalSmartTurnAnalyzerV3,
)
from pipecat.audio.vad.silero import SileroVADAnalyzer  # noqa: E402
from pipecat.frames.frames import (  # noqa: E402
    EndWorkerFrame,
    FunctionCallResultProperties,
    LLMRunFrame,
    TTSSpeakFrame,
)
from pipecat.pipeline.pipeline import Pipeline  # noqa: E402
from pipecat.pipeline.worker import PipelineParams, PipelineWorker  # noqa: E402
from pipecat.processors.aggregators.llm_context import LLMContext  # noqa: E402
from pipecat.processors.aggregators.llm_response_universal import (  # noqa: E402
    LLMContextAggregatorPair,
    LLMUserAggregatorParams,
)
from pipecat.runner.types import RunnerArguments  # noqa: E402
from pipecat.runner.utils import create_transport  # noqa: E402
from pipecat.services.cartesia.tts import CartesiaTTSService  # noqa: E402
from pipecat.services.deepgram.stt import DeepgramSTTService  # noqa: E402
from pipecat.services.deepgram.tts import DeepgramTTSService  # noqa: E402
from pipecat.services.llm_service import FunctionCallParams  # noqa: E402
from pipecat.services.openai.llm import OpenAILLMService  # noqa: E402
from pipecat.transcriptions.language import Language  # noqa: E402
from pipecat.transports.base_transport import BaseTransport, TransportParams  # noqa: E402
from pipecat.transports.websocket.fastapi import FastAPIWebsocketParams  # noqa: E402
from pipecat.turns.user_stop.turn_analyzer_user_turn_stop_strategy import (  # noqa: E402
    TurnAnalyzerUserTurnStopStrategy,
)
from pipecat.turns.user_turn_strategies import UserTurnStrategies  # noqa: E402
from pipecat.workers.runner import WorkerRunner  # noqa: E402

from arres import config, herramientas, prompt, prueba  # noqa: E402
from arres.herramientas import Contexto  # noqa: E402
from arres.textos import normalizar_telefono  # noqa: E402

DESPEDIDA = "Con gusto. Gracias por llamar a {nombre}, ¡que tengas excelente día!"

# Aviso obligatorio al inicio (LFPDPPP): es una IA y la llamada se graba.
# Si el equipo escribe un saludo propio, este aviso se le agrega siempre al final.
AVISO = "Soy {agente}, asistente virtual con inteligencia artificial; esta llamada se graba."
SALUDO = ("Hola, gracias por llamar a {nombre}. Soy su asistente virtual con inteligencia "
          "artificial; esta llamada se graba para gestionar tu reserva. ¿En qué te ayudo?")

async def numeros_twilio(call_sid: str | None) -> tuple[str, str]:
    """Twilio no manda los números en el stream; se piden a su API. Devuelve (de, a)."""
    sid, token = config.env("TWILIO_ACCOUNT_SID"), config.env("TWILIO_AUTH_TOKEN")
    if not (call_sid and sid and token):
        return "", ""
    url = f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Calls/{call_sid}.json"
    try:
        async with httpx.AsyncClient(timeout=5, auth=(sid, token)) as http:
            datos = (await http.get(url)).raise_for_status().json()
        return datos.get("from", ""), datos.get("to", "")
    except httpx.HTTPError as error:
        logger.error(f"No se pudieron leer los números de la llamada: {error}")
        return "", ""


def servicio_llm(instrucciones: str):
    """Gemini usa el servicio nativo de Pipecat; OpenAI (o compatibles) el de OpenAI."""
    datos = config.llm()
    if datos["proveedor"] == "gemini":
        from pipecat.services.google.llm import GoogleLLMService

        return GoogleLLMService(
            api_key=datos["api_key"],
            settings=GoogleLLMService.Settings(
                model=datos["modelo"], system_instruction=instrucciones
            ),
        )
    return OpenAILLMService(
        api_key=datos["api_key"],
        base_url=datos["base_url"],
        settings=OpenAILLMService.Settings(model=datos["modelo"], system_instruction=instrucciones),
    )


def servicio_voz(voz: str = ""):
    """Deepgram (por defecto): usa la misma llave y crédito gratis que el oído.
    Cartesia: voz más natural, pero su plan gratis se acaba rápido."""
    if config.env("VOZ_PROVEEDOR", "deepgram") == "cartesia":
        return CartesiaTTSService(
            api_key=config.env("CARTESIA_API_KEY"),
            settings=CartesiaTTSService.Settings(
                voice=config.env("CARTESIA_VOICE_ID"), language=Language.ES
            ),
        )
    return DeepgramTTSService(
        api_key=config.env("DEEPGRAM_API_KEY"),
        settings=DeepgramTTSService.Settings(
            voice=voz or config.env("DEEPGRAM_VOZ", "aura-2-celeste-es")
        ),
    )


async def run_bot(
    transport: BaseTransport, runner_args: RunnerArguments, ctx: Contexto, es_telefono: bool
) -> None:
    reglas = await ctx.almacen.reglas(ctx.restaurante.id)
    conocimiento = await ctx.almacen.conocimiento(ctx.restaurante.id)
    instrucciones = prompt.construir(ctx.restaurante, reglas, "llamada", ctx.ahora(), conocimiento)
    if conocimiento.saludo.strip():
        saludo = f"{conocimiento.saludo.strip()} " + AVISO.format(agente=conocimiento.nombre_agente)
    else:
        saludo = SALUDO.format(nombre=ctx.restaurante.nombre)
    if ctx.telefono:
        instrucciones += f"\nNúmero de quien llama: {ctx.telefono} (termina en {ctx.telefono[-4:]})."

    stt = DeepgramSTTService(
        api_key=config.env("DEEPGRAM_API_KEY"),
        settings=DeepgramSTTService.Settings(model="nova-3", language=Language.ES),
    )
    tts = servicio_voz(conocimiento.voz)
    llm = servicio_llm(instrucciones)

    async def accion(params: FunctionCallParams) -> None:
        resultado = await herramientas.ejecutar(ctx, params.function_name, dict(params.arguments))
        logger.info(f"acción {params.function_name} {dict(params.arguments)} -> {resultado}")
        await params.result_callback(resultado)

    async def colgar(params: FunctionCallParams) -> None:
        await params.result_callback(
            {"ok": True}, properties=FunctionCallResultProperties(run_llm=False)
        )
        # La despedida la dice el código (la IA a veces colgaba sin decir nada).
        await params.llm.push_frame(TTSSpeakFrame(DESPEDIDA.format(nombre=ctx.restaurante.nombre)))
        # Va detrás de la despedida en la fila, así que primero se escucha el "hasta luego".
        await params.llm.push_frame(EndWorkerFrame(reason="El cliente terminó"))

    esquemas = [
        FunctionSchema(
            name=e["name"],
            description=e["description"],
            properties=e["parameters"]["properties"],
            required=e["parameters"]["required"],
            handler=accion,
        )
        for e in herramientas.ESQUEMAS
    ]
    esquemas.append(FunctionSchema(
        name="colgar",
        description="Se despide y termina la llamada. Úsala cuando el cliente ya no "
        "necesite nada.",
        properties={},
        required=[],
        handler=colgar,
    ))
    context = LLMContext(tools=ToolsSchema(standard_tools=esquemas))
    # Si el detector cree que la frase quedó a medias, espera como máximo ESPERA_TURNO
    # segundos de silencio (Pipecat trae 3 s, que se siente lento al teléfono).
    detector = LocalSmartTurnAnalyzerV3(
        params=SmartTurnParams(stop_secs=float(config.env("ESPERA_TURNO", "1.5")))
    )
    user_aggregator, assistant_aggregator = LLMContextAggregatorPair(
        context,
        user_params=LLMUserAggregatorParams(
            vad_analyzer=SileroVADAnalyzer(),
            user_turn_strategies=UserTurnStrategies(
                stop=[TurnAnalyzerUserTurnStopStrategy(turn_analyzer=detector)]
            ),
        ),
    )

    pipeline = Pipeline([
        transport.input(),
        stt,
        user_aggregator,
        llm,
        tts,
        transport.output(),
        assistant_aggregator,
    ])
    params = PipelineParams(enable_metrics=True, enable_usage_metrics=True)
    if es_telefono:  # la red telefónica usa audio de 8 kHz
        params.audio_in_sample_rate = 8000
        params.audio_out_sample_rate = 8000
    worker = PipelineWorker(pipeline, params=params)
    runner = WorkerRunner(handle_sigint=runner_args.handle_sigint)
    await runner.add_workers(worker)

    # Gemini gratis a veces responde 503 (saturado) o 429 (límite por minuto). En vez de
    # quedarse callado, se reintenta y, si sigue fallando, se le avisa al cliente.
    fallas = {"cuenta": 0, "ultima": 0.0}

    @worker.event_handler("on_pipeline_error")
    async def on_pipeline_error(worker, frame):
        texto = str(frame.error)
        if frame.processor is not llm or not any(
            c in texto for c in ("503", "429", "UNAVAILABLE", "RESOURCE_EXHAUSTED")
        ):
            return
        if time.monotonic() - fallas["ultima"] > 30:
            fallas["cuenta"] = 0
        fallas["cuenta"] += 1
        fallas["ultima"] = time.monotonic()
        if fallas["cuenta"] <= 2:
            logger.warning(f"La IA no respondió ({texto[:40]}…); reintento {fallas['cuenta']}")
            await asyncio.sleep(2 * fallas["cuenta"])
            await worker.queue_frames([LLMRunFrame()])
        else:
            await worker.queue_frames([TTSSpeakFrame(
                "Perdón, tengo problemas de conexión. ¿Me lo repites en un momento?"
            )])

    @transport.event_handler("on_client_connected")
    async def on_client_connected(transport, client):
        # El saludo entra solo al historial al decirse (no se agrega a mano: quedaba doble).
        await worker.queue_frames([TTSSpeakFrame(saludo)])

    @transport.event_handler("on_client_disconnected")
    async def on_client_disconnected(transport, client):
        await guardar_transcripcion(ctx, context)
        await runner.cancel()

    await runner.run()


async def guardar_transcripcion(ctx: Contexto, context: LLMContext) -> None:
    """Deja la conversación en `mensajes` para que el equipo vea qué se dijo."""
    roles = {"user": "cliente", "assistant": "agente"}
    try:
        for m in context.get_messages():
            rol, texto = roles.get(m.get("role")), m.get("content")
            if rol and isinstance(texto, str) and texto.strip():
                await ctx.almacen.guardar_mensaje(
                    ctx.restaurante.id, ctx.telefono or "desconocido", "llamada", rol, texto
                )
    except Exception:
        logger.exception("No se pudo guardar la transcripción")


async def bot(runner_args: RunnerArguments):
    """Punto de entrada que llama el runner de Pipecat en cada llamada."""
    transport = await create_transport(runner_args, {
        "webrtc": lambda: TransportParams(audio_in_enabled=True, audio_out_enabled=True),
        "twilio": lambda: FastAPIWebsocketParams(audio_in_enabled=True, audio_out_enabled=True),
    })

    almacen = config.almacen()
    telefono, restaurante = "", None
    call_data = getattr(runner_args, "call_data", None)
    if call_data:  # llamada real por Twilio: el número marcado dice de qué restaurante es
        de, a = await numeros_twilio(call_data.call_id)
        telefono = normalizar_telefono(de)
        restaurante = await almacen.restaurante_por_telefono_agente(a) if a else None
    if not restaurante:  # navegador (prueba del panel) o número sin registrar
        restaurante_id = prueba.restaurante_prueba.get() or config.env("RESTAURANTE_ID")
        restaurante = (await almacen.restaurante(restaurante_id) if restaurante_id
                       else await almacen.restaurante_por_defecto())

    ctx = Contexto(almacen, restaurante, "llamada", telefono)
    origen = telefono or ("número oculto" if call_data else "navegador")
    logger.info(f"Llamada para {restaurante.nombre} desde {origen}")
    await run_bot(transport, runner_args, ctx, es_telefono=call_data is not None)


def registrar_rutas_de_prueba() -> None:
    """/probar: el panel abre aquí la llamada de prueba con el restaurante de quien prueba."""
    from fastapi import Request
    from fastapi.responses import RedirectResponse
    from pipecat.runner.run import app

    @app.get("/probar")
    async def probar(token: str = ""):
        respuesta = RedirectResponse("/client/")
        restaurante_id = await prueba.restaurante_de(token)
        if restaurante_id:
            respuesta.set_cookie(prueba.COOKIE, prueba.firmar(restaurante_id), httponly=True,
                                 samesite="lax", max_age=8 * 3600)
        return respuesta

    @app.middleware("http")
    async def leer_cookie(request: Request, siguiente):
        # El bot se crea dentro de esta petición y hereda el restaurante de la cookie.
        prueba.restaurante_prueba.set(prueba.verificar(request.cookies.get(prueba.COOKIE, "")))
        return await siguiente(request)


if __name__ == "__main__":
    from pipecat.runner.run import main

    registrar_rutas_de_prueba()

    main()
