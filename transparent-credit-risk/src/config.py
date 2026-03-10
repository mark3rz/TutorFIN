"""
Configuration loader for the transparent credit risk pipeline.

Loads settings from configs/config.yaml and provides them as a dictionary
accessible throughout the project. All paths are resolved relative to the
project root directory.
"""

import os
from pathlib import Path

import yaml


def get_project_root() -> Path:
    """Return the absolute path to the project root directory.

    The project root is defined as the parent of the 'src' directory
    where this file lives.
    """
    return Path(__file__).resolve().parent.parent


def load_config(config_path: str = None) -> dict:
    """Load the YAML configuration file and return it as a dictionary.

    Args:
        config_path: Optional explicit path to config file.
            If None, loads from configs/config.yaml relative to project root.

    Returns:
        Dictionary containing all configuration settings.
    """
    root = get_project_root()

    if config_path is None:
        config_path = root / "configs" / "config.yaml"
    else:
        config_path = Path(config_path)

    if not config_path.exists():
        raise FileNotFoundError(
            f"Configuration file not found: {config_path}\n"
            f"Expected location: {root / 'configs' / 'config.yaml'}"
        )

    with open(config_path, "r") as f:
        config = yaml.safe_load(f)

    return config


def resolve_path(relative_path: str) -> Path:
    """Resolve a path relative to the project root.

    Args:
        relative_path: Path string relative to project root (e.g., 'data/raw').

    Returns:
        Absolute Path object.
    """
    return get_project_root() / relative_path


def ensure_dir(path: str | Path) -> Path:
    """Create a directory (and parents) if it does not exist.

    Args:
        path: Directory path to create.

    Returns:
        The Path object for the created directory.
    """
    p = Path(path)
    p.mkdir(parents=True, exist_ok=True)
    return p
