import Reveal from "./Reveal";
import SectionHeading from "./SectionHeading";

export default function About() {
  return (
    <section id="about" className="border-b border-line" aria-labelledby="about-heading">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
        <div id="about-heading">
          <SectionHeading index="04" label="About" title="Who we are." />
        </div>

        <Reveal className="mt-12 max-w-3xl">
          <p className="display text-2xl leading-tight text-paper sm:text-3xl">
            We&apos;re a team of developers who ship. We take ideas from a text
            message to a working app in the App Store, and build the AI that
            makes them genuinely useful.
          </p>
          <p className="mt-6 text-lg leading-relaxed text-muted">
            You work directly with us — no account managers, no handoffs, no
            jargon. You get a tight team that owns the whole thing, tells you
            the truth about scope, and gets it live.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
