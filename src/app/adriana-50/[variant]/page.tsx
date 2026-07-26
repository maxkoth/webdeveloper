import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { fontVars } from "../fonts";
import { VARIANTS, type VariantKey } from "../variants";
import styles from "./variants.module.css";

export function generateStaticParams() {
  return Object.keys(VARIANTS).map((variant) => ({ variant }));
}

export async function generateMetadata({
  params,
}: PageProps<"/adriana-50/[variant]">): Promise<Metadata> {
  const { variant } = await params;
  const v = VARIANTS[variant as VariantKey];
  return {
    title: `Save the Date (${v?.label ?? "Poster"}) — Adriana Orozco's 50th`,
    description:
      "Save the date: Adriana Orozco's 50th Birthday Celebration — October 3rd. Details to come.",
    robots: { index: false, follow: false },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

// Deterministic decoration fields, kept clear of the lettering.
const CONFETTI = [
  { top: "5%", left: "14%", size: 6, delay: 0, kind: "round" },
  { top: "8%", left: "84%", size: 5, delay: 1.4, kind: "square" },
  { top: "16%", left: "7%", size: 4, delay: 2.6, kind: "round" },
  { top: "20%", left: "92%", size: 6, delay: 0.8, kind: "round" },
  { top: "33%", left: "6%", size: 5, delay: 3.2, kind: "square" },
  { top: "37%", left: "93%", size: 4, delay: 1.9, kind: "round" },
  { top: "52%", left: "8%", size: 6, delay: 0.4, kind: "round" },
  { top: "55%", left: "91%", size: 5, delay: 2.2, kind: "square" },
  { top: "70%", left: "9%", size: 4, delay: 3.6, kind: "round" },
  { top: "73%", left: "90%", size: 6, delay: 1.1, kind: "round" },
  { top: "86%", left: "16%", size: 5, delay: 2.9, kind: "square" },
  { top: "89%", left: "82%", size: 4, delay: 0.6, kind: "round" },
] as const;

const SPARKLES = [
  { top: "10%", left: "24%", size: 13, delay: 0.2 },
  { top: "7%", left: "72%", size: 16, delay: 1.8 },
  { top: "24%", left: "13%", size: 11, delay: 3.1 },
  { top: "22%", left: "88%", size: 14, delay: 0.9 },
  { top: "45%", left: "90%", size: 12, delay: 2.3 },
  { top: "48%", left: "11%", size: 15, delay: 1.2 },
  { top: "68%", left: "15%", size: 12, delay: 2.8 },
  { top: "66%", left: "86%", size: 16, delay: 0.5 },
  { top: "84%", left: "28%", size: 13, delay: 1.5 },
  { top: "82%", left: "74%", size: 14, delay: 3.4 },
] as const;

function Sparkle({ size, id }: { size: number; id: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 0C12.9 6.6 17.4 11.1 24 12C17.4 12.9 12.9 17.4 12 24C11.1 17.4 6.6 12.9 0 12C6.6 11.1 11.1 6.6 12 0Z"
        fill={`url(#${id})`}
      />
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="24" y2="24">
          <stop offset="0" stopColor="var(--spark-hi, #f9e7b3)" />
          <stop offset="0.5" stopColor="var(--spark-mid, #d4a437)" />
          <stop offset="1" stopColor="var(--spark-lo, #a87a1f)" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default async function Page({
  params,
}: PageProps<"/adriana-50/[variant]">) {
  const { variant } = await params;
  if (!(variant in VARIANTS)) notFound();
  const v = variant as VariantKey;

  return (
    <main className={`${fontVars} ${styles.stage} ${styles[v]}`}>
      <section
        className={styles.poster}
        aria-label="Save the date poster for Adriana Orozco's 50th birthday celebration on October 3rd"
      >
        <div className={styles.frameOuter} aria-hidden="true" />
        <div className={styles.frameInner} aria-hidden="true">
          <span className={`${styles.corner} ${styles.cornerTL}`} />
          <span className={`${styles.corner} ${styles.cornerTR}`} />
          <span className={`${styles.corner} ${styles.cornerBL}`} />
          <span className={`${styles.corner} ${styles.cornerBR}`} />
        </div>

        {/* Art Deco stepped strips, only on v1 */}
        {v === "v1" && (
          <>
            <div className={`${styles.decoStrip} ${styles.decoStripTop}`} aria-hidden="true" />
            <div className={`${styles.decoStrip} ${styles.decoStripBottom}`} aria-hidden="true" />
          </>
        )}

        {/* Giant ghost numeral behind the composition, only on v4 */}
        {v === "v4" && (
          <span className={styles.ghostFifty} aria-hidden="true">
            50
          </span>
        )}

        <div className={styles.glitter} aria-hidden="true" />
        <div aria-hidden="true">
          {CONFETTI.map((c, i) => (
            <span
              key={`c${i}`}
              className={`${styles.confetti} ${c.kind === "square" ? styles.confettiSquare : ""}`}
              style={{
                top: c.top,
                left: c.left,
                width: c.size,
                height: c.size,
                animationDelay: `${c.delay}s`,
              }}
            />
          ))}
          {SPARKLES.map((s, i) => (
            <span
              key={`s${i}`}
              className={styles.sparkle}
              style={{ top: s.top, left: s.left, animationDelay: `${s.delay}s` }}
            >
              <Sparkle size={s.size} id={`spark-${v}-${i}`} />
            </span>
          ))}
        </div>

        <div className={styles.content}>
          <p className={styles.kicker}>
            Save <span className={styles.kickerThe}>the</span> Date
          </p>

          <div className={styles.flourish} aria-hidden="true">
            <span className={styles.flourishLine} />
            <span className={styles.flourishDiamond} />
            <span className={styles.flourishLine} />
          </div>

          <h1 className={styles.centerpiece}>
            <span className={styles.name}>Adriana&nbsp;Orozco&rsquo;s</span>
            <span className={styles.fifty}>50th</span>
            <span className={styles.celebration}>Birthday Celebration</span>
          </h1>

          <div className={styles.redRule} aria-hidden="true" />

          <p className={styles.date}>
            October 3<sup className={styles.ordinal}>rd</sup>
          </p>

          <p className={styles.details}>Details to Come</p>
        </div>
      </section>
    </main>
  );
}
