.PHONY: sync lint format typecheck check run help
.DEFAULT_GOAL := help

sync: ## install deps into .venv
	uv sync

lint: ## run ruff linter
	uv run ruff check .

format: ## run ruff formatter
	uv run ruff format .

typecheck: ## run ty type checker
	uv run ty check

check: lint typecheck ## run all checks (lint + typecheck)

run: ## run the app
	uv run xq-jewy

help: ## show this menu
	@grep -E '^[a-z]+:.*?## ' Makefile | awk 'BEGIN {FS = ":.*?## "}; {printf "%-12s %s\n", $$1, $$2}'