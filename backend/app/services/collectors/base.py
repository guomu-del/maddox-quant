from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import date


@dataclass
class CollectedItem:
    title: str
    pdf_url: str
    source: str | None = None
    author: str | None = None
    publish_date: date | None = None
    summary: str | None = None
    external_id: str | None = None


class BaseCollector(ABC):
    def __init__(self, url: str, source_name: str):
        self.url = url
        self.source_name = source_name

    @abstractmethod
    def fetch(self) -> list[CollectedItem]:
        """Fetch raw entries from the source."""

    def parse(self, item: CollectedItem) -> CollectedItem:
        """Normalize a single entry (override for custom parsing)."""
        return item
