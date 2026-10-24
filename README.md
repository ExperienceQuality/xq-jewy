# xq-jewy

A Python starter project designed to **teach you how a modern Python repo works**
by doing. Managed with [uv](https://docs.astral.sh/uv/), linted with
[ruff](https://docs.astral.sh/ruff/), type-checked with
[ty](https://docs.astral.sh/ty/), tested with [pytest](https://docs.pytest.org/).

Work through the sections in order — each one explains a concept, then has you
do it.

## 0. What all these files are

```
xq-jewy/
├── src/xq_jewy/        # the package — all your code lives here
│   ├── __init__.py     # marks this folder as a Python "package"
│   └── core.py         # a module — code you can import
├── tests/              # pytest tests, one file per module
│   └── test_core.py
├── pyproject.toml      # the project's ID card: name, deps, tool settings
├── uv.lock             # exact versions of every dependency (auto-generated)
├── .gitignore          # files git should never track (.venv, caches...)
└── README.md           # this file
```

| Concept | What it means |
| --- | --- |
| **package** | A folder of Python code you can `import`. Ours is `xq_jewy`. |
| **module** | A single `.py` file. `core.py` is the module `xq_jewy.core`. |
| **virtualenv (`.venv`)** | An isolated Python install just for this project, so its dependencies don't fight with other projects. uv manages it for you. |
| **`pyproject.toml`** | Where you declare dependencies and configure tools (ruff, ty, pytest all read it). |
| **`uv.lock`** | The frozen, exact dependency versions. Commit it — it makes everyone's setup identical. |

## 1. First-time setup

```bash
# install uv (one time, per machine)
curl -LsSf https://astral.sh/uv/install.sh | sh

# clone and enter the repo
git clone https://github.com/ExperienceQuality/xq-jewy.git
cd xq-jewy

# install everything — creates .venv, reads uv.lock, done
uv sync
```

**What's happening:** `uv sync` creates a virtualenv in `.venv/` and installs
your package (in "editable" mode, so your edits take effect immediately) plus
the dev tools (pytest, ruff, ty). You never touch `pip` or activate the venv
manually — `uv run` handles it.

## 2. The daily loop

This is the rhythm of working on the repo. Every change follows it:

```bash
uv run pytest           # 1. do the tests still pass?
uv run ruff check .     # 2. is the code clean? (style + bug catches)
uv run ruff format .    #    fix formatting automatically
uv run ty check         # 3. do the types check out?
```

Run these before every commit. All three passing = your change is in good shape.

## 3. Your first change (do this now)

Goal: add a `shout` function that uppercases a greeting.

**a)** Open `src/xq_jewy/core.py` and add:

```python
def shout(name: str) -> str:
    """Return a LOUD greeting for the given name."""
    return greet(name).upper()
```

**b)** Open `tests/test_core.py` and add:

```python
def test_shout_yells():
    assert shout("World") == "HELLO, WORLD!"
```

plus `shout` to the import line at the top.

**c)** Run the loop: `uv run pytest` → `uv run ruff check .` → `uv run ty check`.

**d)** Commit and open a PR:

```bash
git checkout -b add-shout
git add -A && git commit -m "Add shout function"
git push -u origin add-shout
# then open a pull request on GitHub
```

That's the whole job: **write code → write a test → run the loop → PR.**

## 4. Where things go

- **New code** → a module in `src/xq_jewy/` (e.g. `utils.py`).
- **Use it elsewhere** → `from xq_jewy.utils import thing`.
- **New tests** → `tests/test_<module>.py`, functions named `test_*`.
- **New third-party library** → `uv add requests` (adds to pyproject + lock).
- **Dev-only tool** → `uv add --dev ipython`.
- **Update a dep** → `uv lock --upgrade-package <name>` then commit `uv.lock`.

## 5. When things go wrong

| Symptom | Fix |
| --- | --- |
| `ModuleNotFoundError: xq_jewy` | You didn't run `uv sync`, or you're not using `uv run` / the `.venv` python. |
| ruff complains | `uv run ruff check --fix .` auto-fixes most; `uv run ruff format .` fixes the rest. |
| ty complains | It means the types in your code don't line up — read the error, it names the file/line. |
| Weird, stale behavior | `uv sync --reinstall` to rebuild the env. |

## 6. Next concepts to learn (in order)

1. Functions, type hints, docstrings — already in `core.py`.
2. pytest `assert` and `pytest.raises` — already in `test_core.py`.
3. `pytest.mark.parametrize` for table-driven tests.
4. Modules and imports (when `core.py` grows, split it).
5. `pyproject.toml` — read it top to bottom; it's short and it's the map of the repo.
