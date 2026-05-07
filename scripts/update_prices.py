#!/usr/bin/env python3
"""Hämtar lägsta pris från PriceRunner.se för varje modell och uppdaterar data.js.
Körs av GitHub Actions en gång per dygn. Uppdaterar bara om ett giltigt pris hittas;
befintliga priser skrivs aldrig över med None.
"""

import json
import pathlib
import re
import time

import requests
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "sv-SE,sv;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
}

# Samma tillverkare + modellnamn som i data.js
PRODUKTER = [
    ("Roborock", "S8 MaxV Ultra"),
    ("Roborock", "Qrevo Curv"),
    ("Roborock", "Saros 10"),
    ("Roborock", "Saros 10R"),
    ("Roborock", "Saros Z70"),
    ("Roborock", "Qrevo Curv X"),
    ("Dreame",   "X40 Ultra"),
    ("Dreame",   "X50 Ultra"),
    ("Dreame",   "X60 Ultra"),
    ("Dreame",   "X60 Max Ultra Complete"),
    ("Dreame",   "L60 Ultra Pro"),
    ("Narwal",   "Freo Z Ultra"),
    ("Narwal",   "Freo X Ultra"),
    ("Narwal",   "Freo Z10 Ultra"),
    ("Narwal",   "Flow"),
    ("Narwal",   "Flow 2"),
    ("Narwal",   "Flow 2 Ultra"),
    ("Ecovacs",  "Deebot T30S Pro"),
    ("Ecovacs",  "Deebot X12 OmniCyclone"),
    ("Shark",    "PowerDetect ThermaCharged"),
    ("Shark",    "PowerDetect UV Reveal"),
    ("iRobot",   "Roomba Combo 10 Max"),
]

DATA_JS = pathlib.Path(__file__).parent.parent / "data.js"


def fetch_price(manufacturer: str, model: str) -> int | None:
    query = f"{manufacturer} {model} robotdammsugare"
    url = f"https://www.pricerunner.se/search?q={requests.utils.quote(query)}"
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        if resp.status_code != 200:
            print(f"  HTTP {resp.status_code}")
            return None

        # Försök 1: JSON-LD med offers/lowPrice
        soup = BeautifulSoup(resp.text, "html.parser")
        for tag in soup.find_all("script", type="application/ld+json"):
            try:
                data = json.loads(tag.string or "")
                items = data if isinstance(data, list) else [data]
                for item in items:
                    offers = item.get("offers") or item.get("Offers") or {}
                    for key in ("lowPrice", "price"):
                        val = offers.get(key)
                        if val:
                            p = int(float(str(val)))
                            if 2000 <= p <= 80000:
                                return p
            except Exception:
                pass

        # Försök 2: minsta pris som förekommer i sidtexten (2 000–80 000 kr)
        prices = []
        for raw in re.findall(r"(\d[\d\xa0 ]{2,6})\s*kr", resp.text):
            try:
                p = int(raw.replace("\xa0", "").replace(" ", ""))
                if 2000 <= p <= 80000:
                    prices.append(p)
            except ValueError:
                pass
        return min(prices) if prices else None

    except Exception as exc:
        print(f"  Fel: {exc}")
        return None


def patch_price(manufacturer: str, model: str, price: int) -> bool:
    src = DATA_JS.read_text("utf-8")
    # Matcha exakt objekt via tillverkare+modell utan att korsa objektgränsen (})
    pattern = (
        r"(tillverkare:\s*\""
        + re.escape(manufacturer)
        + r"\"[^}]*?modellnamn:\s*\""
        + re.escape(model)
        + r"\"[^}]*?pris_prisjakt:\s*)(?:null|\d+)"
    )
    new_src, n = re.subn(pattern, rf"\g<1>{price}", src, flags=re.DOTALL)
    if n and new_src != src:
        DATA_JS.write_text(new_src, "utf-8")
        return True
    return False


def main() -> None:
    updated = 0
    for manufacturer, model in PRODUKTER:
        print(f"→ {manufacturer} {model}")
        price = fetch_price(manufacturer, model)
        if price:
            changed = patch_price(manufacturer, model, price)
            print(f"  {'Uppdaterat' if changed else 'Oförändrat'}: {price:,} kr".replace(",", " "))
            if changed:
                updated += 1
        else:
            print("  Inget pris hittades — behåller befintligt värde")
        time.sleep(2)

    print(f"\nKlart — {updated} priser uppdaterade.")


if __name__ == "__main__":
    main()
