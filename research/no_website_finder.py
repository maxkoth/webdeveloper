#!/usr/bin/env python3
"""
no_website_finder.py
====================
Find LOCAL BUSINESSES THAT HAVE NO WEBSITE — your warmest "I'll build you a
website" leads. Writes them to research/no_website_targets.csv.

The trick
---------
Businesses get listed on maps (Google Maps / OpenStreetMap) by customers and by
themselves, often WITH a phone number but WITHOUT a website. That missing-website
signal is exactly your opening. This script finds those listings and keeps only
the ones with no site.

Output columns (research/no_website_targets.csv):
    business_name, category, phone, address, source_url, notes

It NEVER invents data. No phone found = blank phone. No business found = nothing
written. "source_url" is the maps listing so you can verify before reaching out.

------------------------------------------------------------------------------
BACKENDS — pick ONE
------------------------------------------------------------------------------

  Backend   Key needed?   Cost                       How to get it
  --------  -----------  -------------------------   ------------------------------
  osm       NO           Free, no key, no signup     (default) Uses OpenStreetMap
            (default)                                 Nominatim + Overpass. Be gentle:
                                                      these are donated public servers.
  google    YES          Free monthly credit, then   1. https://console.cloud.google.com
                         pay-per-call. Best data.     2. Enable "Places API (New)".
                                                      3. Create an API key.
                                                      Set env var: GOOGLE_MAPS_API_KEY=...
                                                      Pricing: https://mapsplatform.google.com/pricing/
                                                      (Set a budget cap in the console so
                                                       you never get a surprise bill.)

Recommendation: start with `osm` (free). Its coverage is thinner than Google's,
but every lead is free and pre-filtered to "no website." Move to `google` when
you want denser, more complete local coverage and don't mind metered cost.

------------------------------------------------------------------------------
DEPENDENCIES
------------------------------------------------------------------------------
    pip install requests

------------------------------------------------------------------------------
USAGE
------------------------------------------------------------------------------
    # Free OSM backend — businesses with no website near a place:
    python research/no_website_finder.py --location "Newark, NJ"

    # Narrow to certain categories (OSM):
    python research/no_website_finder.py --location "Jersey City, NJ" \
        --categories restaurant,hairdresser,cafe,car_repair

    # Google backend (denser data, needs the API key + a budget cap):
    python research/no_website_finder.py --backend google \
        --query "restaurants in Newark NJ"

    # Append instead of overwrite:
    python research/no_website_finder.py --location "Hoboken, NJ" --append
"""

from __future__ import annotations

import argparse
import csv
import os
import sys
import time
from dataclasses import dataclass
from pathlib import Path

try:
    import requests
except ImportError:
    sys.exit("Missing dependency. Run:  pip install requests")

OUTPUT_CSV = Path(__file__).resolve().parent / "no_website_targets.csv"
CSV_COLUMNS = ["business_name", "category", "phone", "address", "source_url", "notes"]

# Set this to your own contact so server admins can reach you (required etiquette
# for OpenStreetMap's free APIs).
USER_AGENT = "NoWebsiteFinder/1.0 (local lead research; +contact: maxkoth77@gmail.com)"

# OSM categories that are typically small businesses likely to want a website.
# Each entry is an Overpass key=value (or key=* with value None) selector.
DEFAULT_OSM_SELECTORS = [
    ("shop", None),                  # any shop (hair, beauty, bakery, butcher, etc.)
    ("craft", None),                 # plumbers, electricians, carpenters, etc.
    ("office", None),                # accountants, lawyers, agencies
    ("amenity", "restaurant"),
    ("amenity", "cafe"),
    ("amenity", "bar"),
    ("amenity", "fast_food"),
    ("amenity", "dentist"),
    ("amenity", "veterinary"),
    ("amenity", "car_repair"),       # also commonly under shop=car_repair
]


@dataclass
class Biz:
    business_name: str = ""
    category: str = ""
    phone: str = ""
    address: str = ""
    source_url: str = ""
    notes: str = ""

    def as_row(self) -> dict:
        return {c: getattr(self, c) for c in CSV_COLUMNS}


# --------------------------------------------------------------------------- #
# OpenStreetMap backend (free)
# --------------------------------------------------------------------------- #

def osm_bbox(location: str) -> tuple[float, float, float, float]:
    """Geocode a place name to a bounding box via Nominatim (free, no key)."""
    resp = requests.get(
        "https://nominatim.openstreetmap.org/search",
        params={"q": location, "format": "json", "limit": 1},
        headers={"User-Agent": USER_AGENT},
        timeout=20,
    )
    resp.raise_for_status()
    data = resp.json()
    if not data:
        sys.exit(f"Could not geocode location: {location!r}. Try a more specific name.")
    # Nominatim boundingbox = [south, north, west, east] as strings.
    s, n, w, e = (float(x) for x in data[0]["boundingbox"])
    return s, w, n, e  # return as (south, west, north, east) for Overpass


def osm_search(location: str, selectors: list[tuple[str, str | None]]) -> list[Biz]:
    south, west, north, east = osm_bbox(location)
    print(f"  bbox: S={south:.4f} W={west:.4f} N={north:.4f} E={east:.4f}")
    time.sleep(1.0)  # be polite to Nominatim before hitting Overpass

    bbox = f"{south},{west},{north},{east}"
    # Build a query that returns named places WITHOUT a website tag.
    parts = []
    for key, val in selectors:
        sel = f'["{key}"]' if val is None else f'["{key}"="{val}"]'
        # require a name, exclude anything carrying a website-ish tag
        suffix = '["name"][!"website"][!"contact:website"][!"url"]'
        parts.append(f'  node{sel}{suffix}({bbox});')
        parts.append(f'  way{sel}{suffix}({bbox});')
    query = "[out:json][timeout:60];\n(\n" + "\n".join(parts) + "\n);\nout center tags;"

    resp = requests.post(
        "https://overpass-api.de/api/interpreter",
        data={"data": query},
        headers={"User-Agent": USER_AGENT},
        timeout=90,
    )
    if resp.status_code != 200:
        print(f"  ! Overpass error {resp.status_code}: {resp.text[:200]}", file=sys.stderr)
        return []

    out: list[Biz] = []
    for el in resp.json().get("elements", []):
        tags = el.get("tags", {})
        name = tags.get("name", "").strip()
        if not name:
            continue
        # category = the most specific business tag we matched
        category = (
            tags.get("shop") or tags.get("craft") or tags.get("office")
            or tags.get("amenity") or "business"
        )
        phone = (tags.get("phone") or tags.get("contact:phone") or "").strip()
        address = " ".join(filter(None, [
            tags.get("addr:housenumber", ""), tags.get("addr:street", ""),
            tags.get("addr:city", ""), tags.get("addr:postcode", ""),
        ])).strip()
        osm_id = el.get("id")
        osm_type = el.get("type")
        source_url = f"https://www.openstreetmap.org/{osm_type}/{osm_id}" if osm_id else ""
        notes = "" if phone else "no phone in OSM; look up before contacting"
        out.append(Biz(name, category, phone, address, source_url, notes))
    return out


# --------------------------------------------------------------------------- #
# Google Places (New) backend (paid, denser)
# --------------------------------------------------------------------------- #

def google_search(query: str) -> list[Biz]:
    key = os.getenv("GOOGLE_MAPS_API_KEY")
    if not key:
        sys.exit(
            "Google backend needs env var GOOGLE_MAPS_API_KEY with the Places API (New)\n"
            "enabled. See this file's header. Set a budget cap in Google Cloud first."
        )
    field_mask = ",".join([
        "places.displayName", "places.formattedAddress", "places.nationalPhoneNumber",
        "places.websiteUri", "places.primaryTypeDisplayName", "places.googleMapsUri",
        "nextPageToken",
    ])
    out: list[Biz] = []
    page_token = None
    pages = 0
    while pages < 3:  # 3 pages * 20 = up to 60 results per query; raise if you want more
        body = {"textQuery": query, "pageSize": 20}
        if page_token:
            body["pageToken"] = page_token
        resp = requests.post(
            "https://places.googleapis.com/v1/places:searchText",
            headers={
                "Content-Type": "application/json",
                "X-Goog-Api-Key": key,
                "X-Goog-FieldMask": field_mask,
            },
            json=body, timeout=30,
        )
        if resp.status_code != 200:
            print(f"  ! Places error {resp.status_code}: {resp.text[:300]}", file=sys.stderr)
            break
        data = resp.json()
        for p in data.get("places", []):
            # KEEP ONLY businesses with NO website — that's the whole point.
            if p.get("websiteUri"):
                continue
            name = (p.get("displayName") or {}).get("text", "").strip()
            if not name:
                continue
            category = (p.get("primaryTypeDisplayName") or {}).get("text", "business")
            phone = p.get("nationalPhoneNumber", "").strip()
            address = p.get("formattedAddress", "").strip()
            source_url = p.get("googleMapsUri", "")
            notes = "" if phone else "no phone on listing; verify before contacting"
            out.append(Biz(name, category, phone, address, source_url, notes))
        page_token = data.get("nextPageToken")
        pages += 1
        if not page_token:
            break
        time.sleep(2.0)  # next page token needs a moment to become valid
    return out


# --------------------------------------------------------------------------- #
# Main
# --------------------------------------------------------------------------- #

def load_existing(path: Path) -> set[str]:
    if not path.exists():
        return set()
    seen = set()
    with path.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            seen.add((row.get("business_name", "").lower(), row.get("address", "").lower()))
    return seen


def main() -> None:
    ap = argparse.ArgumentParser(
        description="Find local businesses with no website (your warmest web-build leads).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    ap.add_argument("--backend", choices=["osm", "google"], default="osm")
    ap.add_argument("--location", help="(osm) Place name, e.g. 'Newark, NJ'")
    ap.add_argument("--query", help="(google) Free text, e.g. 'restaurants in Newark NJ'")
    ap.add_argument("--categories",
                    help="(osm) Comma list of amenity/shop values to narrow, "
                         "e.g. restaurant,hairdresser,cafe")
    ap.add_argument("--append", action="store_true", help="Append to the CSV")
    args = ap.parse_args()

    if args.backend == "osm":
        if not args.location:
            ap.error("osm backend needs --location (e.g. --location 'Newark, NJ')")
        if args.categories:
            cats = [c.strip() for c in args.categories.split(",") if c.strip()]
            # Treat each given category as amenity OR shop value (covers most cases).
            selectors = []
            for c in cats:
                selectors.append(("amenity", c))
                selectors.append(("shop", c))
        else:
            selectors = DEFAULT_OSM_SELECTORS
        print(f"== OSM search near {args.location!r}")
        results = osm_search(args.location, selectors)
    else:
        if not args.query:
            ap.error("google backend needs --query (e.g. --query 'restaurants in Newark NJ')")
        print(f"== Google Places search: {args.query!r}")
        results = google_search(args.query)

    # De-dup (by name + address) and against existing file if appending.
    seen = load_existing(OUTPUT_CSV) if args.append else set()
    unique: list[Biz] = []
    for b in results:
        key = (b.business_name.lower(), b.address.lower())
        if key in seen:
            continue
        seen.add(key)
        unique.append(b)

    mode = "a" if (args.append and OUTPUT_CSV.exists()) else "w"
    OUTPUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_CSV.open(mode, newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=CSV_COLUMNS)
        if mode == "w":
            w.writeheader()
        for b in unique:
            w.writerow(b.as_row())

    with_phone = sum(1 for b in unique if b.phone)
    print(f"\nDone. Wrote {len(unique)} no-website business(es) to {OUTPUT_CSV}")
    print(f"  {with_phone} have a phone number; {len(unique) - with_phone} need a manual lookup.")
    if not unique:
        print("  (Nothing matched. Try a bigger/more specific --location, or the google backend.)")


if __name__ == "__main__":
    main()
