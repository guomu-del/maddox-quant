import hashlib

from app.services.pdf_parser import compute_file_hash, extract_text_from_pdf, save_pdf


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
