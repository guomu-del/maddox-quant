import hashlib
import io

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle

from app.services.pdf_parser import (
    compute_file_hash,
    extract_pdf_content,
    extract_text_from_pdf,
    save_pdf,
)


def _table_pdf_bytes() -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    table = Table(
        [
            ["Metric", "2023", "2024"],
            ["Revenue", "100", "120"],
            ["Profit", "10", "15"],
        ]
    )
    table.setStyle(
        TableStyle(
            [
                ("GRID", (0, 0), (-1, -1), 0.5, colors.black),
                ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
                ("FONTSIZE", (0, 0), (-1, -1), 12),
            ]
        )
    )
    doc.build([table])
    return buffer.getvalue()


def test_compute_file_hash_deterministic():
    h1 = compute_file_hash(b"hello")
    h2 = compute_file_hash(b"hello")
    assert h1 == h2
    assert len(h1) == 64


def test_compute_file_hash_differs_for_different_content():
    assert compute_file_hash(b"a") != compute_file_hash(b"b")


def test_save_pdf_writes_file(tmp_path):
    content = b"pdf-content"
    filename, file_hash = save_pdf(content, str(tmp_path))
    assert filename == f"{hashlib.sha256(content).hexdigest()}.pdf"
    assert (tmp_path / filename).read_bytes() == content
    assert file_hash == hashlib.sha256(content).hexdigest()


def test_extract_text_from_pdf(sample_pdf_bytes):
    text = extract_text_from_pdf(sample_pdf_bytes)
    assert "Maddox Quant Test Report" in text


def test_extract_pdf_content_includes_tables():
    text, tables = extract_pdf_content(_table_pdf_bytes())
    assert tables, "expected at least one table"
    header = [cell.replace(" ", "") for cell in tables[0]["rows"][0]]
    assert "Metric" in "".join(header)
    assert tables[0]["page"] == 1
    assert any("100" in "".join(row) for row in tables[0]["rows"])
    assert text is not None
