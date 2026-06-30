import ContactButtons from "./ContactButtons";
import Reveal from "./Reveal";
import { CONTACT, HERO_META } from "@/lib/site";

export default function Hero() {
  return (
    <section
      id="top"
      className="relative isolate overflow-hidden border-b border-line"
      aria-labelledby="hero-heading"
    >
      {/*
        Concentric arc motif — precision over flash. Two ghost rings emerge from
        the upper-right corner like the face of a compass or a watchmaker's
        diagram. They're barely there; the type does the work.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 -top-40 h-[52rem] w-[52rem] rounded-full"
        style={{ border: "1px solid rgba(42,92,63,0.10)" }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 -top-20 h-[34rem] w-[34rem] rounded-full"
        style={{ border: "1px solid rgba(42,92,63,0.07)" }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-4 top-4 h-[20rem] w-[20rem] rounded-full"
        style={{ border: "1px solid rgba(42,92,63,0.05)" }}
      />

      <div className="mx-auto max-w-6xl px-5 pb-16 pt-32 sm:px-8 sm:pb-20 sm:pt-40">
        <Reveal>
          <p className="label flex items-center gap-2.5">
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-volt opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-volt" />
            </span>
            Development studio · Available for new work
          </p>
        </Reveal>

        <Reveal delay={80}>
          <h1 id="hero-heading" className="display mt-6 max-w-[15ch] text-paper">
            <span className="block text-[clamp(3rem,13vw,9.5rem)]">Maximum</span>
            <span className="block text-[clamp(3rem,13vw,9.5rem)] text-volt">
              Developer
            </span>
          </h1>
        </Reveal>

        <Reveal delay={160}>
          <p className="mt-8 max-w-2xl text-balance text-xl leading-snug text-muted sm:text-2xl">
            We build{" "}
            <span className="text-paper">AI-powered apps and MVPs</span> for
            startups, and{" "}
            <span className="text-paper">fast, working websites</span> for local
            businesses. Real builds, shipped — not decks.
          </p>
        </Reveal>

        <Reveal delay={240}>
          <div className="mt-10">
            <ContactButtons size="lg" />
            <p className="mt-4 font-mono text-xs text-muted">
              Or call:{" "}
              <a
                href={CONTACT.tel}
                className="text-paper underline-offset-4 hover:underline"
              >
                {CONTACT.phoneDisplay}
              </a>
            </p>
          </div>
        </Reveal>

        <Reveal delay={320}>
          <ul className="mt-14 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line pt-6 font-mono text-xs text-muted">
            {HERO_META.map((item, i) => (
              <li key={item} className="flex items-center gap-3">
                {i > 0 && (
                  <span className="text-volt/60" aria-hidden="true">
                    /
                  </span>
                )}
                {item}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>

      <a
        href="#what-i-build"
        aria-label="Scroll to what I build"
        className="absolute bottom-5 right-5 hidden h-11 w-11 items-center justify-center rounded-full border border-line text-muted transition-colors hover:border-volt hover:text-volt sm:right-8 sm:flex"
      >
        <svg
          className="scroll-cue"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 5v14M19 12l-7 7-7-7" />
        </svg>
      </a>
    </section>
  );
}
