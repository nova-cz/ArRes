import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";

const sans = Nunito({ subsets: ["latin"], variable: "--font-sans", weight: ["400", "500", "600", "700", "800", "900"] });

export const metadata: Metadata = {
  title: "ArRES · Anfitrión de IA para restaurantes",
  description:
    "ArRES contesta llamadas y WhatsApp 24/7, revisa disponibilidad y gestiona reservas con las reglas de tu restaurante. Tu equipo aprueba cada reserva.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX" className={sans.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
