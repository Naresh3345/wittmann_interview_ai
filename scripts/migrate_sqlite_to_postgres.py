import json
import sqlite3
import sys
from pathlib import Path

from dotenv import load_dotenv
from psycopg.types.json import Jsonb

BASE_DIR = Path(__file__).resolve().parent.parent
SQLITE_PATH = BASE_DIR / "data" / "interview_system.db"
sys.path.insert(0, str(BASE_DIR))
load_dotenv()

from utils.database import get_db, init_db
from utils.question_bank import ensure_question_bank_indexes


TABLES = [
    "roles",
    "users",
    "question_patterns",
    "questions",
    "interviews",
    "candidate_answers",
    "test_links",
    "interview_questions",
]

SEQUENCES = [
    ("roles", "role_id", "roles_role_id_seq"),
    ("users", "user_id", "users_user_id_seq"),
    ("question_patterns", "pattern_id", "question_patterns_pattern_id_seq"),
    ("questions", "question_id", "questions_question_id_seq"),
    ("candidate_answers", "answer_id", "candidate_answers_answer_id_seq"),
    ("interview_questions", "assignment_id", "interview_questions_assignment_id_seq"),
]


def fetch_rows(table_name):
    with sqlite3.connect(SQLITE_PATH) as conn:
        conn.row_factory = sqlite3.Row
        return [dict(row) for row in conn.execute(f"SELECT * FROM {table_name}")]


def upsert_row(conn, table_name, row):
    if table_name == "users" and "otp_verified" in row:
        row["otp_verified"] = bool(row["otp_verified"])
    columns = list(row)
    values = [row[column] for column in columns]
    if table_name == "interview_questions" and isinstance(row.get("question_snapshot_json"), str):
        values[columns.index("question_snapshot_json")] = Jsonb(json.loads(row["question_snapshot_json"]))

    placeholders = ", ".join(["%s"] * len(columns))
    column_sql = ", ".join(columns)
    conn.execute(f"INSERT INTO {table_name} ({column_sql}) VALUES ({placeholders}) ON CONFLICT DO NOTHING", values)


if __name__ == "__main__":
    if not SQLITE_PATH.exists():
        raise SystemExit(f"SQLite file not found: {SQLITE_PATH}")

    init_db()
    ensure_question_bank_indexes()
    with get_db() as conn:
        for table_name in TABLES:
            rows = fetch_rows(table_name)
            for row in rows:
                upsert_row(conn, table_name, row)
            print(f"Migrated {len(rows)} rows into PostgreSQL table {table_name}.")
        for table_name, id_column, sequence_name in SEQUENCES:
            conn.execute(
                """
                SELECT setval(%s, COALESCE((SELECT MAX(%s) FROM %s), 1), TRUE)
                """
                % ("%s", id_column, table_name),
                (sequence_name,),
            )
