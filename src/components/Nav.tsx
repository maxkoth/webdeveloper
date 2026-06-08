"use client";

import { useEffect, useState } from "react";
import { CONTACT, NAV_LINKS, SITE } from "@/lib/site";

export default function Nav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock body scroll while the mobile menu is open.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        scrolled || open
          ? "border-b border-line bg-ink/85 backdrop-blur-md"
          : "border-b border-transparent"
      }`}
    >
      <nav
        aria-label="Primary"
        className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8"
      >
        <a
          href="#top"
          className="flex items-center gap-2 font-display text-lg font-black tracking-tight"
          onClick={() => setOpen(false)}
        >
          <span aria-hidden="true" className="text-volt">
            ◆
          </span>
          <span className="sr-only">{SITE.name} — back to top</span>
          <span aria-hidden="true">
            Maximum<span className="text-volt">.</span>
          </span>
        </a>

        {/* Desktop links */}
        <ul className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="font-mono text-xs uppercase tracking-[0.16em] text-muted transition-colors hover:text-paper"
              >
                {link.label}
              </a>
            </li>
          ))}
          <li>
            <a
              href={CONTACT.sms}
              className="inline-flex items-center rounded-full bg-volt px-4 py-2 font-semibold tracking-tight text-ink transition-transform duration-200 hover:-translate-y-0.5"
            >
              Get in touch
            </a>
          </li>
        </ul>

        {/* Mobile toggle */}
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center md:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="relative block h-4 w-6">
            <span
              className={`absolute left-0 block h-0.5 w-6 bg-paper transition-transform duration-300 ${
                open ? "top-1.5 rotate-45" : "top-0"
              }`}
            />
            <span
              className={`absolute left-0 top-1.5 block h-0.5 w-6 bg-paper transition-opacity duration-200 ${
                open ? "opacity-0" : "opacity-100"
              }`}
            />
            <span
              className={`absolute left-0 block h-0.5 w-6 bg-paper transition-transform duration-300 ${
                open ? "top-1.5 -rotate-45" : "top-3"
              }`}
            />
          </span>
        </button>
      </nav>

      {/* Mobile menu */}
      <div
        id="mobile-menu"
        hidden={!open}
        className="border-t border-line bg-ink px-5 pb-8 pt-4 md:hidden"
      >
        <ul className="flex flex-col gap-1">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                onClick={() => setOpen(false)}
                className="block py-3 font-display text-2xl font-extrabold tracking-tight"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="mt-5 flex flex-col gap-3">
          <a
            href={CONTACT.sms}
            className="inline-flex items-center justify-center rounded-full bg-volt px-5 py-3 font-semibold text-ink"
          >
            Text {CONTACT.phoneDisplay}
          </a>
          <a
            href={CONTACT.mailto}
            className="inline-flex items-center justify-center rounded-full border border-paper/30 px-5 py-3 font-semibold text-paper"
          >
            Email me
          </a>
        </div>
      </div>
    </header>
  );
}
