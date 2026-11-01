"""Validate the standalone policy page without executing page content."""
from html.parser import HTMLParser
from pathlib import Path
import sys
import xml.etree.ElementTree as ET

URL = "https://yuukigogo000-ai.github.io/little-light/privacy/"
CONTACT = "mailto:support@avenrail.dev"
ALLOWED_LINKS = {
    "#ja", "#en", CONTACT,
    "https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement",
    "https://www.apple.com/legal/privacy/", "https://policies.google.com/privacy",
}


class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.ids, self.links, self.languages = [], [], []
        self.canonical, self.csp, self.text = [], [], []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        assert tag not in {"script", "iframe", "object", "embed", "form", "input", "img", "video", "audio", "base"}, f"Unexpected active/resource tag: {tag}"
        assert not any(k.startswith("on") or k in {"src", "srcset", "ping"} for k in a), "Unexpected executable or resource attribute"
        if "id" in a:
            self.ids.append(a["id"])
        if tag == "article":
            self.languages.append(a.get("lang"))
        if tag == "a":
            self.links.append(a.get("href"))
        if tag == "link":
            assert a.get("rel") == "canonical", "Unexpected link resource"
            self.canonical.append(a.get("href"))
        if tag == "meta":
            equiv = a.get("http-equiv", "").lower()
            assert equiv != "refresh", "Unexpected redirect"
            if equiv == "content-security-policy":
                self.csp.append(a.get("content"))

    def handle_data(self, data):
        self.text.append(data)


def validate(html, sitemap):
    page = Page()
    page.feed(html)
    page.close()
    assert len(page.ids) == len(set(page.ids)), "Duplicate ID"
    assert {"ja", "en", "ja-title", "en-title"} <= set(page.ids), "Missing language section"
    assert set(page.languages) == {"ja", "en"}, "Missing language metadata"
    assert page.canonical == [URL], "Incorrect canonical URL"
    assert page.links.count(CONTACT) == 2, "Missing bilingual contact link"
    assert set(page.links) <= ALLOWED_LINKS, "Unexpected destination"
    assert len(page.csp) == 1 and "default-src 'none'" in page.csp[0], "Missing restrictive CSP"
    assert "url(" not in html.lower() and "@import" not in html.lower(), "Unexpected CSS resource"
    text = " ".join(page.text)
    assert "宮平 雄樹" in text and "Yuuki Miyahira" in text, "Missing operator"
    assert "2026年11月1日" in text and "November 1, 2026" in text, "Missing update date"
    assert "TODO" not in text and "未公開" not in text, "Unfinished public text"
    root = ET.fromstring(sitemap)
    locations = [e.text for e in root.findall("{http://www.sitemaps.org/schemas/sitemap/0.9}url/{http://www.sitemaps.org/schemas/sitemap/0.9}loc")]
    assert locations.count(URL) == 1, "Missing or duplicate sitemap URL"


def main():
    root = Path(__file__).resolve().parents[1]
    html = (root / "little-light/privacy/index.html").read_text(encoding="utf-8")
    sitemap = (root / "sitemap.xml").read_text(encoding="utf-8")
    validate(html, sitemap)
    if "--self-test" in sys.argv:
        mutations = [
            html.replace("</body>", '<script src="https://example.invalid/t.js"></script></body>'),
            html.replace(CONTACT, "mailto:wrong@example.invalid", 1),
            html.replace('rel="canonical" href="' + URL, 'rel="canonical" href="https://example.invalid/'),
        ]
        for altered in mutations:
            try:
                validate(altered, sitemap)
            except AssertionError:
                continue
            raise AssertionError("Validator failed to reject a deliberate fault")
        print("PASS: 3 validator fault checks")
    print("PASS: current policy content, destinations, passive HTML and sitemap")


if __name__ == "__main__":
    main()
