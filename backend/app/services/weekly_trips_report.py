"""
Weekly trips report - every load hauled in a week, grouped by driver.

Built server-side rather than in the browser because it has to be emailed.
Re-deriving the numbers client-side and POSTing the rendered HTML would let
a caller mail arbitrary content from the company's address.
"""

import logging
from datetime import date as date_type, timedelta
from decimal import Decimal, ROUND_HALF_UP
from html import escape
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.load import Load
from app.models.company import Company

logger = logging.getLogger(__name__)

CENTS = Decimal("0.01")

# Palette mirrors the app so the email looks like it came from the product.
NAVY = "#1B2A41"
GOLD_DEEP = "#B45309"
LINE = "#E3E8EF"
SUBTLE = "#F4F6F9"
MUTED = "#5A6B82"


def money(value) -> str:
    d = Decimal(str(value or 0)).quantize(CENTS, rounding=ROUND_HALF_UP)
    return f"${d:,.2f}"


def week_bounds(week_start: date_type) -> tuple[date_type, date_type]:
    """Normalize any date to its Monday, and return (monday, sunday)."""
    monday = week_start - timedelta(days=week_start.weekday())
    return monday, monday + timedelta(days=6)


async def build_weekly_trips(
    db: AsyncSession, company_id: int, week_start: date_type
) -> dict:
    """
    Gather the week's loads grouped by driver.

    Loads with no driver are grouped under 'Unassigned' rather than dropped -
    hiding them would make the totals disagree with the loads page.
    """
    monday, sunday = week_bounds(week_start)

    # pickup_date is a DateTime; compare against the full day range so a load
    # picked up late on Sunday is not missed.
    result = await db.execute(
        select(Load)
        .options(selectinload(Load.driver))
        .where(
            Load.company_id == company_id,
            Load.pickup_date >= monday,
            Load.pickup_date < sunday + timedelta(days=1),
        )
        .order_by(Load.pickup_date)
    )
    loads = result.scalars().unique().all()

    groups: dict = {}
    for load in loads:
        driver = getattr(load, "driver", None)
        key = driver.id if driver else 0
        if key not in groups:
            groups[key] = {
                "driver_name": (
                    f"{driver.first_name} {driver.last_name}" if driver else "Unassigned"
                ),
                "trips": [],
                "miles": 0,
                "revenue": Decimal("0"),
            }
        rate = Decimal(str(load.rate or 0))
        miles = int(load.miles or 0)
        groups[key]["trips"].append({
            "date": load.pickup_date.date() if load.pickup_date else None,
            "load_number": load.load_number or f"#{load.id}",
            "origin": load.pickup_location or "—",
            "destination": load.delivery_location or "—",
            "miles": miles,
            "rate": rate,
        })
        groups[key]["miles"] += miles
        groups[key]["revenue"] += rate

    # Unassigned last, otherwise alphabetical.
    ordered = sorted(
        groups.values(),
        key=lambda g: (g["driver_name"] == "Unassigned", g["driver_name"].lower()),
    )

    total_revenue = sum((g["revenue"] for g in ordered), Decimal("0"))
    total_miles = sum(g["miles"] for g in ordered)
    total_trips = sum(len(g["trips"]) for g in ordered)

    company = (
        await db.execute(select(Company).where(Company.id == company_id))
    ).scalar_one_or_none()

    return {
        "company_name": getattr(company, "name", "") or "",
        "week_start": monday,
        "week_end": sunday,
        "groups": ordered,
        "total_revenue": total_revenue,
        "total_miles": total_miles,
        "total_trips": total_trips,
        # Blended rate, consistent with the dashboard: revenue over miles.
        # None rather than zero when no mileage was recorded, so the email
        # can say so instead of printing a misleading $0.00.
        "rpm": (total_revenue / total_miles) if total_miles > 0 else None,
    }


def render_subject(report: dict) -> str:
    return (
        f"Weekly Trips — {report['week_start'].strftime('%b %-d')} to "
        f"{report['week_end'].strftime('%b %-d, %Y')}"
    )


def render_text(report: dict) -> str:
    """Plain-text alternative. Some clients show this instead of the HTML."""
    lines = [
        f"Weekly Trips: {report['week_start']} to {report['week_end']}",
        "",
        f"Trips: {report['total_trips']}   Miles: {report['total_miles']:,}   "
        f"Revenue: {money(report['total_revenue'])}",
    ]
    if report["rpm"] is not None:
        lines.append(f"Blended rate per mile: {money(report['rpm'])}")
    else:
        lines.append("Blended rate per mile: n/a (no mileage recorded)")
    lines.append("")

    for g in report["groups"]:
        rpm = (g["revenue"] / g["miles"]) if g["miles"] > 0 else None
        lines.append(
            f"{g['driver_name']} — {len(g['trips'])} trips, {g['miles']:,} mi, "
            f"{money(g['revenue'])}" + (f", {money(rpm)}/mi" if rpm else "")
        )
        for t in g["trips"]:
            d = t["date"].strftime("%a %m/%d") if t["date"] else "—"
            lines.append(
                f"    {d}  {t['load_number']}  {t['origin']} -> {t['destination']}  "
                f"{t['miles']:,} mi  {money(t['rate'])}"
            )
        lines.append("")

    if not report["groups"]:
        lines.append("No loads with a pickup date in this week.")

    return "\n".join(lines)


def render_html(report: dict) -> str:
    """
    Email HTML. Styles are inline and the layout is tables on purpose -
    most mail clients strip <style> blocks and have poor flex/grid support.
    """
    def cell(content, align="left", bold=False, color=NAVY, size="13px"):
        weight = "600" if bold else "400"
        return (
            f'<td style="padding:8px 10px;border-bottom:1px solid {LINE};'
            f'text-align:{align};font-size:{size};font-weight:{weight};'
            f'color:{color};">{content}</td>'
        )

    blocks = []
    for g in report["groups"]:
        rpm = (g["revenue"] / g["miles"]) if g["miles"] > 0 else None
        rows = []
        for t in g["trips"]:
            d = t["date"].strftime("%a %-m/%-d") if t["date"] else "—"
            rows.append(
                "<tr>"
                + cell(escape(d), color=MUTED)
                + cell(escape(str(t["load_number"])))
                + cell(
                    f'{escape(str(t["origin"]))} <span style="color:{MUTED}">&rarr;</span> '
                    f'{escape(str(t["destination"]))}'
                )
                + cell(f'{t["miles"]:,}' if t["miles"] else "—", align="right", color=MUTED)
                + cell(money(t["rate"]), align="right", bold=True)
                + "</tr>"
            )

        summary = f'{len(g["trips"])} trips &middot; {g["miles"]:,} mi &middot; {money(g["revenue"])}'
        if rpm is not None:
            summary += f' &middot; <span style="color:{GOLD_DEEP};font-weight:600">{money(rpm)}/mi</span>'

        blocks.append(f"""
        <tr><td style="padding:22px 0 6px 0;">
          <div style="font-size:15px;font-weight:600;color:{NAVY};">{escape(g["driver_name"])}</div>
          <div style="font-size:12px;color:{MUTED};margin-top:2px;">{summary}</div>
        </td></tr>
        <tr><td>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            <tr style="background:{SUBTLE};">
              <th align="left" style="padding:6px 10px;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:{MUTED};">Date</th>
              <th align="left" style="padding:6px 10px;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:{MUTED};">Load</th>
              <th align="left" style="padding:6px 10px;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:{MUTED};">Lane</th>
              <th align="right" style="padding:6px 10px;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:{MUTED};">Miles</th>
              <th align="right" style="padding:6px 10px;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:{MUTED};">Rate</th>
            </tr>
            {''.join(rows)}
          </table>
        </td></tr>""")

    if not report["groups"]:
        blocks.append(
            f'<tr><td style="padding:28px 0;text-align:center;color:{MUTED};font-size:14px;">'
            f'No loads with a pickup date in this week.</td></tr>'
        )

    rpm_line = (
        f'{money(report["rpm"])} /mi blended'
        if report["rpm"] is not None
        else "Rate per mile unavailable — no mileage recorded"
    )
    period = (
        f'{report["week_start"].strftime("%B %-d")} &ndash; '
        f'{report["week_end"].strftime("%B %-d, %Y")}'
    )

    return f"""<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:{SUBTLE};">
<table width="100%" cellpadding="0" cellspacing="0" style="background:{SUBTLE};padding:24px 12px;">
<tr><td align="center">
  <table width="100%" cellpadding="0" cellspacing="0"
         style="max-width:680px;background:#FFFFFF;border:1px solid {LINE};border-radius:10px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <tr><td style="background:{NAVY};padding:22px 24px;">
      <div style="color:#FFFFFF;font-size:17px;font-weight:600;letter-spacing:.02em;">Weekly Trips</div>
      <div style="color:rgba(255,255,255,.72);font-size:13px;margin-top:3px;">{period}</div>
      {f'<div style="color:rgba(255,255,255,.55);font-size:12px;margin-top:6px;">{escape(report["company_name"])}</div>' if report["company_name"] else ''}
    </td></tr>

    <tr><td style="padding:18px 24px;border-bottom:1px solid {LINE};">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font-size:12px;color:{MUTED};">Trips<div style="font-size:19px;font-weight:600;color:{NAVY};margin-top:2px;">{report["total_trips"]}</div></td>
        <td style="font-size:12px;color:{MUTED};">Miles<div style="font-size:19px;font-weight:600;color:{NAVY};margin-top:2px;">{report["total_miles"]:,}</div></td>
        <td style="font-size:12px;color:{MUTED};">Revenue<div style="font-size:19px;font-weight:600;color:{NAVY};margin-top:2px;">{money(report["total_revenue"])}</div></td>
      </tr></table>
      <div style="margin-top:12px;font-size:13px;color:{GOLD_DEEP};font-weight:600;">{rpm_line}</div>
    </td></tr>

    <tr><td style="padding:0 24px 24px 24px;">
      <table width="100%" cellpadding="0" cellspacing="0">{''.join(blocks)}</table>
    </td></tr>

    <tr><td style="padding:14px 24px;background:{SUBTLE};border-top:1px solid {LINE};font-size:11px;color:{MUTED};">
      Sent by Absolute TMS. Figures cover loads with a pickup date in this week.
    </td></tr>
  </table>
</td></tr></table>
</body></html>"""
