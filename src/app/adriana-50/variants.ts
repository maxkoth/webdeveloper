// The five poster directions offered for Adriana's save-the-date.
export const VARIANTS = {
  v1: {
    theme: "#0c0b09",
    label: "Art Deco Gold",
    blurb: "Gatsby glamour — stepped gold geometry on matte black",
  },
  v2: {
    theme: "#efe6d8",
    label: "Champagne Blush",
    blurb: "Light and airy — burnished gold script on warm ivory",
  },
  v3: {
    theme: "#2a070c",
    label: "Burgundy Luxe",
    blurb: "Rich and romantic — gold foil on deep wine red",
  },
  v4: {
    theme: "#0a0a0a",
    label: "Modern Editorial",
    blurb: "High-fashion minimal — a giant ghost 50 behind clean type",
  },
  v5: {
    theme: "#07251d",
    label: "Emerald Jewel",
    blurb: "Jewel-box opulence — gold ornament on deep emerald",
  },
} as const;

export type VariantKey = keyof typeof VARIANTS;
