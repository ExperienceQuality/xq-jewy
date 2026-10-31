from yaml import safe_load


def load_from_file(file_path: str) -> dict:
    with open(file_path) as f:
        return safe_load(f)
