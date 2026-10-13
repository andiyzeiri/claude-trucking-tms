"""Which TMS truck a Peak ELD vehicle is: pinned by hand, else by unit number, else by VIN."""
import re
from typing import Dict, Iterable, Optional, Tuple


def norm_unit(s: Optional[str]) -> str:
    """"Truck #0101" and "101" both -> "101"."""
    s = re.sub(r"[^a-z0-9]", "", (s or "").lower())
    s = re.sub(r"^(truck|unit|trk)", "", s)
    return s.lstrip("0")


class TruckMatcher:
    def __init__(self, trucks: Iterable, manual: Optional[Dict[str, Optional[int]]] = None):
        trucks = list(trucks)
        self.by_id = {t.id: t for t in trucks}
        self.by_unit = {}
        for t in trucks:
            self.by_unit.setdefault(norm_unit(t.truck_number), t)
        self.by_vin = {(t.vin or "").strip().upper(): t for t in trucks if (t.vin or "").strip()}
        self.manual = manual or {}

    def match(self, eld_id: str, vehicle: dict) -> Tuple[Optional[object], Optional[str]]:
        """(truck, how) - how is 'manual', 'unit' or 'vin'."""
        if eld_id in self.manual:
            truck = self.by_id.get(self.manual[eld_id]) if self.manual[eld_id] else None
            return truck, ("manual" if truck else None)
        truck = self.by_unit.get(norm_unit(str(vehicle.get("vehicleId") or eld_id)))
        if truck is not None:
            return truck, "unit"
        vin = (vehicle.get("vinNum") or "").strip().upper()
        truck = self.by_vin.get(vin) if vin else None
        return truck, ("vin" if truck else None)
