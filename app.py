import base64
import json
import os
import sqlite3
import uuid
from datetime import datetime
from pathlib import Path

import cv2
import numpy as np
from dotenv import load_dotenv
from flask import Flask, jsonify, redirect, render_template, request, send_file, session, url_for

from utils.report import generate_pdf_report
from utils.scoring import feedback_from_score, score_answer

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR / "data" / "questions.json"
DB_PATH = BASE_DIR / "data" / "interview_system.db"
REPORT_DIR = BASE_DIR / "reports"

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "dev-secret-key-change-me")

ROLES = [
    ("manual-testing", "Manual Testing"),
    ("automation-testing", "Automation Testing"),
    ("ai-tech-support", "AI Tech Support"),
    ("software-development", "Software Development"),
]

QUESTION_TOPICS = {
    "manual-testing": {
        "Technical": [
            "test case design", "bug life cycle", "regression testing", "smoke testing", "sanity testing",
            "defect severity and priority", "test data preparation", "boundary value analysis",
            "integration testing", "user acceptance testing",
        ],
        "HR": ["team communication", "learning attitude", "work ownership", "deadline handling", "career interest"],
        "Project": ["final year project", "testing strategy", "defect reporting", "test documentation", "quality improvement"],
    },
    "ai-tech-support": {
        "Technical": [
            "AI troubleshooting", "prompt analysis", "model response validation", "customer issue triage",
            "data privacy", "API error handling", "knowledge base usage", "root cause analysis",
            "incident escalation", "support metrics",
        ],
        "HR": ["customer empathy", "clear communication", "shift readiness", "team collaboration", "learning attitude"],
        "Project": ["AI project explanation", "support workflow", "automation idea", "issue resolution example", "documentation practice"],
    },
    "automation-testing": {
        "Technical": [
            "Selenium basics", "test automation framework", "locator strategy", "test scripts",
            "CI execution", "API testing", "data driven testing", "report generation",
            "flaky test handling", "regression automation",
        ],
        "HR": ["team communication", "debugging patience", "ownership", "deadline handling", "career interest"],
        "Project": ["automation project", "framework design", "test reporting", "script maintenance", "quality improvement"],
    },
    "software-development": {
        "Technical": [
            "Python fundamentals", "database design", "REST API", "debugging", "version control",
            "object oriented programming", "web development", "error handling", "testing code", "deployment basics",
        ],
        "HR": ["team communication", "problem solving", "ownership", "deadline handling", "career interest"],
        "Project": ["project architecture", "database module", "API implementation", "bug fixing", "future enhancement"],
    },
}

cv2_data = getattr(cv2, "data", None)
haar_folder = getattr(cv2_data, "haarcascades", None) if cv2_data is not None else None
if not haar_folder:
    haar_folder = os.path.join(os.path.dirname(cv2.__file__), "data", "haarcascades")

face_cascade = cv2.CascadeClassifier(os.path.join(haar_folder, "haarcascade_frontalface_default.xml"))
smile_cascade = cv2.CascadeClassifier(os.path.join(haar_folder, "haarcascade_smile.xml"))


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    DB_PATH.parent.mkdir(exist_ok=True)
    with get_db() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS roles (
                role_id INTEGER PRIMARY KEY AUTOINCREMENT,
                role_slug TEXT NOT NULL UNIQUE,
                role_name TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS users (
                user_id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL,
                phone TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS question_patterns (
                pattern_id INTEGER PRIMARY KEY AUTOINCREMENT,
                role_id INTEGER NOT NULL,
                question_type TEXT NOT NULL,
                difficulty TEXT NOT NULL,
                topic TEXT NOT NULL,
                no_of_questions INTEGER NOT NULL,
                marks INTEGER NOT NULL,
                FOREIGN KEY (role_id) REFERENCES roles(role_id)
            );

            CREATE TABLE IF NOT EXISTS questions (
                question_id INTEGER PRIMARY KEY AUTOINCREMENT,
                pattern_id INTEGER NOT NULL,
                role_id INTEGER NOT NULL,
                question_text TEXT NOT NULL,
                expected_answer TEXT NOT NULL,
                difficulty TEXT NOT NULL,
                question_type TEXT NOT NULL,
                FOREIGN KEY (pattern_id) REFERENCES question_patterns(pattern_id),
                FOREIGN KEY (role_id) REFERENCES roles(role_id)
            );

            CREATE TABLE IF NOT EXISTS interviews (
                interview_id TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                role_id INTEGER NOT NULL,
                date TEXT NOT NULL,
                total_score REAL DEFAULT 0,
                status TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(user_id),
                FOREIGN KEY (role_id) REFERENCES roles(role_id)
            );

            CREATE TABLE IF NOT EXISTS candidate_answers (
                answer_id INTEGER PRIMARY KEY AUTOINCREMENT,
                interview_id TEXT NOT NULL,
                question_id INTEGER NOT NULL,
                answer_text TEXT NOT NULL,
                ai_score REAL NOT NULL,
                ai_feedback TEXT NOT NULL,
                FOREIGN KEY (interview_id) REFERENCES interviews(interview_id),
                FOREIGN KEY (question_id) REFERENCES questions(question_id)
            );
            """
        )
        for slug, name in ROLES:
            conn.execute("INSERT OR IGNORE INTO roles (role_slug, role_name) VALUES (?, ?)", (slug, name))
        seed_question_patterns(conn)


def seed_question_patterns(conn):
    counts = {"Technical": 10, "HR": 5, "Project": 5}
    for role in conn.execute("SELECT role_id, role_slug FROM roles"):
        for question_type, count in counts.items():
            exists = conn.execute(
                """
                SELECT 1 FROM question_patterns
                WHERE role_id = ? AND question_type = ?
                """,
                (role["role_id"], question_type),
            ).fetchone()
            if exists:
                continue
            conn.execute(
                """
                INSERT INTO question_patterns
                    (role_id, question_type, difficulty, topic, no_of_questions, marks)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    role["role_id"],
                    question_type,
                    "Easy + Medium",
                    ", ".join(QUESTION_TOPICS[role["role_slug"]][question_type]),
                    count,
                    5,
                ),
            )


def list_roles():
    with get_db() as conn:
        return [dict(row) for row in conn.execute("SELECT role_id, role_slug, role_name FROM roles ORDER BY role_id")]


def question_keywords(topic, role_name, question_type):
    words = [topic, role_name, question_type, "WITTMANN", "quality", "process"]
    return [word.lower() for word in words]


def build_question(role_name, role_slug, question_type, topic, index, difficulty):
    if question_type == "Technical":
        text = f"Explain {topic} for the {role_name} role and give one practical WITTMANN interview example."
        expected = (
            f"A strong answer explains {topic}, connects it to the {role_name} role, "
            "and includes a practical example related to WITTMANN quality, customer support, automation, or software work."
        )
    elif question_type == "HR":
        text = f"How would you show {topic} while working in a WITTMANN {role_name} team?"
        expected = (
            f"A strong answer gives a clear personal example of {topic}, shows communication and ownership, "
            "and explains how the candidate would work professionally with the WITTMANN team."
        )
    else:
        text = f"Describe a project experience where you used {topic} and how it matches the {role_name} role."
        expected = (
            f"A strong answer describes the project context, the candidate's contribution in {topic}, "
            "the tools or methods used, the result, and how it connects to the selected WITTMANN role."
        )
    return {
        "question": text,
        "expected": expected,
        "difficulty": "Easy" if index % 2 else "Medium",
        "keywords": question_keywords(topic, role_name, question_type),
    }


def ensure_questions_for_role(role_id):
    with get_db() as conn:
        role = conn.execute("SELECT role_id, role_slug, role_name FROM roles WHERE role_id = ?", (role_id,)).fetchone()
        if not role:
            return []
        patterns = conn.execute("SELECT * FROM question_patterns WHERE role_id = ? ORDER BY pattern_id", (role_id,)).fetchall()
        for pattern in patterns:
            existing_count = conn.execute(
                "SELECT COUNT(*) AS total FROM questions WHERE pattern_id = ?",
                (pattern["pattern_id"],),
            ).fetchone()["total"]
            if existing_count >= pattern["no_of_questions"]:
                continue
            topics = QUESTION_TOPICS[role["role_slug"]][pattern["question_type"]]
            for idx, topic in enumerate(topics[: pattern["no_of_questions"]], start=1):
                generated = build_question(role["role_name"], role["role_slug"], pattern["question_type"], topic, idx, pattern["difficulty"])
                conn.execute(
                    """
                    INSERT INTO questions
                        (pattern_id, role_id, question_text, expected_answer, difficulty, question_type)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        pattern["pattern_id"],
                        role_id,
                        generated["question"],
                        generated["expected"],
                        generated["difficulty"],
                        pattern["question_type"],
                    ),
                )
        rows = conn.execute(
            """
            SELECT q.*, r.role_name
            FROM questions q
            JOIN roles r ON r.role_id = q.role_id
            WHERE q.role_id = ?
            ORDER BY
                CASE q.question_type WHEN 'Technical' THEN 1 WHEN 'HR' THEN 2 ELSE 3 END,
                q.question_id
            """,
            (role_id,),
        ).fetchall()
    questions = []
    for row in rows:
        topic = row["question_text"].split("Explain ", 1)[-1].split(" for ", 1)[0]
        questions.append(
            {
                "id": row["question_id"],
                "category": row["question_type"],
                "difficulty": row["difficulty"],
                "question": row["question_text"],
                "ideal_answer": row["expected_answer"],
                "keywords": question_keywords(topic, row["role_name"], row["question_type"]),
            }
        )
    return questions


def load_questions():
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


@app.route("/", methods=["GET", "POST"])
def index():
    if request.method == "POST":
        name = request.form.get("name", "").strip()
        email = request.form.get("email", "").strip()
        phone = request.form.get("phone", "").strip()
        if name and email and phone:
            with get_db() as conn:
                cursor = conn.execute(
                    "INSERT INTO users (name, email, phone, created_at) VALUES (?, ?, ?, ?)",
                    (name, email, phone, datetime.now().isoformat(timespec="seconds")),
                )
                session["user_id"] = cursor.lastrowid
                session["candidate"] = {"name": name, "email": email, "phone": phone}
            return redirect(url_for("select_role"))
    return render_template("index.html", company_name=os.getenv("COMPANY_NAME", "WITTMANN BATTENFELD"))


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
        company_name=os.getenv("COMPANY_NAME", "WITTMANN BATTENFELD"),
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
    with get_db() as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO interviews
                (interview_id, user_id, role_id, date, total_score, status)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (interview_id, session["user_id"], session["role_id"], datetime.now().isoformat(timespec="seconds"), 0, "Started"),
        )
    return render_template(
        "interview.html",
        questions=questions,
        candidate=session.get("candidate", {}),
        role_name=session.get("role_name", ""),
        company_name=os.getenv("COMPANY_NAME", "WITTMANN BATTENFELD"),
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
    candidate = session.get("candidate", {})
    candidate_name = candidate.get("name") or payload.get("candidate_name", "Candidate")
    answers = payload.get("answers", {})
    questions = ensure_questions_for_role(session.get("role_id")) if session.get("role_id") else load_questions()

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

    interview_id = session.get("interview_id")
    overall = round(sum(r["score"]["total_score"] for r in results) / max(len(results), 1), 2)
    if interview_id:
        with get_db() as conn:
            conn.execute("DELETE FROM candidate_answers WHERE interview_id = ?", (interview_id,))
            for result in results:
                conn.execute(
                    """
                    INSERT INTO candidate_answers
                        (interview_id, question_id, answer_text, ai_score, ai_feedback)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (
                        interview_id,
                        result["question"]["id"],
                        result["answer"],
                        result["score"]["total_score"],
                        result["feedback"],
                    ),
                )
            conn.execute(
                "UPDATE interviews SET total_score = ?, status = ? WHERE interview_id = ?",
                (overall, "Completed", interview_id),
            )

    stats = session.get("face_stats", {"total_frames": 0, "detected_frames": 0, "smile_frames": 0, "stable_frames": 0})
    total = max(stats.get("total_frames", 0), 1)
    face_summary = {
        **stats,
        "confidence_index": round(((stats.get("detected_frames", 0) / total) * 55) + ((stats.get("stable_frames", 0) / total) * 30) + ((stats.get("smile_frames", 0) / total) * 15), 2)
    }
    report_path = generate_pdf_report(candidate_name, results, face_summary, str(REPORT_DIR))
    session["last_report"] = report_path

    return jsonify({"overall_score": overall, "results": results, "face_summary": face_summary, "report_url": "/download-report"})


@app.route("/download-report")
def download_report():
    path = session.get("last_report")
    if not path or not Path(path).exists():
        return "No report available", 404
    return send_file(path, as_attachment=True)


init_db()


if __name__ == "__main__":
    app.run(debug=True)
