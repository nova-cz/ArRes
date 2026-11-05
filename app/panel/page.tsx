"use client";
import { useCallback, useEffect, useState } from "react";
import { ForkKnife, Phone, Warning } from "@phosphor-icons/react";
import { supabase, hora, dia, rangoDia, type Reserva, type Reglas } from "@/lib/supabase";
import { useRestaurante } from "@/lib/panel";

const ESTADOS: Record<string, [string, string]> = {
  confirmada: ["Confirmada", "text-green-700"],
  pendiente: ["Por confirmar", "text-naranja"],
  escalada: ["Escalada", "text-rojo"],
  llego: ["Llegó", "text-sky-700"],
  no_llego: ["No llegó", "text-ink/50"],
  rechazada: ["Rechazada", "text-ink/50"],
  cancelada: ["Cancelada", "text-ink/50"],
};

const minutosDesde = (iso: string) => (Date.now() - new Date(iso).getTime()) / 60000;

export default function Hoy() {
  const restaurante = useRestaurante();
  const [vista, setVista] = useState<"hoy" | "semana">("hoy");
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [reglas, setReglas] = useState<Reglas | null>(null);
  const [buscar, setBuscar] = useState("");
  const [, setTic] = useState(0);

  const cargar = useCallback(async () => {
    const [desde, hasta] = vista === "hoy" ? rangoDia(0) : rangoDia(0, 8);
    const { data } = await supabase.from("reservas").select("*")
      .eq("restaurante_id", restaurante.id)
      .or(`and(inicio.gte.${desde},inicio.lt.${hasta}),and(inicio.is.null,estado.eq.escalada)`)
      .order("inicio", { ascending: true, nullsFirst: true });
    setReservas(data ?? []);
  }, [restaurante.id, vista]);

  useEffect(() => {
    cargar();
    supabase.from("reglas").select("*").eq("restaurante_id", restaurante.id).single()
      .then(({ data }) => setReglas(data));
    // En vivo: lo que el agente agenda por teléfono aparece sin recargar.
    const canal = supabase.channel("reservas")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservas",
        filter: `restaurante_id=eq.${restaurante.id}` }, cargar)
      .subscribe();
    const reloj = setInterval(() => setTic((t) => t + 1), 30000); // refresca alertas de tiempo
    return () => { supabase.removeChannel(canal); clearInterval(reloj); };
  }, [cargar, restaurante.id]);

  async function cambiar(id: string, estado: string) {
    setReservas((rs) => rs.map((r) => (r.id === id ? { ...r, estado } : r)));
    await supabase.from("reservas").update({ estado }).eq("id", id);
  }

  const q = buscar.toLowerCase();
  const lista = reservas.filter((r) => !q || r.nombre.toLowerCase().includes(q) || r.telefono.includes(q));
  const de = (e: string) => lista.filter((r) => r.estado === e);
  const porConfirmar = de("pendiente").length + de("escalada").length;

  const alerta = (r: Reserva) => {
    if (!reglas) return "";
    if (["pendiente", "escalada"].includes(r.estado) && minutosDesde(r.creado_en) > reglas.minutos_alerta)
      return "Sin respuesta";
    if (r.estado === "confirmada" && r.inicio && minutosDesde(r.inicio) > reglas.tolerancia_min)
      return "¿Llegó?";
    return "";
  };

  const tarjetas = [
    { t: "Confirmadas", e: "confirmada", bg: "bg-green-100/80" },
    { t: "Por confirmar", e: "pendiente", bg: "bg-orange-100/80" },
    { t: "Escaladas", e: "escalada", bg: "bg-red-100/80" },
  ];

  return (
    <div className="space-y-6">
      <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar nombre o teléfono…"
        className="w-full rounded-full border border-white/70 bg-white/70 px-5 py-3 outline-none focus:border-rojo" />

      <section className="relative overflow-hidden rounded-[2rem] bg-rojo p-8 text-white">
        <ForkKnife size={140} weight="thin" className="absolute -right-2 top-2 opacity-25" />
        <div className="mb-4 flex gap-2">
          {(["hoy", "semana"] as const).map((v) => (
            <button key={v} onClick={() => setVista(v)}
              className={`rounded-full px-4 py-1 text-sm font-bold ${vista === v ? "bg-white text-rojo" : "bg-white/20"}`}>
              {v === "hoy" ? "Hoy" : "Próximos 7 días"}
            </button>
          ))}
        </div>
        <h1 className="font-serif text-4xl">{vista === "hoy" ? "Reservas de hoy" : "Próximas reservas"}</h1>
        <p className="mt-2 text-white/85">
          {restaurante.nombre} · {lista.length} reservas · {porConfirmar} esperan a tu equipo
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        {tarjetas.map(({ t, e, bg }) => (
          <div key={e} className={`rounded-[1.5rem] p-5 ${bg}`}>
            <p className="font-semibold">{t}</p>
            <p className="font-serif text-4xl">{de(e).length}</p>
            <div className="mt-3 space-y-2">
              {de(e).slice(0, 3).map((r) => (
                <p key={r.id} className="truncate rounded-xl bg-white/70 px-3 py-2 text-sm">
                  {r.inicio ? hora(r.inicio) : "Sin hora"} · {r.nombre} · {r.personas}
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>

      <section className="overflow-x-auto rounded-[1.5rem] bg-white/80 p-5">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="text-left text-ink/50">
            <tr><th className="py-2">Hora</th><th>Cliente</th><th>Pers.</th><th>Estado</th><th>Notas</th><th /></tr>
          </thead>
          <tbody>
            {lista.map((r) => {
              const [etiqueta, color] = ESTADOS[r.estado] ?? [r.estado, ""];
              const aviso = alerta(r);
              return (
                <tr key={r.id} className="border-t border-ink/5 align-top">
                  <td className="py-3 font-semibold">
                    {r.inicio ? hora(r.inicio) : "—"}
                    {vista === "semana" && r.inicio && <span className="block text-xs text-ink/50">{dia(r.inicio)}</span>}
                  </td>
                  <td>
                    {r.nombre}
                    <a href={`tel:${r.telefono}`} className="flex items-center gap-1 text-xs text-ink/60 hover:text-rojo">
                      <Phone size={12} />{r.telefono} · {r.canal}
                    </a>
                  </td>
                  <td>{r.personas}</td>
                  <td className={`font-semibold ${color}`}>
                    {etiqueta}
                    {aviso && <span className="mt-1 flex items-center gap-1 text-xs text-rojo"><Warning size={12} />{aviso}</span>}
                  </td>
                  <td className="max-w-[220px] text-xs text-ink/70">{[r.motivo_escalada, r.notas].filter(Boolean).join(" · ")}</td>
                  <td className="space-x-1 whitespace-nowrap text-right">
                    {["pendiente", "escalada"].includes(r.estado) && <>
                      <Accion onClick={() => cambiar(r.id, "confirmada")} principal>Aprobar</Accion>
                      <Accion onClick={() => cambiar(r.id, "rechazada")}>Rechazar</Accion>
                    </>}
                    {r.estado === "confirmada" && <>
                      <Accion onClick={() => cambiar(r.id, "llego")} principal>Llegó</Accion>
                      <Accion onClick={() => cambiar(r.id, "no_llego")}>No llegó</Accion>
                    </>}
                  </td>
                </tr>
              );
            })}
            {!lista.length && <tr><td colSpan={6} className="py-8 text-center text-ink/50">No hay reservas.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Accion({ children, onClick, principal }: { children: React.ReactNode; onClick: () => void; principal?: boolean }) {
  return (
    <button onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-bold ${principal ? "bg-rojo text-white hover:bg-granate" : "bg-ink/5 hover:bg-ink/10"}`}>
      {children}
    </button>
  );
}
