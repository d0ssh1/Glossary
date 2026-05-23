"""HTML → clean text extraction.

We strip code/table blocks so the FTS index isn't poisoned by syntactic noise
(``<select class="...">`` containing the literal term "SELECT", etc.).
"""
from __future__ import annotations

from bs4 import BeautifulSoup

STRIPPED_TAGS = ("code", "pre", "table", "script", "style")


def clean_html(raw_html: str) -> str:
    """Return readable plain text from a Stepik step's ``block.text``.

    Removes code/markup blocks entirely, collapses whitespace.
    """
    if not raw_html:
        return ""
    soup = BeautifulSoup(raw_html, "html.parser")
    for tag in soup(STRIPPED_TAGS):
        tag.decompose()
    text = soup.get_text(separator=" ")
    return " ".join(text.split())
