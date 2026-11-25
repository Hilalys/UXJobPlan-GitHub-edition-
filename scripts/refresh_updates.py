import argparse
import json
import sys
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime
from html import unescape
from pathlib import Path
from urllib.error import URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen
from xml.etree import ElementTree


SOURCES = (
    ("Nielsen Norman Group", "https://www.nngroup.com/feed/rss/"),
    ("Smashing Magazine", "https://www.smashingmagazine.com/category/uxdesign/feed/"),
)
MAX_BYTES = 2 * 1024 * 1024
MAX_PER_SOURCE = 24


def read_articles(xml, source):
    articles = []
    for entry in ElementTree.fromstring(xml).findall("./channel/item"):
        title = " ".join(unescape(entry.findtext("title", "")).split())[:240]
        url = entry.findtext("link", "").strip()
        parsed = urlsplit(url)
        if not title or parsed.scheme not in ("https", "http") or not parsed.hostname:
            continue
        try:
            published = parsedate_to_datetime(entry.findtext("pubDate", "")).date().isoformat()
        except (TypeError, ValueError, OverflowError):
            published = ""
        articles.append({
            "title": title, "url": url, "source": source, "type": "Article",
            "topics": ["industry"], "published": published,
        })
    return sorted(articles, key=lambda a: a["published"], reverse=True)[:MAX_PER_SOURCE]


def fetch_articles(source, url):
    request = Request(url, headers={"User-Agent": "UXJobPlan/1.0 (+https://github.com/Hilalys/UXJobPlan-GitHub-edition-)"})
    with urlopen(request, timeout=15) as response:
        xml = response.read(MAX_BYTES + 1)
    if len(xml) > MAX_BYTES:
        raise ValueError("RSS feed is too large")
    return read_articles(xml, source)


def refresh(path):
    articles = {}
    for source, url in SOURCES:
        try:
            items = fetch_articles(source, url)
            if not items:
                raise ValueError("RSS returned no articles")
        except (URLError, OSError, ValueError, ElementTree.ParseError) as error:
            print(f"{source}: {error}", file=sys.stderr)
            continue
        for item in items:
            articles.setdefault(item["url"].rstrip("/"), item)
    if not articles:
        raise SystemExit("No public sources could be refreshed; not replacing the published feed.")

    runs = json.loads(path.read_text(encoding="utf-8"))
    date = datetime.now(UTC).date().isoformat()
    runs = [{"run": date, "items": list(articles.values())}, *(r for r in runs if r["run"] != date)]
    path.write_text(json.dumps(runs, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Collected {len(articles)} articles for {date}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("feed", type=Path)
    refresh(parser.parse_args().feed)
