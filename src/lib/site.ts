// Single source of truth for contact + site metadata.
// Contact is the site's primary action: text or email Max directly. No forms.

export const SITE = {
  name: "Maximum Developer",
  domain: "maximumdeveloper.com",
  url: "https://maximumdeveloper.com",
  // One-line positioning. Leads with the product/AI work.
  tagline: "I build AI-powered apps, MVPs, and websites that ship.",
  description:
    "Maximum Developer is Max — a freelance developer who builds AI-powered apps and MVPs for startups, fast websites for local businesses, and white-label builds for agencies. Text or email to start.",
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
  "AI-powered builds",
] as const;

export const NAV_LINKS = [
  { href: "#what-i-build", label: "What I build" },
  { href: "#work", label: "Work" },
  { href: "#for-agencies", label: "For agencies" },
  { href: "#how-i-work", label: "How I work" },
  { href: "#faq", label: "FAQ" },
] as const;

// Honest answers to the questions every prospective client actually asks.
// Doubles as FAQ structured data for Google rich results.
export const FAQS = [
  {
    q: "How much does a project cost?",
    a: "Every build is scoped and priced up front — a fixed number after a short call, not an open-ended hourly meter. Text me what you're making and I'll tell you straight.",
  },
  {
    q: "How long does it take?",
    a: "A focused MVP is usually weeks, not months. A small-business website is often days. I set a realistic timeline before we start and show you progress the whole way through.",
  },
  {
    q: "Do I need to be technical?",
    a: "No. Most of the founders I work with aren't engineers. You bring the idea and the domain knowledge; I handle the build and explain the trade-offs in plain language.",
  },
  {
    q: "Do you work with agencies on a white-label basis?",
    a: "Yes. If you run a digital, marketing, or web agency, I build under your brand — apps, AI features, and websites — as the silent partner behind the curtain. You keep the client relationship; your client never has to know I'm involved.",
  },
  {
    q: "Can you work on an app I already have?",
    a: "Yes. I can add features or an AI-powered layer to something you've already built — one of my projects was exactly that: an AI layer on top of an existing iOS app.",
  },
  {
    q: "Who owns the code?",
    a: "You do. You get full ownership of everything I build, handed over cleanly when it ships.",
  },
  {
    q: "Where are you based, and do you work remotely?",
    a: "I'm in New York and work with clients anywhere. Most of the work happens over text, email, and the occasional call.",
  },
] as const;
