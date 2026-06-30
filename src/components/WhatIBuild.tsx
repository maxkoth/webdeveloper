import Reveal from "./Reveal";
import SectionHeading from "./SectionHeading";

// Two clearly-scoped service lines. AI/MVP work leads; small-business sites
// are a distinct, separate offer — not blurred together. Copy says what the
// client GETS, not the tech.
const SERVICES = [
  {
    tag: "Lead service",
    title: "AI apps & startup MVPs",
    lede: "You have a product idea and need it real. We build it.",
    points: [
      "A working mobile or web app you can put in front of users — not a prototype that dies in a demo.",
      "Real AI features that do a job: analyze video, read images, generate useful output. Not a chatbot bolted on.",
      "Scoped to an honest MVP — the smallest thing that proves the idea, built to grow when it works.",
    ],
  },
  {
    tag: "Service line",
    title: "Small-business websites",
    lede: "You run a business and need a site that actually works.",
    points: [
      "A fast, clean site that loads instantly and looks right on a phone — where your customers actually are.",
      "Set up to be found: real titles, clean structure, the SEO basics done properly.",
      "Easy to reach you — tap to call, text, or email. No bloat, no monthly platform you don't need.",
    ],
  },
] as const;

export default function WhatIBuild() {
  return (
    <section
      id="what-i-build"
      className="border-b border-line"
      aria-labelledby="what-i-build-heading"
    >
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
        <div id="what-i-build-heading">
          <SectionHeading index="01" label="What we build" title="Two things, done well." />
        </div>

        <div className="mt-14 grid gap-4 md:grid-cols-2">
          {SERVICES.map((service, i) => (
            <Reveal
              key={service.title}
              delay={i * 80}
              className="group/card surface flex flex-col rounded-2xl border border-line p-7 transition-colors hover:border-volt/40 sm:p-10"
            >
              <span className="label text-volt">{service.tag}</span>
              <h3 className="display mt-5 text-3xl text-paper sm:text-4xl">
                {service.title}
              </h3>
              <p className="mt-3 text-lg text-paper/90">{service.lede}</p>
              <ul className="mt-7 flex flex-col gap-4">
                {service.points.map((point) => (
                  <li key={point} className="flex gap-3 text-muted">
                    <span
                      aria-hidden="true"
                      className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-volt"
                    />
                    <span className="leading-relaxed">{point}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
