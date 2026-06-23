// Single source of truth for contact + site metadata.
// Contact is the site's primary action: text or email Max directly. No forms.

export const SITE = {
  name: "Maximum Developer",
  domain: "maximumdeveloper.com",
  url: "https://maximumdeveloper.com",
  // One-line positioning. Leads with the product/AI work.
  tagline: "I build AI-powered apps, MVPs, and websites that ship.",
  description:
    "Maximum Developer is Max — a freelance developer who builds AI-powered apps and MVPs for startups, and fast, working websites for local businesses. Text or email to start.",
} as const;

export const CONTACT = {
  phoneDisplay: "646-462-1236",
  phoneDigits: "+16464621236",
  email: "maxkoth77@gmail.com",
  get sms() {
    return `sms:${this.phoneDigits}`;
  },
  get tel() {
    return `tel:${this.phoneDigits}`;
  },
  get mailto() {
    return `mailto:${this.email}`;
  },
} as const;

// Honest, verifiable facts — no fabricated stats or tenure.
export const HERO_META = [
  "Based in New York",
  "iOS · React Native · Web",
  "AI built on Claude",
] as const;

export const NAV_LINKS = [
  { href: "#what-i-build", label: "What I build" },
  { href: "#work", label: "Work" },
  { href: "#how-i-work", label: "How I work" },
  { href: "#about", label: "About" },
] as const;
