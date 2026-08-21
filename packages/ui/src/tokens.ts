export const designTokens = {
  color: {
    ink: "#111111",
    charcoal: "#252525",
    ivory: "#F8F5EE",
    paper: "#FFFFFF",
    gold: "#E8B923",
    muted: "#71717A",
    success: "#178A3D",
    error: "#C53030",
  },
  typography: {
    sans: "Geist, ui-sans-serif, system-ui, sans-serif",
    display: "Geist, ui-sans-serif, system-ui, sans-serif",
    mono: "Geist Mono, ui-monospace, monospace",
  },
  spacing: { xs: "0.25rem", sm: "0.5rem", md: "1rem", lg: "1.5rem", xl: "2rem", "2xl": "3rem" },
  radius: { sm: "0.375rem", md: "0.625rem", lg: "1rem", full: "9999px" },
  shadow: {
    subtle: "0 1px 2px rgb(17 17 17 / 0.08)",
    raised: "0 12px 32px rgb(17 17 17 / 0.14)",
    focus: "0 0 0 3px rgb(232 185 35 / 0.38)",
  },
  zIndex: { base: 0, raised: 10, header: 40, overlay: 50, toast: 60 },
  motion: { fast: "120ms", normal: "200ms", slow: "320ms" },
} as const;

export type DesignTokens = typeof designTokens;
