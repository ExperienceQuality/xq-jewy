# xq-jewy

A minimal Python starter project using the `src/` layout, managed with
[uv](https://docs.astral.sh/uv/), linted with [ruff](https://docs.astral.sh/ruff/),
and type-checked with [ty](https://docs.astral.sh/ty/).

## Project layout

```
xq-jewy/
├── src/xq_jewy/      # your package code lives here
│   ├── __init__.py
│   └── core.py       # example module
├── tests/            # pytest tests
│   └── test_core.py
├── pyproject.toml    # project metadata + tool config
└── .gitignore
```

## Setup

1. Install uv: `curl -LsSf https://astral.sh/uv/install.sh | sh`
2. Install dependencies (uv creates `.venv` and the lockfile for you):

```bash
uv sync
```

That's it — no manual venv or `pip install` needed.

## Common commands

```bash
uv run pytest           # run tests
uv run ruff check .     # lint
uv run ruff format .    # auto-format
uv run ty check         # type-check
```

## Adding code

- Put modules under `src/xq_jewy/` (e.g. `src/xq_jewy/utils.py`).
- Import them as `from xq_jewy import utils` — the `src/` layout means imports
  only work on the installed package (uv sync handles that), which guarantees
  you test what users will actually get.
- Add tests in `tests/test_<module>.py`. Test functions start with `test_`.
- Add third-party packages with `uv add <package>`; dev-only tools with
  `uv add --dev <package>`.
