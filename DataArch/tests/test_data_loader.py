"""
tests/test_data_loader.py — Unit tests for data transformation and loading.
No database or API key needed — tests exercise value transformation logic.
"""

from datetime import date
from decimal import Decimal

from pipeline.data_loader import (
    _clean_currency,
    _parse_date,
    _parse_boolean,
    _parse_integer,
    transform_value,
)


# ── _clean_currency ─────────────────────────────────────────────────────────

def test_clean_currency_dollars():
    assert _clean_currency("$1,234.56") == Decimal("1234.56")


def test_clean_currency_pounds():
    assert _clean_currency("£5,000") == Decimal("5000")


def test_clean_currency_euros():
    assert _clean_currency("€99.99") == Decimal("99.99")


def test_clean_currency_plain_number():
    assert _clean_currency("42.50") == Decimal("42.50")


def test_clean_currency_negative():
    assert _clean_currency("-$1,000.00") == Decimal("-1000.00")


def test_clean_currency_no_decimals():
    assert _clean_currency("$5,000") == Decimal("5000")


def test_clean_currency_none():
    assert _clean_currency(None) is None


def test_clean_currency_empty():
    assert _clean_currency("") is None


def test_clean_currency_not_a_number():
    assert _clean_currency("N/A") is None


# ── _parse_date ─────────────────────────────────────────────────────────────

def test_parse_date_iso():
    assert _parse_date("2024-01-15") == date(2024, 1, 15)


def test_parse_date_us_format():
    assert _parse_date("1/15/2024") == date(2024, 1, 15)


def test_parse_date_us_short_year():
    assert _parse_date("1/15/24") == date(2024, 1, 15)


def test_parse_date_european():
    assert _parse_date("15-Jan-2024") == date(2024, 1, 15)


def test_parse_date_iso_datetime():
    assert _parse_date("2024-01-15T10:30:00") == date(2024, 1, 15)


def test_parse_date_none():
    assert _parse_date(None) is None


def test_parse_date_empty():
    assert _parse_date("") is None


def test_parse_date_invalid():
    assert _parse_date("not a date") is None


# ── _parse_boolean ──────────────────────────────────────────────────────────

def test_parse_boolean_true():
    assert _parse_boolean("true") is True
    assert _parse_boolean("True") is True
    assert _parse_boolean("yes") is True
    assert _parse_boolean("1") is True


def test_parse_boolean_false():
    assert _parse_boolean("false") is False
    assert _parse_boolean("False") is False
    assert _parse_boolean("no") is False
    assert _parse_boolean("0") is False


def test_parse_boolean_invalid():
    assert _parse_boolean("maybe") is None
    assert _parse_boolean("") is None
    assert _parse_boolean(None) is None


# ── _parse_integer ──────────────────────────────────────────────────────────

def test_parse_integer_basic():
    assert _parse_integer("42") == 42
    assert _parse_integer("-7") == -7
    assert _parse_integer("0") == 0


def test_parse_integer_invalid():
    assert _parse_integer("3.14") is None
    assert _parse_integer("abc") is None
    assert _parse_integer(None) is None


# ── transform_value ─────────────────────────────────────────────────────────

def test_transform_decimal():
    result = transform_value("$1,234.56", "DECIMAL(18,2)")
    assert result == Decimal("1234.56")


def test_transform_date():
    result = transform_value("2024-01-15", "DATE")
    assert result == date(2024, 1, 15)


def test_transform_bigint():
    result = transform_value("42", "BIGINT")
    assert result == 42


def test_transform_bigint_from_currency():
    """BIGINT columns should handle currency-style values."""
    result = transform_value("$1,000", "BIGINT")
    assert result == 1000


def test_transform_boolean():
    result = transform_value("true", "BOOLEAN")
    assert result is True


def test_transform_varchar():
    result = transform_value("hello world", "VARCHAR(255)")
    assert result == "hello world"


def test_transform_varchar_truncation():
    long_val = "x" * 500
    result = transform_value(long_val, "VARCHAR(255)")
    assert len(result) == 255


def test_transform_text():
    result = transform_value("long text here", "TEXT")
    assert result == "long text here"


def test_transform_none():
    result = transform_value(None, "VARCHAR(255)")
    assert result is None


def test_transform_empty_string():
    result = transform_value("", "VARCHAR(255)")
    assert result is None
