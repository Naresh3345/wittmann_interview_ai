from datetime import datetime
from pathlib import Path
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Image, LongTable, PageBreak, Paragraph, Spacer, Table, TableStyle
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
    return Paragraph(escape(str(value or "")).replace("\n", "<br/>"), style)


def _escaped_lines(value):
    return escape(str(value or "")).replace("\n", "<br/>")


def _score_value(result):
    return float(result.get("score", {}).get("total_score") or 0)


def _question_marks(result):
    try:
        return float(result.get("question", {}).get("marks") or 0)
    except (TypeError, ValueError):
        return 0.0


def _earned_marks(result):
    marks = _question_marks(result)
    if marks <= 0:
        marks = 1.0
    return round((marks * _score_value(result)) / 100, 2)


def _format_number(value):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return "0"
    return str(int(number)) if number.is_integer() else f"{number:.2f}".rstrip("0").rstrip(".")


def _section_results(results, section):
    return [result for result in results if result.get("question", {}).get("category") == section]


def _section_totals(results):
    total_marks = sum((_question_marks(result) or 1.0) for result in results)
    earned_marks = sum(_earned_marks(result) for result in results)
    percent = (earned_marks / total_marks) * 100 if total_marks else 0
    return round(earned_marks, 2), round(total_marks, 2), round(percent, 2)


def _answer_status(result):
    score = _score_value(result)
    is_correct = score >= 50
    return {
        "is_correct": is_correct,
        "label": "Correct" if is_correct else "Wrong",
        "symbol": "&#10003;" if is_correct else "&#10007;",
        "color": colors.HexColor("#15803d") if is_correct else colors.HexColor("#b91c1c"),
    }


def generate_pdf_report(candidate_name: str, results: list, face_summary: dict, output_dir="reports", ai_turns=None) -> str:
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
    subheading_style = ParagraphStyle("ReportSubHeading", parent=styles["Heading3"], spaceBefore=6, spaceAfter=4)
    normal_style = ParagraphStyle("ReportNormal", parent=styles["Normal"], fontSize=8.5, leading=10.5)
    table_cell_style = ParagraphStyle("TableCell", parent=normal_style, wordWrap="CJK", leading=10)
    table_header_style = ParagraphStyle(
        "TableHeader",
        parent=table_cell_style,
        fontName="Helvetica-Bold",
        alignment=1,
        leading=10,
    )
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
    candidate_details = [[Paragraph(f"Candidate: {escape(candidate_name)}", normal_style)]]
    if face_summary.get("candidate_email"):
        email_val = face_summary.get("candidate_email") or ""
        candidate_details.append([Paragraph(f"Email: {escape(email_val)}", normal_style)])
    if face_summary.get("candidate_phone"):
        phone_val = face_summary.get("candidate_phone") or ""
        candidate_details.append([Paragraph(f"Phone: {escape(phone_val)}", normal_style)])
    if face_summary.get("resume_path"):
        resume_val = face_summary.get("resume_path") or ""
        candidate_details.append([Paragraph(f"Resume Saved: {escape(resume_val)}", normal_style)])
    candidate_details.append([Paragraph(f"Generated: {datetime.now().strftime('%d-%m-%Y %I:%M %p')}", normal_style)])
    profile_photo_value = face_summary.get("profile_photo_path") or ""
    profile_photo_path = Path(profile_photo_value) if profile_photo_value else None
    if profile_photo_path and profile_photo_path.exists():
        photo = Image(str(profile_photo_path), width=82, height=110)
        photo_table = Table(
            [[Table(candidate_details, colWidths=[doc.width - 112]), photo]],
            colWidths=[doc.width - 104, 90],
        )
        photo_table.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("BOX", (1, 0), (1, 0), 0.75, colors.HexColor("#111827")),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ]))
        story.append(photo_table)
    else:
        for row in candidate_details:
            story.append(row[0])
    story.append(Spacer(1, 14))

    earned_marks, total_marks, overall_percent = _section_totals(results)
    story.append(Paragraph(
        f"Overall Score: {overall_percent:.2f}% | Marks: {_format_number(earned_marks)} / {_format_number(total_marks)}",
        heading_style,
    ))
    story.append(Paragraph(f"Face Confidence Index: {face_summary.get('confidence_index', 0)}%", normal_style))
    story.append(Paragraph(f"Detected Frames: {face_summary.get('detected_frames', 0)} / {face_summary.get('total_frames', 0)}", normal_style))
    violations = face_summary.get("proctoring_violations", [])
    story.append(Paragraph(f"Proctoring Alerts: {len(violations)}", normal_style))
    auto_submit_reason = face_summary.get("auto_submit_reason")
    if auto_submit_reason:
        story.append(Paragraph(f"Auto Submit Reason: {escape(str(auto_submit_reason))}", normal_style))
    story.append(Paragraph(
        f"Shortlist Result: {escape(str(face_summary.get('shortlist_status') or 'Pending'))}",
        heading_style,
    ))
    story.append(Paragraph(
        f"Reason: {escape(str(face_summary.get('shortlist_reason') or ''))}",
        normal_style,
    ))
    story.append(Spacer(1, 12))

    section_rows = [
        [
            _paragraph("Section", table_header_style),
            _paragraph("Questions", table_header_style),
            _paragraph("Earned Marks", table_header_style),
            _paragraph("Total Marks", table_header_style),
            _paragraph("Percent", table_header_style),
        ]
    ]
    for section in ("Aptitude", "Programming"):
        items = _section_results(results, section)
        section_earned, section_marks, section_percent = _section_totals(items)
        section_rows.append([
            _paragraph(section, table_cell_style),
            _paragraph(str(len(items)), table_cell_style),
            _paragraph(_format_number(section_earned), table_cell_style),
            _paragraph(_format_number(section_marks), table_cell_style),
            _paragraph(f"{section_percent:.2f}%", table_cell_style),
        ])
    section_table = LongTable(section_rows, colWidths=[doc.width * 0.28, doc.width * 0.18, doc.width * 0.18, doc.width * 0.18, doc.width * 0.18], repeatRows=1)
    section_table.setStyle(TableStyle([
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
    story.append(Paragraph("Section-wise Marks", heading_style))
    story.append(section_table)
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
            _paragraph("Marks", table_header_style),
            _paragraph("Score", table_header_style),
            _paragraph("Earned", table_header_style),
            _paragraph("Result", table_header_style),
            _paragraph("Feedback", table_header_style),
        ]
    ]
    for idx, result in enumerate(results, start=1):
        status = _answer_status(result)
        data.append([
            _paragraph(str(idx), table_cell_style),
            _paragraph(result["question"].get("category", "General"), table_cell_style),
            _paragraph(_format_number(_question_marks(result) or 1), table_cell_style),
            _paragraph(f"{_score_value(result):.1f}%", table_cell_style),
            _paragraph(_format_number(_earned_marks(result)), table_cell_style),
            Paragraph(f'<font color="{status["color"].hexval()}">{status["symbol"]} {status["label"]}</font>', status_style),
            _paragraph(result.get("feedback", ""), table_cell_style),
        ])

    table = LongTable(data, colWidths=[30, 70, 42, 46, 42, 58, doc.width - 288], repeatRows=1)
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

    for section in ("Aptitude", "Programming"):
        section_items = _section_results(results, section)
        if not section_items:
            continue
        section_earned, section_marks, section_percent = _section_totals(section_items)
        story.append(Paragraph(
            f"{section} Detailed Answers - {_format_number(section_earned)} / {_format_number(section_marks)} marks ({section_percent:.2f}%)",
            heading_style,
        ))
        for idx, result in enumerate(section_items, start=1):
            status = _answer_status(result)
            status_line = f'<font color="{status["color"].hexval()}">{status["symbol"]} {status["label"]}</font>'
            question = result["question"]
            topic = question.get("topic") or "General"
            marks = _question_marks(result) or 1
            story.append(Paragraph(f"{idx}. [{escape(topic)}] {_escaped_lines(question['question'])}", detail_question_style))
            story.append(Paragraph(
                f"Result: {status_line} | Score: {_score_value(result):.1f}% | Marks: {_format_number(_earned_marks(result))} / {_format_number(marks)}",
                status_style,
            ))
            story.append(Paragraph(f"Candidate Answer: {_escaped_lines(result.get('answer') or 'Not answered')}", normal_style))
            correct_answer = question.get("correct_answer") or question.get("ideal_answer") or ""
            if correct_answer:
                story.append(Paragraph(f"Correct Answer: {_escaped_lines(correct_answer)}", normal_style))
            story.append(Paragraph(f"Feedback: {_escaped_lines(result.get('feedback', ''))}", normal_style))
            matched = ", ".join(result["score"].get("matched_keywords", [])) or "None"
            story.append(Paragraph(f"Matched Keywords: {escape(matched)}", normal_style))
            story.append(Spacer(1, 8))

    if ai_turns:
        story.append(PageBreak())
        story.append(Paragraph(f"Round 3: AI Interview Report ({len(ai_turns)} Spoken Questions)", heading_style))
        story.append(Paragraph("Candidate Spoken Responses & Evaluation Transcript", subheading_style))
        story.append(Spacer(1, 8))
        for idx, turn in enumerate(ai_turns, start=1):
            q_text = turn.get("question_text") or f"Question {idx}"
            a_text = turn.get("candidate_answer") or "Not answered"
            secs = turn.get("answer_seconds") or 0
            story.append(Paragraph(f"Q{idx}. AI Question: {_escaped_lines(q_text)}", detail_question_style))
            story.append(Paragraph(f"Candidate Spoken Answer ({secs}s duration): {_escaped_lines(a_text)}", normal_style))
            story.append(Spacer(1, 8))

    doc.build(story)
    return path


def generate_ai_interview_report(candidate_name: str, role_name: str, turns: list, summary: dict, output_dir="reports") -> str:
    Path(output_dir).mkdir(exist_ok=True)
    safe_name = "_".join(candidate_name.strip().split()) or "candidate"
    filename = f"{safe_name}_ai_hr_interview_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
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
    title_style = ParagraphStyle("ReportTitle", parent=styles["Title"], fontSize=16, leading=19, alignment=1)
    heading_style = ParagraphStyle("ReportHeading", parent=styles["Heading2"], spaceBefore=8, spaceAfter=6)
    normal_style = ParagraphStyle("ReportNormal", parent=styles["Normal"], fontSize=8.5, leading=10.5)
    table_header_style = ParagraphStyle("TableHeader", parent=normal_style, textColor=colors.white, fontName="Helvetica-Bold")
    table_cell_style = ParagraphStyle("TableCell", parent=normal_style, wordWrap="CJK", leading=10)
    story = []

    total_answer_seconds = sum(float(turn.get("answer_seconds") or 0) for turn in turns)
    story.append(Paragraph("WITTMANN BATTENFELD India Pvt. Ltd. AI Interview System", title_style))
    story.append(Paragraph("AI HR Interview Transcript Report", heading_style))
    story.append(Paragraph(f"Candidate: {escape(candidate_name)}", normal_style))
    story.append(Paragraph(f"Role: {escape(role_name or 'Selected Role')}", normal_style))
    story.append(Paragraph(f"Generated: {datetime.now().strftime('%d-%m-%Y %I:%M %p')}", normal_style))
    story.append(Paragraph(f"Questions Asked: {len(turns)}", normal_style))
    story.append(Paragraph(f"Candidate Speaking Time: {_format_number(total_answer_seconds / 60)} minutes", normal_style))
    if summary.get("started_at"):
        story.append(Paragraph(f"Started At: {escape(str(summary.get('started_at')))}", normal_style))
    if summary.get("completed_at"):
        story.append(Paragraph(f"Completed At: {escape(str(summary.get('completed_at')))}", normal_style))
    if summary.get("auto_submit_reason"):
        story.append(Paragraph(f"Completion Note: {escape(str(summary.get('auto_submit_reason')))}", normal_style))
    story.append(Spacer(1, 12))

    rows = [[
        _paragraph("No", table_header_style),
        _paragraph("Question", table_header_style),
        _paragraph("Answer Seconds", table_header_style),
        _paragraph("Status", table_header_style),
        _paragraph("Candidate Answer", table_header_style),
    ]]
    for turn in turns:
        rows.append([
            _paragraph(str(turn.get("question_number") or ""), table_cell_style),
            _paragraph(turn.get("question_text") or "", table_cell_style),
            _paragraph(_format_number(turn.get("answer_seconds") or 0), table_cell_style),
            _paragraph("Timed out" if turn.get("timed_out") else "Answered", table_cell_style),
            _paragraph(turn.get("candidate_answer") or "Not answered", table_cell_style),
        ])
    table = LongTable(rows, colWidths=[28, doc.width * 0.30, doc.width * 0.13, doc.width * 0.13, doc.width * 0.36], repeatRows=1)
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
    doc.build(story)
    return path
