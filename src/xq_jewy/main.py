import os


def main():
    name = os.environ.get(key="XQ_JEWY", default="world")
    print(f"hello {name}")
