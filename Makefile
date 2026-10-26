.PHONY: install check fmt lint type test run run-http inspect

install:  ## create .venv, install deps, enable git hooks
	uv sync
	uv run pre-commit install

check: lint type test  ## everything CI runs

fmt:
	uv run ruff format .
	uv run ruff check --fix .

lint:
	uv run ruff format --check .
	uv run ruff check .

type:
	uv run ty check

test:
	uv run pytest

run:  ## stdio (what MCP clients launch)
	uv run xq-jewy

run-http:
	uv run xq-jewy --transport http

inspect:  ## open the MCP Inspector UI (needs Node.js)
	uv run fastmcp dev inspector src/xq_jewy/server.py
