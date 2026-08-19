"""Offline pre-deploy audit for the static Apartmani Balent site."""

from __future__ import annotations

import json
import re
import sys
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urljoin, urlparse
from xml.etree import ElementTree


ROOT = (Path(__file__).resolve().parent.parent / "deploy").resolve()
DOMAIN = "apartmanibalent.hr"
DEAD_DOMAINS = ("visitkrk.com", "visit-krk.com", "spilja-biserujka.hr", "visit-rijeka.hr")


class PageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.ids: list[str] = []
        self.refs: list[tuple[str, str]] = []
        self.images: list[dict[str, str | None]] = []
        self.buttons: list[dict[str, object]] = []
        self.meta: list[dict[str, str | None]] = []
        self.links: list[dict[str, str | None]] = []
        self.json_ld: list[str] = []
        self.h1_count = 0
        self.title = ""
        self._title = False
        self._json = False
        self._json_parts: list[str] = []
        self._button_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        data = dict(attrs)
        if data.get("id"):
            self.ids.append(str(data["id"]))
        if tag == "a" and data.get("href") is not None:
            self.refs.append(("href", str(data["href"])))
        if tag in {"img", "script", "iframe", "source"} and data.get("src") is not None:
            self.refs.append(("src", str(data["src"])))
        if tag == "link" and data.get("href") is not None:
            self.refs.append(("href", str(data["href"])))
            self.links.append(data)
        if tag == "img":
            self.images.append(data)
        if tag == "meta":
            self.meta.append(data)
        if tag == "h1":
            self.h1_count += 1
        if tag == "title":
            self._title = True
        if tag == "button":
            self._button_depth += 1
            self.buttons.append({"attrs": data, "text": ""})
        if tag == "script" and (data.get("type") or "").lower() == "application/ld+json":
            self._json = True
            self._json_parts = []

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self._title = False
        if tag == "button" and self._button_depth:
            self._button_depth -= 1
        if tag == "script" and self._json:
            self.json_ld.append("".join(self._json_parts).strip())
            self._json = False
            self._json_parts = []

    def handle_data(self, data: str) -> None:
        if self._title:
            self.title += data
        if self._json:
            self._json_parts.append(data)
        if self._button_depth and self.buttons:
            self.buttons[-1]["text"] = str(self.buttons[-1]["text"]) + data


def virtual_url(page: Path) -> str:
    rel = page.relative_to(ROOT).as_posix()
    if rel == "index.html":
        return "https://apartmanibalent.hr/"
    if rel.endswith("/index.html"):
        return "https://apartmanibalent.hr/" + rel[: -len("index.html")]
    return "https://apartmanibalent.hr/" + rel


def local_target(page: Path, raw: str) -> tuple[Path | None, str]:
    raw = raw.strip()
    if not raw or raw.startswith(("mailto:", "tel:", "javascript:", "data:")):
        return None, ""
    absolute = urlparse(urljoin(virtual_url(page), raw))
    if absolute.scheme not in {"", "http", "https"} or absolute.netloc not in {"", DOMAIN, f"www.{DOMAIN}"}:
        return None, ""
    path = unquote(absolute.path)
    target = ROOT / path.lstrip("/")
    if path.endswith("/") or not target.suffix:
        target = target / "index.html"
    return target.resolve(), unquote(absolute.fragment)


errors: list[str] = []
warnings: list[str] = []
pages = sorted(ROOT.rglob("*.html"))
parsed: dict[Path, PageParser] = {}

for page in pages:
    rel = page.relative_to(ROOT).as_posix()
    text = page.read_text(encoding="utf-8")
    parser = PageParser()
    parser.feed(text)
    parsed[page.resolve()] = parser

    if "data:image/" in text:
        errors.append(f"{rel}: contains an embedded data image")
    if any(domain in text for domain in DEAD_DOMAINS):
        errors.append(f"{rel}: contains an obsolete external domain")
    if any(marker in text for marker in ("Ã", "Å", "Ä", "Â", "â€", "[????]")):
        errors.append(f"{rel}: contains likely broken text encoding")
    if page.stat().st_size > 1_000_000:
        warnings.append(f"{rel}: HTML is larger than 1 MB ({page.stat().st_size:,} bytes)")

    duplicates = [item for item, count in Counter(parser.ids).items() if count > 1]
    if duplicates:
        errors.append(f"{rel}: duplicate id values: {', '.join(duplicates)}")

    for image in parser.images:
        if image.get("alt") is None:
            errors.append(f"{rel}: image without alt text ({image.get('src', 'unknown source')})")
        if image.get("src") == "":
            errors.append(f"{rel}: image has an empty src")

    for index, button in enumerate(parser.buttons, start=1):
        attrs = button["attrs"]
        accessible = str(button["text"]).strip() or attrs.get("aria-label") or attrs.get("title")
        if not accessible:
            errors.append(f"{rel}: button #{index} has no accessible name")

    for index, block in enumerate(parser.json_ld, start=1):
        try:
            json.loads(block)
        except json.JSONDecodeError as exc:
            errors.append(f"{rel}: JSON-LD block #{index} is invalid ({exc.msg}, line {exc.lineno})")

    robots = next((m.get("content", "") for m in parser.meta if (m.get("name") or "").lower() == "robots"), "")
    is_public = "noindex" not in robots.lower() and rel not in {"dashboard.html", "admin-login.html"}
    if is_public:
        description = next((m.get("content") for m in parser.meta if (m.get("name") or "").lower() == "description"), None)
        canonical = next((link.get("href") for link in parser.links if (link.get("rel") or "").lower() == "canonical"), None)
        if not parser.title.strip():
            errors.append(f"{rel}: missing title")
        if not description:
            errors.append(f"{rel}: missing meta description")
        if not canonical:
            errors.append(f"{rel}: missing canonical URL")
        if parser.h1_count != 1:
            errors.append(f"{rel}: expected exactly one H1, found {parser.h1_count}")

for page, parser in parsed.items():
    rel = page.relative_to(ROOT).as_posix()
    for attr, ref in parser.refs:
        target, fragment = local_target(page, ref)
        if target is None:
            continue
        if not target.exists():
            errors.append(f"{rel}: broken local {attr} '{ref}'")
            continue
        if fragment and target.suffix.lower() == ".html":
            target_parser = parsed.get(target)
            if target_parser is not None and fragment not in target_parser.ids:
                errors.append(f"{rel}: missing anchor '#{fragment}' in '{ref}'")

sitemap = ROOT / "sitemap.xml"
if not sitemap.exists():
    errors.append("sitemap.xml: file is missing")
else:
    try:
        tree = ElementTree.parse(sitemap)
        namespace = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
        for loc in tree.findall(".//s:loc", namespace):
            if not loc.text:
                continue
            target, _ = local_target(ROOT / "index.html", loc.text)
            if target is not None and not target.exists():
                errors.append(f"sitemap.xml: URL has no local page ({loc.text})")
    except ElementTree.ParseError as exc:
        errors.append(f"sitemap.xml: invalid XML ({exc})")

print(f"Audited {len(pages)} HTML files in {ROOT}")
print(f"Errors: {len(errors)} | Warnings: {len(warnings)}")
for item in errors:
    print(f"ERROR: {item}")
for item in warnings:
    print(f"WARNING: {item}")
sys.exit(1 if errors else 0)
