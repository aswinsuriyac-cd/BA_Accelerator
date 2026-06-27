import os
import uuid
from pathlib import Path

from app.config import settings


def ensure_storage_dirs() -> None:
    for folder in ("uploads", "exports"):
        Path(settings.storage_root, folder).mkdir(parents=True, exist_ok=True)


def save_upload(filename: str, content: bytes) -> str:
    ensure_storage_dirs()
    ext = Path(filename).suffix
    safe_name = f"{uuid.uuid4().hex}{ext}"
    path = Path(settings.storage_root, "uploads", safe_name)
    path.write_bytes(content)
    return os.fspath(path)


def save_export(workflow_id: str, file_name: str, content: bytes) -> str:
    ensure_storage_dirs()
    path = Path(settings.storage_root, "exports", f"{workflow_id}_{file_name}")
    path.write_bytes(content)
    return os.fspath(path)
