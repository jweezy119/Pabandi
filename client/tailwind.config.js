/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        /* ── Dark-mode neutral gray palette ── */
        "primary": "#0ea5e9",
        "primary-container": "rgba(14,165,233,0.15)",
        "on-primary": "#ffffff",
        "on-primary-container": "#7dd3fc",
        "secondary": "#9e9e9e",
        "secondary-container": "rgba(255,255,255,0.08)",
        "on-secondary": "#ffffff",
        "on-secondary-container": "#e0e0e0",
        "tertiary": "#14b8a6",
        "tertiary-container": "rgba(20,184,166,0.15)",
        "on-tertiary": "#ffffff",
        "on-tertiary-container": "#5eead4",
        "error": "#ff3366",
        "error-container": "rgba(255,51,102,0.12)",
        "on-error": "#ffffff",
        "on-error-container": "#fca5a5",
        "background": "#121212",
        "on-background": "#e8e8e8",
        "surface": "#121212",
        "surface-dim": "#0a0a0a",
        "surface-bright": "#2e2e2e",
        "surface-variant": "rgba(255,255,255,0.06)",
        "on-surface": "#e8e8e8",
        "on-surface-variant": "#9e9e9e",
        "surface-container-lowest": "#0a0a0a",
        "surface-container-low": "#1a1a1a",
        "surface-container": "#242424",
        "surface-container-high": "#2e2e2e",
        "surface-container-highest": "#383838",
        "outline": "#616161",
        "outline-variant": "rgba(255,255,255,0.08)",
        "inverse-surface": "#e8e8e8",
        "inverse-on-surface": "#121212",
        "inverse-primary": "#0ea5e9",
        "surface-tint": "#0ea5e9",
      },
      borderRadius: {
        "DEFAULT": "0.5rem",
        "lg": "0.75rem",
        "xl": "1rem",
        "2xl": "1.25rem",
        "3xl": "1.5rem",
        "full": "9999px"
      },
      fontFamily: {
        "headline": ["Space Grotesk", "sans-serif"],
        "body": ["Inter", "sans-serif"],
        "label": ["Inter", "sans-serif"],
        "sans": ["Inter", "sans-serif"]
      }
    },
  },
  plugins: [],
}
