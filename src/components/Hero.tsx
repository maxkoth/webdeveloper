import ContactButtons from "./ContactButtons";
import { CONTACT } from "@/lib/site";

export default function Hero() {
  return (
    <section
      id="top"
      className="relative overflow-hidden border-b border-line"
      aria-labelledby="hero-heading"
    >
      {/* Single accent flourish — a faint volt grid, not a purple gradient. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(var(--color-volt) 1px, transparent 1px), linear-gradient(90deg, var(--color-volt) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(circle at 70% 20%, black, transparent 70%)",
        }}
      />

      <div className="mx-auto max-w-6xl px-5 pb-20 pt-32 sm:px-8 sm:pb-28 sm:pt-40">
        <p className="label mb-6 flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-volt" aria-hidden="true" />
          Freelance developer · Available for new work
        </p>

        <h1 id="hero-heading" className="display max-w-[15ch] text-paper">
          <span className="block text-[clamp(3rem,13vw,9rem)]">Maximum</span>
          <span className="block text-[clamp(3rem,13vw,9rem)] text-volt">
            Developer
          </span>
        </h1>

        <p className="mt-8 max-w-2xl text-balance text-xl leading-snug text-muted sm:text-2xl">
          I&apos;m Max. I build{" "}
          <span className="text-paper">AI-powered apps and MVPs</span> for
          startups, and{" "}
          <span className="text-paper">fast, working websites</span> for local
          businesses. Real builds, shipped — not decks.
        </p>

        <div className="mt-10">
          <ContactButtons size="lg" />
          <p className="mt-4 font-mono text-xs text-muted">
            Or call:{" "}
            <a href={CONTACT.tel} className="text-paper underline-offset-4 hover:underline">
              {CONTACT.phoneDisplay}
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
