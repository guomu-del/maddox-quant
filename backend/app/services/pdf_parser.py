import hashlib
import io
import os
from pathlib import Path

PAGE_BREAK = "\f"


def compute_file_hash(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def _clean_cell(value: str | None) -> str:
    if value is None:
        return ""
    return " ".join(str(value).split())


def _clean_table(rows: list[list[str | None]] | None) -> list[list[str]]:
    if not rows:
        return []
    cleaned = [[_clean_cell(cell) for cell in row] for row in rows]
    cleaned = [row for row in cleaned if any(cell for cell in row)]
    if len(cleaned) < 2:
        return []
    width = max(len(row) for row in cleaned)
    if width < 2:
        return []
    return [row + [""] * (width - len(row)) for row in cleaned]


def _char_outside_tables(bboxes: list[tuple[float, float, float, float]]):
    def _keep(obj: dict) -> bool:
        x0, top, x1, bottom = obj.get("x0"), obj.get("top"), obj.get("x1"), obj.get("bottom")
        if None in (x0, top, x1, bottom):
            return True
        for bx0, btop, bx1, bbottom in bboxes:
            overlap_x = min(x1, bx1) - max(x0, bx0)
            overlap_y = min(bottom, bbottom) - max(top, btop)
            if overlap_x > 0 and overlap_y > 0:
                return False
        return True

    return _keep


def extract_pdf_content(content: bytes) -> tuple[str, list[dict]]:
    import pdfplumber

    page_texts: list[str] = []
    tables: list[dict] = []

    with pdfplumber.open(io.BytesIO(content)) as pdf:
        for page_number, page in enumerate(pdf.pages, start=1):
            found = page.find_tables() if hasattr(page, "find_tables") else []
            bboxes: list[tuple[float, float, float, float]] = []
            for table in found:
                cleaned = _clean_table(table.extract())
                if not cleaned:
                    continue
                tables.append({"page": page_number, "rows": cleaned})
                bboxes.append(table.bbox)

            source = page.filter(_char_outside_tables(bboxes)) if bboxes else page
            page_texts.append(source.extract_text() or "")

    return PAGE_BREAK.join(page_texts).strip(), tables


def extract_text_from_pdf(content: bytes) -> str:
    text, _ = extract_pdf_content(content)
    return text


def save_pdf(content: bytes, storage_path: str) -> tuple[str, str]:
    filename, file_hash, stored = persist_pdf(content, storage_path)
    if stored is not None:
        raise OSError("Read-only file system")
    return filename, file_hash


def persist_pdf(content: bytes, storage_path: str) -> tuple[str, str, bytes | None]:
    """Write the PDF to disk when possible.

    Vercel and other serverless hosts only allow writes under /tmp, which is
    discarded after the request. If the disk is not writable, or we are on
    Vercel, return the bytes so the caller can persist them in the database.
    """
    file_hash = compute_file_hash(content)
    filename = f"{file_hash}.pdf"
    stored: bytes | None = None
    try:
        root = Path(storage_path)
        root.mkdir(parents=True, exist_ok=True)
        dest = root / filename
        dest.write_bytes(content)
    except OSError:
        stored = content
    if os.getenv("VERCEL"):
        stored = content
    return filename, file_hash, stored
