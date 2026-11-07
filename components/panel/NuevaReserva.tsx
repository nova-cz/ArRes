"use client";
import { useState } from "react";
import { X } from "@phosphor-icons/react";
import { supabase, TZ, type Reglas } from "@/lib/supabase";

// Para cuando contesta una persona del equipo o alguien llega sin reserva.
// La crea el equipo, así que queda confirmada sin pasar por las reglas automáticas.
export default function NuevaReserva({ restauranteId, reglas, cerrar }:
  { restauranteId: string; reglas: Reglas | null; cerrar: () => void }) {
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: TZ });
  const [f, setF] = useState({ nombre: "", telefono: "", personas: 2, fecha: hoy, hora: "20:00", notas: "" });
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    const digitos = f.telefono.replace(/\D/g, "");
    if (digitos.length !== 10) return setError("El teléfono debe tener 10 dígitos.");
    setGuardando(true);
    const inicio = new Date(`${f.fecha}T${f.hora}:00-06:00`);
    const fin = new Date(inicio.getTime() + (reglas?.duracion_min ?? 90) * 60000);
    const { error } = await supabase.from("reservas").insert({
      restaurante_id: restauranteId, nombre: f.nombre.trim(), telefono: `+52${digitos}`,
      personas: f.personas, inicio: inicio.toISOString(), fin: fin.toISOString(),
      estado: "confirmada", canal: "panel", notas: f.notas.trim(),
    });
    setGuardando(false);
    if (error) return setError("No se pudo guardar la reserva.");
    cerrar();
  }

  const campo = "w-full rounded-2xl border border-ink/10 bg-white px-4 py-2.5 outline-none focus:border-rojo";
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/30 p-4 backdrop-blur-sm" onClick={cerrar}>
      <form onSubmit={guardar} onClick={(e) => e.stopPropagation()}
        className="aparecer grid w-full max-w-lg gap-3 rounded-[1.75rem] bg-papel p-7 shadow-2xl sm:grid-cols-2">
        <div className="flex items-center justify-between sm:col-span-2">
          <h2 className="font-serif text-2xl">Nueva reserva</h2>
          <button type="button" onClick={cerrar} className="p-1 text-ink/50 hover:text-rojo"><X size={22} /></button>
        </div>
        <label className="sm:col-span-2"><span className="text-sm font-semibold">Nombre</span>
          <input required value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} className={campo} /></label>
        <label><span className="text-sm font-semibold">Teléfono</span>
          <input required inputMode="tel" placeholder="222 123 4567" value={f.telefono} onChange={(e) => setF({ ...f, telefono: e.target.value })} className={campo} /></label>
        <label><span className="text-sm font-semibold">Personas</span>
          <input type="number" min={1} value={f.personas} onChange={(e) => setF({ ...f, personas: Number(e.target.value) })} className={campo} /></label>
        <label><span className="text-sm font-semibold">Fecha</span>
          <input type="date" value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} className={campo} /></label>
        <label><span className="text-sm font-semibold">Hora</span>
          <input type="time" value={f.hora} onChange={(e) => setF({ ...f, hora: e.target.value })} className={campo} /></label>
        <label className="sm:col-span-2"><span className="text-sm font-semibold">Notas</span>
          <input placeholder="Cumpleaños, silla para bebé…" value={f.notas} onChange={(e) => setF({ ...f, notas: e.target.value })} className={campo} /></label>
        {error && <p className="text-sm font-semibold text-rojo sm:col-span-2">{error}</p>}
        <button disabled={guardando} className="rounded-2xl bg-rojo py-3 font-bold text-white hover:bg-granate disabled:opacity-60 sm:col-span-2">
          {guardando ? "Guardando…" : "Guardar reserva"}
        </button>
      </form>
    </div>
  );
}
