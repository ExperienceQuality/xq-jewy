import os
from pathlib import Path

from xq_jewy.bootstrap import create_server
from xq_jewy.configuration import load_config

CONFIG_ENV = "XQ_JEWY_CONFIG"


def main() -> None:
    config_path = Path(os.environ.get(CONFIG_ENV, "config.yaml"))
    config = load_config(config_path)
    tools_root = Path(__file__).parent / "tools"
    mcp = create_server(config, tools_root)
    mcp.run()


if __name__ == "__main__":
    main()
