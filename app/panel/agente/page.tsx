"use client";
import { useEffect, useState } from "react";
import { Plus, Trash, Sparkle } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import { Tarjeta, useRestaurante } from "@/lib/panel";

type Agente = { nombre: string; voz: string; tono: string; saludo: string; sobre_negocio: string };
type Platillo = { categoria: string; nombre: string; descripcion: string; precio: number | null; vegetariano: boolean; disponible: boolean };
type Faq = { pregunta: string; respuesta: string };
type Promo = { texto: string; termina: string | null };

const VOCES = [
  ["aura-2-celeste-es", "Celeste (mujer)"], ["aura-2-estrella-es", "Estrella (mujer)"],
  ["aura-2-carina-es", "Carina (mujer)"], ["aura-2-diana-es", "Diana (mujer)"],
  ["aura-2-nestor-es", "Néstor (hombre)"], ["aura-2-alvaro-es", "Álvaro (hombre)"],
  ["aura-2-sirio-es", "Sirio (hombre)"], ["aura-2-javier-es", "Javier (hombre)"],
];
const LIMITE = 200;
const campo = "w-full rounded-2xl border border-ink/10 bg-white px-4 py-2.5 outline-none focus:border-rojo";
const palabras = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;

export default function AgentePage() {
  const { id } = useRestaurante();
  const [agente, setAgente] = useState<Agente | null>(null);
  const [platillos, setPlatillos] = useState<Platillo[]>([]);
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [promos, setPromos] = useState<Promo[]>([]);
  const [pegado, setPegado] = useState("");
  const [leyendo, setLeyendo] = useState(false);
  const [estado, setEstado] = useState("");

  useEffect(() => {
    const de = { restaurante_id: id };
    Promise.all([
      supabase.from("agente").select("nombre, voz, tono, saludo, sobre_negocio").match(de).maybeSingle(),
      supabase.from("platillos").select("categoria, nombre, descripcion, precio, vegetariano, disponible").match(de).order("orden"),
      supabase.from("faqs").select("pregunta, respuesta").match(de).order("orden"),
      supabase.from("promociones").select("texto, termina").match(de),
    ]).then(([a, p, f, pr]) => {
      setAgente(a.data ?? { nombre: "Sofi", voz: VOCES[0][0], tono: "calido", saludo: "", sobre_negocio: "" });
      setPlatillos(p.data ?? []); setFaqs(f.data ?? []); setPromos(pr.data ?? []);
    });
  }, [id]);

  if (!agente) return <p className="text-ink/60">Cargando…</p>;

  const editar = <T,>(lista: T[], set: (l: T[]) => void, i: number, cambio: Partial<T>) =>
    set(lista.map((x, j) => (j === i ? { ...x, ...cambio } : x)));
  const quitar = <T,>(lista: T[], set: (l: T[]) => void, i: number) => set(lista.filter((_, j) => j !== i));

  async function leerMenu() {
    setLeyendo(true);
    const { data: { session } } = await supabase.auth.getSession();
    const r = await fetch("/api/menu", { method: "POST", body: JSON.stringify({ texto: pegado }),
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` } });
    const datos = await r.json();
    setLeyendo(false);
    if (!r.ok) return setEstado(datos.error);
    setPlatillos([...platillos, ...datos.platillos.map((p: Platillo) => ({
      categoria: p.categoria ?? "", nombre: p.nombre, descripcion: p.descripcion ?? "",
      precio: p.precio ?? null, vegetariano: !!p.vegetariano, disponible: true }))]);
    setPegado("");
    setEstado(`Se agregaron ${datos.platillos.length} platillos. Revísalos y guarda.`);
  }

  async function guardar() {
    setEstado("Guardando…");
    const de = { restaurante_id: id };
    // Las listas son cortas: se reemplazan completas.
    const reemplazar = async (tabla: string, filas: object[]) => {
      const borrado = await supabase.from(tabla).delete().match(de);
      if (borrado.error || !filas.length) return borrado.error;
      return (await supabase.from(tabla).insert(filas.map((f) => ({ ...f, ...de })))).error;
    };
    const errores = await Promise.all([
      supabase.from("agente").upsert({ ...agente!, ...de }).then((r) => r.error),
      reemplazar("platillos", platillos.filter((p) => p.nombre.trim()).map((p, orden) => ({ ...p, orden }))),
      reemplazar("faqs", faqs.filter((f) => f.pregunta.trim() && f.respuesta.trim()).map((f, orden) => ({ ...f, orden }))),
      reemplazar("promociones", promos.filter((p) => p.texto.trim()).map((p) => ({ ...p, termina: p.termina || null }))),
    ]);
    setEstado(errores.some(Boolean) ? "No se pudo guardar. ¿Corriste migracion_04_agente.sql?" : "Guardado. El agente lo usa desde la siguiente llamada.");
  }

  const n = palabras(agente.sobre_negocio);

  return (
    <div className="space-y-5">
      <h1 className="font-serif text-4xl">Tu agente</h1>

      <Tarjeta className="grid gap-4 bg-white/85 sm:grid-cols-2">
        <h2 className="text-lg font-bold sm:col-span-2">Identidad</h2>
        <label><span className="font-semibold">Nombre del agente</span>
          <input value={agente.nombre} onChange={(e) => setAgente({ ...agente, nombre: e.target.value })} className={campo} /></label>
        <label><span className="font-semibold">Voz</span>
          <select value={agente.voz} onChange={(e) => setAgente({ ...agente, voz: e.target.value })} className={campo}>
            {VOCES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select></label>
        <label><span className="font-semibold">Tono</span>
          <select value={agente.tono} onChange={(e) => setAgente({ ...agente, tono: e.target.value })} className={campo}>
            <option value="calido">Cálido y casual (tutea)</option><option value="formal">Amable y formal (de usted)</option>
          </select></label>
        <label><span className="font-semibold">Saludo</span>
          <input value={agente.saludo} placeholder="Ej. ¡Hola! Gracias por llamar a La Talavera."
            onChange={(e) => setAgente({ ...agente, saludo: e.target.value })} className={campo} />
          <span className="text-xs text-ink/55">Al final siempre se agrega el aviso de IA y de grabación.</span></label>
      </Tarjeta>

      <Tarjeta className="bg-white/85">
        <h2 className="text-lg font-bold">Sobre tu negocio</h2>
        <p className="mb-2 text-xs text-ink/55">Tipo de cocina, historia y ambiente. Corto: el agente lo dice por teléfono.</p>
        <textarea rows={4} value={agente.sobre_negocio} onChange={(e) => setAgente({ ...agente, sobre_negocio: e.target.value })}
          placeholder="Ej. Cocina poblana tradicional desde 1998, ambiente familiar y terraza pet friendly." className={campo} />
        <p className={`text-right text-xs ${n > LIMITE ? "font-bold text-rojo" : "text-ink/50"}`}>{n} / {LIMITE} palabras</p>
      </Tarjeta>

      <Tarjeta className="overflow-x-auto bg-white/85">
        <h2 className="text-lg font-bold">Menú</h2>
        <p className="mb-3 text-xs text-ink/55">El agente solo menciona lo que esté aquí y disponible.</p>
        <div className="mb-4 rounded-2xl bg-crema/70 p-4">
          <p className="mb-2 flex items-center gap-2 font-semibold"><Sparkle size={18} className="text-rojo" />Pegar menú</p>
          <textarea rows={3} value={pegado} onChange={(e) => setPegado(e.target.value)} className={campo}
            placeholder="Copia el texto de tu menú (de tu página, Word, Instagram…) y pégalo aquí." />
          <button onClick={leerMenu} disabled={!pegado.trim() || leyendo}
            className="mt-2 rounded-full bg-ink px-5 py-2 text-sm font-bold text-white disabled:opacity-40">
            {leyendo ? "Leyendo…" : "Llenar la tabla"}
          </button>
        </div>
        <table className="w-full min-w-[720px] text-sm">
          <thead className="text-left text-ink/45"><tr>
            <th className="py-2 font-medium">Categoría</th><th className="font-medium">Platillo</th><th className="font-medium">Descripción</th>
            <th className="font-medium">Precio</th><th className="font-medium">Veg.</th><th className="font-medium">Disponible</th><th /></tr></thead>
          <tbody>
            {platillos.map((p, i) => (
              <tr key={i} className="border-t border-ink/5">
                <td className="py-1.5 pr-2"><input value={p.categoria} onChange={(e) => editar(platillos, setPlatillos, i, { categoria: e.target.value })} className={campo} /></td>
                <td className="pr-2"><input value={p.nombre} onChange={(e) => editar(platillos, setPlatillos, i, { nombre: e.target.value })} className={campo} /></td>
                <td className="pr-2"><input value={p.descripcion} onChange={(e) => editar(platillos, setPlatillos, i, { descripcion: e.target.value })} className={campo} /></td>
                <td className="w-24 pr-2"><input type="number" value={p.precio ?? ""} onChange={(e) => editar(platillos, setPlatillos, i, { precio: e.target.value ? Number(e.target.value) : null })} className={campo} /></td>
                <td className="text-center"><input type="checkbox" checked={p.vegetariano} onChange={(e) => editar(platillos, setPlatillos, i, { vegetariano: e.target.checked })} /></td>
                <td className="text-center"><input type="checkbox" checked={p.disponible} onChange={(e) => editar(platillos, setPlatillos, i, { disponible: e.target.checked })} /></td>
                <td><button onClick={() => quitar(platillos, setPlatillos, i)} className="p-2 text-ink/40 hover:text-rojo"><Trash size={18} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <Agregar onClick={() => setPlatillos([...platillos, { categoria: platillos.at(-1)?.categoria ?? "", nombre: "", descripcion: "", precio: null, vegetariano: false, disponible: true }])}>Agregar platillo</Agregar>
      </Tarjeta>

      <div className="grid gap-4 lg:grid-cols-2">
        <Tarjeta className="bg-white/85">
          <h2 className="mb-3 text-lg font-bold">Preguntas frecuentes</h2>
          <div className="space-y-3">
            {faqs.map((f, i) => (
              <div key={i} className="flex gap-2">
                <div className="flex-1 space-y-1">
                  <input value={f.pregunta} placeholder="¿Hay estacionamiento?" onChange={(e) => editar(faqs, setFaqs, i, { pregunta: e.target.value })} className={campo} />
                  <input value={f.respuesta} placeholder="Sí, con valet por $50." onChange={(e) => editar(faqs, setFaqs, i, { respuesta: e.target.value })} className={campo} />
                </div>
                <button onClick={() => quitar(faqs, setFaqs, i)} className="p-2 text-ink/40 hover:text-rojo"><Trash size={18} /></button>
              </div>
            ))}
          </div>
          <Agregar onClick={() => setFaqs([...faqs, { pregunta: "", respuesta: "" }])}>Agregar pregunta</Agregar>
        </Tarjeta>

        <Tarjeta className="bg-[#FBF1C4]/90">
          <h2 className="text-lg font-bold">Promociones</h2>
          <p className="mb-3 text-xs text-ink/55">Después de la fecha de fin, el agente deja de mencionarla.</p>
          <div className="space-y-3">
            {promos.map((p, i) => (
              <div key={i} className="flex gap-2">
                <input value={p.texto} placeholder="2x1 en mezcal los jueves" onChange={(e) => editar(promos, setPromos, i, { texto: e.target.value })} className={campo} />
                <input type="date" value={p.termina ?? ""} onChange={(e) => editar(promos, setPromos, i, { termina: e.target.value })} className={`${campo} w-44`} />
                <button onClick={() => quitar(promos, setPromos, i)} className="p-2 text-ink/40 hover:text-rojo"><Trash size={18} /></button>
              </div>
            ))}
          </div>
          <Agregar onClick={() => setPromos([...promos, { texto: "", termina: null }])}>Agregar promoción</Agregar>
        </Tarjeta>
      </div>

      <div className="sticky bottom-4 flex items-center gap-4 rounded-full bg-white/90 p-2 pl-2 shadow-lg backdrop-blur">
        <button onClick={guardar} className="rounded-full bg-rojo px-6 py-3 font-bold text-white hover:bg-granate">Guardar cambios</button>
        <span className="pr-4 text-sm text-ink/70">{estado}</span>
      </div>
    </div>
  );
}

function Agregar({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="mt-3 flex items-center gap-2 rounded-full px-3 py-2 text-sm font-bold text-rojo hover:bg-rojo/5">
      <Plus size={16} />{children}
    </button>
  );
}
