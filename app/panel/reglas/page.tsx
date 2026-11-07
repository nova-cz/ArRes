"use client";
import { useEffect, useState } from "react";
import { supabase, type Reglas } from "@/lib/supabase";
import { useRestaurante } from "@/lib/panel";

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const NUMEROS: [keyof Reglas, string, string][] = [
  ["cupo_personas", "Cupo", "Personas con reserva al mismo tiempo"],
  ["max_personas", "Máximo por reserva", "Grupos más grandes pasan al equipo"],
  ["auto_aprobar_hasta", "Confirmar en la llamada hasta", "Personas; 0 = todo lo aprueba el equipo"],
  ["duracion_min", "Duración de la mesa", "Minutos"],
  ["anticipacion_min", "Anticipación mínima", "Minutos antes de la reserva"],
  ["tolerancia_min", "Tolerancia", "Minutos de espera antes de liberar la mesa"],
  ["max_faltas", "Faltas permitidas", "Con estas, ya no se confirma sola"],
];

export default function ReglasPage() {
  const restaurante = useRestaurante();
  const [reglas, setReglas] = useState<Reglas | null>(null);
  const [estado, setEstado] = useState("");

  useEffect(() => {
    supabase.from("reglas").select("*").eq("restaurante_id", restaurante.id).single()
      .then(({ data }) => setReglas(data));
  }, [restaurante.id]);

  if (!reglas) return <p className="text-ink/60">Cargando…</p>;

  const turno = (d: number) => reglas.horario[String(d)]?.[0];
  const setTurno = (d: number, valor: [string, string] | null) =>
    setReglas({ ...reglas, horario: { ...reglas.horario, [String(d)]: valor ? [valor] : [] } });

  async function guardar() {
    setEstado("Guardando…");
    const { restaurante_id, ...cambios } = reglas!;
    const { error } = await supabase.from("reglas").update(cambios).eq("restaurante_id", restaurante_id);
    setEstado(error ? "No se pudo guardar." : "Guardado. El agente ya usa estas reglas.");
  }

  const campo = "rounded-full border border-ink/10 bg-white px-4 py-2 outline-none focus:border-rojo";

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-4xl">Reglas de la casa</h1>

      <section className="rounded-[1.75rem] border border-white/80 bg-white/85 p-6">
        <h2 className="mb-3 font-bold">Horario de reservas</h2>
        <div className="space-y-2">
          {DIAS.map((nombre, d) => {
            const t = turno(d);
            return (
              <div key={d} className="flex flex-wrap items-center gap-3">
                <span className="w-24 font-semibold">{nombre}</span>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={!!t} onChange={(e) => setTurno(d, e.target.checked ? ["13:00", "23:00"] : null)} />
                  Abre
                </label>
                {t && <>
                  <input type="time" value={t[0]} onChange={(e) => setTurno(d, [e.target.value, t[1]])} className={campo} />
                  <span>a</span>
                  <input type="time" value={t[1]} onChange={(e) => setTurno(d, [t[0], e.target.value])} className={campo} />
                </>}
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 rounded-[1.75rem] border border-white/80 bg-white/85 p-6 sm:grid-cols-2">
        {NUMEROS.map(([clave, titulo, ayuda]) => (
          <label key={clave} className="flex flex-col gap-1">
            <span className="font-semibold">{titulo}</span>
            <input type="number" min={0} value={reglas[clave] as number}
              onChange={(e) => setReglas({ ...reglas, [clave]: Number(e.target.value) })} className={campo} />
            <span className="text-xs text-ink/60">{ayuda}</span>
          </label>
        ))}
      </section>


      <div className="flex items-center gap-4">
        <button onClick={guardar} className="rounded-full bg-rojo px-6 py-3 font-bold text-white hover:bg-granate">Guardar</button>
        <span className="text-sm text-ink/70">{estado}</span>
      </div>
    </div>
  );
}
