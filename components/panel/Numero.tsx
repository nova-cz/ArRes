"use client";
import { useEffect, useState } from "react";

/** Número que sube desde 0 al aparecer o cambiar. Acepta texto como "$1,200" o "85%". */
export default function Numero({ valor }: { valor: number | string }) {
  const [, pre = "", num = "", suf = ""] = String(valor).match(/^([^\d-]*)(-?[\d,.]+)(.*)$/) ?? [];
  const meta = Number(num.replace(/,/g, ""));
  const decimales = num.split(".")[1]?.length ?? 0;
  const [actual, setActual] = useState(0);

  useEffect(() => {
    if (!Number.isFinite(meta)) return;
    let marco = 0;
    const inicio = performance.now();
    const paso = (t: number) => {
      const p = Math.min(1, (t - inicio) / 700);
      setActual(meta * (1 - (1 - p) ** 3));
      if (p < 1) marco = requestAnimationFrame(paso);
    };
    marco = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(marco);
  }, [meta]);

  if (!num) return <>{valor}</>;
  return <>{pre}{actual.toLocaleString("es-MX", { minimumFractionDigits: decimales, maximumFractionDigits: decimales })}{suf}</>;
}
