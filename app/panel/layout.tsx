"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { House, Phone, ListChecks, SignOut } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import { RestauranteCtx, type Restaurante } from "@/lib/panel";

const menu = [
  { href: "/panel", label: "Hoy", Icono: House },
  { href: "/panel/llamadas", label: "Llamadas", Icono: Phone },
  { href: "/panel/reglas", label: "Reglas", Icono: ListChecks },
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
    <div className="min-h-screen bg-[url('/fotos/tenue.jpg')] bg-cover bg-fixed bg-center p-3 sm:p-6">
      <div className="glass mx-auto flex min-h-[calc(100vh-3rem)] max-w-7xl flex-col overflow-hidden rounded-[2rem] md:flex-row">
        <aside className="flex shrink-0 flex-row items-center gap-2 border-b border-white/60 bg-white/40 p-4 md:w-56 md:flex-col md:items-stretch md:border-b-0 md:border-r md:p-6">
          <a href="/" className="mr-auto text-2xl font-black md:mb-8 md:mr-0">Ar<span className="text-rojo">RES</span></a>
          {menu.map(({ href, label, Icono }) => (
            <a key={href} href={href}
              className={`flex items-center gap-3 rounded-2xl px-4 py-2.5 font-semibold transition-colors ${
                ruta === href ? "bg-rojo text-white shadow-lg" : "text-ink/70 hover:bg-white/70"}`}>
              <Icono size={20} /><span className="hidden sm:inline">{label}</span>
            </a>
          ))}
          <button onClick={salir} className="flex items-center gap-3 rounded-2xl px-4 py-2.5 font-semibold text-ink/60 hover:bg-white/70 md:mt-auto">
            <SignOut size={20} /><span className="hidden sm:inline">Salir</span>
          </button>
        </aside>
        <main className="min-w-0 flex-1 p-4 sm:p-8">
          {restaurante ? <RestauranteCtx.Provider value={restaurante}>{children}</RestauranteCtx.Provider>
            : <p className="text-ink/70">{aviso}</p>}
        </main>
      </div>
    </div>
  );
}
