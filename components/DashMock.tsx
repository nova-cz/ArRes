import Plato from "./Plato";
import { Bell, BowlFood, Cake, CalendarBlank, ForkKnife, GearSix, House, Hamburger, ListChecks, Table } from "@phosphor-icons/react/dist/ssr";


const nav = [[<House weight="duotone" />, "Hoy"], [<CalendarBlank weight="duotone" />, "Calendario"], [<Table weight="duotone" />, "Mesas"], [<ListChecks weight="duotone" />, "Reglas"], [<GearSix weight="duotone" />, "Ajustes"]];

const cols = [
  { t: "Confirmadas", n: 12, bg: "bg-[#DDEBD6]", i: <BowlFood weight="duotone" />, items: ["19:00 · Familia Torres · 6", "19:30 · Laura Ramírez · 4", "20:15 · Mesa de empresa · 8"] },
  { t: "Pendientes", n: 5, bg: "bg-[#FBE3C8]", i: <Hamburger weight="duotone" />, items: ["20:00 · Carlos M. · 2", "20:30 · Ana Sofía · 5"] },
  { t: "Escaladas", n: 2, bg: "bg-[#F6D2D0]", i: <Cake weight="duotone" />, items: ["21:00 · Evento privado · 20", "21:30 · Silla de ruedas · 3"] },
];

const filas = [
  ["19:30", "Laura Ramírez", "4", "Terraza", "Pendiente", "text-naranja"],
  ["20:00", "Carlos M.", "2", "Salón", "Pendiente", "text-naranja"],
  ["20:15", "Mesa de empresa", "8", "Salón", "Confirmada", "text-[#3F7D32]"],
  ["21:00", "Evento privado", "20", "Terraza", "Escalada", "text-rojo"],
];

export default function DashMock() {
  return (
    <div
      style={{ backgroundImage: "linear-gradient(rgba(61,16,21,.35), rgba(61,16,21,.5)), url(/fotos/mesa.jpg)" }}
      className="relative overflow-hidden rounded-[2rem] bg-cover bg-center p-3 sm:p-8"
    >
      <div className="flex overflow-hidden rounded-3xl glass">
        <aside className="hidden w-40 shrink-0 flex-col gap-1 bg-white/40 p-4 md:flex">
          <span className="mb-5 font-serif text-xl font-semibold">Ar<span className="text-rojo">RES</span></span>
          {nav.map(([i, n], k) => (
            <span key={String(n)} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${k === 0 ? "bg-rojo font-medium text-white shadow-md shadow-rojo/30" : "text-ink/60"}`}>
              <span aria-hidden className="[&>svg]:h-[18px] [&>svg]:w-[18px]">{i}</span>{n}
            </span>
          ))}
        </aside>

        <div className="min-w-0 flex-1 space-y-4 bg-white/30 p-4 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="hidden flex-1 rounded-full bg-white/60 px-4 py-2 text-xs text-ink/40 sm:block">Buscar reserva, nombre o teléfono…</div>
            <span className="glass rounded-full px-3 py-1.5 text-xs"><Bell size={14} weight="duotone" className="mr-1 inline text-naranja" />2 por aprobar</span>
          </div>

          <div className="relative overflow-hidden rounded-2xl bg-rojo p-5 text-crema sm:p-7">
            <h3 className="max-w-xs font-serif text-2xl leading-tight sm:text-3xl">Reservas de hoy</h3>
            <p className="mt-1 max-w-xs text-sm text-crema/80">19 reservas · 5 esperan tu aprobación</p>
            <span className="mt-4 inline-block rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-rojo">Revisar pendientes</span>
            <ForkKnife aria-hidden weight="duotone" className="absolute -right-2 top-1/2 h-24 w-24 -translate-y-1/2 text-crema/30 sm:right-8 sm:h-32 sm:w-32" />
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {cols.map((c) => (
              <section key={c.t} className={`rounded-2xl border border-white/60 p-4 backdrop-blur-md ${c.bg}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold">{c.t}</h4>
                    <p className="font-serif text-4xl leading-none">{c.n}</p>
                  </div>
                  <Plato size={56}>{c.i}</Plato>
                </div>
                <ul className="mt-3 space-y-1 text-xs text-ink/70">
                  {c.items.map((i) => <li key={i} className="truncate rounded-lg bg-white/70 px-2 py-1.5">{i}</li>)}
                </ul>
              </section>
            ))}
          </div>

          <div className="grid gap-3 lg:grid-cols-[1.6fr_1fr]">
            <section className="overflow-x-auto glass rounded-2xl p-4">
              <h4 className="mb-2 text-sm font-semibold">Próximas reservas</h4>
              <table className="w-full min-w-[420px] text-left text-xs">
                <thead className="text-ink/40"><tr><th className="py-1 font-normal">Hora</th><th className="font-normal">Nombre</th><th className="font-normal">Pers.</th><th className="font-normal">Zona</th><th className="font-normal">Estado</th></tr></thead>
                <tbody>
                  {filas.map(([h, n, p, z, s, c]) => (
                    <tr key={h} className="border-t border-ink/5"><td className="py-2">{h}</td><td>{n}</td><td>{p}</td><td>{z}</td><td className={`font-medium ${c}`}>{s}</td></tr>
                  ))}
                </tbody>
              </table>
            </section>
            <section className="rounded-2xl bg-[#FFF3B8]/80 backdrop-blur-md p-4 text-xs leading-relaxed text-ink/75">
              <h4 className="mb-2 text-sm font-semibold text-ink">Notas del equipo</h4>
              <ol className="list-decimal space-y-1.5 pl-4">
                <li>Evento de 20 personas: confirmar anticipo.</li>
                <li>Terraza cerrada si llueve después de las 9.</li>
                <li>Mesa 6 reservada para cumpleaños.</li>
              </ol>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
