import ContactButtons from "./ContactButtons";
import Reveal from "./Reveal";
import { CONTACT, SITE } from "@/lib/site";

export default function Footer() {
  return (
    <footer id="contact" className="bg-ink">
      <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8 sm:py-32">
        <Reveal>
          <p className="label text-volt">Let&apos;s build it</p>
          <h2 className="display mt-5 text-[clamp(2.5rem,9vw,6.5rem)] text-paper">
            Got something
            <br />
            to build<span className="text-volt">?</span>
          </h2>
          <p className="mt-6 max-w-xl text-lg text-muted">
            Text or email me. Tell me what you&apos;re making. I&apos;ll tell you
            straight whether I&apos;m the right person to build it.
          </p>

          <div className="mt-9">
            <ContactButtons size="lg" placement="footer" />
          </div>
        </Reveal>

        <div className="mt-20 flex flex-col gap-6 border-t border-line pt-8 font-mono text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {SITE.name}. Built by Max.
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <a href={CONTACT.tel} className="hover:text-paper">
              Call {CONTACT.phoneDisplay}
            </a>
            <a href={CONTACT.sms} className="hover:text-paper">
              Text {CONTACT.phoneDisplay}
            </a>
            <a href={CONTACT.mailto} className="hover:text-paper">
              {CONTACT.email}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
