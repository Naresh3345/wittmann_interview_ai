from datetime import datetime
from pathlib import Path
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import LongTable, Paragraph, Spacer, TableStyle
from xml.sax.saxutils import escape


def _register_unicode_font():
    font_paths = [
        "C:/Windows/Fonts/seguisym.ttf",
        "C:/Windows/Fonts/arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for font_path in font_paths:
        if Path(font_path).exists():
            try:
                pdfmetrics.registerFont(TTFont("ReportUnicode", font_path))
                return "ReportUnicode"
            except Exception:
                continue
    return "Helvetica"


UNICODE_FONT = _register_unicode_font()


def _paragraph(value, style):
    return Paragraph(escape(str(value or "")), style)


def _score_value(result):
    return float(result.get("score", {}).get("total_score") or 0)


def _answer_status(result):
    score = _score_value(result)
    is_correct = score >= 50
    return {
        "is_correct": is_correct,
        "label": "Correct" if is_correct else "Wrong",
        "symbol": "&#10003;" if is_correct else "&#10007;",
        "color": colors.HexColor("#15803d") if is_correct else colors.HexColor("#b91c1c"),
    }


def generate_pdf_report(candidate_name: str, results: list, face_summary: dict, output_dir="reports") -> str:
    Path(output_dir).mkdir(exist_ok=True)
    safe_name = "_".join(candidate_name.strip().split()) or "candidate"
    filename = f"{safe_name}_interview_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
    path = str(Path(output_dir) / filename)
    from reportlab.platypus import SimpleDocTemplate

    doc = SimpleDocTemplate(
        path,
        pagesize=A4,
        leftMargin=32,
        rightMargin=32,
        topMargin=42,
        bottomMargin=42,
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "ReportTitle",
        parent=styles["Title"],
        fontSize=16,
        leading=19,
        alignment=1,
    )
    heading_style = ParagraphStyle("ReportHeading", parent=styles["Heading2"], spaceBefore=8, spaceAfter=6)
    normal_style = ParagraphStyle("ReportNormal", parent=styles["Normal"], fontSize=8.5, leading=10.5)
    table_header_style = ParagraphStyle(
        "TableHeader",
        parent=normal_style,
        textColor=colors.white,
        fontName="Helvetica-Bold",
        leading=10,
    )
    table_cell_style = ParagraphStyle("TableCell", parent=normal_style, wordWrap="CJK", leading=10)
    detail_question_style = ParagraphStyle(
        "DetailQuestion",
        parent=styles["Heading3"],
        fontSize=9.5,
        leading=11.5,
        spaceBefore=8,
        spaceAfter=3,
        wordWrap="CJK",
    )
    status_style = ParagraphStyle(
        "Status",
        parent=normal_style,
        fontName=UNICODE_FONT,
        alignment=1,
        leading=10,
    )
    story = []

    story.append(Paragraph("WITTMANN BATTENFELD India Pvt. Ltd. AI Interview System", title_style))
    story.append(Paragraph("Candidate Interview Assessment Report", heading_style))
    story.append(Paragraph(f"Candidate: {escape(candidate_name)}", normal_style))
    if face_summary.get("candidate_email"):
        story.append(Paragraph(f"Email: {escape(face_summary.get('candidate_email'))}", normal_style))
    if face_summary.get("candidate_phone"):
        story.append(Paragraph(f"Phone: {escape(face_summary.get('candidate_phone'))}", normal_style))
    if face_summary.get("resume_path"):
        story.append(Paragraph(f"Resume Saved: {escape(face_summary.get('resume_path'))}", normal_style))
    story.append(Paragraph(f"Generated: {datetime.now().strftime('%d-%m-%Y %I:%M %p')}", normal_style))
    story.append(Spacer(1, 14))

    avg = sum(r["score"]["total_score"] for r in results) / max(len(results), 1)
    story.append(Paragraph(f"Overall Score: {avg:.2f}%", heading_style))
    story.append(Paragraph(f"Face Confidence Index: {face_summary.get('confidence_index', 0)}%", normal_style))
    story.append(Paragraph(f"Detected Frames: {face_summary.get('detected_frames', 0)} / {face_summary.get('total_frames', 0)}", normal_style))
    violations = face_summary.get("proctoring_violations", [])
    story.append(Paragraph(f"Proctoring Alerts: {len(violations)}", normal_style))
    if face_summary.get("auto_submit_reason"):
        story.append(Paragraph(f"Auto Submit Reason: {escape(face_summary.get('auto_submit_reason'))}", normal_style))
    story.append(Paragraph(f"Shortlist Result: {escape(face_summary.get('shortlist_status', 'Pending'))}", heading_style))
    story.append(Paragraph(f"Reason: {escape(face_summary.get('shortlist_reason', ''))}", normal_style))
    story.append(Spacer(1, 12))

    if violations:
        story.append(Paragraph("Warning Popup Details", heading_style))
        warning_rows = [
            [
                _paragraph("No", table_header_style),
                _paragraph("Question", table_header_style),
                _paragraph("Warning", table_header_style),
                _paragraph("Time", table_header_style),
            ]
        ]
        for idx, item in enumerate(violations, start=1):
            question_number = item.get("question_number") or "-"
            question_category = item.get("question_category") or "-"
            question_text = item.get("question_text") or "Question not captured"
            question_label = f"{question_category} Q{question_number}: {question_text}"
            warning_rows.append([
                _paragraph(str(idx), table_cell_style),
                _paragraph(question_label, table_cell_style),
                _paragraph(item.get("reason", ""), table_cell_style),
                _paragraph(item.get("time", ""), table_cell_style),
            ])
        warning_table = LongTable(warning_rows, colWidths=[30, doc.width * 0.42, doc.width * 0.36, doc.width * 0.16], repeatRows=1)
        warning_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#7f1d1d")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#fecaca")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#fff7ed")]),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        story.append(warning_table)
        story.append(Spacer(1, 14))

    data = [
        [
            _paragraph("Q.No", table_header_style),
            _paragraph("Category", table_header_style),
            _paragraph("Score", table_header_style),
            _paragraph("Result", table_header_style),
            _paragraph("Feedback", table_header_style),
        ]
    ]
    for idx, result in enumerate(results, start=1):
        status = _answer_status(result)
        data.append([
            _paragraph(str(idx), table_cell_style),
            _paragraph(result["question"].get("category", "General"), table_cell_style),
            _paragraph(f"{_score_value(result):.1f}%", table_cell_style),
            Paragraph(f'<font color="{status["color"].hexval()}">{status["symbol"]} {status["label"]}</font>', status_style),
            _paragraph(result.get("feedback", ""), table_cell_style),
        ])

    table = LongTable(data, colWidths=[34, 82, 48, 68, doc.width - 232], repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#111827")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#d1d5db")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f9fafb")]),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(table)
    story.append(Spacer(1, 16))

    story.append(Paragraph("Detailed Answers", heading_style))
    for idx, result in enumerate(results, start=1):
        status = _answer_status(result)
        status_line = f'<font color="{status["color"].hexval()}">{status["symbol"]} {status["label"]}</font>'
        story.append(Paragraph(f"{idx}. {escape(result['question']['question'])}", detail_question_style))
        story.append(Paragraph(f"Result: {status_line} | Score: {_score_value(result):.1f}%", status_style))
        story.append(Paragraph(f"Candidate Answer: {escape(result.get('answer') or 'Not answered')}", normal_style))
        correct_answer = result["question"].get("correct_answer") or result["question"].get("ideal_answer") or ""
        if correct_answer:
            story.append(Paragraph(f"Correct Answer: {escape(correct_answer)}", normal_style))
        matched = ", ".join(result["score"].get("matched_keywords", [])) or "None"
        story.append(Paragraph(f"Matched Keywords: {escape(matched)}", normal_style))
        story.append(Spacer(1, 8))

    doc.build(story)
    return path
