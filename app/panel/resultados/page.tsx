"use client";
import { useEffect, useState } from "react";
import { supabase, TZ } from "@/lib/supabase";
import { Tarjeta, useRestaurante } from "@/lib/panel";

type Fila = { canal: string; estado: string; personas: number; inicio: string | null; creado_en: string; motivo_escalada: string };
const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const CANALES: Record<string, string> = { llamada: "Llamadas (agente)", panel: "Panel (equipo)", whatsapp: "WhatsApp", web: "Web" };
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

export default function Resultados() {
  const { id } = useRestaurante();
  const [dias, setDias] = useState(30);
  const [filas, setFilas] = useState<Fila[]>([]);
  const [llamadas, setLlamadas] = useState(0);
  const [ticket, setTicket] = useState(250);

  useEffect(() => {
    try { const t = Number(localStorage.getItem("arres-ticket")); if (t) setTicket(t); } catch {}
  }, []);

  useEffect(() => {
    const desde = new Date(Date.now() - dias * 86400000).toISOString();
    supabase.from("reservas").select("canal, estado, personas, inicio, creado_en, motivo_escalada")
      .eq("restaurante_id", id).gte("creado_en", desde).then(({ data }) => setFilas(data ?? []));
    // Llamadas atendidas = conversaciones distintas (mismo teléfono, con menos de 1 min entre mensajes).
    supabase.from("mensajes").select("telefono, creado_en").eq("restaurante_id", id).eq("canal", "llamada")
      .gte("creado_en", desde).order("id").then(({ data }) => {
        let n = 0, ultimo = { telefono: "", t: 0 };
        for (const m of data ?? []) {
          const t = new Date(m.creado_en).getTime();
          if (m.telefono !== ultimo.telefono || t - ultimo.t > 60000) n++;
          ultimo = { telefono: m.telefono, t };
        }
        setLlamadas(n);
      });
  }, [id, dias]);

  const validas = filas.filter((r) => !["cancelada", "rechazada"].includes(r.estado));
  const porLlamada = validas.filter((r) => r.canal === "llamada");
  const solas = porLlamada.filter((r) => !r.motivo_escalada && !["pendiente", "escalada"].includes(r.estado));
  const llego = filas.filter((r) => r.estado === "llego").length;
  const falto = filas.filter((r) => r.estado === "no_llego").length;
  const personasAgente = porLlamada.reduce((s, r) => s + r.personas, 0);

  const hora = (r: Fila) => Number(new Date(r.inicio!).toLocaleString("en-US", { timeZone: TZ, hour: "numeric", hour12: false }));
  const diaSemana = (r: Fila) => (new Date(new Date(r.inicio!).toLocaleString("en-US", { timeZone: TZ })).getDay() + 6) % 7;
  const conHora = validas.filter((r) => r.inicio);
  const horas = Array.from({ length: 24 }, (_, h) => ({ etiqueta: `${h % 12 || 12}${h < 12 ? "am" : "pm"}`, valor: conHora.filter((r) => hora(r) === h).length }))
    .filter((_, h) => h >= 12 && h <= 23);
  const semana = DIAS.map((d, i) => ({ etiqueta: d, valor: conHora.filter((r) => diaSemana(r) === i).length }));
  const canales = Object.entries(CANALES).map(([c, nombre]) => ({ nombre, valor: validas.filter((r) => r.canal === c).length })).filter((c) => c.valor);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-4xl">Resultados</h1>
        <div className="flex gap-1 rounded-full bg-white/80 p-1">
          {[7, 30, 90].map((d) => (
            <button key={d} onClick={() => setDias(d)}
              className={`rounded-full px-4 py-1.5 text-sm font-bold ${dias === d ? "bg-rojo text-white" : "text-ink/60"}`}>{d} días</button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Dato titulo="Llamadas atendidas por el agente" valor={llamadas} nota="Ninguna se quedó sin contestar" />
        <Dato titulo="Reservas tomadas por el agente" valor={porLlamada.length} nota={`${personasAgente} personas`} />
        <Dato titulo="Resueltas sin ayuda del equipo" valor={`${pct(solas.length, porLlamada.length)}%`} nota={`${solas.length} de ${porLlamada.length} reservas por llamada`} />
        <Dato titulo="Asistencia" valor={`${pct(llego, llego + falto)}%`} nota={`${llego} llegaron · ${falto} no llegaron`} />
      </div>

      <Tarjeta className="bg-rojo text-white">
        <p className="font-semibold text-white/80">Ventas estimadas de reservas del agente</p>
        <p className="font-serif text-5xl">${(personasAgente * ticket).toLocaleString("es-MX")}</p>
        <label className="mt-2 flex items-center gap-2 text-sm text-white/80">
          {personasAgente} personas × ticket promedio de $
          <input type="number" min={0} value={ticket} className="w-24 rounded-full bg-white/20 px-3 py-1 text-white outline-none"
            onChange={(e) => { setTicket(Number(e.target.value)); try { localStorage.setItem("arres-ticket", e.target.value); } catch {} }} />
          por persona
        </label>
      </Tarjeta>

      <div className="grid gap-4 lg:grid-cols-2">
        <Barras titulo="Horas pico" subtitulo="Reservas por hora de llegada" datos={horas} />
        <Barras titulo="Días con más reservas" subtitulo="Reservas por día de la semana" datos={semana} />
      </div>

      <Tarjeta className="bg-white/85">
        <h2 className="text-lg font-bold">Reservas por canal</h2>
        <div className="mt-4 space-y-3">
          {canales.map((c) => (
            <div key={c.nombre}>
              <div className="mb-1 flex justify-between text-sm"><span>{c.nombre}</span><span className="font-semibold">{c.valor} · {pct(c.valor, validas.length)}%</span></div>
              <div className="h-2.5 rounded-full bg-ink/5"><div className="h-full rounded-full bg-rojo" style={{ width: `${pct(c.valor, validas.length)}%` }} /></div>
            </div>
          ))}
          {!canales.length && <p className="text-sm text-ink/45">Todavía no hay reservas en este periodo.</p>}
        </div>
      </Tarjeta>
    </div>
  );
}

function Dato({ titulo, valor, nota }: { titulo: string; valor: number | string; nota: string }) {
  return (
    <Tarjeta className="bg-white/85">
      <p className="text-sm font-semibold text-ink/60">{titulo}</p>
      <p className="font-serif text-5xl">{valor}</p>
      <p className="mt-1 text-xs text-ink/50">{nota}</p>
    </Tarjeta>
  );
}

function Barras({ titulo, subtitulo, datos }: { titulo: string; subtitulo: string; datos: { etiqueta: string; valor: number }[] }) {
  const max = Math.max(1, ...datos.map((d) => d.valor));
  const pico = datos.reduce((a, b) => (b.valor > a.valor ? b : a), datos[0]);
  return (
    <Tarjeta className="bg-white/85">
      <h2 className="text-lg font-bold">{titulo}</h2>
      <p className="text-xs text-ink/50">{subtitulo}{pico?.valor ? ` · más reservas: ${pico.etiqueta}` : ""}</p>
      <div className="mt-5 flex h-40 items-end gap-1.5 border-b border-ink/10">
        {datos.map((d) => (
          <div key={d.etiqueta} className="group relative flex h-full flex-1 items-end" title={`${d.etiqueta}: ${d.valor} reservas`}>
            <div className="w-full rounded-t bg-rojo/85 transition-colors group-hover:bg-rojo" style={{ height: `${(d.valor / max) * 100}%`, minHeight: d.valor ? 4 : 0 }} />
            <span className="pointer-events-none absolute -top-6 left-1/2 hidden -translate-x-1/2 rounded bg-ink px-1.5 py-0.5 text-xs text-white group-hover:block">{d.valor}</span>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1.5">{datos.map((d) => <span key={d.etiqueta} className="flex-1 text-center text-[10px] text-ink/50">{d.etiqueta}</span>)}</div>
    </Tarjeta>
  );
}
