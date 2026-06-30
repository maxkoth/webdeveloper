import Reveal from "./Reveal";
import SectionHeading from "./SectionHeading";

const STEPS = [
  {
    n: "01",
    title: "Brief",
    body: "A quick call or text. We figure out what you actually need, what it should do, and what it shouldn't. You get a clear scope and price — no surprises.",
  },
  {
    n: "02",
    title: "Build",
    body: "We build it and show you progress as it happens, not at the end. You see the real thing early and steer while it's cheap to change.",
  },
  {
    n: "03",
    title: "Ship",
    body: "It goes live — fast, tested, and working on real devices. App store, the web, your domain: wherever it needs to be.",
  },
  {
    n: "04",
    title: "Support",
    body: "After launch we're still reachable. Fixes, tweaks, and the next round of features when you're ready to grow.",
  },
] as const;

export default function HowIWork() {
  return (
    <section
      id="how-i-work"
      className="border-b border-line"
      aria-labelledby="how-i-work-heading"
    >
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
        <div id="how-i-work-heading">
          <SectionHeading
            index="03"
            label="How we work"
            title="Brief. Build. Ship. Support."
          />
        </div>

        <ol className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <Reveal
              key={step.n}
              as="li"
              delay={i * 70}
              className="group/card surface flex flex-col rounded-2xl border border-line p-7 transition-colors hover:border-volt/40 sm:p-8"
            >
              <span className="font-mono text-sm text-volt">{step.n}</span>
              <h3 className="display mt-6 text-2xl text-paper">{step.title}</h3>
              <p className="mt-3 leading-relaxed text-muted">{step.body}</p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
