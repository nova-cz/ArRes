import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: { ink: "#2A1512", vino: "#3D1015", granate: "#5C1A20", crema: "#F6EEE1", papel: "#FFFAF1", rojo: "#C0161A", naranja: "#F26B2A", dorado: "#E8B35E" },
      fontFamily: { serif: ["var(--font-sans)", "system-ui", "sans-serif"], sans: ["var(--font-sans)", "system-ui", "sans-serif"] },
    },
  },
  plugins: [],
};
export default config;
