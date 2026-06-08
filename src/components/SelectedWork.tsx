import Reveal from "./Reveal";
import SectionHeading from "./SectionHeading";

// Exactly the two real projects supplied. No clients named, no extras invented.
// Each card leads with what it does + the differentiator, then the stack.
// Live URLs are marked [link coming soon] until real URLs are supplied.
const WORK = [
  {
    kind: "AI · iOS",
    title: "Athlete performance & recruiting — AI layer",
    built:
      "I built an AI layer on top of an existing iOS app for athlete performance and recruiting. It analyzes uploaded athlete videos to detect movement, flag performance issues, and automatically generate written coaching feedback.",
    differentiator:
      "Turns raw video into coaching-grade feedback with no human in the loop.",
    stack: ["Claude API", "React Native", "Mux", "Supabase", "AWS"],
    cover: "motion" as const,
  },
  {
    kind: "AI · Mobile + Web",
    title: "Sports-card scanning app + landing site",
    built:
      "I built a mobile app that scans trading cards, identifies and values them, and — unlike every competitor — recommends what to do with each card: grade, sell, or hold. It's made for casual collectors, not hobby experts, and ships with its own marketing landing page.",
    differentiator:
      "A recommendation engine, not just a price lookup. Other apps show value; none tell you what to do next.",
    stack: ["React Native", "Claude API", "Image scanning", "Landing page"],
    cover: "scan" as const,
  },
] as const;

export default function SelectedWork() {
  return (
    <section id="work" className="border-b border-line" aria-labelledby="work-heading">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
        <div id="work-heading">
          <SectionHeading index="02" label="Selected work" title="Things I shipped." />
        </div>

        <div className="mt-14 flex flex-col gap-px overflow-hidden rounded-2xl border border-line bg-line">
          {WORK.map((item, i) => (
            <Reveal
              key={item.title}
              delay={i * 80}
              as="article"
              className="grid gap-8 bg-ink-raised p-7 sm:p-10 lg:grid-cols-[1.4fr_1fr] lg:items-center"
            >
              <div>
                <span className="label text-volt">{item.kind}</span>
                <h3 className="display mt-4 text-2xl text-paper sm:text-3xl">
                  {item.title}
                </h3>
                <p className="mt-4 leading-relaxed text-muted">{item.built}</p>

                <p className="mt-5 border-l-2 border-volt pl-4 text-paper">
                  <span className="label mb-1 block text-volt">
                    Why it&apos;s different
                  </span>
                  {item.differentiator}
                </p>

                <ul className="mt-6 flex flex-wrap gap-2" aria-label="Stack">
                  {item.stack.map((tech) => (
                    <li
                      key={tech}
                      className="rounded-full border border-line px-3 py-1 font-mono text-xs text-muted"
                    >
                      {tech}
                    </li>
                  ))}
                </ul>

                <p className="mt-6 font-mono text-xs text-muted">
                  <span className="text-paper">Live:</span> [link coming soon]
                </p>
              </div>

              <Cover variant={item.cover} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * On-brand abstract cover art (inline SVG — zero extra requests, no layout
 * shift, no fake screenshots). Each motif nods at what the product does.
 */
function Cover({ variant }: { variant: "motion" | "scan" }) {
  return (
    <div className="order-first aspect-[5/4] w-full overflow-hidden rounded-xl border border-line bg-ink lg:order-none">
      {variant === "motion" ? <MotionArt /> : <ScanArt />}
    </div>
  );
}

// Athlete video -> motion-capture skeleton + tracked path.
function MotionArt() {
  return (
    <svg
      viewBox="0 0 400 320"
      className="h-full w-full"
      role="img"
      aria-label="Abstract motion-capture skeleton tracing an athletic movement"
    >
      <defs>
        <pattern id="mgrid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M40 0H0V40" fill="none" stroke="rgba(245,243,236,0.06)" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="400" height="320" fill="url(#mgrid)" />
      <path
        d="M60 270 Q160 120 360 60"
        fill="none"
        stroke="var(--color-volt)"
        strokeWidth="2"
        strokeDasharray="4 8"
        opacity="0.7"
      />
      {/* joints */}
      {[
        [120, 90],
        [150, 150],
        [130, 210],
        [180, 200],
        [190, 250],
        [150, 150],
        [110, 200],
        [100, 250],
      ].map(([x, y], idx) => (
        <circle key={idx} cx={x} cy={y} r="6" fill="var(--color-volt)" />
      ))}
      {/* limbs */}
      <g stroke="var(--color-paper)" strokeWidth="3" strokeLinecap="round" opacity="0.85">
        <line x1="120" y1="90" x2="150" y2="150" />
        <line x1="150" y1="150" x2="130" y2="210" />
        <line x1="130" y1="210" x2="100" y2="250" />
        <line x1="150" y1="150" x2="180" y2="200" />
        <line x1="180" y1="200" x2="190" y2="250" />
        <line x1="150" y1="150" x2="110" y2="200" />
      </g>
    </svg>
  );
}

// Card scanning -> a card in a scan frame with a sweeping reticle.
function ScanArt() {
  return (
    <svg
      viewBox="0 0 400 320"
      className="h-full w-full"
      role="img"
      aria-label="Abstract trading card inside a scanning frame with a decision marker"
    >
      <rect width="400" height="320" fill="transparent" />
      <rect
        x="150"
        y="70"
        width="100"
        height="150"
        rx="8"
        fill="var(--color-ink-raised)"
        stroke="var(--color-paper)"
        strokeWidth="2"
        opacity="0.9"
      />
      <circle cx="200" cy="120" r="20" fill="none" stroke="var(--color-volt)" strokeWidth="3" />
      <rect x="168" y="160" width="64" height="6" rx="3" fill="rgba(245,243,236,0.4)" />
      <rect x="168" y="176" width="44" height="6" rx="3" fill="rgba(245,243,236,0.25)" />
      {/* scan reticle corners */}
      <g stroke="var(--color-volt)" strokeWidth="3" fill="none">
        <path d="M120 60 V40 H140" />
        <path d="M280 40 H300 V60" />
        <path d="M300 230 V250 H280" />
        <path d="M140 250 H120 V230" />
      </g>
      <line x1="120" y1="145" x2="300" y2="145" stroke="var(--color-volt)" strokeWidth="2" opacity="0.6" />
      {/* decision tag */}
      <g transform="translate(232,210)">
        <rect width="64" height="28" rx="14" fill="var(--color-volt)" />
        <text x="32" y="19" textAnchor="middle" fontFamily="monospace" fontSize="13" fontWeight="700" fill="#0a0a0b">
          HOLD
        </text>
      </g>
    </svg>
  );
}
