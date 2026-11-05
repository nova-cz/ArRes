# Agente de ArRES (llamadas + WhatsApp)

El "cerebro" de ArRES: contesta **llamadas** y **mensajes de WhatsApp**, revisa la
disponibilidad con las reglas del restaurante y deja cada reserva **pendiente** para que el
equipo la apruebe. Cuando la aprueban, le llega al cliente un WhatsApp de confirmación.

```
Llamada (Twilio) ──► voz/bot.py (Pipecat) ──┐
                                            ├──► arres/herramientas.py ──► Supabase ◄── Panel web
WhatsApp (Meta) ──► arres/servidor.py ──────┘     (mismas acciones           (tabla reservas)  │
                                                   y reglas para los dos)                     │
Cliente ◄── WhatsApp "✅ confirmada" ◄── /eventos/reserva ◄── aviso de Supabase ◄─────────────┘
```

**La IA conversa; el código decide la disponibilidad; el equipo confirma.**

## Qué hay en cada archivo

| Archivo | Qué hace |
|---|---|
| `arres/disponibilidad.py` | Calcula si hay lugar (horario, cupo, grupos grandes, anticipación) y propone 3 alternativas. Sin IA. |
| `arres/herramientas.py` | Las acciones del agente: `ver_disponibilidad`, `crear_reserva`, `escalar_a_humano`. |
| `arres/prompt.py` | Instrucciones del agente (tono, reglas, calendario de la semana). |
| `arres/cerebro.py` | Agente de texto para WhatsApp (Gemini u OpenAI). |
| `arres/servidor.py` | Webhook de WhatsApp, aviso del panel y página de prueba. |
| `arres/notificaciones.py` | Manda la confirmación o el rechazo por WhatsApp. |
| `arres/almacen.py` | Lee y escribe en Supabase (o en memoria para probar). |
| `voz/bot.py` | Agente de voz: Deepgram (oído y voz) + Gemini/OpenAI (cerebro). Cartesia opcional. |
| `supabase/esquema.sql` | Tablas, seguridad y restaurante demo. **Es el contrato con el panel web.** |

## 1. Probar en tu compu (sin pagar nada)

Necesitas Python 3.11 o más nuevo.

```bash
cd agente
python -m venv .venv
source .venv/bin/activate        # en Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
cp .env.example .env
```

Abre `.env` y pega tu llave de Gemini (gratis en https://aistudio.google.com/apikey) en
`GEMINI_API_KEY`. Lo demás puede quedar vacío por ahora.

### Chat tipo WhatsApp + panel de aprobación

```bash
uvicorn arres.servidor:app --reload --port 8000
```

Abre http://localhost:8000/prueba. A la izquierda escribes como cliente; a la derecha
aparece la reserva como **pendiente**. Dale **Aprobar** y en el chat aparece el ✅.
Así se ve en la presentación sin conectar nada de Meta.

### Llamada desde el navegador

Agrega a `.env` tu llave de Deepgram (https://console.deepgram.com, trae crédito gratis
sin tarjeta). Con esa misma llave el agente escucha y habla, así que la demo cuesta $0.
Si quieren una voz más natural, cambien `VOZ_PROVEEDOR=cartesia` y agreguen la llave de
Cartesia.

```bash
python voz/bot.py
```

Abre http://localhost:7860, dale **Connect** y habla. Las reservas que hagas por voz
también aparecen en la página de prueba si usas la misma base (Supabase).

### Pruebas automáticas

```bash
pytest
```

## 2. Conectar Supabase (base compartida con el panel)

1. Crea un proyecto en https://supabase.com (gratis).
2. **SQL Editor** → pega todo `supabase/esquema.sql` → **Run**.
3. **Project Settings → API**: copia `URL` y `service_role key` a `SUPABASE_URL` y
   `SUPABASE_SERVICE_ROLE_KEY` en `.env`.

La llave `service_role` salta toda la seguridad: **solo va en el servidor del agente**,
nunca en el panel web ni en GitHub.

### Para quien hace el panel web

- El panel usa la llave `anon` + login de Supabase Auth. Para que un usuario vea un
  restaurante, agrega una fila en `miembros (user_id, restaurante_id)`.
- **Reservas de hoy:** `reservas` filtrando `restaurante_id` y `inicio`. Están en Realtime:
  suscríbete y las nuevas aparecen solas.
- **Aprobar / rechazar:** `update reservas set estado = 'confirmada'` (o `'rechazada'`).
  Nada más. El aviso al cliente lo manda el agente.
- **Estados:** `confirmada` (el agente la confirmó en la llamada), `pendiente` (la decide
  el equipo; el porqué, si lo hay, está en `motivo_escalada`), `escalada` (grupo grande,
  queja o caso especial), `rechazada`, `cancelada`, `llego` y `no_llego`.
- **Llegó / No llegó:** pasada la `reglas.tolerancia_min`, el panel debe preguntar si el
  cliente llegó. Marcar `no_llego` libera la mesa y cuenta como falta para ese teléfono;
  con `reglas.max_faltas` faltas, sus reservas ya no se confirman solas.
- **Alerta:** si una `pendiente` o `escalada` lleva más de `reglas.minutos_alerta` desde
  `creado_en`, márcala en rojo.
- **Reglas editables:** tabla `reglas` (horario, cupo, máximo por grupo, anticipación,
  `auto_aprobar_hasta`). El agente las lee en cada conversación.
- **Historial:** tabla `mensajes` (WhatsApp y transcripción de llamadas).

### Aviso cuando el panel aprueba

Supabase → **Database → Webhooks → Create**: tabla `reservas`, evento **Update**, método
POST a `https://TU-SERVIDOR/eventos/reserva`, con el header
`x-arres-secreto: <el mismo EVENTOS_SECRETO del .env>`.

## 3. WhatsApp de verdad (Meta)

1. https://developers.facebook.com → crear app tipo **Business** → agregar **WhatsApp**.
2. En **API Setup** copia el token y el **Phone number ID**. El Phone number ID va en la
   columna `restaurantes.whatsapp_phone_number_id`.
3. **Configuration → Webhook**: URL `https://TU-SERVIDOR/whatsapp`, verify token = el
   `WHATSAPP_VERIFY_TOKEN` que inventaste. Suscríbete a `messages`.
4. Para avisar a quien reservó **por llamada** hace falta una plantilla aprobada (categoría
   *Utility*) con 3 variables: nombre, fecha y personas. Pon su nombre en
   `WHATSAPP_PLANTILLA_CONFIRMADA` / `..._RECHAZADA`.

En local, expón el puerto con `ngrok http 8000` para que Meta te alcance.

## 4. Llamadas de verdad (Twilio)

1. Compra un número en Twilio (para números mexicanos piden documentos de la empresa).
2. Ponlo en `restaurantes.telefono_agente` con formato `+52XXXXXXXXXX`.
3. Corre `python voz/bot.py -t twilio -x TU-DOMINIO-NGROK` y en Twilio configura el número:
   *A call comes in* → Webhook → `https://TU-DOMINIO-NGROK/` (POST).
4. El restaurante activa en su línea el **desvío cuando no contesta u ocupado** hacia ese número.

## Dónde publicarlo

Vercel no sirve para la voz (necesita un servidor encendido todo el tiempo). Opciones:
Fly.io, Railway, Render o un VPS barato. Se corren dos procesos: `uvicorn arres.servidor:app`
y `python voz/bot.py -t twilio`. **No actives `MODO_PRUEBA` en el servidor público.**

## Pendiente

- Cancelar o cambiar una reserva por el propio agente (hoy se escala al equipo).
- Recordatorio por WhatsApp el día de la reserva.
- Si dos llamadas piden el último lugar en el mismo segundo, las dos podrían quedar
  pendientes; el equipo lo ve al aprobar. Para producción conviene una función en Postgres
  que revise y guarde en un solo paso.
- Medir latencia y costo real por minuto en los pilotos.
