#!/usr/bin/env python3
"""Import a complete Wikisource transcription from its EPUB export as UTF-8 text."""

import argparse
import posixpath
import re
import urllib.parse
import urllib.request
import zipfile
from html.parser import HTMLParser
from io import BytesIO
from pathlib import Path
from xml.etree import ElementTree


class TextExtractor(HTMLParser):
    BLOCKS = {"p", "div", "section", "article", "li", "blockquote", "h1", "h2", "h3", "h4", "h5", "h6"}
    VOID = {"br", "hr"}
    SKIP_CLASSES = {"mw-editsection", "ws-noexport", "noprint"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self.title = ""
        self.in_title = False
        self.skip_depth = 0

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        classes = set((attrs.get("class") or "").split())
        if self.skip_depth:
            if tag not in self.VOID:
                self.skip_depth += 1
            return
        if tag in {"script", "style", "nav"} or classes & self.SKIP_CLASSES:
            self.skip_depth = 1
            return
        if tag == "title":
            self.in_title = True
        if not self.skip_depth and tag in self.BLOCKS:
            self.parts.append("\n")
        elif not self.skip_depth and tag in self.VOID:
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if self.skip_depth:
            self.skip_depth -= 1
            return
        if tag == "title":
            self.in_title = False
        if tag in self.BLOCKS:
            self.parts.append("\n")

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in self.VOID:
            self.handle_endtag(tag)

    def handle_data(self, data):
        if self.in_title:
            self.title += data
        if self.skip_depth or self.in_title or not data:
            return
        # Keep whitespace at inline-tag boundaries (e.g. text <i>with</i>
        # emphasis) while normalizing formatting whitespace from XHTML.
        self.parts.append(re.sub(r"[\r\n\t]+", " ", data))

    def text(self):
        raw = "".join(self.parts).replace("\xa0", " ").replace("\u200b", "")
        lines = [re.sub(r"[ \t]+", " ", line).strip() for line in raw.splitlines()]
        output = []
        for line in lines:
            if line:
                output.append(line)
            elif output and output[-1] != "":
                output.append("")
        return "\n".join(output).strip()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("page", help="Wikisource page title, e.g. 'Eu_(Augusto_dos_Anjos,_1912)'")
    parser.add_argument("output", type=Path, help="destination UTF-8 .txt file")
    parser.add_argument("--min-words", type=int, default=1000, help="reject obviously incomplete exports")
    args = parser.parse_args()

    page = urllib.parse.unquote(args.page)
    query = urllib.parse.urlencode({"lang": "pt", "format": "epub", "page": page})
    request = urllib.request.Request(
        f"https://ws-export.wmcloud.org/?{query}",
        headers={"User-Agent": "Entrelinhas/1.0 (public-domain literature reader)"},
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        epub = zipfile.ZipFile(BytesIO(response.read()))

    container = ElementTree.fromstring(epub.read("META-INF/container.xml"))
    rootfile = container.find(".//{*}rootfile").attrib["full-path"]
    package = ElementTree.fromstring(epub.read(rootfile))
    manifest = {
        item.attrib["id"]: posixpath.join(posixpath.dirname(rootfile), item.attrib["href"])
        for item in package.findall(".//{*}manifest/{*}item")
        if item.attrib.get("media-type") == "application/xhtml+xml"
    }

    sections = []
    for itemref in package.findall(".//{*}spine/{*}itemref"):
        path = manifest.get(itemref.attrib.get("idref"))
        if not path or "/c" not in path or re.search(r"/c0(?:_|\.)", path):
            continue
        extractor = TextExtractor()
        document = epub.read(path)
        encoding_match = re.search(br"charset=[\"']?([A-Za-z0-9._-]+)", document, flags=re.IGNORECASE)
        encoding = encoding_match.group(1).decode("ascii") if encoding_match else None
        candidates = [encoding] if encoding else ["utf-8", "cp1252"]
        html = None
        for candidate in candidates:
            try:
                html = document.decode(candidate)
                break
            except (LookupError, UnicodeDecodeError):
                continue
        if html is None:
            html = document.decode("utf-8", errors="replace")
        extractor.feed(html)
        body = extractor.text()
        heading = re.sub(r"\s+", " ", extractor.title).strip()
        if body:
            if heading:
                body_lines = body.splitlines()
                first_content = next((i for i, line in enumerate(body_lines) if line.strip()), None)
                if first_content is not None and body_lines[first_content].strip().rstrip(".").casefold() == heading.rstrip(".").casefold():
                    body_lines.pop(first_content)
                    body = "\n".join(body_lines).strip()
            sections.append((heading or "Texto", body))

    combined = "\n\n".join(f"SECTION: {heading}\n\n{body}" for heading, body in sections)
    word_count = len(re.findall(r"\b\w+\b", combined, flags=re.UNICODE))
    if word_count < args.min_words:
        raise SystemExit(f"Refusing incomplete export: {word_count} words, expected at least {args.min_words}.")

    text = f"*** START OF THE ENTRELINHAS TEXT ***\n\n{combined}\n\n*** END OF THE ENTRELINHAS TEXT ***\n"
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(text, encoding="utf-8", newline="\n")
    print(f"Imported {len(sections)} sections and {word_count} words to {args.output}")


if __name__ == "__main__":
    main()
