from datetime import date, datetime, timezone

import feedparser
import httpx

from app.services.collectors.base import BaseCollector, CollectedItem


def _entry_publish_date(entry: feedparser.FeedParserDict) -> date | None:
    parsed = entry.get("published_parsed") or entry.get("updated_parsed")
    if not parsed:
        return None
    return datetime(*parsed[:6], tzinfo=timezone.utc).date()


def _find_pdf_url(entry: feedparser.FeedParserDict) -> str | None:
    for link in entry.get("links", []):
        href = link.get("href", "")
        mime = link.get("type", "")
        if mime == "application/pdf" or href.lower().endswith(".pdf"):
            return href

    for enc in entry.get("enclosures", []):
        href = enc.get("href", "")
        mime = enc.get("type", "")
        if mime == "application/pdf" or href.lower().endswith(".pdf"):
            return href

    return None


class RssCollector(BaseCollector):
    def fetch(self) -> list[CollectedItem]:
        response = httpx.get(self.url, timeout=30, follow_redirects=True)
        response.raise_for_status()
        feed = feedparser.parse(response.text)

        items: list[CollectedItem] = []
        for entry in feed.entries:
            pdf_url = _find_pdf_url(entry)
            if not pdf_url:
                continue

            title = (entry.get("title") or "Untitled").strip()
            items.append(
                CollectedItem(
                    title=title,
                    pdf_url=pdf_url,
                    source=self.source_name,
                    author=entry.get("author"),
                    publish_date=_entry_publish_date(entry),
                    summary=entry.get("summary"),
                    external_id=entry.get("id") or entry.get("link") or pdf_url,
                )
            )
        return items
