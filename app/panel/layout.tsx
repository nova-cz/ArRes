"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { House, CalendarBlank, Phone, Users, ListChecks, Gear, SignOut } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import { RestauranteCtx, type Restaurante } from "@/lib/panel";

const menu = [
  { href: "/panel", label: "Hoy", Icono: House },
  { href: "/panel/calendario", label: "Calendario", Icono: CalendarBlank },
  { href: "/panel/llamadas", label: "Llamadas", Icono: Phone },
  { href: "/panel/clientes", label: "Clientes", Icono: Users },
  { href: "/panel/reglas", label: "Reglas", Icono: ListChecks },
  { href: "/panel/ajustes", label: "Ajustes", Icono: Gear },
];

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const ruta = usePathname();
  const [restaurante, setRestaurante] = useState<Restaurante | null>(null);
  const [aviso, setAviso] = useState("Cargando…");

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.replace("/login");
      // RLS solo deja ver los restaurantes donde el usuario está en "miembros".
      const { data } = await supabase.from("restaurantes").select("id, nombre").limit(1);
      if (data?.[0]) setRestaurante(data[0]);
      else setAviso("Tu usuario todavía no tiene un restaurante asignado.");
    })();
  }, [router]);

  async function salir() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="flex shrink-0 items-center gap-1 overflow-x-auto px-4 py-4 md:sticky md:top-0 md:h-screen md:w-60 md:flex-col md:items-stretch md:gap-2 md:px-5 md:py-8">
        <a href="/" className="mr-4 text-3xl font-black md:mb-8 md:ml-3 md:mr-0">Ar<span className="text-rojo">RES</span></a>
        {menu.map(({ href, label, Icono }) => (
          <a key={href} href={href}
            className={`flex shrink-0 items-center gap-3 rounded-2xl px-4 py-3 font-semibold transition-colors ${
              ruta === href ? "bg-rojo text-white shadow-[0_8px_20px_rgba(192,22,26,.3)]" : "text-ink/65 hover:bg-white/70"}`}>
            <Icono size={22} /><span className="hidden lg:inline">{label}</span>
          </a>
        ))}
        <button onClick={salir} className="flex shrink-0 items-center gap-3 rounded-2xl px-4 py-3 font-semibold text-ink/50 hover:bg-white/70 md:mt-auto">
          <SignOut size={22} /><span className="hidden lg:inline">Salir</span>
        </button>
      </aside>
      <main className="min-w-0 flex-1 px-4 pb-10 md:py-8 md:pr-8">
        {restaurante ? <RestauranteCtx.Provider value={restaurante}>{children}</RestauranteCtx.Provider>
          : <p className="pt-4 text-ink/70">{aviso}</p>}
      </main>
    </div>
  );
}
