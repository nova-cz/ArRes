const msgs = [
  { de: "cliente", t: "Hola, ¿tienen mesa para 4 hoy a las 19:30?", h: "18:42", d: "0s" },
  { de: "agente", t: "¡Hola! Sí, tenemos mesa para 4 a las 19:30 en terraza o salón. ¿Cuál prefieres?", h: "18:42", d: ".7s" },
  { de: "cliente", t: "En terraza, a nombre de Laura Ramírez", h: "18:43", d: "1.4s" },
  { de: "agente", t: "Listo, Laura. Dejé tu solicitud: mesa para 4, hoy 19:30, terraza. El equipo del restaurante la aprobará y te confirmamos por aquí en unos minutos.", h: "18:43", d: "2.1s" },
];

export default function ChatMock() {
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
        <ol className="flex flex-col gap-2 px-3 py-4">
          {msgs.map((m, i) => (
            <li
              key={i}
              style={{ animationDelay: m.d }}
              className={`burbuja max-w-[85%] rounded-2xl px-3 py-2 text-[13px] leading-snug ${
                m.de === "cliente" ? "self-end rounded-br-sm bg-[#F8D9B8]" : "self-start rounded-bl-sm bg-papel"
              }`}
            >
              {m.t}
              <span className="mt-1 block text-right text-[10px] text-ink/40">{m.h}</span>
            </li>
          ))}
          <li
            style={{ animationDelay: "2.8s" }}
            className="burbuja mt-1 self-center rounded-full bg-naranja/15 px-3 py-1 text-xs font-medium text-rojo"
          >
            Pendiente de aprobación del personal
          </li>
        </ol>
      </div>
    </div>
  );
}
