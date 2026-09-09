from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class PaperOrderCreate(BaseModel):
    code: str = Field(pattern=r"^\d{6}$")
    side: Literal["buy", "sell"]
    order_type: Literal["market", "limit"]
    price: float | None = None
    quantity: int = Field(gt=0)

    @model_validator(mode="after")
    def validate_price(self):
        if self.order_type == "market" and self.price is not None:
            raise ValueError("market order price must be null")
        if self.order_type == "limit" and (
            self.price is None or self.price <= 0
        ):
            raise ValueError("limit order price must be greater than zero")
        return self


class PaperAccountResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    cash: float
    frozen: float
    starting_cash: float
    equity: float
    updated_at: datetime | None = None


class PaperOrderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    account_id: int
    code: str
    name: str
    side: str
    order_type: str
    price: float | None
    quantity: int
    filled_qty: int
    status: str
    reject_reason: str | None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class PaperTradeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    account_id: int
    order_id: int
    code: str
    name: str
    side: str
    price: float
    quantity: int
    commission: float
    stamp_tax: float
    traded_at: datetime | None = None


class PaperPositionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    account_id: int
    code: str
    name: str
    quantity: int
    cost_amount: float
