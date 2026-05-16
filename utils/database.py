import sqlite3
import json
from datetime import datetime
from pathlib import Path

from utils.ai_wrapper import ai_wrapper


BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BASE_DIR / "data" / "interview_system.db"

ROLES = [
    ("manual-testing", "Manual Testing"),
    ("automation-testing", "Automation Testing"),
    ("ai-tech-support", "AI Tech Support"),
    ("software-development", "Software Development"),
]

QUESTION_TOPICS = {
    "manual-testing": {
        "Aptitude": [
            "Logical Reasoning",
            "Verbal Ability",
            "Programming Aptitude",
            "Number Series",
            "Percentage",
            "Ratio and Proportion",
            "Time and Work",
            "Data Interpretation",
            "Statement and Conclusion",
            "Error Spotting",
            "Synonyms",
            "Pseudocode Logic",
            "Manual Testing Bug Priority",
            "Manual Testing Test Case Logic",
            "Manual Testing Defect Flow",
        ],
        "Programming": [
            "Easy Java output tracing",
            "Medium Python output tracing",
            "Hard C++ output tracing",
        ],
    },
    "ai-tech-support": {
        "Aptitude": [
            "Logical Reasoning",
            "Verbal Ability",
            "Programming Aptitude",
            "Number Series",
            "Percentage",
            "Ratio and Proportion",
            "Time and Work",
            "Data Interpretation",
            "Statement and Conclusion",
            "Error Spotting",
            "Synonyms",
            "Pseudocode Logic",
            "AI Tech Support Ticket Priority",
            "AI Tech Support Troubleshooting Logic",
            "AI Tech Support Escalation Flow",
        ],
        "Programming": [
            "Easy Java output tracing",
            "Medium Python output tracing",
            "Hard C++ output tracing",
        ],
    },
    "automation-testing": {
        "Aptitude": [
            "Logical Reasoning",
            "Verbal Ability",
            "Programming Aptitude",
            "Number Series",
            "Percentage",
            "Ratio and Proportion",
            "Time and Work",
            "Data Interpretation",
            "Statement and Conclusion",
            "Error Spotting",
            "Synonyms",
            "Pseudocode Logic",
            "Automation Testing Locator Logic",
            "Automation Testing Regression Priority",
            "Automation Testing Failure Analysis",
        ],
        "Programming": [
            "Easy Java output tracing",
            "Medium Python output tracing",
            "Hard C++ output tracing",
        ],
    },
    "software-development": {
        "Aptitude": [
            "Logical Reasoning",
            "Verbal Ability",
            "Programming Aptitude",
            "Number Series",
            "Percentage",
            "Ratio and Proportion",
            "Time and Work",
            "Data Interpretation",
            "Statement and Conclusion",
            "Error Spotting",
            "Synonyms",
            "Pseudocode Logic",
            "Software Development Debug Logic",
            "Software Development API Logic",
            "Software Development Database Logic",
        ],
        "Programming": [
            "Easy Java output tracing",
            "Medium Python output tracing",
            "Hard C++ output tracing",
        ],
    },
}

SECTION_COUNTS = {"Aptitude": 15, "Programming": 3}


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
                otp_verified INTEGER DEFAULT 0,
                resume_path TEXT,
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
                shortlist_status TEXT,
                shortlist_reason TEXT,
                report_path TEXT,
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

            CREATE TABLE IF NOT EXISTS interview_questions (
                assignment_id INTEGER PRIMARY KEY AUTOINCREMENT,
                interview_id TEXT NOT NULL,
                question_key TEXT NOT NULL,
                display_order INTEGER NOT NULL,
                question_snapshot_json TEXT NOT NULL,
                UNIQUE(interview_id, question_key),
                FOREIGN KEY (interview_id) REFERENCES interviews(interview_id)
            );

            CREATE TABLE IF NOT EXISTS test_links (
                token TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                expires_at TEXT NOT NULL,
                used_at TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(user_id)
            );
            """
        )
        ensure_column(conn, "users", "otp_verified", "INTEGER DEFAULT 0")
        ensure_column(conn, "users", "resume_path", "TEXT")
        ensure_column(conn, "interviews", "report_path", "TEXT")
        ensure_column(conn, "interviews", "shortlist_status", "TEXT")
        ensure_column(conn, "interviews", "shortlist_reason", "TEXT")
        for slug, name in ROLES:
            conn.execute("INSERT OR IGNORE INTO roles (role_slug, role_name) VALUES (?, ?)", (slug, name))
        seed_question_patterns(conn)


def ensure_column(conn, table_name, column_name, column_definition):
    columns = [column["name"] for column in conn.execute(f"PRAGMA table_info({table_name})").fetchall()]
    if column_name not in columns:
        conn.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_definition}")


def seed_question_patterns(conn):
    for role in conn.execute("SELECT role_id, role_slug FROM roles"):
        role_topics = QUESTION_TOPICS[role["role_slug"]]
        desired_topics = {section: ", ".join(topics) for section, topics in role_topics.items()}
        existing_types = {
            row["question_type"]
            for row in conn.execute("SELECT DISTINCT question_type FROM question_patterns WHERE role_id = ?", (role["role_id"],))
        }
        current_patterns = conn.execute("SELECT question_type, topic FROM question_patterns WHERE role_id = ?", (role["role_id"],)).fetchall()
        topics_match = all(row["topic"] == desired_topics.get(row["question_type"]) for row in current_patterns)
        if existing_types and (existing_types != set(SECTION_COUNTS) or not topics_match):
            conn.execute("DELETE FROM questions WHERE role_id = ?", (role["role_id"],))
            conn.execute("DELETE FROM question_patterns WHERE role_id = ?", (role["role_id"],))
        for question_type, count in SECTION_COUNTS.items():
            exists = conn.execute(
                "SELECT 1 FROM question_patterns WHERE role_id = ? AND question_type = ?",
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
                    "Easy + Medium + Hard" if question_type == "Programming" else "Easy + Medium",
                    desired_topics[question_type],
                    count,
                    5,
                ),
            )


def list_roles():
    with get_db() as conn:
        return [dict(row) for row in conn.execute("SELECT role_id, role_slug, role_name FROM roles ORDER BY role_id")]


def create_user(name, email, phone, resume_path=""):
    with get_db() as conn:
        cursor = conn.execute(
            """
            INSERT INTO users (name, email, phone, otp_verified, resume_path, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (name, email, phone, 1, resume_path, datetime.now().isoformat(timespec="seconds")),
        )
        return cursor.lastrowid


def create_test_link(token, user_id, expires_at):
    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO test_links (token, user_id, expires_at, used_at, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (token, user_id, expires_at.isoformat(timespec="seconds"), None, datetime.now().isoformat(timespec="seconds")),
        )


def get_test_link(token):
    with get_db() as conn:
        row = conn.execute(
            """
            SELECT tl.token, tl.expires_at, tl.used_at,
                   u.user_id, u.name, u.email, u.phone, u.resume_path
            FROM test_links tl
            JOIN users u ON u.user_id = tl.user_id
            WHERE tl.token = ?
            """,
            (token,),
        ).fetchone()
    return dict(row) if row else None


def mark_test_link_used(token):
    with get_db() as conn:
        conn.execute(
            "UPDATE test_links SET used_at = ? WHERE token = ?",
            (datetime.now().isoformat(timespec="seconds"), token),
        )


def create_interview(interview_id, user_id, role_id):
    with get_db() as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO interviews
                (interview_id, user_id, role_id, date, total_score, status)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (interview_id, user_id, role_id, datetime.now().isoformat(timespec="seconds"), 0, "Started"),
        )


def save_interview_questions(interview_id, questions):
    with get_db() as conn:
        conn.execute("DELETE FROM interview_questions WHERE interview_id = ?", (interview_id,))
        for index, question in enumerate(questions, start=1):
            conn.execute(
                """
                INSERT INTO interview_questions
                    (interview_id, question_key, display_order, question_snapshot_json)
                VALUES (?, ?, ?, ?)
                """,
                (interview_id, str(question["id"]), index, json.dumps(question)),
            )


def load_interview_questions(interview_id):
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT question_snapshot_json
            FROM interview_questions
            WHERE interview_id = ?
            ORDER BY display_order
            """,
            (interview_id,),
        ).fetchall()
    return [json.loads(row["question_snapshot_json"]) for row in rows]


def complete_interview(interview_id, total_score, report_path, shortlist_status, shortlist_reason):
    with get_db() as conn:
        conn.execute(
            """
            UPDATE interviews
            SET total_score = ?, status = ?, report_path = ?, shortlist_status = ?, shortlist_reason = ?
            WHERE interview_id = ?
            """,
            (total_score, "Completed", report_path, shortlist_status, shortlist_reason, interview_id),
        )


def save_candidate_answers(interview_id, results):
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
                    str(result["question"]["id"]),
                    result["answer"],
                    result["score"]["total_score"],
                    result["feedback"],
                ),
            )


def list_reports():
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT i.interview_id, i.date, i.total_score, i.status, i.shortlist_status,
                   i.shortlist_reason, i.report_path,
                   u.name, u.email, u.phone, u.resume_path, r.role_name
            FROM interviews i
            JOIN users u ON u.user_id = i.user_id
            JOIN roles r ON r.role_id = i.role_id
            WHERE i.report_path IS NOT NULL
            ORDER BY i.date DESC
            """
        ).fetchall()
    return [dict(row) for row in rows]


def question_keywords(topic, role_name, question_type):
    words = [topic, role_name, question_type, "logical", "verbal", "programming", "java", "python", "c", "c++", "output", "option"]
    return [word.lower() for word in words]


def parse_question_options(question_text):
    if "\nOptions:\n" not in question_text:
        return question_text, []
    prompt, option_text = question_text.split("\nOptions:\n", 1)
    return prompt, [line.strip() for line in option_text.splitlines() if line.strip()]


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
                generated = ai_wrapper.generate_question(role["role_name"], pattern["question_type"], topic, idx)
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
                        generated["expected_answer"],
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
                CASE q.question_type WHEN 'Aptitude' THEN 1 WHEN 'Programming' THEN 2 ELSE 3 END,
                q.question_id
            """,
            (role_id,),
        ).fetchall()
    questions = []
    for row in rows:
        prompt, options = parse_question_options(row["question_text"])
        topic = prompt.split(":", 1)[0]
        questions.append(
            {
                "id": row["question_id"],
                "category": row["question_type"],
                "difficulty": row["difficulty"],
                "question": prompt,
                "ideal_answer": row["expected_answer"],
                "correct_answer": row["expected_answer"],
                "options": options,
                "keywords": question_keywords(topic, row["role_name"], row["question_type"]),
            }
        )
    return questions


def load_database_snapshot():
    ignored_tables = {"sqlite_sequence"}
    snapshot = []
    with get_db() as conn:
        tables = conn.execute(
            """
            SELECT name
            FROM sqlite_master
            WHERE type = 'table'
            ORDER BY name
            """
        ).fetchall()
        for table in tables:
            table_name = table["name"]
            if table_name in ignored_tables:
                continue
            columns = [column["name"] for column in conn.execute(f"PRAGMA table_info({table_name})").fetchall()]
            rows = conn.execute(f"SELECT * FROM {table_name} LIMIT 50").fetchall()
            snapshot.append(
                {
                    "name": table_name,
                    "columns": columns,
                    "rows": [dict(row) for row in rows],
                }
            )
    return snapshot
