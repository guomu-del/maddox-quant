from app.services.collectors.base import BaseCollector, CollectedItem
from app.services.collectors.rss_collector import RssCollector

COLLECTOR_REGISTRY: dict[str, type[BaseCollector]] = {
    "rss": RssCollector,
}


def get_collector(parser: str, url: str, source_name: str) -> BaseCollector:
    collector_cls = COLLECTOR_REGISTRY.get(parser)
    if not collector_cls:
        raise ValueError(f"Unknown collector parser: {parser}")
    return collector_cls(url=url, source_name=source_name)
