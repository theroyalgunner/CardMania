import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        cm: {
          bg: "#080812",
          surface: "#121225",
          line: "rgba(255,255,255,0.12)",
          muted: "#a7a7bd",
          purple: "#8b5cf6",
          green: "#22c55e",
          red: "#ef4444"
        }
      },
      boxShadow: { card: "0 18px 50px rgba(0,0,0,.35)" }
    }
  },
  plugins: []
};
export default config;
