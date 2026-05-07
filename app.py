import base64
import json
import os
import random
import smtplib
import urllib.parse
import urllib.request
import uuid
from email.message import EmailMessage
from pathlib import Path

import cv2
import numpy as np
from dotenv import load_dotenv
from flask import Flask, jsonify, redirect, render_template, request, send_file, session, url_for

from utils.ai_wrapper import ai_wrapper
from utils.database import (
    DB_PATH,
    complete_interview,
    create_interview,
    create_user,
    ensure_questions_for_role,
    init_db,
    list_reports,
    list_roles,
    load_database_snapshot,
    save_candidate_answers,
)
from utils.report import generate_pdf_report

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR / "data" / "questions.json"
REPORT_DIR = BASE_DIR / "reports"
DEFAULT_COMPANY_NAME = "WITTMANN BATTENFELD India Pvt. Ltd."

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


def create_otp():
    return str(random.randint(100000, 999999))


def send_email_otp(email, otp):
    smtp_host = os.getenv("SMTP_HOST", "").strip()
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "").strip()
    smtp_password = os.getenv("SMTP_PASSWORD", "").strip()
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


def shortlist_candidate(overall_score, proctoring_violations):
    violation_count = len(proctoring_violations)
    if overall_score >= 70 and violation_count <= 2:
        return "Shortlisted", "Candidate met the score benchmark with acceptable proctoring activity."
    if violation_count > 2:
        return "Needs Review", "Candidate score requires manual review because proctoring alerts were triggered."
    return "Not Shortlisted", "Candidate did not meet the minimum shortlist score."


@app.route("/", methods=["GET", "POST"])
def index():
    if request.method == "POST":
        name = request.form.get("name", "").strip()
        email = request.form.get("email", "").strip()
        phone = request.form.get("phone", "").strip()
        if name and email and phone:
            otp = create_otp()
            session["pending_candidate"] = {"name": name, "email": email, "phone": phone}
            session["login_otp"] = otp
            session["otp_sent_to"] = send_otp(email, phone, otp)
            return redirect(url_for("verify_otp"))
    return render_template("index.html", company_name=os.getenv("COMPANY_NAME", DEFAULT_COMPANY_NAME))


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
    if request.method == "POST":
        role_id = int(request.form.get("role_id", 0))
        selected = next((role for role in roles if role["role_id"] == role_id), None)
        if selected:
            session["role_id"] = role_id
            session["role_name"] = selected["role_name"]
            ensure_questions_for_role(role_id)
            return redirect(url_for("interview"))
    return render_template(
        "roles.html",
        roles=roles,
        candidate=session.get("candidate", {}),
        company_name=os.getenv("COMPANY_NAME", DEFAULT_COMPANY_NAME),
    )


@app.route("/interview")
def interview():
    if "user_id" not in session:
        return redirect(url_for("index"))
    if "role_id" not in session:
        return redirect(url_for("select_role"))

    questions = ensure_questions_for_role(session["role_id"])
    interview_id = str(uuid.uuid4())
    session["interview_id"] = interview_id
    session["face_stats"] = {"total_frames": 0, "detected_frames": 0, "smile_frames": 0, "stable_frames": 0}
    create_interview(interview_id, session["user_id"], session["role_id"])

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
        db_path=DB_PATH,
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
    if "role_id" in session:
        return jsonify(ensure_questions_for_role(session["role_id"]))
    return jsonify(load_questions())


@app.route("/api/analyze-frame", methods=["POST"])
def analyze_frame():
    payload = request.get_json(force=True)
    img_data = payload.get("image", "")
    if "," in img_data:
        img_data = img_data.split(",", 1)[1]

    try:
        img_bytes = base64.b64decode(img_data)
        np_arr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
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
    questions = ensure_questions_for_role(session.get("role_id")) if session.get("role_id") else load_questions()

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

    return jsonify({"submitted": True, "message": "Thank you. Once you are shortlisted, you will be notified."})


@app.route("/download-report")
def download_report():
    if not admin_key_is_valid():
        return "Admin access required", 403
    path = request.args.get("path") or session.get("last_report")
    if not path or not Path(path).exists():
        return "No report available", 404
    return send_file(path, as_attachment=True)


init_db()


if __name__ == "__main__":
    app.run(debug=True)
