.PHONY: sync lint format format-check typecheck test check ci run help
.DEFAULT_GOAL := help

sync: ## install deps into .venv
	uv sync --locked

lint: ## run ruff linter
	uv run ruff check .

format: ## run ruff formatter
	uv run ruff format .

format-check: ## check ruff formatting without writing
	uv run ruff format --check .

typecheck: ## run ty type checker
	uv run ty check

test: ## run pytest
	uv run pytest

check: lint format-check typecheck test ## run all checks

ci: check ## CI gate: lint + format-check + typecheck + tests

run: ## run the app
	uv run xq-jewy

help: ## show this menu
	@grep -E '^[a-z]+:.*?## ' Makefile | awk 'BEGIN {FS = ":.*?## "}; {printf "%-12s %s\n", $$1, $$2}'