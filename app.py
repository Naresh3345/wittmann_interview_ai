import base64
import json
import os
import uuid
from pathlib import Path

import cv2
import numpy as np
from dotenv import load_dotenv
from flask import Flask, jsonify, render_template, request, send_file, session

from utils.report import generate_pdf_report
from utils.scoring import feedback_from_score, score_answer

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR / "data" / "questions.json"
REPORT_DIR = BASE_DIR / "reports"

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "dev-secret-key-change-me")

face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
smile_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_smile.xml")


def load_questions():
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


@app.route("/")
def index():
    return render_template("index.html", company_name=os.getenv("COMPANY_NAME", "WITTMANN BATTENFELD"))


@app.route("/interview")
def interview():
    questions = load_questions()
    session["interview_id"] = str(uuid.uuid4())
    session["face_stats"] = {"total_frames": 0, "detected_frames": 0, "smile_frames": 0, "stable_frames": 0}
    return render_template("interview.html", questions=questions, company_name=os.getenv("COMPANY_NAME", "WITTMANN BATTENFELD"))


@app.route("/api/questions")
def api_questions():
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

        result = {"face_detected": False, "emotion": "Neutral", "confidence_hint": "Keep your face centered and maintain eye contact."}
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
            result = {"face_detected": True, "emotion": emotion, "confidence_hint": hint}

        session["face_stats"] = stats
        return jsonify(result)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 400


@app.route("/api/submit", methods=["POST"])
def submit_interview():
    payload = request.get_json(force=True)
    candidate_name = payload.get("candidate_name", "Candidate")
    answers = payload.get("answers", {})
    questions = load_questions()

    results = []
    for question in questions:
        answer = answers.get(str(question["id"]), "")
        score = score_answer(answer, question)
        results.append({
            "question": question,
            "answer": answer,
            "score": score,
            "feedback": feedback_from_score(score["total_score"])
        })

    stats = session.get("face_stats", {"total_frames": 0, "detected_frames": 0, "smile_frames": 0, "stable_frames": 0})
    total = max(stats.get("total_frames", 0), 1)
    face_summary = {
        **stats,
        "confidence_index": round(((stats.get("detected_frames", 0) / total) * 55) + ((stats.get("stable_frames", 0) / total) * 30) + ((stats.get("smile_frames", 0) / total) * 15), 2)
    }
    report_path = generate_pdf_report(candidate_name, results, face_summary, REPORT_DIR)
    session["last_report"] = report_path

    overall = round(sum(r["score"]["total_score"] for r in results) / max(len(results), 1), 2)
    return jsonify({"overall_score": overall, "results": results, "face_summary": face_summary, "report_url": "/download-report"})


@app.route("/download-report")
def download_report():
    path = session.get("last_report")
    if not path or not Path(path).exists():
        return "No report available", 404
    return send_file(path, as_attachment=True)


if __name__ == "__main__":
    app.run(debug=True)
