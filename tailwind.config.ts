import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/contexts/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        green: {
          DEFAULT: "#00C853",
          mid:     "#00A846",
          dark:    "#007B33",
          light:   "#E8F5E9",
          pale:    "#F0FFF4",
        },
        navy: {
          DEFAULT: "#0B1F3A",
          mid:     "#1A2F4A",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Barlow Condensed", "sans-serif"],
        body:    ["var(--font-body)",    "DM Sans",           "sans-serif"],
      },
      borderRadius: {
        "4xl": "2rem",
      },
    },
  },
  plugins: [],
};

export default config;
