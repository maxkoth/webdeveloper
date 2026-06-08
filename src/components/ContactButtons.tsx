import { CONTACT } from "@/lib/site";

/**
 * The site's primary action, reused in the hero and footer.
 * Both links are real, tappable, one-tap targets on mobile:
 *   Text  -> sms:+16464621236
 *   Email -> mailto:maxkoth77@gmail.com
 */
export default function ContactButtons({
  size = "lg",
}: {
  size?: "lg" | "md";
}) {
  const pad = size === "lg" ? "px-7 py-4 text-base" : "px-6 py-3 text-sm";

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <a
        href={CONTACT.sms}
        className={`group inline-flex items-center justify-center gap-2 rounded-full bg-volt font-semibold tracking-tight text-ink transition-transform duration-200 hover:-translate-y-0.5 ${pad}`}
      >
        <ChatIcon />
        Text me
        <span className="font-mono text-[0.8em] font-normal opacity-70">
          {CONTACT.phoneDisplay}
        </span>
      </a>
      <a
        href={CONTACT.mailto}
        className={`group inline-flex items-center justify-center gap-2 rounded-full border border-paper/30 font-semibold tracking-tight text-paper transition-colors duration-200 hover:border-volt hover:text-volt ${pad}`}
      >
        <MailIcon />
        Email me
      </a>
    </div>
  );
}

function ChatIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}
