"""
services/storage.py — Abstracted file storage for DataArch.AI.

Supports two backends:
  - local  (default): writes to DATAARCH_OUTPUTS_DIR on the container filesystem
  - s3:               writes to an S3-compatible bucket (AWS S3, MinIO, etc.)

All pipeline code should use this module instead of writing to
Path("outputs/") directly. This allows seamless migration from
Docker-volume storage to S3 for multi-instance / cloud deployments.

Configuration (via environment variables):
  STORAGE_BACKEND=local        default — uses DATAARCH_OUTPUTS_DIR
  STORAGE_BACKEND=s3           writes to S3_BUCKET / S3_PREFIX
  S3_BUCKET=dataarch-outputs   required when STORAGE_BACKEND=s3
  S3_PREFIX=v1/                optional key prefix (trailing slash recommended)
  AWS_REGION=us-east-1         used for S3 client region

The S3 backend requires `boto3` and AWS credentials in the environment
(AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_SESSION_TOKEN, or an
instance profile / IAM role when running on EC2 / ECS / Fargate).

boto3 is listed in requirements.txt as an optional dependency; the S3 backend
raises a clear ImportError at startup if it is not installed.
"""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Optional

import config

logger = logging.getLogger(__name__)

# ── Backend selection ────────────────────────────────────────────────────────

STORAGE_BACKEND: str = os.getenv("STORAGE_BACKEND", "local").lower()
S3_BUCKET: str = os.getenv("S3_BUCKET", "")
S3_PREFIX: str = os.getenv("S3_PREFIX", "")
AWS_REGION: str = os.getenv("AWS_REGION", "us-east-1")

# Root directory for local backend
_LOCAL_ROOT = Path(config.OUTPUTS_DIR)

# ── S3 client (lazy singleton) ───────────────────────────────────────────────

_s3_client = None


def _get_s3():
    """Return a boto3 S3 client, creating it on first use."""
    global _s3_client
    if _s3_client is None:
        try:
            import boto3  # type: ignore
        except ImportError as e:
            raise ImportError(
                "boto3 is required for STORAGE_BACKEND=s3. "
                "Install it with: pip install boto3"
            ) from e
        _s3_client = boto3.client("s3", region_name=AWS_REGION)
        logger.info(f"S3 storage client created (bucket={S3_BUCKET}, prefix={S3_PREFIX!r})")
    return _s3_client


def _s3_key(relative_path: str) -> str:
    """Construct a full S3 key from a relative path."""
    prefix = S3_PREFIX.rstrip("/")
    rel = relative_path.lstrip("/")
    return f"{prefix}/{rel}" if prefix else rel


# ── Public API ───────────────────────────────────────────────────────────────

def write_json(relative_path: str, data: dict) -> str:
    """
    Write a dict as pretty-printed JSON.

    relative_path — e.g. 'ontology/entity_registry.json'
    Returns the full path / S3 URI that was written.
    """
    content = json.dumps(data, indent=2, default=str)
    return write_text(relative_path, content)


def write_text(relative_path: str, content: str) -> str:
    """
    Write a text string (e.g., SQL DDL, raw text).

    relative_path — e.g. 'schema/schema.sql'
    Returns the full path / S3 URI that was written.
    """
    if STORAGE_BACKEND == "s3":
        return _write_s3(relative_path, content)
    return _write_local(relative_path, content)


def read_json(relative_path: str) -> Optional[dict]:
    """
    Read a JSON file.

    Returns the parsed dict, or None if the file does not exist.
    """
    raw = read_text(relative_path)
    if raw is None:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError as e:
        logger.warning(f"JSON decode error reading {relative_path!r}: {e}")
        return None


def read_text(relative_path: str) -> Optional[str]:
    """
    Read a text file.

    Returns the file contents as a string, or None if not found.
    """
    if STORAGE_BACKEND == "s3":
        return _read_s3(relative_path)
    return _read_local(relative_path)


def exists(relative_path: str) -> bool:
    """Return True if the file exists in the configured backend."""
    if STORAGE_BACKEND == "s3":
        return _exists_s3(relative_path)
    return (_LOCAL_ROOT / relative_path).exists()


def list_files(prefix: str = "", suffix: str = ".json") -> list[str]:
    """
    List files under a path prefix with a given suffix.

    Returns relative paths (e.g. ['abc_parsed.json', 'def_parsed.json']).
    prefix — subdirectory within outputs/ (e.g. 'ontology', '')
    suffix — file extension filter (e.g. '.json', '.sql')
    """
    if STORAGE_BACKEND == "s3":
        return _list_s3(prefix, suffix)
    return _list_local(prefix, suffix)


def delete(relative_path: str) -> bool:
    """
    Delete a file. Returns True on success, False if file did not exist.
    """
    if STORAGE_BACKEND == "s3":
        return _delete_s3(relative_path)
    return _delete_local(relative_path)


# ── Local backend ────────────────────────────────────────────────────────────

def _write_local(relative_path: str, content: str) -> str:
    full_path = _LOCAL_ROOT / relative_path
    full_path.parent.mkdir(parents=True, exist_ok=True)
    full_path.write_text(content, encoding="utf-8")
    logger.debug(f"[storage:local] wrote {full_path}")
    return str(full_path)


def _read_local(relative_path: str) -> Optional[str]:
    full_path = _LOCAL_ROOT / relative_path
    if not full_path.exists():
        return None
    return full_path.read_text(encoding="utf-8")


def _list_local(prefix: str, suffix: str) -> list[str]:
    base = _LOCAL_ROOT / prefix if prefix else _LOCAL_ROOT
    if not base.exists():
        return []
    return [
        str(p.relative_to(_LOCAL_ROOT))
        for p in sorted(base.iterdir())
        if p.is_file() and p.name.endswith(suffix)
    ]


def _delete_local(relative_path: str) -> bool:
    full_path = _LOCAL_ROOT / relative_path
    if not full_path.exists():
        return False
    full_path.unlink()
    return True


# ── S3 backend ───────────────────────────────────────────────────────────────

def _write_s3(relative_path: str, content: str) -> str:
    s3 = _get_s3()
    key = _s3_key(relative_path)
    content_type = "application/json" if relative_path.endswith(".json") else "text/plain"
    s3.put_object(
        Bucket=S3_BUCKET,
        Key=key,
        Body=content.encode("utf-8"),
        ContentType=content_type,
    )
    uri = f"s3://{S3_BUCKET}/{key}"
    logger.debug(f"[storage:s3] wrote {uri}")
    return uri


def _read_s3(relative_path: str) -> Optional[str]:
    s3 = _get_s3()
    key = _s3_key(relative_path)
    try:
        response = s3.get_object(Bucket=S3_BUCKET, Key=key)
        return response["Body"].read().decode("utf-8")
    except s3.exceptions.NoSuchKey:
        return None
    except Exception as e:
        logger.warning(f"[storage:s3] read error for {key!r}: {e}")
        return None


def _exists_s3(relative_path: str) -> bool:
    s3 = _get_s3()
    key = _s3_key(relative_path)
    try:
        s3.head_object(Bucket=S3_BUCKET, Key=key)
        return True
    except Exception:
        return False


def _list_s3(prefix: str, suffix: str) -> list[str]:
    s3 = _get_s3()
    full_prefix = _s3_key(prefix) if prefix else (S3_PREFIX.rstrip("/") if S3_PREFIX else "")
    try:
        paginator = s3.get_paginator("list_objects_v2")
        results = []
        for page in paginator.paginate(Bucket=S3_BUCKET, Prefix=full_prefix):
            for obj in page.get("Contents", []):
                key = obj["Key"]
                if key.endswith(suffix):
                    # Strip the S3 prefix to return a relative path
                    root_prefix = S3_PREFIX.rstrip("/") + "/" if S3_PREFIX else ""
                    rel = key[len(root_prefix):] if key.startswith(root_prefix) else key
                    results.append(rel)
        return sorted(results)
    except Exception as e:
        logger.warning(f"[storage:s3] list error for prefix {full_prefix!r}: {e}")
        return []


def _delete_s3(relative_path: str) -> bool:
    s3 = _get_s3()
    key = _s3_key(relative_path)
    try:
        s3.delete_object(Bucket=S3_BUCKET, Key=key)
        return True
    except Exception as e:
        logger.warning(f"[storage:s3] delete error for {key!r}: {e}")
        return False
