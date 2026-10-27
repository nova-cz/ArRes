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
  return (
    <div className="relative mx-auto aspect-[10/3] w-full max-w-3xl" aria-hidden="true">
      {CARAS.map((c, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={i}
          src={`/fotos/caras/cara-${i + 1}.jpg`}
          alt=""
          loading="lazy"
          className="absolute aspect-square rounded-full object-cover shadow-lg ring-2 ring-white/25 transition-transform duration-300 ease-out hover:scale-105"
          style={{ left: `${c.x / 10}%`, top: `${(c.y / 300) * 100}%`, width: `${c.d / 10}%` }}
        />
      ))}
    </div>
  );
}
