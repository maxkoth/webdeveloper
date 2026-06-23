import Reveal from "./Reveal";
import SectionHeading from "./SectionHeading";
import { FAQS } from "@/lib/site";

// Native <details> accordion — keyboard-accessible, zero JS, no layout shift.
export default function Faq() {
  return (
    <section id="faq" className="border-b border-line" aria-labelledby="faq-heading">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
        <div id="faq-heading">
          <SectionHeading index="05" label="FAQ" title="Straight answers." />
        </div>

        <div className="mt-14 flex flex-col gap-4">
          {FAQS.map((item, i) => (
            <Reveal key={item.q} delay={i * 50}>
              <details className="surface group/faq rounded-2xl border border-line transition-colors open:border-volt/40 hover:border-volt/40">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-6 sm:p-7 [&::-webkit-details-marker]:hidden">
                  <h3 className="display text-xl text-paper sm:text-2xl">
                    {item.q}
                  </h3>
                  <span
                    aria-hidden="true"
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line text-volt transition-transform duration-300 group-open/faq:rotate-45"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    >
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </span>
                </summary>
                <p className="max-w-2xl px-6 pb-7 leading-relaxed text-muted sm:px-7">
                  {item.a}
                </p>
              </details>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
