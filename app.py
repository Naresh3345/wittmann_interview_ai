import base64
import json
import os
import random
import re
import secrets
import smtplib
import tempfile
import urllib.parse
import urllib.request
import uuid
import zipfile
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from email.message import EmailMessage
from pathlib import Path

import cv2
import numpy as np
from dotenv import load_dotenv

load_dotenv()

from flask import Flask, jsonify, redirect, render_template, request, send_file, session, url_for

from utils.ai_wrapper import ai_wrapper
from utils.database import (
    DB_LABEL,
    complete_interview,
    create_test_link,
    create_interview,
    create_user,
    get_test_link,
    init_db,
    load_interview_questions,
    list_reports,
    list_roles,
    load_database_snapshot,
    mark_test_link_used,
    save_candidate_answers,
    save_interview_questions,
)
from utils.question_bank import ensure_question_bank_indexes, select_questions_for_role
from utils.report import generate_pdf_report
from werkzeug.utils import secure_filename

BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR / "data" / "questions.json"
REPORT_DIR = BASE_DIR / "reports"
RESUME_DIR = REPORT_DIR / "resumes"
DEFAULT_COMPANY_NAME = "WITTMANN BATTENFELD India Pvt. Ltd."
ALLOWED_RESUME_EXTENSIONS = {".pdf", ".docx", ".txt"}
SHORTLIST_MIN_SCORE = float(os.getenv("SHORTLIST_MIN_SCORE", "70"))

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "dev-secret-key-change-me")

cv2_data = getattr(cv2, "data", None)
haar_folder = getattr(cv2_data, "haarcascades", None) if cv2_data is not None else None
if not haar_folder:
    haar_folder = os.path.join(os.path.dirname(cv2.__file__), "data", "haarcascades")

face_cascade = cv2.CascadeClassifier(os.path.join(haar_folder, "haarcascade_frontalface_default.xml"))
smile_cascade = cv2.CascadeClassifier(os.path.join(haar_folder, "haarcascade_smile.xml"))


def load_questions():
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def get_role_by_id(role_id):
    # list_roles may return dicts or objects; handle both safely
    for role in list_roles():
        try:
            # if role is a dict
            if isinstance(role, dict):
                if role.get("role_id") == role_id:
                    return role
            else:
                # if role is an object with attribute
                if getattr(role, "role_id", None) == role_id:
                    return role
        except Exception:
            continue
    return None


def create_otp():
    return str(random.randint(100000, 999999))


def resume_file_allowed(filename):
    return Path(filename).suffix.lower() in ALLOWED_RESUME_EXTENSIONS


def extract_text_from_docx(path):
    text_parts = []
    with zipfile.ZipFile(path) as docx:
        xml_bytes = docx.read("word/document.xml")
    root = ET.fromstring(xml_bytes)
    for node in root.iter():
        if node.tag.endswith("}t") and node.text:
            text_parts.append(node.text)
    return "\n".join(text_parts)


def extract_text_from_pdf(path):
    try:
        from pypdf import PdfReader

        reader = PdfReader(str(path))
        return "\n".join(page.extract_text() or "" for page in reader.pages)
    except Exception as exc:
        app.logger.warning("PDF resume parsing failed: %s", exc)
        return ""


def extract_resume_text(path):
    extension = Path(path).suffix.lower()
    if extension == ".txt":
        return Path(path).read_text(encoding="utf-8", errors="ignore")
    if extension == ".docx":
        return extract_text_from_docx(path)
    if extension == ".pdf":
        return extract_text_from_pdf(path)
    return ""


def clean_phone(raw_phone):
    digits = re.sub(r"\D", "", raw_phone)
    if len(digits) > 10 and digits.startswith("91"):
        digits = digits[-10:]
    return digits if 7 <= len(digits) <= 15 else ""


def repair_pdf_word_spacing(text):
    text = re.sub(r"\b([A-Za-z])\s+(?=[a-z])", r"\1", text)
    return re.sub(r"\s{2,}", " ", text).strip()


def extract_email(text):
    direct_match = re.search(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", text, re.IGNORECASE)
    if direct_match:
        return direct_match.group(0).lower()

    label_match = re.search(
        r"(?:e[- \t]*mail|email|mail)[ \t]*[:\-]?[ \t]*([A-Z0-9._%+\- \t]+@[ \t]*[A-Z0-9.\- \t]+\.[ \t]*[A-Z]{2,})",
        text,
        re.IGNORECASE,
    )
    if label_match:
        return re.sub(r"\s+", "", label_match.group(1)).lower()

    at_index = text.find("@")
    if at_index == -1:
        return ""
    left = re.findall(r"[A-Z0-9._%+\-\s]{1,45}$", text[max(0, at_index - 45):at_index], re.IGNORECASE)
    right = re.findall(r"^[A-Z0-9.\-\s]{1,45}\.[A-Z\s]{2,10}", text[at_index + 1:at_index + 60], re.IGNORECASE)
    if left and right:
        candidate = f"{left[-1]}@{right[0]}"
        candidate = re.sub(r"\s+", "", candidate).lower()
        email_match = re.search(r"[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}", candidate)
        return email_match.group(0) if email_match else ""

    return ""


def parse_resume_details(text):
    repaired_text = repair_pdf_word_spacing(text)
    lines = [repair_pdf_word_spacing(line.strip()) for line in text.splitlines() if line.strip()]
    phone_match = re.search(r"(?:\+?\d[\d\s().-]{7,}\d)", text)
    name = ""
    for line in lines[:8]:
        if "@" in line or re.search(r"\d", line):
            continue
        if re.search(r"(resume|curriculum|vitae|profile|email|phone|mobile)", line, re.IGNORECASE):
            continue
        words = re.findall(r"[A-Za-z]+", line)
        if 2 <= len(words) <= 4:
            name = " ".join(words)
            break
    return {
        "name": name,
        "email": extract_email(repaired_text),
        "phone": clean_phone(phone_match.group(0)) if phone_match else "",
    }


def save_uploaded_resume(uploaded_file):
    RESUME_DIR.mkdir(parents=True, exist_ok=True)
    original_name = secure_filename(uploaded_file.filename or "resume")
    extension = Path(original_name).suffix.lower()
    filename = f"{Path(original_name).stem}_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{secrets.token_hex(4)}{extension}"
    path = RESUME_DIR / filename
    uploaded_file.save(path)
    return path


def send_email_otp(email, otp):
    smtp_host = os.getenv("SMTP_HOST", "").strip()
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "").strip()
    smtp_password = os.getenv("SMTP_PASSWORD", "").replace(" ", "").strip()
    sender = os.getenv("SMTP_FROM", smtp_user).strip()
    if not all([smtp_host, smtp_user, smtp_password, sender]):
        return False

    message = EmailMessage()
    message["Subject"] = f"{DEFAULT_COMPANY_NAME} Interview OTP"
    message["From"] = sender
    message["To"] = email
    message.set_content(f"Your {DEFAULT_COMPANY_NAME} AI Interview OTP is {otp}.")

    with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as server:
        server.starttls()
        server.login(smtp_user, smtp_password)
        server.send_message(message)
    return True


def send_test_link(email, candidate_name, test_link, expires_at):
    smtp_host = os.getenv("SMTP_HOST", "").strip()
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "").strip()
    smtp_password = os.getenv("SMTP_PASSWORD", "").replace(" ", "").strip()
    sender = os.getenv("SMTP_FROM", smtp_user).strip()
    if not all([smtp_host, smtp_user, smtp_password, sender]):
        app.logger.info("Candidate test link for %s: %s", email, test_link)
        return {"sent": False, "status": "not_configured", "error": "SMTP settings are incomplete."}

    message = EmailMessage()
    message["Subject"] = f"{DEFAULT_COMPANY_NAME} Interview Test Link"
    message["From"] = sender
    message["To"] = email
    message.set_content(
        "\n".join(
            [
                f"Hello {candidate_name},",
                "",
                f"Your {DEFAULT_COMPANY_NAME} AI Interview test link is below.",
                test_link,
                "",
                f"This link expires at {expires_at.strftime('%d-%m-%Y %I:%M %p')} and must be opened within 5 minutes.",
            ]
        )
    )

    with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as server:
        server.starttls()
        server.login(smtp_user, smtp_password)
        server.send_message(message)
    return {"sent": True, "status": "sent", "error": ""}


def send_sms_otp(phone, otp):
    account_sid = os.getenv("TWILIO_ACCOUNT_SID", "").strip()
    auth_token = os.getenv("TWILIO_AUTH_TOKEN", "").strip()
    from_phone = os.getenv("TWILIO_FROM_PHONE", "").strip()
    if not all([account_sid, auth_token, from_phone]):
        return False

    payload = urllib.parse.urlencode(
        {
            "From": from_phone,
            "To": phone,
            "Body": f"Your {DEFAULT_COMPANY_NAME} AI Interview OTP is {otp}.",
        }
    ).encode("utf-8")
    request_obj = urllib.request.Request(
        f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json",
        data=payload,
    )
    credentials = f"{account_sid}:{auth_token}".encode("utf-8")
    request_obj.add_header("Authorization", f"Basic {base64.b64encode(credentials).decode('ascii')}")
    urllib.request.urlopen(request_obj, timeout=15).read()
    return True


def send_otp(email, phone, otp):
    sent_to = []
    try:
        if send_email_otp(email, otp):
            sent_to.append("email")
    except Exception as exc:
        app.logger.warning("Email OTP failed: %s", exc)
    try:
        if send_sms_otp(phone, otp):
            sent_to.append("phone")
    except Exception as exc:
        app.logger.warning("SMS OTP failed: %s", exc)
    app.logger.info("Candidate OTP for %s / %s: %s", email, phone, otp)
    return sent_to


def admin_key_is_valid():
    configured_key = os.getenv("ADMIN_REPORT_KEY", "admin123")
    return request.args.get("key") == configured_key


def proctoring_rejected(proctoring_violations):
    warning_count = len(proctoring_violations)
    tab_switch_count = sum(1 for item in proctoring_violations if item.get("kind") == "tab-switch")
    return tab_switch_count >= 5 or warning_count >= 10


def shortlist_candidate(overall_score, proctoring_violations):
    violation_count = len(proctoring_violations)
    if proctoring_rejected(proctoring_violations):
        return "Rejected", "Candidate was rejected because the tab switch or warning limit was reached."
    if overall_score >= SHORTLIST_MIN_SCORE and violation_count <= 2:
        return "Shortlisted", f"Candidate met the {SHORTLIST_MIN_SCORE:g} marks benchmark with acceptable proctoring activity."
    if violation_count > 2:
        return "Needs Review", "Candidate score requires manual review because proctoring alerts were triggered."
    return "Not Shortlisted", f"Candidate did not meet the minimum shortlist score of {SHORTLIST_MIN_SCORE:g} marks."


@app.route("/", methods=["GET", "POST"])
def index():
    error = ""
    invite = None
    form_values = {"name": "", "email": "", "phone": ""}
    if request.method == "POST":
        resume_file = request.files.get("resume")
        if not resume_file or not resume_file.filename:
            error = "Please upload a resume file."
        elif not resume_file_allowed(resume_file.filename):
            error = "Please upload a PDF, DOCX, or TXT resume."
        else:
            resume_path = save_uploaded_resume(resume_file)
            resume_text = extract_resume_text(resume_path)
            details = parse_resume_details(resume_text)
            name = request.form.get("name", "").strip() or details["name"]
            email = request.form.get("email", "").strip() or details["email"]
            phone = request.form.get("phone", "").strip() or details["phone"]
            form_values = {"name": name, "email": email, "phone": phone}
            if not name or not email or not phone:
                error = "Could not find name, email, and phone number in the resume. Please enter the missing details and upload again."
            else:
                user_id = create_user(name, email, phone, str(resume_path))
                token = secrets.token_urlsafe(32)
                expires_at = datetime.now() + timedelta(minutes=5)
                create_test_link(token, user_id, expires_at)
                test_link = url_for("start_test", token=token, _external=True)
                mail_result = {"sent": False, "status": "failed", "error": ""}
                try:
                    mail_result = send_test_link(email, name, test_link, expires_at)
                except Exception as exc:
                    app.logger.warning("Test link email failed: %s", exc)
                    mail_result = {"sent": False, "status": "failed", "error": str(exc)}
                invite = {
                    "name": name,
                    "email": email,
                    "phone": phone,
                    "resume_path": resume_path,
                    "sent": mail_result["sent"],
                    "mail_status": mail_result["status"],
                    "mail_error": mail_result["error"],
                    "test_link": test_link,
                    "expires_at": expires_at.strftime("%d-%m-%Y %I:%M %p"),
                }
    return render_template(
        "index.html",
        company_name=os.getenv("COMPANY_NAME", DEFAULT_COMPANY_NAME),
        error=error,
        invite=invite,
        form_values=form_values,
    )


@app.route("/start-test/<token>")
def start_test(token):
    invite = get_test_link(token)
    if not invite:
        return render_template(
            "test_link.html",
            title="Invalid Test Link",
            message="This interview test link is invalid. Please upload your resume again to receive a new link.",
            company_name=os.getenv("COMPANY_NAME", DEFAULT_COMPANY_NAME),
        ), 404

    expires_at = datetime.fromisoformat(invite["expires_at"])
    if invite.get("used_at"):
        return render_template(
            "test_link.html",
            title="Test Link Already Used",
            message="This interview test link has already been used. Continue from the same browser session if the test is already open.",
            company_name=os.getenv("COMPANY_NAME", DEFAULT_COMPANY_NAME),
        ), 410
    current_time = datetime.now(expires_at.tzinfo) if expires_at.tzinfo else datetime.now()
    if current_time > expires_at:
        return render_template(
            "test_link.html",
            title="Test Link Expired",
            message="This interview test link expired because the test was not started within 5 minutes. Please upload your resume again to receive a fresh link.",
            company_name=os.getenv("COMPANY_NAME", DEFAULT_COMPANY_NAME),
        ), 410

    mark_test_link_used(token)
    session.clear()
    session["user_id"] = invite["user_id"]
    session["candidate"] = {
        "name": invite["name"],
        "email": invite["email"],
        "phone": invite["phone"],
        "resume_path": invite.get("resume_path", ""),
    }
    return redirect(url_for("select_role"))


@app.route("/api/parse-resume", methods=["POST"])
def api_parse_resume():
    resume_file = request.files.get("resume")
    if not resume_file or not resume_file.filename:
        return jsonify({"error": "Please choose a resume file."}), 400
    if not resume_file_allowed(resume_file.filename):
        return jsonify({"error": "Please upload a PDF, DOCX, or TXT resume."}), 400

    extension = Path(secure_filename(resume_file.filename)).suffix.lower()
    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=extension) as temp_file:
            resume_file.save(temp_file)
            temp_path = Path(temp_file.name)
        details = parse_resume_details(extract_resume_text(temp_path))
        return jsonify(details)
    finally:
        if temp_path and temp_path.exists():
            temp_path.unlink()


@app.route("/verify-otp", methods=["GET", "POST"])
def verify_otp():
    pending_candidate = session.get("pending_candidate")
    if not pending_candidate:
        return redirect(url_for("index"))

    error = ""
    if request.method == "POST":
        entered_otp = request.form.get("otp", "").strip()
        if entered_otp == session.get("login_otp"):
            session["user_id"] = create_user(
                pending_candidate["name"],
                pending_candidate["email"],
                pending_candidate["phone"],
            )
            session["candidate"] = pending_candidate
            session.pop("pending_candidate", None)
            session.pop("login_otp", None)
            session.pop("otp_sent_to", None)
            return redirect(url_for("select_role"))
        error = "Invalid OTP. Please check your email or phone and try again."

    return render_template(
        "otp.html",
        candidate=pending_candidate,
        sent_to=session.get("otp_sent_to", []),
        dev_otp=session.get("login_otp") if not session.get("otp_sent_to") else "",
        error=error,
        company_name=os.getenv("COMPANY_NAME", DEFAULT_COMPANY_NAME),
    )


@app.route("/roles", methods=["GET", "POST"])
def select_role():
    if "user_id" not in session:
        return redirect(url_for("index"))
    roles = list_roles()
    error = ""
    if request.method == "POST":
        role_id = int(request.form.get("role_id", 0))
        terms_accepted = request.form.get("terms_accepted") == "yes"
        selected = next(
            (
                role
                for role in roles
                if (
                    (role.get("role_id") if isinstance(role, dict) else getattr(role, "role_id", None))
                    == role_id
                )
            ),
            None,
        )
        if not terms_accepted:
            error = "Please accept the terms and conditions before starting the interview."
        elif selected:
            session["role_id"] = role_id
            # selected may be a dict or an object; handle both
            role_name = selected.get("role_name") if isinstance(selected, dict) else getattr(selected, "role_name", None)
            session["role_name"] = role_name
            session["terms_accepted"] = True
            return redirect(url_for("interview"))
    return render_template(
        "roles.html",
        roles=roles,
        candidate=session.get("candidate", {}),
        error=error,
        company_name=os.getenv("COMPANY_NAME", DEFAULT_COMPANY_NAME),
    )


@app.route("/interview")
def interview():
    if "user_id" not in session:
        return redirect(url_for("index"))
    if "role_id" not in session:
        return redirect(url_for("select_role"))
    if not session.get("terms_accepted"):
        return redirect(url_for("select_role"))

    interview_id = str(uuid.uuid4())
    session["interview_id"] = interview_id
    session["face_stats"] = {"total_frames": 0, "detected_frames": 0, "smile_frames": 0, "stable_frames": 0}
    create_interview(interview_id, session["user_id"], session["role_id"])
    role = get_role_by_id(session["role_id"])
    if not role:
        return redirect(url_for("select_role"))
    role_slug = role.get("role_slug") if isinstance(role, dict) else getattr(role, "role_slug", None)
    if not role_slug:
        return redirect(url_for("select_role"))
    questions = select_questions_for_role(role_slug)
    save_interview_questions(interview_id, questions)

    return render_template(
        "interview.html",
        questions=questions,
        candidate=session.get("candidate", {}),
        role_name=session.get("role_name", ""),
        company_name=os.getenv("COMPANY_NAME", DEFAULT_COMPANY_NAME),
    )


@app.route("/admin/database")
def admin_database():
    if not admin_key_is_valid():
        return "Admin access required. Add ?key=admin123 to the URL or set ADMIN_REPORT_KEY in .env.", 403
    return render_template(
        "database.html",
        tables=load_database_snapshot(),
        db_path=DB_LABEL,
        company_name=os.getenv("COMPANY_NAME", DEFAULT_COMPANY_NAME),
    )


@app.route("/admin/reports")
def admin_reports():
    if not admin_key_is_valid():
        return "Admin access required. Add ?key=admin123 to the URL or set ADMIN_REPORT_KEY in .env.", 403
    return render_template(
        "admin_reports.html",
        reports=list_reports(),
        admin_key=request.args.get("key", ""),
        company_name=os.getenv("COMPANY_NAME", DEFAULT_COMPANY_NAME),
    )


@app.route("/api/questions")
def api_questions():
    if session.get("interview_id"):
        return jsonify(load_interview_questions(session["interview_id"]))
    return jsonify(load_questions())


@app.route("/api/analyze-frame", methods=["POST"])
def analyze_frame():
    payload = request.get_json(force=True)
    img_data = payload.get("image", "")
    if "," in img_data:
        img_data = img_data.split(",", 1)[1]
    if not img_data.strip():
        return jsonify({"error": "No camera frame image was received."}), 400

    try:
        img_bytes = base64.b64decode(img_data)
        if not img_bytes:
            raise ValueError("No camera frame image was received.")
        np_arr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        if frame is None:
            raise ValueError("Unable to decode image data")
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(gray, 1.2, 5, minSize=(60, 60))
        stats = session.get("face_stats", {"total_frames": 0, "detected_frames": 0, "smile_frames": 0, "stable_frames": 0})
        stats["total_frames"] += 1

        result = {
            "face_detected": False,
            "multiple_faces": False,
            "emotion": "Neutral",
            "confidence_hint": "Keep your face centered and maintain eye contact.",
            "alert_level": "warning",
            "alert_reason": "No face detected in camera frame.",
        }
        if len(faces) > 0:
            stats["detected_frames"] += 1
            x, y, w, h = max(faces, key=lambda r: r[2] * r[3])
            frame_area = gray.shape[0] * gray.shape[1]
            face_ratio = (w * h) / frame_area
            if 0.08 <= face_ratio <= 0.45:
                stats["stable_frames"] += 1
            roi_gray = gray[y:y+h, x:x+w]
            smiles = smile_cascade.detectMultiScale(roi_gray, 1.7, 20)
            if len(smiles) > 0:
                stats["smile_frames"] += 1
                emotion = "Positive"
                hint = "Good facial engagement. Continue speaking clearly."
            else:
                emotion = "Focused"
                hint = "Good focus detected. Add a natural smile when appropriate."
            result = {
                "face_detected": True,
                "multiple_faces": len(faces) > 1,
                "emotion": emotion,
                "confidence_hint": hint,
                "alert_level": "danger" if len(faces) > 1 else "ok",
                "alert_reason": "Multiple faces detected in camera frame." if len(faces) > 1 else "",
            }

        session["face_stats"] = stats
        return jsonify(result)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 400


@app.route("/api/submit", methods=["POST"])
def submit_interview():
    payload = request.get_json(force=True)
    candidate = session.get("candidate", {})
    candidate_name = candidate.get("name") or payload.get("candidate_name", "Candidate")
    answers = payload.get("answers", {})
    proctoring_violations = payload.get("proctoring_violations", [])
    auto_submit_reason = payload.get("auto_submit_reason", "")
    questions = load_interview_questions(session.get("interview_id")) if session.get("interview_id") else load_questions()

    results = []
    for question in questions:
        answer = answers.get(str(question["id"]), "")
        evaluation = ai_wrapper.evaluate_answer(answer, question)
        results.append(
            {
                "question": question,
                "answer": answer,
                "score": evaluation["score"],
                "feedback": evaluation["feedback"],
            }
        )

    interview_id = session.get("interview_id")
    overall = round(sum(r["score"]["total_score"] for r in results) / max(len(results), 1), 2)
    if interview_id:
        save_candidate_answers(interview_id, results)

    stats = session.get("face_stats", {"total_frames": 0, "detected_frames": 0, "smile_frames": 0, "stable_frames": 0})
    total = max(stats.get("total_frames", 0), 1)
    face_summary = {
        **stats,
        "candidate_email": candidate.get("email", ""),
        "candidate_phone": candidate.get("phone", ""),
        "resume_path": candidate.get("resume_path", ""),
        "confidence_index": round(((stats.get("detected_frames", 0) / total) * 55) + ((stats.get("stable_frames", 0) / total) * 30) + ((stats.get("smile_frames", 0) / total) * 15), 2),
        "proctoring_violations": proctoring_violations,
        "auto_submit_reason": auto_submit_reason,
    }
    shortlist_status, shortlist_reason = shortlist_candidate(overall, proctoring_violations)
    face_summary["shortlist_status"] = shortlist_status
    face_summary["shortlist_reason"] = shortlist_reason
    report_path = generate_pdf_report(candidate_name, results, face_summary, str(REPORT_DIR))
    session["last_report"] = report_path
    if interview_id:
        complete_interview(interview_id, overall, report_path, shortlist_status, shortlist_reason)

    rejected = proctoring_rejected(proctoring_violations)
    completion = {
        "status": "rejected" if rejected else "submitted",
        "title": "Suspicious Activity Detected" if rejected else "Interview Submitted",
        "message": (
            "Reminder: the tab switch or warning limit was reached during your test, so your interview has been rejected."
            if rejected
            else "Thank you. Your interview was submitted successfully. Once you are shortlisted, you will be notified."
        ),
        "warning_count": len(proctoring_violations),
        "auto_submit_reason": auto_submit_reason,
    }
    session["completion_result"] = completion
    return jsonify({"submitted": True, "redirect_url": url_for("interview_result"), **completion})


@app.route("/interview/result")
def interview_result():
    completion = session.get("completion_result")
    if not completion:
        return redirect(url_for("interview"))
    return render_template(
        "result.html",
        result=completion,
        candidate=session.get("candidate", {}),
        role_name=session.get("role_name", ""),
        company_name=os.getenv("COMPANY_NAME", DEFAULT_COMPANY_NAME),
    )


@app.route("/download-report")
def download_report():
    if not admin_key_is_valid():
        return "Admin access required", 403
    path = request.args.get("path") or session.get("last_report")
    if not path or not Path(path).exists():
        return "No report available", 404
    return send_file(path, as_attachment=True)


@app.route("/download-resume")
def download_resume():
    if not admin_key_is_valid():
        return "Admin access required", 403
    path = request.args.get("path", "")
    resume_path = Path(path)
    try:
        resume_path.relative_to(RESUME_DIR)
    except ValueError:
        return "Resume access denied", 403
    if not resume_path.exists():
        return "Resume not found", 404
    return send_file(resume_path, as_attachment=True)


@app.route("/favicon.ico")
def favicon():
    return send_file(BASE_DIR / "static" / "wittmann-logo-hq.png", mimetype="image/png")


def resolve_ssl_context():
    if os.getenv("ENABLE_HTTPS", "1").strip().lower() not in {"1", "true", "yes"}:
        return None

    cert_file = os.getenv("SSL_CERT_FILE", "").strip()
    key_file = os.getenv("SSL_KEY_FILE", "").strip()
    if cert_file and key_file:
        cert_path = Path(cert_file)
        key_path = Path(key_file)
        if not cert_path.is_absolute():
            cert_path = BASE_DIR / cert_path
        if not key_path.is_absolute():
            key_path = BASE_DIR / key_path
        if cert_path.exists() and key_path.exists():
            return (str(cert_path), str(key_path))
        app.logger.warning("Configured SSL certificate files were not found. Falling back to Flask adhoc SSL.")

    return "adhoc"


init_db()
ensure_question_bank_indexes()


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    ssl_context = resolve_ssl_context()
    app.run(host="0.0.0.0", port=port, debug=True, ssl_context=ssl_context)
