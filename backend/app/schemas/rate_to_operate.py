from pydantic import BaseModel, ConfigDict
from datetime import datetime
from decimal import Decimal
from typing import Optional, Any


class RateToOperateBase(BaseModel):
    section: str  # 'variable', 'fixed', or 'summary'
    expense: str = ''
    miles: Decimal = Decimal(0)
    rate_per_mile: Decimal = Decimal(0)
    total: Decimal = Decimal(0)
    sort_order: int = 0


class RateToOperateCreate(RateToOperateBase):
    pass


class RateToOperateUpdate(BaseModel):
    model_config = ConfigDict(extra='forbid')

    section: Any = None
    expense: Any = None
    miles: Any = None
    rate_per_mile: Any = None
    total: Any = None
    sort_order: Any = None


class RateToOperateResponse(RateToOperateBase):
    id: int
    company_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
