# syntax=docker/dockerfile:1
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS builder
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=0
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv uv sync --locked --no-install-project --no-dev
COPY README.md ./
COPY src ./src
RUN --mount=type=cache,target=/root/.cache/uv uv sync --locked --no-dev

FROM python:3.12-slim-bookworm
RUN useradd --create-home app
COPY --from=builder --chown=app:app /app /app
ENV PATH="/app/.venv/bin:$PATH" \
    XQ_JEWY_TRANSPORT=http \
    XQ_JEWY_HOST=0.0.0.0 \
    XQ_JEWY_PORT=8000
# Listens on all interfaces inside the container; set XQ_JEWY_AUTH_TOKEN when publishing the port.
USER app
EXPOSE 8000
HEALTHCHECK CMD ["python", "-c", "import os, urllib.request; urllib.request.urlopen(f\"http://127.0.0.1:{os.environ.get('XQ_JEWY_PORT', '8000')}/health\")"]
CMD ["xq-jewy"]
