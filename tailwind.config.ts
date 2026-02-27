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
    },
  },
  plugins: [],
};

export default config;
