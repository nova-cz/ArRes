"use client";
import { hora, TZ } from "@/lib/supabase";
import { ESTADOS, Tarjeta, useReservas } from "@/lib/panel";

const claveDia = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ });

export default function Calendario() {
  const { reservas } = useReservas(7);
  const dias = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() + i * 86400000);
    return { clave: claveDia(d.toISOString()),
      titulo: d.toLocaleDateString("es-MX", { timeZone: TZ, weekday: "long", day: "numeric", month: "short" }) };
  });
  const activas = reservas.filter((r) => r.inicio && !["cancelada", "rechazada"].includes(r.estado));

  return (
    <div className="space-y-5">
      <h1 className="font-serif text-4xl">Próximos 7 días</h1>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {dias.map(({ clave, titulo }) => {
          const delDia = activas.filter((r) => claveDia(r.inicio!) === clave);
          const personas = delDia.reduce((s, r) => s + r.personas, 0);
          return (
            <Tarjeta key={clave} className="bg-white/80">
              <p className="font-bold capitalize">{titulo}</p>
              <p className="mb-3 text-sm text-ink/55">{delDia.length} reservas · {personas} personas</p>
              <div className="space-y-2">
                {delDia.map((r) => {
                  const [etiqueta, color] = ESTADOS[r.estado] ?? [r.estado, ""];
                  return (
                    <p key={r.id} className="rounded-xl bg-crema/70 px-3 py-2 text-sm">
                      <b>{hora(r.inicio!)}</b> · {r.nombre} · {r.personas}
                      <span className={`block text-xs font-semibold ${color}`}>{etiqueta}</span>
                    </p>
                  );
                })}
                {!delDia.length && <p className="text-sm text-ink/40">Sin reservas</p>}
              </div>
            </Tarjeta>
          );
        })}
      </div>
    </div>
  );
}
