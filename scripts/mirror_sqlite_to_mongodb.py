import sqlite3
from datetime import datetime
from pathlib import Path

from pymongo import MongoClient


BASE_DIR = Path(__file__).resolve().parent.parent
SQLITE_PATH = BASE_DIR / "data" / "interview_system.db"
MONGODB_URI = "mongodb://localhost:27017/"
MONGODB_DB_NAME = "wittmann_interview_ai"
TABLES = [
    "users",
    "interviews",
    "candidate_answers",
    "test_links",
    "interview_questions",
]


def fetch_rows(table_name):
    with sqlite3.connect(SQLITE_PATH) as conn:
        conn.row_factory = sqlite3.Row
        return [dict(row) for row in conn.execute(f"SELECT * FROM {table_name}")]


if __name__ == "__main__":
    db = MongoClient(MONGODB_URI)[MONGODB_DB_NAME]
    now = datetime.utcnow()
    for table_name in TABLES:
        collection = db[f"sqlite_{table_name}"]
        collection.delete_many({})
        rows = fetch_rows(table_name)
        if rows:
            collection.insert_many([{**row, "mirrored_at": now} for row in rows])
        print(f"Mirrored {len(rows)} rows into sqlite_{table_name}.")
