import { Check, CheckCircle } from "@phosphor-icons/react/dist/ssr";

type Msg = { de: "cliente" | "agente"; t: string; h: string; p: number };

// p = paso en el que aparece el mensaje (0 Pregunta, 1 Revisa, 2 Aprueba)
const msgs: Msg[] = [
  { de: "cliente", t: "Hola, ¿tienen mesa para 4 hoy a las 19:30?", h: "18:42", p: 0 },
  { de: "agente", t: "¡Hola! Sí, tenemos mesa para 4 a las 19:30 en terraza o salón. ¿Cuál prefieres?", h: "18:42", p: 0 },
  { de: "cliente", t: "En terraza, a nombre de Laura Ramírez", h: "18:43", p: 1 },
  { de: "agente", t: "Listo, Laura. Dejé tu solicitud: mesa para 4, hoy 19:30, terraza. El equipo del restaurante la aprobará y te confirmamos por aquí en unos minutos.", h: "18:43", p: 2 },
];

const chequeos = ["Restaurante abierto a las 19:30", "Mesa de 4 libre en terraza", "Aforo del turno disponible"];

export default function ChatMock({ paso = 2 }: { paso?: number }) {
  // Lo que ya apareció en pasos anteriores se pinta sin animar; lo del paso actual entra escalonado.
  const anim = (p: number, i: number) => (p === paso ? { animationDelay: `${i * 0.7}s` } : undefined);
  const cls = (p: number) => (p === paso ? "burbuja" : "");
  const visibles = msgs.filter((m) => m.p <= paso);

  return (
    <div className="mx-auto w-full max-w-sm glass-dark rounded-[2rem] p-2">
      <div className="overflow-hidden rounded-[1.6rem] bg-crema text-ink">
        <div className="flex items-center gap-3 bg-vino px-4 py-3 text-crema">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-rojo font-serif text-sm">Ar</div>
          <div>
            <p className="text-sm font-semibold leading-tight">Restaurante La Cazuela</p>
            <p className="text-xs text-crema/60">Anfitrión ArRES · en línea</p>
          </div>
        </div>
        <ol className="flex min-h-[29rem] flex-col gap-2 px-3 py-4" aria-live="polite">
          {visibles.map((m, i) => {
            const nuevos = visibles.filter((x) => x.p === m.p);
            return (
              <li
                key={`${m.p}-${i}`}
                style={anim(m.p, nuevos.indexOf(m))}
                className={`${cls(m.p)} max-w-[85%] rounded-2xl px-3 py-2 text-[13px] leading-snug ${
                  m.de === "cliente" ? "self-end rounded-br-sm bg-[#F8D9B8]" : "self-start rounded-bl-sm bg-papel"
                }`}
              >
                {m.t}
                <span className="mt-1 block text-right text-[10px] text-ink/40">{m.h}</span>
              </li>
            );
          })}

          {paso === 0 && (
            <li style={{ animationDelay: "1.4s" }} className="burbuja flex gap-1 self-start rounded-2xl rounded-bl-sm bg-papel px-3 py-3" aria-label="Escribiendo">
              {[0, 1, 2].map((n) => <span key={n} className="punto h-1.5 w-1.5 rounded-full bg-ink/40" style={{ animationDelay: `${n * 0.15}s` }} />)}
            </li>
          )}

          {paso === 1 && (
            <li style={{ animationDelay: ".7s" }} className="burbuja mt-1 rounded-2xl border border-ink/10 bg-white/70 p-3 text-xs">
              <p className="mb-2 font-semibold text-vino">Revisando disponibilidad…</p>
              <ul className="space-y-1.5">
                {chequeos.map((c, n) => (
                  <li key={c} style={{ animationDelay: `${1.3 + n * 0.8}s` }} className="burbuja flex items-center gap-2">
                    <span className="grid h-4 w-4 place-items-center rounded-full bg-[#4E9A3E] text-white"><Check size={10} weight="bold" /></span>
                    {c}
                  </li>
                ))}
              </ul>
            </li>
          )}

          {paso === 2 && (
            <>
              <li style={{ animationDelay: ".7s" }} className="burbuja mt-1 self-center rounded-full bg-naranja/15 px-3 py-1 text-xs font-medium text-rojo">
                Pendiente de aprobación del personal
              </li>
              <li style={{ animationDelay: "2.4s" }} className="burbuja flex items-center justify-between gap-2 rounded-2xl bg-white/70 px-3 py-2 text-xs">
                <span><b className="block text-[13px]">Laura R. · 4 pers.</b>Hoy 19:30 · Terraza</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-[#4E9A3E] px-2.5 py-1 font-semibold text-white"><CheckCircle size={14} weight="fill" />Aprobada</span>
              </li>
            </>
          )}
        </ol>
      </div>
    </div>
  );
}
