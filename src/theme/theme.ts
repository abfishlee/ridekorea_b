/**
 * Design tokens — single source of truth for colors, spacing, radius, type.
 * Mirrors vision_doc/3_design_philosophy_and_standards.md and the
 * "Cozy Modern Minimal" upgrade (vision_doc/11_cozy_modern_minimal_ux_spec.md).
 * Never hardcode colors/sizes in components; import from here.
 */
import { fontFamily } from "./fonts";

export const colors = {
  // Brand & tracks
  primary: "#1E3A8A", // K-Indigo — header, primary buttons, default markers, planned track
  accent: "#0EA5E9", // Soft Sky Blue — subtle accents
  exploration: "#E17055", // Warm Terracotta Coral — deviated "my own path" (was neon pink)
  warning: "#F59E0B", // Alert Orange — danger/avoid (never red)

  // Warm surfaces (cozy off-white / oatmeal — eyes-at-ease warmth)
  bg: "#FDFBF7", // Warm Off-White — main background (was cold #F8FAFC)
  surface: "#FFFFFF", // card surface
  surfaceMuted: "#F5F2EB", // Soft Oatmeal — secondary panels, segmented backgrounds
  scrimDark: "rgba(15, 23, 42, 0.55)", // over map for white text (WCAG 4.5:1)
  scrimLight: "rgba(255, 255, 255, 0.78)", // over map for dark text

  // Frosted glass panels (Soft Frosted Glass HUD)
  glassLight: "rgba(253, 251, 247, 0.86)", // light-mode glass HUD
  glassDark: "rgba(15, 23, 42, 0.75)", // dark-mode glass HUD
  borderGlass: "rgba(226, 232, 240, 0.6)", // soft panel border

  // Text
  text: "#0F172A", // Deep Slate Black
  textMuted: "#64748B", // Warm Slate Grey — softer than cold #475569
  textOnPrimary: "#FFFFFF",
  textOnGlassDark: "#FFFFFF",
  textOnGlassLight: "#0F172A",

  border: "#E2E8F0",
  success: "#16A34A",
  danger: "#DC2626",
} as const;

/** Spacing scale — roomier "breathing room" per Cozy Modern spec. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 18, // was 16 — comfortable padding
  xl: 28, // was 24 — generous card gaps
  xxl: 36, // was 32
  touch: 64, // glove-friendly in-ride touch target (was 60)
} as const;

export const radius = {
  sm: 10, // was 8
  card: 20, // was 16 — softer modern curvature
  pill: 999,
} as const;

export const shadows = {
  // Soft diffused shadow — content floats gently over warm surfaces (no harsh black).
  soft: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
} as const;

export const fontSize = {
  caption: 12,
  body: 14,
  label: 16,
  title: 20,
  h2: 24,
  h1: 28,
  metric: 44, // speedometer / big glanceable numbers
} as const;

export const fontWeight = {
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
} as const;

export const theme = {
  colors,
  space,
  radius,
  shadows,
  fontSize,
  fontWeight,
  fontFamily,
} as const;

export type Theme = typeof theme;
export default theme;
