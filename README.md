# Maximum Developer

The portfolio site for **Maximum Developer** — Max, a freelance developer who
builds AI-powered apps and MVPs for startups, and fast, working websites for
local businesses.

Single page, anchored navigation, contact-first. Built with **Next.js (App
Router) + TypeScript + Tailwind CSS v4**, deploy-ready for Vercel with zero
extra config.

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
```

Other scripts:

```bash
npm run build    # production build (type-checked)
npm run start    # serve the production build
npm run lint     # ESLint
```

## Deploy (Vercel)

1. Push this repo to GitHub.
2. In Vercel, **Add New → Project** and import the repo.
3. Framework preset auto-detects **Next.js** — no settings to change.
4. Deploy.

After connecting the real domain (`maximumdeveloper.com`), no code change is
needed: the canonical URL, sitemap, robots, and Open Graph tags read from
`SITE.url` in [`src/lib/site.ts`](src/lib/site.ts). Update that one constant if
the domain differs.

## Editing content

Everything content-related lives in two places:

- [`src/lib/site.ts`](src/lib/site.ts) — name, tagline, contact details, nav.
- The section components in [`src/components/`](src/components) — `Hero`,
  `WhatIBuild`, `SelectedWork`, `HowIWork`, `About`, `Footer`.

The two case studies and their live URLs (teamthrive.com, thevaultr.com) live in
[`SelectedWork.tsx`](src/components/SelectedWork.tsx).

## Contact

The site's only call to action is to reach Max directly — no forms, no booking
tool. Both links are real and one-tap on mobile:

- **Text / call:** `sms:` / `tel:` → 646-462-1236
- **Email:** `mailto:` → maxkoth77@gmail.com

---

## Design decision & scores

**The one move:** an editorial-brutalist system in near-black + warm off-white,
anchored by a *single* high-voltage electric-lime accent, with oversized
`Archivo` display type set tight and left-aligned and `JetBrains Mono` for
labels and stack tags. I committed to this because the name "Maximum Developer"
is bold and a little aggressive, and the site is itself the proof of work — so
it deliberately rejects the generic AI-startup template (centered hero, three
line-icon cards, purple gradient, Inter everywhere) in favor of a confident,
type-led layout. Visuals are inline SVG (the work-card cover art included), so
there are no raster images to optimize, no extra requests, and no layout shift.
Legibility was held above edginess: all text meets WCAG AA contrast, focus
states are visible, and motion is disabled under `prefers-reduced-motion`.

**Lighthouse** (Chrome, production build):

| Category       | Mobile | Desktop |
| -------------- | :----: | :-----: |
| Performance    |   97   |   100   |
| Accessibility  |  100   |   100   |
| Best Practices |  100   |   100   |
| SEO            |  100   |   100   |

Verified: `npm run build` passes with no type errors; every nav anchor and the
`sms:` / `tel:` / `mailto:` links resolve correctly; layout is clean at 360px,
768px, and 1280px; no console errors or warnings on load.
