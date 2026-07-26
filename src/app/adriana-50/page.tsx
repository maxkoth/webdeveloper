import type { Metadata, Viewport } from "next";
import { Cinzel, Great_Vibes, Cormorant_Garamond } from "next/font/google";
import styles from "./poster.module.css";

// Luxury print pairing, loaded only for this route: Cinzel for engraved
// foil capitals, Great Vibes for the script centerpiece, Cormorant for
// refined serif supporting lines.
const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

const greatVibes = Great_Vibes({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#0b0a08",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "Save the Date — Adriana Orozco's 50th Birthday Celebration",
  description:
    "Save the date: Adriana Orozco's 50th Birthday Celebration — October 3rd. Details to come.",
  robots: { index: false, follow: false },
};

// Deterministic confetti field — hand-placed so the render is stable and the
// pieces cluster toward the poster's edges, away from the lettering.
const CONFETTI = [
  { top: "4%", left: "12%", size: 7, delay: 0, kind: "round" },
  { top: "7%", left: "82%", size: 5, delay: 1.4, kind: "round" },
  { top: "12%", left: "6%", size: 4, delay: 2.6, kind: "square" },
  { top: "15%", left: "93%", size: 6, delay: 0.8, kind: "round" },
  { top: "22%", left: "10%", size: 5, delay: 3.2, kind: "square" },
  { top: "26%", left: "88%", size: 4, delay: 1.9, kind: "round" },
  { top: "34%", left: "5%", size: 6, delay: 0.4, kind: "round" },
  { top: "38%", left: "94%", size: 5, delay: 2.2, kind: "square" },
  { top: "48%", left: "8%", size: 4, delay: 3.6, kind: "round" },
  { top: "52%", left: "91%", size: 7, delay: 1.1, kind: "round" },
  { top: "62%", left: "6%", size: 5, delay: 2.9, kind: "square" },
  { top: "66%", left: "93%", size: 4, delay: 0.6, kind: "round" },
  { top: "76%", left: "10%", size: 6, delay: 1.7, kind: "round" },
  { top: "80%", left: "88%", size: 5, delay: 3.0, kind: "square" },
  { top: "88%", left: "14%", size: 4, delay: 2.4, kind: "round" },
  { top: "91%", left: "84%", size: 6, delay: 0.9, kind: "round" },
] as const;

const SPARKLES = [
  { top: "9%", left: "26%", size: 14, delay: 0.2 },
  { top: "6%", left: "70%", size: 18, delay: 1.8 },
  { top: "19%", left: "16%", size: 12, delay: 3.1 },
  { top: "17%", left: "86%", size: 15, delay: 0.9 },
  { top: "31%", left: "90%", size: 12, delay: 2.3 },
  { top: "35%", left: "12%", size: 16, delay: 1.2 },
  { top: "56%", left: "15%", size: 13, delay: 2.8 },
  { top: "58%", left: "87%", size: 17, delay: 0.5 },
  { top: "72%", left: "20%", size: 12, delay: 1.5 },
  { top: "74%", left: "82%", size: 14, delay: 3.4 },
  { top: "86%", left: "30%", size: 16, delay: 2.0 },
  { top: "84%", left: "72%", size: 13, delay: 0.7 },
] as const;

function Sparkle({ size, id }: { size: number; id: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 0C12.9 6.6 17.4 11.1 24 12C17.4 12.9 12.9 17.4 12 24C11.1 17.4 6.6 12.9 0 12C6.6 11.1 11.1 6.6 12 0Z"
        fill={`url(#${id})`}
      />
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="24" y2="24">
          <stop offset="0" stopColor="#f9e7b3" />
          <stop offset="0.5" stopColor="#d4a437" />
          <stop offset="1" stopColor="#a87a1f" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function Page() {
  return (
    <main className={styles.stage}>
      <section
        className={styles.poster}
        aria-label="Save the date poster for Adriana Orozco's 50th birthday celebration on October 3rd"
      >
        {/* Ornamental double border with corner flourishes */}
        <div className={styles.frameOuter} aria-hidden="true" />
        <div className={styles.frameInner} aria-hidden="true">
          <span className={`${styles.corner} ${styles.cornerTL}`} />
          <span className={`${styles.corner} ${styles.cornerTR}`} />
          <span className={`${styles.corner} ${styles.cornerBL}`} />
          <span className={`${styles.corner} ${styles.cornerBR}`} />
        </div>

        {/* Ambient glitter, confetti and sparkles */}
        <div className={styles.glitter} aria-hidden="true" />
        <div aria-hidden="true">
          {CONFETTI.map((c, i) => (
            <span
              key={`c${i}`}
              className={`${styles.confetti} ${
                c.kind === "square" ? styles.confettiSquare : ""
              }`}
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
              <Sparkle size={s.size} id={`spark-${i}`} />
            </span>
          ))}
        </div>

        <div className={styles.content}>
          <p className={`${cinzel.className} ${styles.saveTheDate}`}>
            Save <span className={styles.amp}>the</span> Date
          </p>

          <div className={styles.flourish} aria-hidden="true">
            <span className={styles.flourishLine} />
            <span className={styles.flourishDiamond} />
            <span className={styles.flourishLine} />
          </div>

          <h1 className={styles.centerpiece}>
            <span className={`${greatVibes.className} ${styles.scriptName}`}>
              Adriana Orozco&rsquo;s
            </span>
            <span className={`${greatVibes.className} ${styles.scriptFifty}`}>
              50th
            </span>
            <span className={`${cinzel.className} ${styles.celebration}`}>
              Birthday Celebration
            </span>
          </h1>

          {/* Bold red accent rule separating the name from the date */}
          <div className={styles.redRule} aria-hidden="true" />

          <p className={`${cinzel.className} ${styles.date}`}>
            October 3<sup className={styles.ordinal}>rd</sup>
          </p>

          <p className={`${cormorant.className} ${styles.details}`}>
            Details to Come
          </p>
        </div>
      </section>
    </main>
  );
}
