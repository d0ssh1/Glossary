"""HTML → clean text extraction.

We strip code/table blocks so the FTS index isn't poisoned by syntactic noise
(``<select class="...">`` containing the literal term "SELECT", etc.).
"""
from __future__ import annotations

import re
from html import escape as _html_escape

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


# --------------------------------------------------------------------------- #
# Sentence extraction — used to auto-fill term definitions and to show the
# whole sentence a term appears in (instead of a "...word..." FTS snippet).
# --------------------------------------------------------------------------- #

# Split after sentence-final punctuation followed by whitespace. Good enough for
# Russian/English course prose; abbreviations may over-split but that's harmless
# here (we only ever take the first matching sentence).
_SENTENCE_SPLIT = re.compile(r"(?<=[.!?…])\s+")
# Safety cap for pathological text with no sentence punctuation (e.g. a heading
# that is the whole step) — avoids dumping an entire step as a "sentence".
_MAX_SENTENCE_LEN = 600


def split_sentences(text: str) -> list[str]:
    """Split plain text into trimmed sentences."""
    text = " ".join((text or "").split())
    if not text:
        return []
    return [p.strip() for p in _SENTENCE_SPLIT.split(text) if p.strip()]


def _term_pattern(term_name: str) -> re.Pattern[str] | None:
    """Case-insensitive matcher for a term, allowing inflected endings.

    Mirrors the FTS prefix match: the word must START at a word boundary and may
    carry a grammatical suffix (``тег`` matches ``теги``/``тега``) but won't match
    mid-word (``стратегия``). Multi-word terms allow flexible whitespace.
    """
    tokens = [re.escape(t) for t in term_name.split() if t]
    if not tokens:
        return None
    body = r"\s+".join(tokens)
    return re.compile(rf"(?<!\w){body}\w*", re.IGNORECASE)


def _truncate(sentence: str) -> str:
    if len(sentence) <= _MAX_SENTENCE_LEN:
        return sentence
    cut = sentence[:_MAX_SENTENCE_LEN].rsplit(" ", 1)[0]
    return f"{cut}…"


def first_sentence_with_term(text: str, term_name: str) -> str | None:
    """Return the first full sentence in ``text`` that contains ``term_name``."""
    pattern = _term_pattern(term_name)
    if pattern is None:
        return None
    for sentence in split_sentences(text):
        if pattern.search(sentence):
            return _truncate(sentence)
    return None


def highlight_term_html(sentence: str, term_name: str) -> str:
    """HTML-escape ``sentence`` and wrap occurrences of the term in ``<b>``."""
    pattern = _term_pattern(term_name)
    if pattern is None:
        return _html_escape(sentence)
    out: list[str] = []
    last = 0
    for m in pattern.finditer(sentence):
        out.append(_html_escape(sentence[last:m.start()]))
        out.append(f"<b>{_html_escape(m.group(0))}</b>")
        last = m.end()
    out.append(_html_escape(sentence[last:]))
    return "".join(out)
