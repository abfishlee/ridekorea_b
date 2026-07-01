/**
 * Design tokens — single source of truth for colors, spacing, radius, type.
 * Mirrors vision_doc/3_design_philosophy_and_standards.md.
 * Never hardcode colors/sizes in components; import from here.
 */
import { fontFamily } from "./fonts";

export const colors = {
  // Brand
  primary: "#1E3A8A", // K-Indigo — header, primary buttons, default markers
  accent: "#0EA5E9", // Aero Blue — normal on-route track (planned/track)
  exploration: "#EC4899", // Adventure Pink — deviated "my own path"
  warning: "#F59E0B", // Alert Orange — danger/avoid (never red)

  // Surfaces
  bg: "#F8FAFC", // Cloud White — panels, bottom sheets
  surface: "#FFFFFF",
  scrimDark: "rgba(15, 23, 42, 0.55)", // over map for white text (WCAG 4.5:1)
  scrimLight: "rgba(255, 255, 255, 0.78)", // over map for dark text

  // Text
  text: "#0F172A",
  textMuted: "#475569",
  textOnPrimary: "#FFFFFF",
  textOnGlassDark: "#FFFFFF",
  textOnGlassLight: "#0F172A",

  border: "#E2E8F0",
  success: "#16A34A",
  danger: "#DC2626",
} as const;

/** 4pt spacing scale. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  touch: 60, // min touch target for in-ride, glove-friendly controls
} as const;

export const radius = {
  sm: 8,
  card: 16,
  pill: 999,
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
  fontSize,
  fontWeight,
  fontFamily,
} as const;

export type Theme = typeof theme;
export default theme;
