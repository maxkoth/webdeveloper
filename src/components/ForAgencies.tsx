import ContactButtons from "./ContactButtons";
import Reveal from "./Reveal";
import SectionHeading from "./SectionHeading";

// White-label offer aimed at agencies: same builds as the rest of the site,
// but delivered under the agency's brand. Peer-to-peer tone — leads with what
// the agency gets (capacity, margin, an invisible partner), not the tech.
const POINTS = [
  {
    title: "White-label by default",
    body: "Your brand on the front, me as the silent build team. Your client never has to know I'm involved.",
  },
  {
    title: "The work you'd turn down",
    body: "The dev-heavy jobs you'd otherwise pass on or subcontract: AI apps, MVPs, and websites — shipped.",
  },
  {
    title: "Fast, no overhead",
    body: "Scoped and priced up front, delivered fast. One builder — no subcontractor chaos to manage.",
  },
  {
    title: "You keep the relationship",
    body: "You own the client and the margin. I build it and hand it over clean, under your name.",
  },
] as const;

export default function ForAgencies() {
  return (
    <section
      id="for-agencies"
      className="border-b border-line"
      aria-labelledby="for-agencies-heading"
    >
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
        <div id="for-agencies-heading">
          <SectionHeading
            index="03"
            label="For agencies"
            title="Your clients' builds, under your brand."
          />
        </div>

        <Reveal className="surface mt-14 rounded-2xl border border-line p-7 sm:p-10">
          <p className="max-w-2xl text-lg text-paper/90">
            Run a digital, marketing, or web agency? When a client needs an app or
            an AI feature you can&apos;t staff, I&apos;m the build partner behind the
            curtain — invisible unless you want otherwise.
          </p>

          <div className="mt-10 grid gap-x-10 gap-y-7 sm:grid-cols-2">
            {POINTS.map((point) => (
              <div key={point.title} className="flex gap-3 text-muted">
                <span
                  aria-hidden="true"
                  className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-volt"
                />
                <span className="leading-relaxed">
                  <span className="font-semibold text-paper">{point.title}.</span>{" "}
                  {point.body}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-10">
            <ContactButtons size="md" placement="for-agencies" />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
