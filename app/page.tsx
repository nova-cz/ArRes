import Boton from "@/components/Boton";
import Caras from "@/components/Caras";
import ChatMock from "@/components/ChatMock";
import DashMock from "@/components/DashMock";
import Photo from "@/components/Photo";
import Plato from "@/components/Plato";
import {
  Armchair, ArrowsClockwise, BellRinging, CalendarBlank, CalendarCheck, Cake, ChatCircleDots, Champagne, Check,
  CheckCircle, Clock, ForkKnife, Minus, MoonStars, Phone, Plant, Plus, Shuffle, ShieldCheck, UsersThree, WhatsappLogo, X, XCircle,
} from "@phosphor-icons/react/dist/ssr";

const d = "duotone" as const;

const links = [
  ["Cómo funciona", "#como-funciona"],
  ["Panel", "#panel"],
  ["Comparativa", "#comparativa"],
  ["Precio", "#precio"],
  ["Preguntas", "#faq"],
];

const problemas = [
  { i: <Phone weight={d} />, t: "Llamadas sin contestar en hora pico", d: "Sábado a las 8 pm el equipo está sirviendo mesas. El teléfono suena y esa reserva se va con la competencia." },
  { i: <ChatCircleDots weight={d} />, t: "WhatsApp acumulados", d: "Mensajes que se quedan sin leer durante el turno y se contestan hasta el día siguiente, cuando el cliente ya reservó en otro lado." },
  { i: <Shuffle weight={d} />, t: "Respuestas contradictorias", d: "Uno dice que hay lugar, otro que no. Cada quien contesta distinto y la agenda termina en desorden." },
];

const pruebas = [
  { i: <ChatCircleDots weight={d} />, a: "8 de 10", b: "restauranteros en Puebla lo consideran urgente" },
  { i: <MoonStars weight={d} />, a: "Atención 24/7", b: "llamadas y WhatsApp, también de madrugada" },
  { i: <ShieldCheck weight={d} />, a: "Tu equipo aprueba", b: "cada reserva antes de confirmarse" },
];

type Celda = { ok: "si" | "no" | "mid"; t: string };
const filas: [string, Celda, Celda, Celda][] = [
  ["Atiende fuera de horario", { ok: "si", t: "Sí, 24/7" }, { ok: "mid", t: "Depende del turno" }, { ok: "si", t: "Sí" }],
  ["Conoce las reglas de tu restaurante", { ok: "si", t: "Las configuras tú" }, { ok: "si", t: "Con capacitación" }, { ok: "no", t: "Respuestas genéricas" }],
  ["Revisa disponibilidad real", { ok: "si", t: "Sí" }, { ok: "si", t: "Sí" }, { ok: "no", t: "Normalmente no" }],
  ["Contesta llamadas y WhatsApp", { ok: "si", t: "Ambos" }, { ok: "mid", t: "Uno a la vez" }, { ok: "mid", t: "Solo chat" }],
  ["Una persona aprueba cada reserva", { ok: "si", t: "Siempre" }, { ok: "mid", t: "No aplica" }, { ok: "no", t: "No" }],
  ["Respuestas consistentes", { ok: "si", t: "Siempre las mismas reglas" }, { ok: "no", t: "Varían por persona" }, { ok: "no", t: "Varían sin control" }],
];

const faqs = [
  { q: "¿Mi equipo pierde el control de las reservas?", a: "No. ArRES nunca confirma por su cuenta: cada reserva llega a tu panel como solicitud y tu personal la aprueba, la ajusta o la rechaza. Lo que se sale de las reglas se escala a una persona." },
  { q: "¿Necesito cambiar mi número o mis sistemas?", a: "No. Te ayudamos a conectar tu línea de WhatsApp y el desvío de llamadas. Tu restaurante sigue usando el mismo número que ya conocen tus clientes." },
  { q: "¿Qué pasa si no me convence después de los 30 días?", a: "Cancelas y ya. No hay contrato ni permanencia, y durante la prueba no pagas nada." },
];

function Titulo({ children, claro = false, className = "" }: { children: React.ReactNode; claro?: boolean; className?: string }) {
  return (
    <h2 className={`font-serif text-4xl leading-[1.08] sm:text-5xl lg:text-[3.4rem] ${claro ? "text-crema" : "text-ink"} ${className}`}>
      {children}
    </h2>
  );
}

const Marca = ({ claro = false }: { claro?: boolean }) => (
  <a href="#" className="flex items-center gap-2.5">
    <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-rojo to-naranja text-crema shadow-md shadow-rojo/30"><ForkKnife size={20} weight="fill" /></span>
    <span className={`font-serif text-2xl ${claro ? "text-crema" : "text-ink"}`}>Ar<span className={claro ? "text-dorado" : "text-rojo"}>RES</span></span>
  </a>
);

const Blobs = ({ a = "bg-naranja/40", b = "bg-rojo/40" }: { a?: string; b?: string }) => (
  <>
    <div aria-hidden className={`blob -left-20 -top-20 h-80 w-80 ${a}`} />
    <div aria-hidden className={`blob -bottom-24 right-0 h-96 w-96 ${b}`} />
  </>
);

const Estado = ({ c }: { c: Celda }) => (
  <span className="flex items-center gap-2">
    {c.ok === "si" && <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#4E9A3E] text-white"><Check size={12} weight="bold" /></span>}
    {c.ok === "mid" && <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-dorado/90 text-vino"><Minus size={12} weight="bold" /></span>}
    {c.ok === "no" && <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-rojo text-white"><X size={12} weight="bold" /></span>}
    {c.t}
  </span>
);

export default function Page() {
  return (
    <>
      <header className="glass sticky top-3 z-50 mx-3 mt-3 flex items-center justify-between rounded-full py-2.5 pl-4 pr-2.5 sm:mx-auto sm:max-w-6xl sm:pl-6">
        <Marca />
        <nav aria-label="Principal" className="hidden gap-8 text-sm font-semibold md:flex">
          {links.map(([l, h]) => (<a key={h} href={h} className="text-ink/75 transition-colors hover:text-rojo">{l}</a>))}
        </nav>
        <Boton variante="oscuro" className="gap-2 !px-5 !py-2.5"><WhatsappLogo size={18} weight="fill" />Agenda tu demo</Boton>
      </header>

      <main>
        {/* Hero */}
        <section className="grain relative mx-3 mt-3 overflow-hidden rounded-[2rem] bg-vino text-crema sm:mx-5 lg:rounded-[2.5rem]">
          <Photo name="hero" label="" className="absolute inset-0 opacity-50" />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-vino via-vino/85 to-vino/40" />
          <Blobs />
          <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 pb-28 pt-14 sm:px-10 lg:grid-cols-[1.2fr_1fr] lg:pb-32 lg:pt-20">
            <div>
              <p className="glass-dark mb-8 inline-flex items-center gap-3 rounded-full py-1.5 pl-1.5 pr-5 text-sm">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-crema text-rojo" aria-hidden><ForkKnife size={20} weight={d} /></span>
                <span className="font-semibold">Anfitrión de IA para restaurantes de Puebla</span>
              </p>
              <h1 className="font-serif text-5xl leading-[1.03] sm:text-6xl lg:text-[4.4rem]">
                Tu restaurante nunca vuelve a dejar una reserva sin contestar
              </h1>
              <p className="mt-8 max-w-xl text-lg leading-relaxed text-crema/75">
                ArRES atiende tus llamadas y WhatsApp las 24 horas, revisa disponibilidad y gestiona reservas con las reglas de tu restaurante. Tu equipo aprueba cada una.
              </p>
              <div className="mt-10 flex flex-wrap items-center gap-5">
                <Boton className="gap-2 !px-7 !py-3.5 shadow-lg shadow-naranja/30"><WhatsappLogo size={20} weight="fill" />Prueba gratis 30 días</Boton>
                <a href="#como-funciona" className="text-sm font-semibold underline decoration-dorado decoration-2 underline-offset-[6px] hover:text-dorado">Ver cómo funciona</a>
              </div>
            </div>

            <div className="relative">
              <div className="mb-4 flex justify-center gap-2 text-xs font-bold" aria-hidden>
                {["Pregunta", "Revisa", "Aprueba"].map((x, i) => (
                  <span key={x} className={`rounded-full px-4 py-2 ${i === 2 ? "bg-naranja text-ink" : "glass-dark"}`}>{x}</span>
                ))}
              </div>
              <ChatMock />
              <div className="glass-dark flota absolute -left-24 top-44 hidden items-center gap-3 rounded-2xl p-3 pr-5 xl:flex" aria-hidden>
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#4E9A3E] text-white"><CalendarCheck size={22} weight={d} /></span>
                <span className="text-xs leading-tight"><b className="block text-sm">Mesa para 4</b>Hoy 19:30 · Terraza</span>
              </div>
              <div className="glass-dark flota absolute -right-8 -bottom-4 hidden items-center gap-3 rounded-2xl p-3 pr-5 [animation-delay:-3s] xl:flex" aria-hidden>
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-naranja text-ink"><BellRinging size={22} weight={d} /></span>
                <span className="text-xs leading-tight"><b className="block text-sm">Por aprobar</b>Tu equipo decide</span>
              </div>
            </div>
          </div>
        </section>

        {/* Prueba */}
        <section aria-label="Resumen" className="relative z-10 mx-auto -mt-16 grid max-w-6xl gap-4 px-5 sm:px-8 md:grid-cols-3">
          {pruebas.map((p) => (
            <div key={p.a} className="glass flex items-center gap-4 rounded-3xl p-5">
              <Plato size={56}>{p.i}</Plato>
              <div>
                <p className="font-serif text-2xl leading-tight text-rojo">{p.a}</p>
                <p className="mt-0.5 text-sm leading-snug text-ink/70">{p.b}</p>
              </div>
            </div>
          ))}
        </section>

        {/* Problema */}
        <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28">
          <Titulo className="max-w-3xl">Cada reserva que no contestas es una mesa vacía</Titulo>
          <div className="mt-12 grid gap-5 lg:grid-cols-[1fr_1.35fr]">
            <div className="relative min-h-[22rem] overflow-hidden rounded-3xl ring-1 ring-ink/10">
              <Photo name="llamadas" label="Anfitriona con diadema atendiendo llamadas" className="absolute inset-0" />
              <p className="glass absolute inset-x-4 bottom-4 rounded-2xl p-4 text-lg font-bold leading-snug">
                En hora pico, tu equipo está atendiendo mesas, no el teléfono.
              </p>
            </div>
            <div className="grid gap-5">
              {problemas.map((p) => (
                <article key={p.t} className="glass flex items-start gap-5 rounded-3xl p-6 transition-transform hover:-translate-y-0.5">
                  <Plato size={56}>{p.i}</Plato>
                  <div>
                    <h3 className="font-serif text-xl leading-tight sm:text-2xl">{p.t}</h3>
                    <p className="mt-2 leading-relaxed text-ink/70">{p.d}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Cómo funciona */}
        <section id="como-funciona" className="grain relative mx-3 scroll-mt-4 overflow-hidden rounded-[2rem] bg-vino text-crema sm:mx-5 lg:rounded-[2.5rem]">
          <Blobs a="bg-rojo/35" b="bg-naranja/35" />
          <div className="relative mx-auto max-w-7xl px-5 py-20 sm:px-10 lg:py-28">
            <Titulo claro className="max-w-3xl">Tres pasos y tu agenda se contesta sola</Titulo>
            <ol className="relative mt-14 grid gap-5 md:grid-cols-3">

              <li className="glass-dark relative rounded-3xl p-7">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-dorado to-naranja font-serif text-xl text-vino shadow-lg shadow-naranja/30">1</span>
                <h3 className="mt-6 font-serif text-2xl leading-tight">Le enseñas las reglas de tu restaurante</h3>
                <p className="mt-3 leading-relaxed text-crema/70">Horarios, mesas, aforo por turno, grupos grandes y días de cierre. Lo configuramos contigo.</p>
                <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold" aria-hidden>
                  {["Horarios", "18 mesas", "Aforo por turno", "Grupos +8", "Días de cierre"].map((c) => (
                    <span key={c} className="rounded-full bg-white/10 px-3 py-1.5 ring-1 ring-white/15">{c}</span>
                  ))}
                </div>
              </li>

              <li className="glass-dark relative rounded-3xl p-7">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-dorado to-naranja font-serif text-xl text-vino shadow-lg shadow-naranja/30">2</span>
                <h3 className="mt-6 font-serif text-2xl leading-tight">ArRES atiende llamadas y WhatsApp</h3>
                <p className="mt-3 leading-relaxed text-crema/70">Contesta a cualquier hora, revisa disponibilidad real y levanta la solicitud con los datos del cliente.</p>
                <div className="mt-5 space-y-2 text-xs" aria-hidden>
                  <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-[#F8D9B8] px-3 py-2 text-ink">¿Mesa para 4 a las 19:30?</p>
                  <p className="w-fit max-w-[85%] rounded-2xl rounded-bl-sm bg-papel px-3 py-2 text-ink">Sí hay lugar. ¿Terraza o salón?</p>
                </div>
              </li>

              <li className="glass-dark relative rounded-3xl p-7">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-dorado to-naranja font-serif text-xl text-vino shadow-lg shadow-naranja/30">3</span>
                <h3 className="mt-6 font-serif text-2xl leading-tight">Tu equipo aprueba cada reserva</h3>
                <p className="mt-3 leading-relaxed text-crema/70">Recibes la solicitud en el panel. Con un toque confirmas, ajustas o rechazas. Lo delicado lo escala a una persona.</p>
                <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl bg-papel p-3 text-xs text-ink" aria-hidden>
                  <span><b className="block text-sm">Laura R. · 4 pers.</b>Hoy 19:30</span>
                  <span className="flex gap-1.5">
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-[#4E9A3E] text-white"><Check size={16} weight="bold" /></span>
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-rojo/15 text-rojo"><X size={16} weight="bold" /></span>
                  </span>
                </div>
              </li>
            </ol>

            <div className="glass-dark mt-5 overflow-hidden rounded-3xl pt-8 text-center sm:pt-12">
              <p className="mx-auto max-w-xl px-6 font-serif text-2xl leading-snug sm:text-3xl">
                ArRES propone. Tu equipo siempre tiene la última palabra.
              </p>
              <div className="mt-8 px-5 pb-8 sm:px-8 sm:pb-10">
                <Caras />
              </div>
            </div>
          </div>
        </section>

        {/* Panel */}
        <section id="panel" className="mx-auto max-w-7xl scroll-mt-4 px-5 py-20 sm:px-8 lg:py-28">
          <div className="mb-12 max-w-3xl">
            <Titulo>Todas las reservas del día en una sola pantalla</Titulo>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink/70">
              Confirmadas, pendientes de tu aprobación y escaladas a una persona. Sabes qué sigue sin abrir el chat.
            </p>
          </div>
          <ul className="mb-8 flex gap-3 overflow-x-auto pb-2" aria-label="Lo que ArRES atiende">
            {[[<Cake weight={d} />, "Cumpleaños"], [<UsersThree weight={d} />, "Familias"], [<Champagne weight={d} />, "Eventos"], [<Plant weight={d} />, "Terraza"], [<Armchair weight={d} />, "Grupos grandes"], [<ArrowsClockwise weight={d} />, "Cambios"], [<XCircle weight={d} />, "Cancelaciones"]].map(([e, n]) => (
              <li key={String(n)} className="glass flex min-w-[6rem] flex-col items-center gap-1.5 rounded-2xl px-3 py-3.5 text-xs font-bold">
                <span className="text-rojo [&>svg]:h-8 [&>svg]:w-8" aria-hidden>{e}</span>{n}
              </li>
            ))}
          </ul>
          <DashMock />
        </section>

        {/* Comparativa */}
        <section id="comparativa" className="grain relative mx-3 scroll-mt-4 overflow-hidden rounded-[2rem] bg-vino text-crema sm:mx-5 lg:rounded-[2.5rem]">
          <Photo name="sala" label="" className="absolute inset-0 opacity-30" />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-vino/90 to-vino/70" />
          <Blobs />
          <div className="relative mx-auto max-w-7xl px-5 py-20 sm:px-10 lg:py-28">
            <Titulo claro className="max-w-3xl">ArRES frente a las alternativas</Titulo>
            <div className="glass-dark mt-12 overflow-x-auto rounded-3xl p-3 sm:p-5">
              <table className="w-full min-w-[720px] border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr className="text-crema/70">
                    <th className="w-1/4 pb-4"><span className="sr-only">Característica</span></th>
                    <th className="rounded-t-2xl bg-gradient-to-b from-rojo to-[#9E1217] px-5 py-4 font-serif text-xl text-crema">ArRES</th>
                    <th className="px-5 pb-4 font-bold">Contratar personal</th>
                    <th className="px-5 pb-4 font-bold">Chatbot genérico</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map(([a, b, c, e], i) => (
                    <tr key={a}>
                      <th scope="row" className="border-t border-white/10 py-4 pr-4 font-semibold">{a}</th>
                      <td className={`border-t border-white/15 bg-gradient-to-b from-[#9E1217] to-[#9E1217] px-5 py-4 font-bold ${i === filas.length - 1 ? "rounded-b-2xl" : ""}`}><Estado c={b} /></td>
                      <td className="border-t border-white/10 px-5 py-4 text-crema/80"><Estado c={c} /></td>
                      <td className="border-t border-white/10 px-5 py-4 text-crema/80"><Estado c={e} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Precio */}
        <section id="precio" className="mx-auto grid max-w-6xl scroll-mt-4 gap-5 px-5 py-20 sm:px-8 lg:grid-cols-[1fr_1.3fr] lg:py-28">
          <div className="relative min-h-64 overflow-hidden rounded-[2rem] ring-1 ring-ink/10">
            <Photo name="tenue" label="Mesa lista en un restaurante de noche" className="absolute inset-0" />
            <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-vino/70 to-transparent" />
            <p className="glass absolute inset-x-4 bottom-4 flex items-center gap-3 rounded-2xl p-3 text-sm font-bold">
              <Clock size={22} weight={d} className="text-rojo" />Sin contrato: cancelas cuando quieras
            </p>
          </div>
          <div className="oro-borde relative rounded-[2rem] p-8 sm:p-12">
            <span className="absolute right-6 top-6 rounded-full bg-gradient-to-r from-dorado to-naranja px-4 py-1.5 text-xs font-extrabold text-vino">30 días gratis</span>
            <Titulo className="max-w-md pr-24 sm:pr-0">Un solo plan, sin letras chiquitas</Titulo>
            <p className="mt-8 font-serif text-6xl text-rojo sm:text-7xl">$2,000<span className="ml-1 text-xl text-ink/60"> MXN/mes</span></p>
            <ul className="mt-8 space-y-3 text-lg">
              {["30 días gratis para probarlo en tu restaurante", "Sin contrato ni permanencia", "Llamadas y WhatsApp incluidos", "Tu equipo aprueba cada reserva"].map((t) => (
                <li key={t} className="flex items-start gap-3"><CheckCircle size={26} weight="fill" className="mt-0.5 shrink-0 text-[#4E9A3E]" />{t}</li>
              ))}
            </ul>
            <Boton className="mt-10 gap-2 !px-8 !py-4"><WhatsappLogo size={20} weight="fill" />Prueba gratis 30 días</Boton>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="mx-auto max-w-3xl scroll-mt-4 px-5 pb-20 sm:px-8 lg:pb-28">
          <Titulo>Preguntas frecuentes</Titulo>
          <div className="mt-10 space-y-3">
            {faqs.map((f) => (
              <details key={f.q} className="glass group rounded-2xl px-6 py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-bold">
                  {f.q}
                  <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-rojo text-white transition-transform group-open:rotate-45"><Plus size={16} weight="bold" /></span>
                </summary>
                <p className="mt-3 leading-relaxed text-ink/70">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* CTA final */}
        <section className="grain relative mx-3 overflow-hidden rounded-[2rem] bg-vino text-crema sm:mx-5 lg:rounded-[2.5rem]">
          <Photo name="plato" label="" className="absolute inset-0 opacity-40" />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-vino via-vino/60 to-vino/30" />
          <div className="relative mx-auto max-w-3xl px-5 py-24 text-center sm:px-10 lg:py-32">
            <Titulo claro>Que la próxima reserva no se te escape</Titulo>
            <p className="mx-auto mt-6 max-w-lg text-lg text-crema/75">Agenda una demo por WhatsApp y vemos cómo quedaría ArRES en tu restaurante.</p>
            <Boton className="mt-10 gap-2 !px-8 !py-4"><WhatsappLogo size={20} weight="fill" />Agenda tu demo</Boton>
          </div>
        </section>
      </main>

      <footer className="mx-auto mt-6 flex max-w-7xl flex-col items-center justify-between gap-5 px-5 py-10 text-sm text-ink/70 sm:flex-row sm:px-8">
        <Marca />
        <nav aria-label="Pie" className="flex flex-wrap justify-center gap-x-6 gap-y-2 font-semibold">
          {links.map(([l, h]) => (<a key={h} href={h} className="hover:text-rojo">{l}</a>))}
        </nav>
        <span className="font-semibold">Hecho en Puebla · BUAP</span>
      </footer>
    </>
  );
}
