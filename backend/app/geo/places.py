"""
US city / ZIP coordinates, offline, from the Census Bureau 2023 Gazetteer
(public domain): every incorporated place and CDP, and every ZIP (ZCTA),
at its internal point. Used for deadhead (DH) radius searches - straight-line
miles, which is what a DH radius means on a load board.
"""
import csv
import gzip
import math
import re
from functools import lru_cache
from pathlib import Path
from typing import Optional, Tuple

_FILE = Path(__file__).resolve().parent.parent / "data" / "us_places.csv.gz"
_ABBR = {"SAINT": "ST", "SAINTE": "STE", "MOUNT": "MT", "FORT": "FT", "NORTH": "N", "SOUTH": "S", "EAST": "E", "WEST": "W"}

US_STATES = {
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA",
    "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR",
    "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "PR",
}


def city_key(city) -> str:
    words = re.sub(r"[^A-Z0-9 ]", " ", str(city or "").upper()).split()
    return " ".join(_ABBR.get(w, w) for w in words)


@lru_cache(maxsize=1)
def _tables():
    places, zips = {}, {}
    with gzip.open(_FILE, "rt", newline="") as f:
        for kind, state, name, lat, lng in csv.reader(f):
            if kind == "P":
                # First wins: the Gazetteer lists the incorporated place before a same-named CDP.
                places.setdefault((state, city_key(name)), (float(lat), float(lng)))
            elif kind == "Z":
                zips[name] = (float(lat), float(lng))
    return places, zips


def locate(city=None, state=None, zip_code=None) -> Optional[Tuple[float, float]]:
    """(lat, lng) of a city/state, else of its ZIP."""
    places, zips = _tables()
    st = str(state or "").strip().upper()[:2]
    if city and st:
        hit = places.get((st, city_key(city)))
        if hit:
            return hit
    z = re.search(r"\d{5}", str(zip_code or ""))
    return zips.get(z.group(0)) if z else None


def parse_place(query: str) -> dict:
    """'Chicago, IL' / 'chicago il' / 'IL' / '60609' -> {city, state, zip}."""
    q = str(query or "").strip()
    z = re.fullmatch(r"\s*(\d{5})\s*", q)
    if z:
        return {"zip": z.group(1)}
    words = re.sub(r"[,]", " ", q).split()
    if not words:
        return {}
    if len(words) == 1 and words[0].upper() in US_STATES:
        return {"state": words[0].upper()}
    if len(words) > 1 and words[-1].upper() in US_STATES:
        return {"city": " ".join(words[:-1]), "state": words[-1].upper()}
    return {"city": " ".join(words)}


def miles_between(a: Tuple[float, float], b: Tuple[float, float]) -> float:
    """Straight-line (great-circle) miles."""
    lat1, lng1, lat2, lng2 = map(math.radians, (*a, *b))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lng2 - lng1) / 2) ** 2
    return 3958.8 * 2 * math.asin(math.sqrt(h))
