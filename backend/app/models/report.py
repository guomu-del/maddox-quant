from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Date, DateTime, String, Text, func
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.analysis import AnalysisJob, AnalysisResult


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    source: Mapped[str | None] = mapped_column(String(200))
    author: Mapped[str | None] = mapped_column(String(200))
    publish_date: Mapped[date | None] = mapped_column(Date)
    industries: Mapped[list[str] | None] = mapped_column(ARRAY(String))
    sectors: Mapped[list[str] | None] = mapped_column(ARRAY(String))
    stocks: Mapped[list[str] | None] = mapped_column(ARRAY(String))
    summary: Mapped[str | None] = mapped_column(Text)
    full_text: Mapped[str | None] = mapped_column(Text)
    file_path: Mapped[str | None] = mapped_column(String(500))
    file_hash: Mapped[str | None] = mapped_column(String(64), unique=True)
    tags: Mapped[list[str] | None] = mapped_column(ARRAY(String))
    status: Mapped[str] = mapped_column(String(20), default="pending")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    analysis_result: Mapped["AnalysisResult | None"] = relationship(
        back_populates="report", uselist=False
    )
    analysis_jobs: Mapped[list["AnalysisJob"]] = relationship(back_populates="report")
