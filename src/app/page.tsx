import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import WhatIBuild from "@/components/WhatIBuild";
import SelectedWork from "@/components/SelectedWork";
import HowIWork from "@/components/HowIWork";
import About from "@/components/About";
import Faq from "@/components/Faq";
import Footer from "@/components/Footer";
import { CONTACT, FAQS, SITE } from "@/lib/site";

// JSON-LD: helps the site describe itself to search engines as a real person/
// service with reachable contact points, the services on offer, and FAQ
// content eligible for rich results.
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "ProfessionalService",
      "@id": `${SITE.url}/#business`,
      name: SITE.name,
      url: SITE.url,
      description: SITE.description,
      founder: { "@type": "Person", name: "Max" },
      email: CONTACT.email,
      telephone: CONTACT.phoneDigits,
      areaServed: [
        { "@type": "City", name: "New York" },
        { "@type": "Country", name: "United States" },
      ],
      knowsAbout: [
        "AI application development",
        "MVP development",
        "React Native",
        "Next.js",
        "Small business websites",
      ],
      makesOffer: [
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: "AI apps & startup MVPs",
            description:
              "AI-powered mobile and web apps and startup MVPs, built and shipped.",
          },
        },
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: "Small-business websites",
            description:
              "Fast, mobile-first websites for local and small businesses.",
          },
        },
      ],
    },
    {
      "@type": "FAQPage",
      "@id": `${SITE.url}/#faq`,
      mainEntity: FAQS.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ],
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-volt focus:px-4 focus:py-2 focus:font-semibold focus:text-ink"
      >
        Skip to content
      </a>
      <Nav />
      <main id="main">
        <Hero />
        <WhatIBuild />
        <SelectedWork />
        <HowIWork />
        <About />
        <Faq />
      </main>
      <Footer />
    </>
  );
}
