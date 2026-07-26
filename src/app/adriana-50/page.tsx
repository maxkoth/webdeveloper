import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { cinzel, cormorant } from "./fonts";
import { VARIANTS } from "./variants";
import styles from "./chooser.module.css";

export const viewport: Viewport = {
  themeColor: "#0b0a08",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "Save the Date — Adriana's 50th (Choose a Design)",
  description:
    "Five poster options for Adriana Orozco's 50th Birthday Celebration save-the-date.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <main className={styles.stage}>
      <h1 className={`${cinzel.className} ${styles.heading}`}>
        Adriana&rsquo;s 50th — Save the Date
      </h1>
      <p className={`${cormorant.className} ${styles.sub}`}>
        Five design directions. Tap one to view it full screen.
      </p>
      <ol className={styles.list}>
        {Object.entries(VARIANTS).map(([key, v], i) => (
          <li key={key}>
            <Link
              href={`/adriana-50/${key}`}
              className={styles.card}
              style={{ background: v.theme }}
            >
              <span className={`${cinzel.className} ${styles.cardNum}`}>
                {i + 1}
              </span>
              <span className={styles.cardText}>
                <span className={`${cinzel.className} ${styles.cardLabel}`}>
                  {v.label}
                </span>
                <span className={`${cormorant.className} ${styles.cardBlurb}`}>
                  {v.blurb}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </main>
  );
}
