def greet(name: str) -> str:
    """Return a greeting for the given name."""
    if not name:
        raise ValueError("name must not be empty")
    return f"Hello, {name}!"
