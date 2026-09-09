from __future__ import annotations

import re
from collections.abc import Callable

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models.paper import PaperAccount, PaperOrder, PaperPosition, PaperTrade
from app.schemas.market import StockQuote
from app.schemas.paper import PaperAccountResponse
from app.services import market_service
from app.services.trading_fees import commission, stamp_tax

ACCOUNT_ID = 1
STARTING_CASH = 1_000_000.0
CODE_RE = re.compile(r"^\d{6}$")


class PaperBroker:
    def __init__(self, get_quote: Callable[[str], StockQuote]):
        self._get_quote = get_quote

    def place_order(
        self,
        db: Session,
        *,
        code: str,
        side: str,
        order_type: str,
        price: float | None,
        quantity: int,
    ) -> PaperOrder:
        self._validate_order(
            code=code,
            side=side,
            order_type=order_type,
            price=price,
            quantity=quantity,
        )
        account = self._ensure_account(db)
        position = self._position(db, code)
        if side == "sell":
            pending_quantity = db.scalar(
                select(func.coalesce(func.sum(PaperOrder.quantity), 0)).where(
                    PaperOrder.account_id == ACCOUNT_ID,
                    PaperOrder.code == code,
                    PaperOrder.side == "sell",
                    PaperOrder.status == "pending",
                )
            )
            available_quantity = (
                (position.quantity if position is not None else 0) - pending_quantity
            )
            if available_quantity < quantity:
                raise AppError(
                    "持仓数量不足", code="insufficient_position", status_code=400
                )

        quote = self._get_quote(code)
        last = quote.last if quote.last is not None and quote.last > 0 else None
        order = PaperOrder(
            account_id=ACCOUNT_ID,
            code=code,
            name=quote.name or code,
            side=side,
            order_type=order_type,
            price=price,
            quantity=quantity,
            filled_qty=0,
            status="pending",
        )

        if order_type == "market" and last is None:
            order.status = "rejected"
            order.reject_reason = "无有效最新价"
            db.add(order)
            db.commit()
            db.refresh(order)
            return order

        ref_price = last if order_type == "market" else price
        assert ref_price is not None
        if side == "buy":
            required = quantity * ref_price + commission(quantity * ref_price)
            if required > account.cash:
                raise AppError("可用资金不足", code="insufficient_cash", status_code=400)
            reserved = quantity * ref_price
            account.cash = self._money(account.cash - reserved)
            account.frozen = self._money(account.frozen + reserved)

        db.add(order)
        db.flush()
        if last is not None and self._can_fill(order, last):
            self._fill(db, account, order, last)
        db.commit()
        db.refresh(order)
        return order

    def cancel_order(self, db: Session, order_id: int) -> PaperOrder:
        account = self._ensure_account(db)
        order = db.get(PaperOrder, order_id)
        if order is None or order.account_id != ACCOUNT_ID or order.status != "pending":
            raise AppError(
                "委托不可撤销",
                code="order_not_cancellable",
                status_code=409,
            )
        if order.side == "buy":
            reserved = order.quantity * (order.price or 0)
            account.frozen = self._money(account.frozen - reserved)
            account.cash = self._money(account.cash + reserved)
        order.status = "cancelled"
        db.commit()
        db.refresh(order)
        return order

    def get_account(self, db: Session) -> PaperAccountResponse:
        account = self._ensure_account(db)
        market_value = 0.0
        for position in self.list_positions(db):
            fallback = position.cost_amount / position.quantity
            try:
                quote = self._get_quote(position.code)
                mark = quote.last if quote.last is not None and quote.last > 0 else fallback
            except AppError:
                mark = fallback
            market_value += position.quantity * mark
        return PaperAccountResponse(
            id=account.id,
            cash=account.cash,
            frozen=account.frozen,
            starting_cash=account.starting_cash,
            equity=self._money(account.cash + account.frozen + market_value),
            updated_at=account.updated_at,
        )

    def list_positions(self, db: Session) -> list[PaperPosition]:
        return list(
            db.scalars(
                select(PaperPosition)
                .where(PaperPosition.account_id == ACCOUNT_ID)
                .order_by(PaperPosition.code)
            ).all()
        )

    def list_orders(
        self,
        db: Session,
        *,
        status: str | None = None,
        code: str | None = None,
    ) -> list[PaperOrder]:
        statement = select(PaperOrder).where(PaperOrder.account_id == ACCOUNT_ID)
        if status:
            statement = statement.where(PaperOrder.status == status)
        if code:
            statement = statement.where(PaperOrder.code == code)
        return list(db.scalars(statement.order_by(PaperOrder.id.desc())).all())

    def list_trades(
        self, db: Session, *, code: str | None = None
    ) -> list[PaperTrade]:
        statement = select(PaperTrade).where(PaperTrade.account_id == ACCOUNT_ID)
        if code:
            statement = statement.where(PaperTrade.code == code)
        return list(db.scalars(statement.order_by(PaperTrade.id.desc())).all())

    def reset_account(self, db: Session) -> PaperAccountResponse:
        account = self._ensure_account(db)
        db.execute(delete(PaperTrade).where(PaperTrade.account_id == ACCOUNT_ID))
        db.execute(delete(PaperOrder).where(PaperOrder.account_id == ACCOUNT_ID))
        db.execute(delete(PaperPosition).where(PaperPosition.account_id == ACCOUNT_ID))
        account.cash = account.starting_cash
        account.frozen = 0.0
        db.commit()
        db.refresh(account)
        return self.get_account(db)

    def match_pending(self, db: Session) -> list[PaperOrder]:
        account = self._ensure_account(db)
        pending = list(
            db.scalars(
                select(PaperOrder)
                .where(
                    PaperOrder.account_id == ACCOUNT_ID,
                    PaperOrder.status == "pending",
                    PaperOrder.order_type == "limit",
                )
                .order_by(PaperOrder.id)
                .with_for_update(skip_locked=True)
            ).all()
        )
        filled: list[PaperOrder] = []
        for order in pending:
            try:
                quote = self._get_quote(order.code)
            except Exception:
                continue
            last = quote.last
            if last is not None and last > 0 and self._can_fill(order, last):
                self._fill(db, account, order, last)
                filled.append(order)
        db.commit()
        return filled

    def _ensure_account(self, db: Session) -> PaperAccount:
        account = db.scalar(
            select(PaperAccount)
            .where(PaperAccount.id == ACCOUNT_ID)
            .with_for_update()
        )
        if account is None:
            account = PaperAccount(
                id=ACCOUNT_ID,
                cash=STARTING_CASH,
                frozen=0.0,
                starting_cash=STARTING_CASH,
            )
            db.add(account)
            db.flush()
        return account

    @staticmethod
    def _validate_order(
        *,
        code: str,
        side: str,
        order_type: str,
        price: float | None,
        quantity: int,
    ) -> None:
        if not CODE_RE.fullmatch(code):
            raise AppError(
                "股票代码须为6位数字",
                code="invalid_stock_code",
                status_code=400,
            )
        if side not in {"buy", "sell"}:
            raise AppError("无效买卖方向", code="invalid_side", status_code=400)
        if order_type not in {"market", "limit"}:
            raise AppError("无效委托类型", code="invalid_order_type", status_code=400)
        if not isinstance(quantity, int) or isinstance(quantity, bool) or quantity <= 0:
            raise AppError("数量须为正整数", code="invalid_quantity", status_code=400)
        if side == "buy" and quantity % 100:
            raise AppError(
                "买入数量须为100股的整数倍",
                code="invalid_lot",
                status_code=400,
            )
        if order_type == "market" and price is not None:
            raise AppError("市价单价格须为空", code="invalid_price", status_code=400)
        if order_type == "limit" and (price is None or price <= 0):
            raise AppError("限价须大于0", code="invalid_price", status_code=400)

    @staticmethod
    def _can_fill(order: PaperOrder, last: float) -> bool:
        if order.order_type == "market":
            return True
        if order.side == "buy":
            return last <= (order.price or 0)
        return last >= (order.price or 0)

    def _fill(
        self,
        db: Session,
        account: PaperAccount,
        order: PaperOrder,
        last: float,
    ) -> None:
        amount = order.quantity * last
        order_commission = commission(amount)
        order_stamp_tax = stamp_tax(order.side, amount)
        position = self._position(db, order.code)

        if order.side == "buy":
            reserved = order.quantity * (
                order.price if order.order_type == "limit" else last
            )
            account.frozen = self._money(account.frozen - reserved)
            account.cash = self._money(
                account.cash + reserved - amount - order_commission - order_stamp_tax
            )
            if position is None:
                position = PaperPosition(
                    account_id=ACCOUNT_ID,
                    code=order.code,
                    name=order.name,
                    quantity=0,
                    cost_amount=0.0,
                )
                db.add(position)
            position.quantity += order.quantity
            position.cost_amount = self._money(position.cost_amount + amount)
            position.name = order.name
        else:
            if position is None or position.quantity < order.quantity:
                raise AppError(
                    "持仓数量不足",
                    code="insufficient_position",
                    status_code=400,
                )
            account.cash = self._money(
                account.cash + amount - order_commission - order_stamp_tax
            )
            fraction = order.quantity / position.quantity
            position.cost_amount = self._money(
                position.cost_amount * (1 - fraction)
            )
            position.quantity -= order.quantity
            if position.quantity == 0:
                db.delete(position)

        order.status = "filled"
        order.filled_qty = order.quantity
        db.add(
            PaperTrade(
                account_id=ACCOUNT_ID,
                order_id=order.id,
                code=order.code,
                name=order.name,
                side=order.side,
                price=last,
                quantity=order.quantity,
                commission=order_commission,
                stamp_tax=order_stamp_tax,
            )
        )

    @staticmethod
    def _position(db: Session, code: str) -> PaperPosition | None:
        return db.scalar(
            select(PaperPosition).where(
                PaperPosition.account_id == ACCOUNT_ID,
                PaperPosition.code == code,
            )
        )

    @staticmethod
    def _money(value: float) -> float:
        return round(value, 10)


broker = PaperBroker(get_quote=market_service.get_stock)
