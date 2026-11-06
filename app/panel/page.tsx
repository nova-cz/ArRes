"use client";
import { useEffect, useState } from "react";
import { Bell, BowlFood, Hamburger, Cake, ForkKnife, MagnifyingGlass, Phone, Warning } from "@phosphor-icons/react";
import { supabase, hora, dia, type Reserva } from "@/lib/supabase";
import { Accion, ESTADOS, Tarjeta, useReglas, useReservas, useRestaurante } from "@/lib/panel";

const minutosDesde = (iso: string) => (Date.now() - new Date(iso).getTime()) / 60000;

export default function Hoy() {
  const restaurante = useRestaurante();
  const { reservas, cambiar } = useReservas(1);
  // Lo que espera al equipo puede ser de otro día: se buscan los próximos 30.
  const { reservas: proximas, cambiar: cambiarProxima } = useReservas(30);
  const [reglas] = useReglas();
  const [buscar, setBuscar] = useState("");
  const [soloPendientes, setSoloPendientes] = useState(false);
  const [notas, setNotas] = useState("");
  const [, setTic] = useState(0);

  useEffect(() => {
    supabase.from("restaurantes").select("notas_equipo").eq("id", restaurante.id).single()
      .then(({ data }) => setNotas(data?.notas_equipo ?? ""));
    const reloj = setInterval(() => setTic((t) => t + 1), 30000); // refresca alertas de tiempo
    return () => clearInterval(reloj);
  }, [restaurante.id]);

  const esperan = (r: Reserva) => ["pendiente", "escalada"].includes(r.estado);
  const q = buscar.toLowerCase();
  const pendientes = proximas.filter(esperan);
  const base = soloPendientes ? pendientes : reservas;
  const lista = base.filter((r) => !q || r.nombre.toLowerCase().includes(q) || r.telefono.includes(q));
  const de = (e: string) => reservas.filter((r) => r.estado === e);
  const porAprobar = pendientes.length;
  const actualizar = (id: string, estado: string) => { cambiar(id, estado); cambiarProxima(id, estado); };

  const alerta = (r: Reserva) => {
    if (!reglas) return "";
    if (esperan(r) && minutosDesde(r.creado_en) > reglas.minutos_alerta) return "Sin respuesta";
    if (r.estado === "confirmada" && r.inicio && minutosDesde(r.inicio) > reglas.tolerancia_min) return "¿Llegó?";
    return "";
  };

  const tarjetas = [
    { t: "Confirmadas", e: "confirmada", bg: "bg-[#E3EFDF]/90", Icono: BowlFood },
    { t: "Por confirmar", e: "pendiente", bg: "bg-[#FBE5CB]/90", Icono: Hamburger },
    { t: "Escaladas", e: "escalada", bg: "bg-[#F6D6D3]/90", Icono: Cake },
  ];

  return (
    <div className="space-y-5">
      <div className="flex gap-3">
        <label className="flex flex-1 items-center gap-2 rounded-full border border-white/80 bg-white/70 px-5 py-3">
          <MagnifyingGlass size={18} className="text-ink/40" />
          <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar reserva, nombre o teléfono…"
            className="w-full bg-transparent outline-none" />
        </label>
        <button onClick={() => setSoloPendientes(true)}
          className="flex items-center gap-2 rounded-full border border-white/80 bg-white/80 px-5 font-semibold">
          <Bell size={18} className="text-rojo" />{porAprobar} por aprobar
        </button>
      </div>

      <section className="relative overflow-hidden rounded-[1.75rem] bg-rojo px-8 py-9 text-white shadow-[0_12px_40px_rgba(192,22,26,.25)]">
        <ForkKnife size={170} weight="light" className="absolute right-8 top-1/2 -translate-y-1/2 opacity-25" />
        <h1 className="font-serif text-4xl">Reservas de hoy</h1>
        <p className="mt-2 text-white/85">{reservas.length} reservas hoy · {porAprobar} esperan a tu equipo</p>
        <button onClick={() => setSoloPendientes(!soloPendientes)}
          className="mt-5 rounded-full bg-white px-5 py-2 font-bold text-rojo hover:bg-crema">
          {soloPendientes ? "Ver todas" : "Revisar pendientes"}
        </button>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        {tarjetas.map(({ t, e, bg, Icono }) => (
          <Tarjeta key={e} className={bg}>
            <div className="flex items-start justify-between">
              <div><p className="font-semibold">{t}</p><p className="font-serif text-5xl">{de(e).length}</p></div>
              <span className="grid h-16 w-16 place-items-center rounded-full bg-white text-rojo shadow"><Icono size={30} /></span>
            </div>
            <div className="mt-4 space-y-2">
              {de(e).slice(0, 3).map((r) => (
                <p key={r.id} className="truncate rounded-xl bg-white/70 px-3 py-2 text-sm">
                  {r.inicio ? hora(r.inicio) : "Sin hora"} · {r.nombre} · {r.personas}
                </p>
              ))}
            </div>
          </Tarjeta>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Tarjeta className="overflow-x-auto bg-white/85">
          <h2 className="mb-3 text-lg font-bold">{soloPendientes ? "Esperan a tu equipo" : "Próximas reservas"}</h2>
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-ink/45">
              <tr><th className="py-2 font-medium">Hora</th><th className="font-medium">Nombre</th><th className="font-medium">Pers.</th><th className="font-medium">Estado</th><th /></tr>
            </thead>
            <tbody>
              {lista.map((r) => {
                const [etiqueta, color] = ESTADOS[r.estado] ?? [r.estado, ""];
                const aviso = alerta(r);
                const detalle = [r.motivo_escalada, r.notas].filter(Boolean).join(" · ");
                return (
                  <tr key={r.id} className="border-t border-ink/5 align-top">
                    <td className="py-3 font-semibold">
                      {r.inicio ? hora(r.inicio) : "—"}
                      {soloPendientes && r.inicio && <span className="block text-xs font-normal capitalize text-ink/50">{dia(r.inicio)}</span>}
                    </td>
                    <td>
                      {r.nombre}
                      <a href={`tel:${r.telefono}`} className="flex items-center gap-1 text-xs text-ink/55 hover:text-rojo"><Phone size={12} />{r.telefono}</a>
                      {detalle && <span className="block max-w-[240px] text-xs text-ink/55">{detalle}</span>}
                    </td>
                    <td>{r.personas}</td>
                    <td className={`font-semibold ${color}`}>
                      {etiqueta}
                      {aviso && <span className="mt-1 flex items-center gap-1 text-xs text-rojo"><Warning size={12} />{aviso}</span>}
                    </td>
                    <td className="space-x-1 whitespace-nowrap text-right">
                      {esperan(r) && <><Accion onClick={() => actualizar(r.id, "confirmada")} principal>Aprobar</Accion>
                        <Accion onClick={() => actualizar(r.id, "rechazada")}>Rechazar</Accion></>}
                      {r.estado === "confirmada" && <><Accion onClick={() => actualizar(r.id, "llego")} principal>Llegó</Accion>
                        <Accion onClick={() => actualizar(r.id, "no_llego")}>No llegó</Accion></>}
                    </td>
                  </tr>
                );
              })}
              {!lista.length && <tr><td colSpan={5} className="py-8 text-center text-ink/45">No hay reservas.</td></tr>}
            </tbody>
          </table>
        </Tarjeta>

        <Tarjeta className="bg-[#FBF1C4]/90">
          <h2 className="mb-3 text-lg font-bold">Notas del equipo</h2>
          <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={8}
            onBlur={() => supabase.from("restaurantes").update({ notas_equipo: notas }).eq("id", restaurante.id)}
            placeholder={"Ej. Terraza cerrada si llueve.\nMesa 6 reservada para cumpleaños."}
            className="w-full resize-none bg-transparent leading-relaxed outline-none placeholder:text-ink/35" />
          <p className="text-xs text-ink/45">Se guarda al salir del cuadro.</p>
        </Tarjeta>
      </div>
    </div>
  );
}
