from io import BytesIO
from html import escape
from math import ceil
from typing import Literal

from docx import Document
from docx.enum.section import WD_ORIENT
from docx.shared import Inches
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font
from openpyxl.utils import get_column_letter
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.schemas.generator_schema import GeneratorOutput, UserStoryRow

ExportFormat = Literal["xlsx", "docx", "pdf"]

EXCEL_HEADERS = [
    "S.no",
    "Epic",
    "Features",
    "US ID",
    "US Summary",
    "User Story Description",
    "Acceptance Criteria",
    "Business Rules",
    "Dependencies",
    "State",
    "Comments",
    "Reference Link",
]


def _block(items: list[str]) -> str:
    return "\n\n".join(item.strip() for item in items if item and item.strip())


def _html_block(value: str | int) -> str:
    return escape(str(value)).replace("\n", "<br/>")


def _story_row_values(story: UserStoryRow) -> list[str | int]:
    return [
        story.serial_number,
        story.epic,
        story.feature,
        story.us_id,
        story.us_summary,
        story.user_story_description,
        _block(story.acceptance_criteria),
        _block(story.business_rules),
        _block(story.dependencies),
        story.state,
        story.comments or "",
        story.reference_link or "",
    ]


def build_excel_export(output: GeneratorOutput) -> bytes:
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "AI-US"

    sheet.append(EXCEL_HEADERS)
    for story in output.stories:
        sheet.append(_story_row_values(story))

    for cell in sheet[1]:
        cell.font = Font(bold=True)
        cell.alignment = Alignment(vertical="top", wrap_text=True)

    column_widths = {
        "A": 8,
        "B": 18,
        "C": 24,
        "D": 14,
        "E": 28,
        "F": 48,
        "G": 42,
        "H": 32,
        "I": 32,
        "J": 12,
        "K": 18,
        "L": 24,
    }
    for column, width in column_widths.items():
        sheet.column_dimensions[column].width = width

    for row in sheet.iter_rows(min_row=2):
        for cell in row:
            cell.alignment = Alignment(vertical="top", wrap_text=True)

    for row in sheet.iter_rows(min_row=2):
        estimated_lines = 1
        for cell in row:
            value = "" if cell.value is None else str(cell.value)
            column_width = sheet.column_dimensions[get_column_letter(cell.column)].width or 12
            explicit_lines = value.count("\n") + 1
            wrapped_lines = ceil(len(value) / max(int(column_width * 1.2), 1))
            estimated_lines = max(estimated_lines, explicit_lines, wrapped_lines)
        sheet.row_dimensions[row[0].row].height = min(max(estimated_lines * 15, 30), 180)

    buffer = BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


def build_docx_export(output: GeneratorOutput) -> bytes:
    document = Document()
    section = document.sections[0]
    section.orientation = WD_ORIENT.LANDSCAPE
    section.page_width, section.page_height = section.page_height, section.page_width
    section.left_margin = Inches(0.5)
    section.right_margin = Inches(0.5)

    document.add_heading(output.document_title, level=0)
    document.add_paragraph(f"Story ID Prefix: {output.story_id_prefix}")
    document.add_paragraph(f"Total Stories: {len(output.stories)}")

    for story in output.stories:
        document.add_heading(f"{story.us_id} - {story.us_summary}", level=1)
        document.add_paragraph(f"Epic: {story.epic}")
        document.add_paragraph(f"Feature: {story.feature}")
        document.add_paragraph(f"State: {story.state}")

        story_heading = document.add_paragraph()
        story_heading.add_run("User Story Description: ").bold = True
        story_heading.add_run(story.user_story_description)

        document.add_paragraph("Acceptance Criteria", style="Heading 2")
        for item in story.acceptance_criteria:
            document.add_paragraph(item, style="List Bullet")

        if story.business_rules:
            document.add_paragraph("Business Rules", style="Heading 2")
            for item in story.business_rules:
                document.add_paragraph(item, style="List Bullet")

        if story.dependencies:
            document.add_paragraph("Dependencies", style="Heading 2")
            for item in story.dependencies:
                document.add_paragraph(item, style="List Bullet")

        if story.comments:
            comment_paragraph = document.add_paragraph()
            comment_paragraph.add_run("Comments: ").bold = True
            comment_paragraph.add_run(story.comments)

        if story.reference_link:
            reference_paragraph = document.add_paragraph()
            reference_paragraph.add_run("Reference Link: ").bold = True
            reference_paragraph.add_run(story.reference_link)

    buffer = BytesIO()
    document.save(buffer)
    return buffer.getvalue()


def build_pdf_export(output: GeneratorOutput) -> bytes:
    buffer = BytesIO()
    styles = getSampleStyleSheet()
    title_style = styles["Title"]
    normal_style = styles["Normal"]
    header_style = ParagraphStyle(
        "ExportTableHeader",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7.5,
        leading=9,
        wordWrap="CJK",
    )
    cell_style = ParagraphStyle(
        "ExportTableCell",
        parent=styles["Normal"],
        fontSize=7.5,
        leading=9,
        wordWrap="CJK",
        splitLongWords=True,
    )
    document = SimpleDocTemplate(
        buffer,
        pagesize=landscape(A4),
        leftMargin=24,
        rightMargin=24,
        topMargin=24,
        bottomMargin=24,
    )

    story_table_rows = [
        [Paragraph(_html_block(header), header_style) for header in ["US ID", "Summary", "Epic / Feature", "Story", "Acceptance Criteria"]]
    ]
    for story in output.stories:
        story_table_rows.append(
            [
                Paragraph(_html_block(story.us_id), cell_style),
                Paragraph(_html_block(story.us_summary), cell_style),
                Paragraph(_html_block(f"{story.epic}\n{story.feature}"), cell_style),
                Paragraph(_html_block(story.user_story_description), cell_style),
                Paragraph(_html_block(_block(story.acceptance_criteria)), cell_style),
            ]
        )

    elements = [
        Paragraph(_html_block(output.document_title), title_style),
        Spacer(1, 8),
        Paragraph(_html_block(f"Story ID Prefix: {output.story_id_prefix}"), normal_style),
        Spacer(1, 12),
        Table(
            story_table_rows,
            colWidths=[60, 120, 120, 240, 220],
            repeatRows=1,
            splitByRow=True,
            style=TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#D9E2F3")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.black),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F7F9FC")]),
                    ("LEFTPADDING", (0, 0), (-1, -1), 4),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                    ("TOPPADDING", (0, 0), (-1, -1), 5),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ]
            ),
        ),
    ]

    document.build(elements)
    return buffer.getvalue()


def build_export_bytes(output: GeneratorOutput, output_format: ExportFormat) -> bytes:
    if output_format == "xlsx":
        return build_excel_export(output)
    if output_format == "docx":
        return build_docx_export(output)
    if output_format == "pdf":
        return build_pdf_export(output)
    raise ValueError(f"Unsupported export format: {output_format}")


def export_media_type(output_format: ExportFormat) -> str:
    if output_format == "xlsx":
        return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    if output_format == "docx":
        return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    return "application/pdf"
