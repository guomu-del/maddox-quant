import hashlib
import io
from pathlib import Path

import pdfplumber


def compute_file_hash(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def extract_text_from_pdf(content: bytes) -> str:
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        pages = [page.extract_text() or "" for page in pdf.pages]
    return "\n".join(pages).strip()


def save_pdf(content: bytes, storage_path: str) -> tuple[str, str]:
    file_hash = compute_file_hash(content)
    root = Path(storage_path)
    root.mkdir(parents=True, exist_ok=True)
    filename = f"{file_hash}.pdf"
    dest = root / filename
    dest.write_bytes(content)
    return filename, file_hash
