import sys
from pathlib import Path

from xq_jewy.domain import Configuration
from xq_jewy.services.config_loader import load_from_file


def main():
    raw = load_from_file(
        str(Path(__file__).parent / "config_example.yaml")
    )

    try:
        config = Configuration.model_validate(raw)
        print(config)
    except Exception as e:
        print(
            f"Error parsing configuration: {e}. "
            "Please correct your xq.yaml file."
        )
        sys.exit(1)


if __name__ == "__main__":
    main()
