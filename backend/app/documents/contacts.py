"""
The broker's email on an AI load: who sent us the rate confirmation.

Kept on the load as draft["broker_email"] when the load is built. It is not
shown on the Loads AI page; the Lanes page's Contacts tab lists it.

The email's sender, else its Reply-To, else the first address printed on the
rate confirmation. Our own addresses (a dispatcher forwarding the ratecon)
and no-reply senders are skipped.
"""
import logging
from typing import Iterable, Optional

from app.documents.pod_email import _EMAIL, _NOREPLY, _addresses, own_domains
from app.models.loads_ai import InboundEmail

logger = logging.getLogger(__name__)


def _usable(addresses: Iterable[str], ours: set) -> Optional[str]:
    for a in addresses:
        a = a.strip().strip(".").lower()
        if a and a.rsplit("@", 1)[-1] not in ours and not _NOREPLY.search(a):
            return a
    return None


def broker_email(email_row: Optional[InboundEmail], company_email: Optional[str] = None,
                 ratecon_text: Optional[str] = None) -> Optional[str]:
    ours = own_domains(company_email)
    if email_row is not None:
        found = _usable(_addresses(email_row.from_address), ours) or _usable(_addresses(email_row.reply_to), ours)
        if found:
            return found
    return _usable(_EMAIL.findall(ratecon_text or ""), ours)
