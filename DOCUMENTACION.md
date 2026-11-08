# ArRES · Documentación del proyecto

**ArRES** es un anfitrión con inteligencia artificial para restaurantes. Contesta las llamadas del restaurante, agenda las reservas en la misma llamada y le da al equipo un panel web para ver y controlar todo.

Es un proyecto de estudiantes de la BUAP para el programa Wadhwani Ignite.

---

## 1. Qué problema resuelve

Los restaurantes pierden reservas porque nadie contesta el teléfono: en horas pico el personal está atendiendo, fuera de horario no hay nadie, y cuando contestan cada quien dice algo distinto. Además, mucha gente reserva y no llega (*no-shows*), y casi nadie lleva un registro de eso.

ArRES resuelve esto así:

| Problema | Cómo lo resuelve ArRES |
|---|---|
| Llamadas sin contestar | Contesta 24/7 y atiende varias llamadas a la vez |
| "Le confirmo más tarde" | Revisa la disponibilidad real y **confirma en la misma llamada** |
| Cada empleado dice algo distinto | Sigue siempre las reglas del restaurante (horario, cupo, tolerancia) |
| Clientes que no llegan | Avisa la tolerancia, el equipo marca "Llegó / No llegó" y el sistema limita reservas a quien falla seguido |
| No se sabe cuánto deja el teléfono | El panel muestra llamadas, reservas, asistencia y ventas estimadas |

Comparado con contratar a alguien (~$9,600 MXN al mes con salario mínimo 2026) u otra IA (desde ~$4,497 MXN al mes, más las llamadas), ArRES se plantea en **$2,000 MXN al mes**.

---

## 2. Qué hace (funciones)

### Agente de voz (por teléfono)
- **Saluda** con el saludo del restaurante y avisa que es una IA y que la llamada se graba.
- **Revisa disponibilidad real** según horario, cupo y reservas existentes. Lo calcula el código, no la IA, para que nunca invente lugares.
- **Ofrece otros horarios** si el que pidieron está lleno o cerrado.
- **Confirma todos los datos** (día, hora, personas, nombre y teléfono) y pide un "sí" antes de guardar.
- **Confirma al instante** los grupos pequeños (hasta 8 personas, configurable).
- **Escala al equipo** los grupos grandes, los casos especiales o los clientes con muchas faltas: queda "Por confirmar" y "el equipo te llama".
- **Avisa la tolerancia** (por ejemplo, 15 minutos).
- **Consulta, cambia y cancela** reservas existentes, verificando nombre y teléfono.
- **Contesta preguntas** con el menú, las preguntas frecuentes y las promociones vigentes que cargó el restaurante.
- **Se despide y cuelga** solo.
- **Guarda la conversación** completa para que el equipo la lea.

### Panel web (SaaS para el restaurante)

| Sección | Para qué sirve |
|---|---|
| **Hoy** | Reservas del día, pendientes por confirmar, escaladas, notas del equipo; botones para aprobar, rechazar, marcar llegada y crear reservas a mano. Se actualiza en vivo. |
| **Calendario** | Reservas de los próximos 7 días |
| **Llamadas** | Cada llamada con la conversación completa |
| **Clientes** | Historial por cliente: visitas, faltas, notas |
| **Resultados** | Llamadas atendidas, reservas del agente, % resueltas sin ayuda, asistencia, horas pico, días fuertes y ventas estimadas |
| **Agente** | Nombre, voz, saludo, menú (se puede subir foto o PDF y la IA lo lee), preguntas frecuentes y promociones; botón para probar el agente |
| **Reglas** | Horario, cupo, tamaño máximo para confirmar solo, tolerancia, faltas permitidas |
| **Ajustes** | Datos del restaurante, número del agente, códigos para desviar el teléfono de siempre, equipo e invitaciones |

Además incluye:
- **Cuentas:** registro con correo o Google, alta del restaurante e invitaciones al equipo por correo.
- **Seguridad:** cada usuario solo ve los datos de su restaurante.
- **Landing:** página de ventas en `arres-ia.vercel.app` con la tabla comparativa animada.

---

## 3. Cómo funciona (arquitectura)

```
 Cliente llama ──► Twilio (número telefónico)
                        │  audio en vivo
                        ▼
              Agente de voz (Python · Pipecat)
   Deepgram (oye) ─► Gemini (piensa) ─► Deepgram (habla)
                        │  usa herramientas: revisar disponibilidad,
                        │  crear / cambiar / cancelar reserva, escalar
                        ▼
                  Supabase (base de datos)
                        ▲  en vivo
                        │
              Panel web (Next.js en Vercel) ◄── Equipo del restaurante
```

1. El cliente llama al número del restaurante, o a uno desviado hacia el agente.
2. **Twilio** recibe la llamada y manda el audio al agente.
3. El agente convierte la voz a texto (**Deepgram**), decide qué hacer (**Gemini**) y contesta con voz (**Deepgram**).
4. Cuando hace falta, el agente usa sus **herramientas**: código que revisa el calendario y guarda en **Supabase**.
5. El **panel** lee Supabase y se actualiza solo cuando entra una reserva.

---

## 4. Con qué está hecho (tecnologías)

| Parte | Tecnología | Por qué |
|---|---|---|
| Panel y landing | **Next.js 15**, React 19, TypeScript, Tailwind CSS, iconos Phosphor | Rápido, moderno y se publica gratis en Vercel |
| Agente de voz | **Python** + **Pipecat 1.15** | Librería abierta para agentes de voz en tiempo real |
| Oído y voz | **Deepgram** (nova-3 para escuchar, Aura 2 en español para hablar) | Baja latencia y buen español; Cartesia como opción |
| Cerebro | **Google Gemini** (`gemini-3.5-flash-lite`) | Rápido, barato y con capa gratuita |
| Turnos de conversación | Silero VAD + Smart Turn v3 | Detecta cuándo terminaste de hablar para no interrumpir |
| Telefonía | **Twilio** (número de EE. UU. y Media Streams) | Estándar de la industria, pago por uso |
| Base de datos, login y tiempo real | **Supabase** (Postgres + Auth + Realtime) | Gratis para empezar, con seguridad por restaurante (RLS) |
| Hosting del panel | **Vercel** | Gratis y se publica solo al subir a `main` |
| Túnel para pruebas | **ngrok** | Conecta Twilio con la computadora sin servidor |
| Pruebas automáticas | pytest (52 pruebas) | Disponibilidad, herramientas, reservas, prompt y servidor |

---

## 5. Estructura del repositorio

```
arres/
├── app/                    Panel y landing (Next.js)
│   ├── page.tsx            Landing
│   ├── login/              Inicio de sesión y registro
│   ├── panel/              Hoy, calendario, llamadas, clientes, resultados, agente, reglas, ajustes
│   └── api/                menu (lee el menú con IA) y voz (muestra de voces)
├── components/             Comparativa, panel (nueva reserva, equipo, probar agente, números animados)
├── lib/                    Conexión a Supabase y utilidades del panel
└── agente/                 Agente (Python)
    ├── voz/bot.py          Agente de voz (llamadas y prueba en navegador)
    ├── arres/              Lógica: disponibilidad, herramientas, prompt, almacén, WhatsApp
    ├── supabase/           esquema.sql y migraciones 02 a 05
    └── tests/              Pruebas automáticas
```

---

## 6. Cómo correrlo (demo local)

Necesitas tres terminales:

```bash
# 1) Túnel para Twilio
ngrok http --url=culpable-grumbling-finance.ngrok-free.dev 7860
```

```bash
# 2) Agente de voz (carpeta agente, con el entorno virtual activado)
python voz/bot.py -t twilio -x culpable-grumbling-finance.ngrok-free.dev
```

```bash
# 3) Panel (carpeta arres)
npm run dev
```

- Panel: `http://localhost:3000/panel`
- Número del agente: **+1 507 554 1606**
- Para probar sin teléfono, usa el botón **"Hablar con el agente"** del panel, o corre `python voz/bot.py` y abre el navegador.

### Configuración (sin claves aquí)

Las claves van solo en archivos `.env` locales, nunca en GitHub ni en el chat.

- **Panel** (`.env.local` / Vercel): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_AGENTE_URL`, `GEMINI_API_KEY`, `DEEPGRAM_API_KEY`.
- **Agente** (`agente/.env`): `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `GEMINI_API_KEY`, `DEEPGRAM_API_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `RESTAURANTE_ID`. Hay más opciones en `agente/.env.example`.
- `MODO_PRUEBA=1` nunca debe usarse en un servidor público.
- En Twilio, el número apunta con **Webhook (HTTP POST)** a la dirección del agente.

---

## 7. Costos

| Concepto | Costo |
|---|---|
| Número Twilio (EE. UU.) | $1.15 USD al mes, más centavos por minuto de llamada |
| Deepgram | Crédito gratis inicial; después, pago por uso |
| Gemini | Capa gratuita suficiente para la demo |
| Supabase y Vercel | Gratis en el plan inicial |
| Railway (opcional, agente 24/7) | Aprox. $8–12 USD al mes (estimado) |

Para la demo, el costo es prácticamente **$0**, además de los $20 USD de saldo cargados a Twilio.

---

## 8. Estado y siguientes pasos

**Listo y probado:** llamada real por teléfono → reserva confirmada → aparece sola en el panel.

**Pendiente (opcional):**
- Publicar el agente en Railway para que funcione sin la laptop, y apuntar ahí el webhook de Twilio.
- Variables del panel en Vercel y direcciones permitidas en Supabase y Google.
- Número local de Puebla (requiere documentos en Twilio).
- WhatsApp: el código base ya existe; queda como siguiente fase.
- Recordatorios automáticos antes de la reserva.
