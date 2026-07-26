import {
  Cinzel,
  Cinzel_Decorative,
  Great_Vibes,
  Pinyon_Script,
  Playfair_Display,
  Cormorant_Garamond,
} from "next/font/google";

// Every face any of the five poster options uses, exposed as CSS variables
// so each variant's stylesheet can pick its own pairing.
export const cinzel = Cinzel({
  variable: "--f-cinzel",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

export const cinzelDeco = Cinzel_Decorative({
  variable: "--f-deco",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

export const greatVibes = Great_Vibes({
  variable: "--f-vibes",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

export const pinyon = Pinyon_Script({
  variable: "--f-pinyon",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

export const playfair = Playfair_Display({
  variable: "--f-playfair",
  subsets: ["latin"],
  weight: ["400", "600", "800"],
  style: ["normal", "italic"],
  display: "swap",
});

export const cormorant = Cormorant_Garamond({
  variable: "--f-cormorant",
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  display: "swap",
});

export const fontVars = [
  cinzel.variable,
  cinzelDeco.variable,
  greatVibes.variable,
  pinyon.variable,
  playfair.variable,
  cormorant.variable,
].join(" ");
