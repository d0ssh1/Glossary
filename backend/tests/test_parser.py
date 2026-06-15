"""Unit tests for sentence extraction / term highlighting."""
from __future__ import annotations

from app.services.parser import (
    first_sentence_with_term,
    highlight_term_html,
    split_sentences,
)


def test_split_sentences_basic() -> None:
    text = "Первое предложение. Второе! Третье?"
    assert split_sentences(text) == ["Первое предложение.", "Второе!", "Третье?"]


def test_first_sentence_returns_whole_sentence() -> None:
    text = "Оператор SELECT извлекает данные. Это частый запрос."
    assert first_sentence_with_term(text, "SELECT") == "Оператор SELECT извлекает данные."


def test_first_sentence_matches_inflected_form() -> None:
    # "тег" should match its grammatical forms ("тегов", "теги")...
    text = "HTML состоит из тегов. Тег задаёт элемент."
    assert first_sentence_with_term(text, "тег") == "HTML состоит из тегов."


def test_first_sentence_ignores_midword_substring() -> None:
    # ...but must NOT match when the term sits inside another word.
    assert first_sentence_with_term("Стратегия очень важна.", "тег") is None


def test_first_sentence_absent_returns_none() -> None:
    assert first_sentence_with_term("Здесь нет искомого слова.", "SELECT") is None


def test_highlight_escapes_and_bolds() -> None:
    out = highlight_term_html("a < b, затем тег", "тег")
    assert "&lt;" in out  # HTML-escaped
    assert "<b>тег</b>" in out  # term bolded, not escaped


def test_highlight_no_match_just_escapes() -> None:
    assert highlight_term_html("3 < 5", "тег") == "3 &lt; 5"
