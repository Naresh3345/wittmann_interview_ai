import json
import os
import random
from datetime import datetime
from pathlib import Path

from bson import ObjectId
from pymongo import ASCENDING, MongoClient


BASE_DIR = Path(__file__).resolve().parent.parent
DEFAULT_DB_NAME = "wittmann_interview_ai"
SECTION_COUNTS = {"Aptitude": 15, "Programming": 3}


def get_client():
    return MongoClient(os.getenv("MONGODB_URI", "mongodb://localhost:27017/"), serverSelectionTimeoutMS=3000)


def get_database():
    return get_client()[os.getenv("MONGODB_DB_NAME", DEFAULT_DB_NAME)]


def ensure_question_bank_indexes():
    db = get_database()
    db.command("ping")
    db.questions.create_index(
        [("role_slug", ASCENDING), ("section", ASCENDING), ("active", ASCENDING)],
        name="role_section_active_idx",
    )
    db.questions.create_index([("role_slug", ASCENDING), ("topic", ASCENDING)], name="role_topic_idx")
    db.questions.create_index([("question_code", ASCENDING)], unique=True, sparse=True, name="question_code_unique_idx")


def normalize_question(document):
    question_id = str(document["_id"])
    options = document.get("options") or []
    return {
        "id": question_id,
        "category": document["section"],
        "difficulty": document.get("difficulty", "Medium"),
        "question": document["question_text"],
        "ideal_answer": document["correct_answer"],
        "correct_answer": document["correct_answer"],
        "options": options,
        "keywords": document.get("keywords") or [],
        "topic": document.get("topic", ""),
        "marks": document.get("marks", 5),
    }


def select_questions_for_role(role_slug, excluded_ids=None):
    excluded_ids = excluded_ids or set()
    db = get_database()
    selected = []
    now = datetime.utcnow()

    for section, count in SECTION_COUNTS.items():
        pool = list(
            db.questions.find(
                {
                    "role_slug": role_slug,
                    "section": section,
                    "active": True,
                    "_id": {"$nin": [ObjectId(value) for value in excluded_ids if ObjectId.is_valid(value)]},
                }
            )
        )
        if len(pool) < count:
            raise ValueError(
                f"MongoDB question bank has only {len(pool)} active {section} questions for role '{role_slug}'. "
                f"At least {count} are required."
            )
        pool.sort(key=lambda item: (item.get("assignment_count", 0), item.get("last_assigned_at") or datetime.min, random.random()))
        chosen = pool[:count]
        selected.extend(chosen)
        db.questions.update_many(
            {"_id": {"$in": [item["_id"] for item in chosen]}},
            {"$inc": {"assignment_count": 1}, "$set": {"last_assigned_at": now}},
        )

    selected.sort(key=lambda item: (0 if item["section"] == "Aptitude" else 1, random.random()))
    return [normalize_question(item) for item in selected]


def import_questions_from_json(path):
    db = get_database()
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(payload, list):
        raise ValueError("Question import file must contain a JSON array.")

    operations = 0
    for item in payload:
        required = {"question_code", "role_slug", "section", "topic", "question_text", "correct_answer"}
        missing = required - set(item)
        if missing:
            raise ValueError(f"Question is missing required fields: {', '.join(sorted(missing))}")
        document = {
            "question_code": item["question_code"],
            "role_slug": item["role_slug"],
            "section": item["section"],
            "topic": item["topic"],
            "difficulty": item.get("difficulty", "Medium"),
            "question_text": item["question_text"],
            "options": item.get("options", []),
            "correct_answer": item["correct_answer"],
            "keywords": item.get("keywords", []),
            "marks": item.get("marks", 5),
            "active": item.get("active", True),
            "updated_at": datetime.utcnow(),
        }
        db.questions.update_one(
            {"question_code": document["question_code"]},
            {"$set": document, "$setOnInsert": {"created_at": datetime.utcnow(), "assignment_count": 0}},
            upsert=True,
        )
        operations += 1
    return operations
