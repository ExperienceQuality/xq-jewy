import pytest

from xq_jewy.core import greet


def test_greet_returns_greeting():
    assert greet("World") == "Hello, World!"


def test_greet_rejects_empty_name():
    with pytest.raises(ValueError, match="must not be empty"):
        greet("")
