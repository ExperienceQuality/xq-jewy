import pytest

from xq_jewy.core import add, greet


def test_greet_returns_greeting():
    assert greet("World") == "Hello, World!"


def test_greet_strips_whitespace():
    assert greet("  Ada  ") == "Hello, Ada!"


@pytest.mark.parametrize("bad", ["", "   "])
def test_greet_rejects_empty_name(bad: str):
    with pytest.raises(ValueError, match="must not be empty"):
        greet(bad)


@pytest.mark.parametrize(("a", "b", "expected"), [(1, 2, 3), (-1, 1, 0), (0.5, 0.25, 0.75)])
def test_add(a: float, b: float, expected: float):
    assert add(a, b) == expected
