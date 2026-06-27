#!/usr/bin/env python3
"""
agency_finder.py
================
Build a target list of small-to-mid digital / marketing / web agencies from
PUBLIC sources only, and write it to research/targets.csv.

What it does
------------
1. Runs one or more search queries (e.g. "Webflow agency", "marketing agency Austin").
2. Collects candidate agency website URLs from a search backend.
3. Visits each homepage politely (robots.txt aware, rate-limited) and tries to
   find a contact email or a contact-page URL.
4. De-duplicates by domain and writes rows to research/targets.csv with columns:
       agency_name, website, contact, niche, notes

It NEVER invents data. If a field can't be found it is left blank and a note is
added (e.g. "no email on homepage; check contact page manually").

------------------------------------------------------------------------------
SEARCH BACKENDS — pick ONE (the script auto-detects which is available)
------------------------------------------------------------------------------

  Backend            Key needed?   Cost                 How to get it
  -----------------  ------------  -------------------  -----------------------------
  ddgs (default)     NO            Free                 pip install ddgs
                                   (rate-limited,       (formerly `duckduckgo_search`)
                                    can throttle you)
  google             YES (2 keys)  Free 100 queries/    1. https://console.cloud.google.com
                                   day, then paid          enable "Custom Search API",
                                                           create an API key.
                                                        2. https://programmablesearchengine.google.com
                                                           create an engine set to
                                                           "Search the entire web",
                                                           copy the Search engine ID.
                                                        Set env vars:
                                                           GOOGLE_API_KEY=...
                                                           GOOGLE_CSE_ID=...
  serpapi            YES (1 key)   PAID (free trial:    https://serpapi.com  -> API key
                                   100 searches/mo)     Set env var: SERPAPI_KEY=...

Recommendation: start with `ddgs` (free, no key). If it throttles or you need
volume/quality, move to the Google Custom Search API free tier (100/day).

------------------------------------------------------------------------------
OPTIONAL: better email discovery
------------------------------------------------------------------------------
This script only reads emails that agencies publish on their own site. If you
want verified/role-based emails at scale, Hunter.io has a free tier
(25 searches/mo): https://hunter.io  -> set HUNTER_API_KEY=... and pass
--use-hunter. This is OPTIONAL and off by default. Always check a provider's
terms and your local anti-spam law (CAN-SPAM / GDPR / CASL) before emailing.

------------------------------------------------------------------------------
DEPENDENCIES
------------------------------------------------------------------------------
    pip install requests beautifulsoup4 ddgs
    # `ddgs` is only needed for the free default backend.

------------------------------------------------------------------------------
USAGE EXAMPLES
------------------------------------------------------------------------------
    # Free backend, two queries, 15 results each:
    python research/agency_finder.py "Webflow agency" "marketing agency Austin" --per-query 15

    # Force Google backend (needs the two env vars above):
    python research/agency_finder.py "shopify agency" --backend google

    # Read queries from a file (one per line):
    python research/agency_finder.py --queries-file research/queries.txt

    # Append to an existing targets.csv instead of overwriting:
    python research/agency_finder.py "saas web design agency" --append
"""

from __future__ import annotations

import argparse
import csv
import os
import re
import sys
import time
import urllib.parse
import urllib.robotparser
from dataclasses import dataclass, field
from pathlib import Path

try:
    import requests
except ImportError:
    sys.exit("Missing dependency. Run:  pip install requests beautifulsoup4 ddgs")

try:
    from bs4 import BeautifulSoup
except ImportError:
    sys.exit("Missing dependency. Run:  pip install requests beautifulsoup4 ddgs")


# --------------------------------------------------------------------------- #
# Config
# --------------------------------------------------------------------------- #

OUTPUT_CSV = Path(__file__).resolve().parent / "targets.csv"
CSV_COLUMNS = ["agency_name", "website", "contact", "niche", "notes"]

USER_AGENT = (
    "Mozilla/5.0 (compatible; AgencyFinder/1.0; outbound research; "
    "+contact: set-your-own-email)"
)
REQUEST_TIMEOUT = 12  # seconds
POLITE_DELAY = 2.0    # seconds between site visits (be a good citizen)

EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")

# Domains that are directories/aggregators/socials, not individual agencies.
# We skip these as targets (they're useful to FIND agencies, not to contact).
SKIP_DOMAINS = {
    "clutch.co", "goodfirms.co", "designrush.com", "upwork.com", "fiverr.com",
    "g2.com", "trustpilot.com", "yelp.com", "glassdoor.com", "indeed.com",
    "linkedin.com", "facebook.com", "twitter.com", "x.com", "instagram.com",
    "youtube.com", "medium.com", "reddit.com", "quora.com", "wikipedia.org",
    "github.com", "behance.net", "dribbble.com", "crunchbase.com",
    "google.com", "bing.com", "duckduckgo.com", "pinterest.com", "tiktok.com",
}

# Emails we should not treat as a usable contact (generic vendors / noreply).
JUNK_EMAIL_SUBSTR = ("example.com", "sentry.io", "wixpress.com", "@2x", ".png", ".jpg")

CONTACT_PATH_HINTS = ("contact", "get-in-touch", "lets-talk", "say-hello", "hire-us")


# --------------------------------------------------------------------------- #
# Data model
# --------------------------------------------------------------------------- #

@dataclass
class Target:
    agency_name: str = ""
    website: str = ""
    contact: str = ""
    niche: str = ""
    notes: list[str] = field(default_factory=list)

    def as_row(self) -> dict:
        return {
            "agency_name": self.agency_name,
            "website": self.website,
            "contact": self.contact,
            "niche": self.niche,
            "notes": "; ".join(self.notes),
        }


# --------------------------------------------------------------------------- #
# Search backends
# --------------------------------------------------------------------------- #

def search_ddgs(query: str, n: int) -> list[str]:
    """Free, no API key. Requires `pip install ddgs`."""
    try:
        from ddgs import DDGS
    except ImportError:
        try:
            # older package name
            from duckduckgo_search import DDGS  # type: ignore
        except ImportError:
            sys.exit(
                "The free backend needs the `ddgs` package:\n"
                "    pip install ddgs\n"
                "Or use --backend google / --backend serpapi with the right env vars."
            )
    urls: list[str] = []
    with DDGS() as ddgs:
        for r in ddgs.text(query, max_results=n * 2):
            href = r.get("href") or r.get("url") or ""
            if href:
                urls.append(href)
    return urls


def search_google(query: str, n: int) -> list[str]:
    """Google Custom Search JSON API. Needs GOOGLE_API_KEY + GOOGLE_CSE_ID."""
    api_key = os.getenv("GOOGLE_API_KEY")
    cse_id = os.getenv("GOOGLE_CSE_ID")
    if not api_key or not cse_id:
        sys.exit(
            "Google backend needs env vars GOOGLE_API_KEY and GOOGLE_CSE_ID.\n"
            "See the header of this file for how to create them (free, 100/day)."
        )
    urls: list[str] = []
    fetched = 0
    start = 1
    while fetched < n and start <= 91:  # API caps at 100 results (10 pages)
        resp = requests.get(
            "https://www.googleapis.com/customsearch/v1",
            params={
                "key": api_key, "cx": cse_id, "q": query,
                "num": min(10, n - fetched), "start": start,
            },
            timeout=REQUEST_TIMEOUT,
        )
        if resp.status_code != 200:
            print(f"  ! Google API error {resp.status_code}: {resp.text[:200]}",
                  file=sys.stderr)
            break
        items = resp.json().get("items", [])
        if not items:
            break
        for it in items:
            urls.append(it.get("link", ""))
        fetched += len(items)
        start += 10
        time.sleep(0.5)
    return urls


def search_serpapi(query: str, n: int) -> list[str]:
    """SerpAPI (paid, free trial). Needs SERPAPI_KEY."""
    key = os.getenv("SERPAPI_KEY")
    if not key:
        sys.exit("SerpAPI backend needs env var SERPAPI_KEY. Get one at https://serpapi.com")
    resp = requests.get(
        "https://serpapi.com/search.json",
        params={"engine": "google", "q": query, "num": n, "api_key": key},
        timeout=REQUEST_TIMEOUT,
    )
    if resp.status_code != 200:
        print(f"  ! SerpAPI error {resp.status_code}: {resp.text[:200]}", file=sys.stderr)
        return []
    return [r.get("link", "") for r in resp.json().get("organic_results", [])]


BACKENDS = {"ddgs": search_ddgs, "google": search_google, "serpapi": search_serpapi}


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #

def registrable_domain(url: str) -> str:
    """Return the host without a leading www. for de-dup / skip checks."""
    host = urllib.parse.urlparse(url).netloc.lower()
    return host[4:] if host.startswith("www.") else host


def is_skippable(url: str) -> bool:
    dom = registrable_domain(url)
    if not dom:
        return True
    return any(dom == s or dom.endswith("." + s) for s in SKIP_DOMAINS)


def robots_allows(url: str, ua: str) -> bool:
    """Best-effort robots.txt check. On any error we DEFAULT TO POLITE (skip-allow)."""
    try:
        parts = urllib.parse.urlparse(url)
        robots_url = f"{parts.scheme}://{parts.netloc}/robots.txt"
        rp = urllib.robotparser.RobotFileParser()
        rp.set_url(robots_url)
        rp.read()
        return rp.can_fetch(ua, url)
    except Exception:
        return True  # if robots can't be read, allow but stay rate-limited


def fetch(url: str) -> requests.Response | None:
    try:
        return requests.get(
            url, headers={"User-Agent": USER_AGENT},
            timeout=REQUEST_TIMEOUT, allow_redirects=True,
        )
    except requests.RequestException:
        return None


def clean_email(raw: str) -> str | None:
    e = raw.strip().strip(".,;:").lower()
    if any(j in e for j in JUNK_EMAIL_SUBSTR):
        return None
    return e


def extract_email(soup: BeautifulSoup, html: str) -> str | None:
    # 1) mailto: links are the most reliable
    for a in soup.select('a[href^="mailto:"]'):
        addr = a.get("href", "")[len("mailto:"):].split("?")[0]
        e = clean_email(addr)
        if e:
            return e
    # 2) fall back to scanning visible text for an address
    for m in EMAIL_RE.findall(html):
        e = clean_email(m)
        if e:
            return e
    return None


def find_contact_page(soup: BeautifulSoup, base_url: str) -> str | None:
    for a in soup.find_all("a", href=True):
        href = a["href"].lower()
        text = (a.get_text() or "").lower()
        if any(h in href for h in CONTACT_PATH_HINTS) or "contact" in text:
            return urllib.parse.urljoin(base_url, a["href"])
    return None


def agency_name_from(soup: BeautifulSoup, url: str) -> str:
    """Best-effort name: og:site_name, then <title> (trimmed), then domain."""
    og = soup.find("meta", attrs={"property": "og:site_name"})
    if og and og.get("content", "").strip():
        return og["content"].strip()
    if soup.title and soup.title.string:
        title = soup.title.string.strip()
        # Trim common "Name | tagline" / "Name - tagline" patterns to the first part.
        for sep in (" | ", " – ", " — ", " - ", " :: "):
            if sep in title:
                return title.split(sep)[0].strip()
        return title[:80]
    return registrable_domain(url)


def enrich(url: str, niche: str) -> Target | None:
    """Visit a homepage and build a Target. Returns None if the site is unreachable."""
    t = Target(website=url, niche=niche)

    if not robots_allows(url, USER_AGENT):
        t.notes.append("robots.txt disallows crawling homepage; left contact blank")
        t.agency_name = registrable_domain(url)
        return t

    resp = fetch(url)
    if resp is None or resp.status_code >= 400 or not resp.text:
        # Keep the row anyway — the URL itself is still a usable lead.
        t.agency_name = registrable_domain(url)
        t.notes.append(f"homepage unreachable (status={getattr(resp, 'status_code', 'n/a')}); "
                       "verify URL and find contact manually")
        return t

    soup = BeautifulSoup(resp.text, "html.parser")
    t.website = resp.url  # follow redirects to the canonical URL
    t.agency_name = agency_name_from(soup, t.website)

    email = extract_email(soup, resp.text)
    if email:
        t.contact = email
    else:
        contact_page = find_contact_page(soup, t.website)
        if contact_page and robots_allows(contact_page, USER_AGENT):
            time.sleep(POLITE_DELAY)
            cresp = fetch(contact_page)
            if cresp is not None and cresp.status_code < 400 and cresp.text:
                csoup = BeautifulSoup(cresp.text, "html.parser")
                email = extract_email(csoup, cresp.text)
                if email:
                    t.contact = email
                else:
                    t.contact = contact_page
                    t.notes.append("no email found; contact field is the contact-page URL")
            else:
                t.contact = contact_page
                t.notes.append("no email on homepage; contact field is contact-page URL")
        else:
            t.notes.append("no email or contact page found on homepage; check manually")
    return t


# --------------------------------------------------------------------------- #
# Optional Hunter.io email lookup
# --------------------------------------------------------------------------- #

def hunter_email(domain: str) -> str | None:
    key = os.getenv("HUNTER_API_KEY")
    if not key:
        return None
    try:
        resp = requests.get(
            "https://api.hunter.io/v2/domain-search",
            params={"domain": domain, "api_key": key, "limit": 1},
            timeout=REQUEST_TIMEOUT,
        )
        if resp.status_code != 200:
            return None
        emails = resp.json().get("data", {}).get("emails", [])
        return emails[0]["value"] if emails else None
    except requests.RequestException:
        return None


# --------------------------------------------------------------------------- #
# Main
# --------------------------------------------------------------------------- #

def load_existing_domains(path: Path) -> set[str]:
    if not path.exists():
        return set()
    seen = set()
    with path.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            seen.add(registrable_domain(row.get("website", "")))
    return seen


def main() -> None:
    ap = argparse.ArgumentParser(
        description="Find small/mid digital & marketing agencies from public sources.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    ap.add_argument("queries", nargs="*",
                    help='Search queries, e.g. "Webflow agency" "marketing agency Austin"')
    ap.add_argument("--queries-file", help="Path to a file with one query per line")
    ap.add_argument("--backend", choices=list(BACKENDS), default="ddgs",
                    help="Search backend (default: ddgs, free, no key)")
    ap.add_argument("--per-query", type=int, default=10,
                    help="Candidate results to keep per query (default: 10)")
    ap.add_argument("--append", action="store_true",
                    help="Append to targets.csv instead of overwriting")
    ap.add_argument("--use-hunter", action="store_true",
                    help="If contact missing, try Hunter.io (needs HUNTER_API_KEY)")
    ap.add_argument("--delay", type=float, default=POLITE_DELAY,
                    help=f"Seconds between site visits (default: {POLITE_DELAY})")
    args = ap.parse_args()

    queries = list(args.queries)
    if args.queries_file:
        queries += [l.strip() for l in Path(args.queries_file).read_text().splitlines()
                    if l.strip() and not l.startswith("#")]
    if not queries:
        ap.error("Provide at least one query, or use --queries-file.")

    search = BACKENDS[args.backend]
    print(f"Backend: {args.backend} | queries: {len(queries)} | "
          f"per-query: {args.per_query}\n")

    seen_domains = load_existing_domains(OUTPUT_CSV) if args.append else set()
    targets: list[Target] = []

    for q in queries:
        print(f"== Searching: {q!r}")
        try:
            urls = search(q, args.per_query)
        except SystemExit:
            raise
        except Exception as e:
            print(f"  ! search failed: {e}", file=sys.stderr)
            continue

        kept = 0
        for url in urls:
            if kept >= args.per_query:
                break
            if not url or is_skippable(url):
                continue
            dom = registrable_domain(url)
            if dom in seen_domains:
                continue
            seen_domains.add(dom)

            print(f"  - {dom}")
            t = enrich(url, niche=q)
            if t is None:
                continue
            if not t.contact and args.use_hunter:
                he = hunter_email(dom)
                if he:
                    t.contact = he
                    t.notes.append("contact via Hunter.io")
            targets.append(t)
            kept += 1
            time.sleep(args.delay)
        print(f"  -> kept {kept} new target(s)\n")

    # Write CSV
    mode = "a" if (args.append and OUTPUT_CSV.exists()) else "w"
    write_header = not (mode == "a")
    OUTPUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_CSV.open(mode, newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=CSV_COLUMNS)
        if write_header:
            w.writeheader()
        for t in targets:
            w.writerow(t.as_row())

    with_contact = sum(1 for t in targets if t.contact)
    print(f"Done. Wrote {len(targets)} target(s) to {OUTPUT_CSV}")
    print(f"  {with_contact} have a contact; {len(targets) - with_contact} need manual lookup.")
    if len(targets) and with_contact == 0:
        print("  (No contacts auto-found — try --use-hunter, or open the contact-page URLs.)")


if __name__ == "__main__":
    main()
