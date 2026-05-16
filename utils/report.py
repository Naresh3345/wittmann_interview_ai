from datetime import datetime
from pathlib import Path
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle


def generate_pdf_report(candidate_name: str, results: list, face_summary: dict, output_dir="reports") -> str:
    Path(output_dir).mkdir(exist_ok=True)
    safe_name = "_".join(candidate_name.strip().split()) or "candidate"
    filename = f"{safe_name}_interview_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
    path = str(Path(output_dir) / filename)
    doc = SimpleDocTemplate(path, pagesize=A4)
    styles = getSampleStyleSheet()
    story = []

    story.append(Paragraph("WITTMANN BATTENFELD India Pvt. Ltd. AI Interview System", styles["Title"]))
    story.append(Paragraph("Candidate Interview Assessment Report", styles["Heading2"]))
    story.append(Paragraph(f"Candidate: {candidate_name}", styles["Normal"]))
    if face_summary.get("candidate_email"):
        story.append(Paragraph(f"Email: {face_summary.get('candidate_email')}", styles["Normal"]))
    if face_summary.get("candidate_phone"):
        story.append(Paragraph(f"Phone: {face_summary.get('candidate_phone')}", styles["Normal"]))
    if face_summary.get("resume_path"):
        story.append(Paragraph(f"Resume Saved: {face_summary.get('resume_path')}", styles["Normal"]))
    story.append(Paragraph(f"Generated: {datetime.now().strftime('%d-%m-%Y %I:%M %p')}", styles["Normal"]))
    story.append(Spacer(1, 14))

    avg = sum(r["score"]["total_score"] for r in results) / max(len(results), 1)
    story.append(Paragraph(f"Overall Score: {avg:.2f}%", styles["Heading2"]))
    story.append(Paragraph(f"Face Confidence Index: {face_summary.get('confidence_index', 0)}%", styles["Normal"]))
    story.append(Paragraph(f"Detected Frames: {face_summary.get('detected_frames', 0)} / {face_summary.get('total_frames', 0)}", styles["Normal"]))
    violations = face_summary.get("proctoring_violations", [])
    story.append(Paragraph(f"Proctoring Alerts: {len(violations)}", styles["Normal"]))
    if face_summary.get("auto_submit_reason"):
        story.append(Paragraph(f"Auto Submit Reason: {face_summary.get('auto_submit_reason')}", styles["Normal"]))
    story.append(Paragraph(f"Shortlist Result: {face_summary.get('shortlist_status', 'Pending')}", styles["Heading2"]))
    story.append(Paragraph(f"Reason: {face_summary.get('shortlist_reason', '')}", styles["Normal"]))
    story.append(Spacer(1, 12))

    data = [["Q.No", "Category", "Score", "Feedback"]]
    for idx, result in enumerate(results, start=1):
        data.append([
            str(idx),
            result["question"].get("category", "General"),
            f"{result['score']['total_score']}%",
            result.get("feedback", "")[:90]
        ])

    table = Table(data, colWidths=[40, 100, 60, 290])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#111827")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
    ]))
    story.append(table)
    story.append(Spacer(1, 16))

    story.append(Paragraph("Detailed Answers", styles["Heading2"]))
    for idx, result in enumerate(results, start=1):
        story.append(Paragraph(f"{idx}. {result['question']['question']}", styles["Heading3"]))
        story.append(Paragraph(f"Answer: {result.get('answer', '')}", styles["Normal"]))
        story.append(Paragraph(f"Matched Keywords: {', '.join(result['score'].get('matched_keywords', [])) or 'None'}", styles["Normal"]))
        story.append(Spacer(1, 8))

    doc.build(story)
    return path
