import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        clay: {
          50: "#FFF8F0",
          100: "#FAEBD7",
          200: "#F0D0A8",
          300: "#DEB887",
          400: "#C8963E",
          500: "#A0784A",
          600: "#7D5A3C",
          700: "#5B3A29",
          800: "#3E2518",
          900: "#2A180F",
        },
        gold: {
          DEFAULT: "#C8963E",
          light: "#E0B872",
          dark: "#9A7230",
        },
        cream: "#FFF8F0",
        teal: {
          DEFAULT: "#4A9B8E",
          light: "#6DB8AB",
          dark: "#357A6F",
        },
      },
      fontFamily: {
        display: ["DM Serif Display", "serif"],
        sans: ["DM Sans", "sans-serif"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        shimmer: {
          "0%": { transform: "translateX(-30%) skewX(-12deg)" },
          "60%": { transform: "translateX(360%) skewX(-12deg)" },
          "100%": { transform: "translateX(360%) skewX(-12deg)" },
        },
        "ring-glow": {
          "0%, 100%": { filter: "drop-shadow(0 0 0 rgba(74,155,142,0))" },
          "50%": { filter: "drop-shadow(0 0 14px rgba(74,155,142,0.55))" },
        },
        "float-up": {
          "0%": { transform: "translateY(8px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "sparkle-pulse": {
          "0%, 100%": { transform: "scale(1)", opacity: "0.85" },
          "50%": { transform: "scale(1.18)", opacity: "1" },
        },
        "draw-check": {
          "0%": { strokeDashoffset: "24" },
          "100%": { strokeDashoffset: "0" },
        },
      },
      animation: {
        shimmer: "shimmer 7s ease-in-out infinite",
        "ring-glow": "ring-glow 2.6s ease-in-out infinite",
        "float-up": "float-up 0.55s ease-out both",
        "sparkle-pulse": "sparkle-pulse 1.8s ease-in-out infinite",
        "draw-check": "draw-check 0.6s ease-out forwards",
      },
    },
  },
  plugins: [],
};

export default config;
