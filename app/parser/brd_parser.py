import io
from pypdf import PdfReader
from docx import Document

def parse_txt(file_bytes: bytes) -> str:
    """Parse TXT or Markdown file content."""
    try:
        return file_bytes.decode("utf-8")
    except UnicodeDecodeError:
        return file_bytes.decode("latin-1")

def parse_pdf(file_bytes: bytes) -> str:
    """Parse PDF file content."""
    pdf_file = io.BytesIO(file_bytes)
    reader = PdfReader(pdf_file)
    text_content = []
    for page in reader.pages:
        text = page.extract_text()
        if text:
            text_content.append(text)
    return "\n".join(text_content)

def parse_docx(file_bytes: bytes) -> str:
    """Parse DOCX file content."""
    docx_file = io.BytesIO(file_bytes)
    doc = Document(docx_file)
    text_content = []
    for para in doc.paragraphs:
        if para.text:
            text_content.append(para.text)
    
    # Extract text from tables as well
    for table in doc.tables:
        for row in table.rows:
            row_text = [cell.text.strip() for cell in row.cells if cell.text]
            if row_text:
                text_content.append(" | ".join(row_text))
                
    return "\n".join(text_content)

def parse_document(filename: str, content: bytes) -> str:
    """Unified entry point to parse documents based on extension."""
    ext = filename.lower().split(".")[-1]
    if ext in ("txt", "md"):
        return parse_txt(content)
    elif ext == "pdf":
        return parse_pdf(content)
    elif ext == "docx":
        return parse_docx(content)
    else:
        raise ValueError(f"Unsupported file format: .{ext}. Supported formats are: .txt, .md, .pdf, .docx")
