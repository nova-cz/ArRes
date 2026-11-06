"use client";
import { useCallback, useEffect, useState } from "react";
import { Trash, UserPlus } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";

type Miembro = { user_id: string; email: string; rol: string };

// Invitar = guardar el correo. Cuando esa persona entra (con Google o correo), recibe acceso solo.
export default function Equipo({ restauranteId }: { restauranteId: string }) {
  const [miembros, setMiembros] = useState<Miembro[]>([]);
  const [invitados, setInvitados] = useState<string[]>([]);
  const [yo, setYo] = useState("");
  const [correo, setCorreo] = useState("");
  const [aviso, setAviso] = useState("");

  const cargar = useCallback(async () => {
    const [{ data: m }, { data: i }, { data: u }] = await Promise.all([
      supabase.rpc("equipo", { rid: restauranteId }),
      supabase.from("invitaciones").select("email").eq("restaurante_id", restauranteId),
      supabase.auth.getUser(),
    ]);
    setMiembros(m ?? []);
    setInvitados((i ?? []).map((x) => x.email));
    setYo(u.user?.id ?? "");
  }, [restauranteId]);

  useEffect(() => { cargar(); }, [cargar]);

  const soyDueno = miembros.some((m) => m.user_id === yo && m.rol === "dueno");

  async function invitar(e: React.FormEvent) {
    e.preventDefault();
    const email = correo.trim().toLowerCase();
    const { error } = await supabase.from("invitaciones").insert({ restaurante_id: restauranteId, email });
    setAviso(error ? "No se pudo invitar (¿ya estaba invitado?)." : `Listo. Pídele a ${email} que entre a ArRES con ese correo.`);
    setCorreo("");
    cargar();
  }

  async function quitarInvitacion(email: string) {
    await supabase.from("invitaciones").delete().match({ restaurante_id: restauranteId, email });
    cargar();
  }

  async function quitarMiembro(userId: string) {
    await supabase.from("miembros").delete().match({ restaurante_id: restauranteId, user_id: userId });
    cargar();
  }

  return (
    <section className="rounded-[1.75rem] border border-white/80 bg-white/85 p-6">
      <h2 className="text-lg font-bold">Equipo</h2>
      <p className="mb-4 text-xs text-ink/55">Quién puede ver y aprobar reservas en este panel.</p>
      <ul className="mb-4 divide-y divide-ink/5">
        {miembros.map((m) => (
          <li key={m.user_id} className="flex items-center justify-between py-2.5">
            <span>{m.email} {m.user_id === yo && <span className="text-ink/45">(tú)</span>}</span>
            <span className="flex items-center gap-3 text-sm text-ink/55">
              {m.rol === "dueno" ? "Dueño" : "Equipo"}
              {soyDueno && m.user_id !== yo &&
                <button onClick={() => quitarMiembro(m.user_id)} className="text-ink/40 hover:text-rojo" title="Quitar"><Trash size={18} /></button>}
            </span>
          </li>
        ))}
        {invitados.map((email) => (
          <li key={email} className="flex items-center justify-between py-2.5 text-ink/60">
            <span>{email}</span>
            <span className="flex items-center gap-3 text-sm">Invitado, aún no entra
              <button onClick={() => quitarInvitacion(email)} className="text-ink/40 hover:text-rojo" title="Cancelar invitación"><Trash size={18} /></button>
            </span>
          </li>
        ))}
      </ul>
      <form onSubmit={invitar} className="flex flex-wrap gap-2">
        <input type="email" required value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="correo@ejemplo.com"
          className="min-w-0 flex-1 rounded-2xl border border-ink/10 bg-white px-4 py-2.5 outline-none focus:border-rojo" />
        <button className="flex items-center gap-2 rounded-2xl bg-rojo px-5 py-2.5 font-bold text-white hover:bg-granate">
          <UserPlus size={18} />Invitar
        </button>
      </form>
      {aviso && <p className="mt-2 text-sm text-ink/70">{aviso}</p>}
    </section>
  );
}
