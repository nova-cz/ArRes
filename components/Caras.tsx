"use client";
import { useEffect, useRef, useState } from "react";

// Collage de rostros en círculos. Coordenadas sobre un lienzo de 1000 x 300.
const CARAS: { x: number; y: number; d: number }[] = [
  { x: 20, y: 110, d: 150 },
  { x: 150, y: 20, d: 120 },
  { x: 200, y: 160, d: 100 },
  { x: 320, y: 70, d: 220 },
  { x: 570, y: 10, d: 110 },
  { x: 560, y: 140, d: 150 },
  { x: 700, y: 10, d: 110 },
  { x: 715, y: 170, d: 95 },
  { x: 820, y: 80, d: 180 },
];

export default function Caras() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && (setVisible(true), io.disconnect()), { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={`relative mx-auto aspect-[10/3] w-full max-w-3xl ${visible ? "caras-visibles" : ""}`} aria-hidden="true">
      {CARAS.map((c, i) => (
        <div
          key={i}
          className="cara absolute aspect-square"
          style={{ left: `${c.x / 10}%`, top: `${(c.y / 300) * 100}%`, width: `${c.d / 10}%`, transitionDelay: visible ? `${i * 90}ms` : "0ms" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/fotos/caras/cara-${i + 1}.jpg`}
            alt=""
            loading="lazy"
            className="h-full w-full rounded-full object-cover shadow-lg ring-2 ring-white/25"
            style={{ animationDuration: `${4.5 + (i % 4) * 0.8}s`, animationDelay: `${-i * 0.9}s` }}
          />
        </div>
      ))}
    </div>
  );
}
