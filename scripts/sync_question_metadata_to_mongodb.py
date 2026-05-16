import sqlite3
from datetime import datetime
from pathlib import Path

from pymongo import MongoClient


BASE_DIR = Path(__file__).resolve().parent.parent
SQLITE_PATH = BASE_DIR / "data" / "interview_system.db"
MONGODB_URI = "mongodb://localhost:27017/"
MONGODB_DB_NAME = "wittmann_interview_ai"


def fetch_rows(table_name):
    with sqlite3.connect(SQLITE_PATH) as conn:
        conn.row_factory = sqlite3.Row
        return [dict(row) for row in conn.execute(f"SELECT * FROM {table_name}")]


if __name__ == "__main__":
    db = MongoClient(MONGODB_URI)[MONGODB_DB_NAME]
    now = datetime.utcnow()

    for role in fetch_rows("roles"):
        db.roles.update_one(
            {"role_id": role["role_id"]},
            {"$set": {**role, "updated_at": now}, "$setOnInsert": {"created_at": now}},
            upsert=True,
        )

    for pattern in fetch_rows("question_patterns"):
        db.question_patterns.update_one(
            {"pattern_id": pattern["pattern_id"]},
            {"$set": {**pattern, "updated_at": now}, "$setOnInsert": {"created_at": now}},
            upsert=True,
        )

    print("Synced roles and question_patterns from SQLite to MongoDB.")
