"""Pure business logic. No MCP imports here, so it is trivial to unit test."""


def greet(name: str) -> str:
    """Return a greeting for the given name."""
    name = name.strip()
    if not name:
        raise ValueError("name must not be empty")
    return f"Hello, {name}!"


def add(a: float, b: float) -> float:
    """Return the sum of two numbers."""
    return a + b
