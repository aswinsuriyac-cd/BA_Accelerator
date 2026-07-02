from zipfile import ZipFile, ZIP_DEFLATED
from xml.sax.saxutils import escape
from pathlib import Path

output_path = Path(r"d:\Project 2\BA_Accelerator\frontend_reference_document.docx")

content = """<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>
<w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\">
  <w:body>
    <w:p><w:pPr><w:pStyle w:val=\"Title\"/></w:pPr><w:r><w:t>Frontend Reference Document</w:t></w:r></w:p>
    <w:p><w:r><w:t>This document summarizes the frontend part of the BRD Accelerator project, including its features, functionalities, and technology stack.</w:t></w:r></w:p>
    <w:p><w:bookmarkStart w:id=\"0\" w:name=\"overview\"/><w:r><w:t>Overview</w:t></w:r><w:bookmarkEnd w:id=\"0\"/></w:p>
    <w:p><w:r><w:t>The frontend is the user-facing part of the BRD Accelerator application. It provides an interactive workflow for uploading business requirements documents, reviewing extracted requirements, managing user stories, validating outputs, and exporting results.</w:t></w:r></w:p>
    <w:p><w:r><w:t>Frontend Functionalities</w:t></w:r></w:p>
    <w:p><w:r><w:t>• Dashboard: Displays summary cards for projects, epics, stories, quality score, and coverage.</w:t></w:r></w:p>
    <w:p><w:r><w:t>• BRD Upload: Supports drag-and-drop upload and file browsing for common document formats.</w:t></w:r></w:p>
    <w:p><w:r><w:t>• Project Management: Shows workflows/projects with search and pagination.</w:t></w:r></w:p>
    <w:p><w:r><w:t>• Requirements Review: Allows viewing, filtering, editing, and approving requirements.</w:t></w:r></w:p>
    <w:p><w:r><w:t>• Epic Generation: Groups generated stories into epics with search and pagination.</w:t></w:r></w:p>
    <w:p><w:r><w:t>• User Stories Management: Supports table and board view for managing stories.</w:t></w:r></w:p>
    <w:p><w:r><w:t>• Story Details and Review: Displays detailed story information, acceptance criteria, and business rules.</w:t></w:r></w:p>
    <w:p><w:r><w:t>• Validation / QA: Shows validation score, issues, and recommendations.</w:t></w:r></w:p>
    <w:p><w:r><w:t>• Export: Supports exporting in PDF, Word, and Excel formats.</w:t></w:r></w:p>
    <w:p><w:r><w:t>Tech Stack Used</w:t></w:r></w:p>
    <w:p><w:r><w:t>Frontend Core: React, TypeScript</w:t></w:r></w:p>
    <w:p><w:r><w:t>Build Tool: Vite</w:t></w:r></w:p>
    <w:p><w:r><w:t>Routing: TanStack Router, TanStack Start</w:t></w:r></w:p>
    <w:p><w:r><w:t>State/Data Fetching: React Query</w:t></w:r></w:p>
    <w:p><w:r><w:t>Styling: Tailwind CSS</w:t></w:r></w:p>
    <w:p><w:r><w:t>UI Libraries: Radix UI, shadcn-style component structure</w:t></w:r></w:p>
    <w:p><w:r><w:t>Forms and Validation: React Hook Form, Zod</w:t></w:r></w:p>
    <w:p><w:r><w:t>Icons and Visualization: Lucide React, Recharts</w:t></w:r></w:p>
    <w:p><w:r><w:t>Utilities: clsx, tailwind-merge, date-fns</w:t></w:r></w:p>
    <w:p><w:r><w:t>Summary</w:t></w:r></w:p>
    <w:p><w:r><w:t>The frontend is built as a modern, interactive workflow application that helps users move from uploaded BRD content to structured requirements, epics, user stories, validation, and export.</w:t></w:r></w:p>
    <w:sectPr></w:sectPr>
  </w:body>
</w:document>"""

parts = {
    "[Content_Types].xml": """<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>
<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\">
  <Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/>
  <Default Extension=\"xml\" ContentType=\"application/xml\"/>
  <Override PartName=\"/word/document.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml\"/>
  <Override PartName=\"/word/styles.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml\"/>
</Types>""",
    "_rels/.rels": """<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>
<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">
  <Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"word/document.xml\"/>
</Relationships>""",
    "word/document.xml": content,
    "word/styles.xml": """<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>
<w:styles xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\">
  <w:style w:type=\"paragraph\" w:default=\"1\" w:styleId=\"Normal\">
    <w:name w:val=\"Normal\"/>
    <w:qFormat/>
    <w:pPr><w:spacing w:after=\"160\"/></w:pPr>
    <w:rPr><w:rFonts w:ascii=\"Calibri\" w:hAnsi=\"Calibri\"/><w:sz w:val=\"22\"/></w:rPr>
  </w:style>
  <w:style w:type=\"paragraph\" w:styleId=\"Title\">
    <w:name w:val=\"Title\"/>
    <w:basedOn w:val=\"Normal\"/>
    <w:qFormat/>
    <w:pPr><w:spacing w:after=\"160\"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val=\"28\"/></w:rPr>
  </w:style>
</w:styles>""",
}

with ZipFile(output_path, 'w', ZIP_DEFLATED) as z:
    for name, data in parts.items():
        z.writestr(name, data)

print(output_path.exists(), output_path)
