import json
import random
from datetime import datetime
from pathlib import Path

from psycopg.types.json import Jsonb

from utils.database import get_db


SECTION_COUNTS = {"Aptitude": 30, "Programming": 5}


def ensure_question_bank_indexes():
    with get_db() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS question_bank (
                question_id SERIAL PRIMARY KEY,
                question_code TEXT UNIQUE,
                role_slug TEXT NOT NULL,
                question_set TEXT NOT NULL DEFAULT 'Set 1',
                section TEXT NOT NULL,
                topic TEXT NOT NULL,
                difficulty TEXT NOT NULL DEFAULT 'Medium',
                question_text TEXT NOT NULL,
                options JSONB NOT NULL DEFAULT '[]'::jsonb,
                correct_answer TEXT NOT NULL,
                keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
                marks INTEGER NOT NULL DEFAULT 5,
                active BOOLEAN NOT NULL DEFAULT TRUE,
                assignment_count INTEGER NOT NULL DEFAULT 0,
                last_assigned_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
            """
        )
        conn.execute("ALTER TABLE question_bank ADD COLUMN IF NOT EXISTS question_set TEXT NOT NULL DEFAULT 'Set 1'")
        conn.execute("ALTER TABLE question_bank ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ")
        conn.execute("ALTER TABLE question_bank ADD COLUMN IF NOT EXISTS deleted_by TEXT")
        conn.execute(
            """
            UPDATE question_bank
            SET question_set = CASE
                WHEN question_code ILIKE '%set5%' THEN 'Set 5'
                WHEN question_set IS NULL OR btrim(question_set) = '' THEN 'Set 1'
                ELSE question_set
            END
            """
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS question_bank_role_section_active_idx ON question_bank (role_slug, section, active)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS question_bank_role_set_section_active_idx ON question_bank (role_slug, question_set, section, active)"
        )
        conn.execute("CREATE INDEX IF NOT EXISTS question_bank_role_topic_idx ON question_bank (role_slug, topic)")


def normalize_question(row):
    return {
        "id": str(row["question_id"]),
        "set": row.get("question_set", "Set 1"),
        "category": row["section"],
        "difficulty": row.get("difficulty", "Medium"),
        "question": row["question_text"],
        "ideal_answer": row["correct_answer"],
        "correct_answer": row["correct_answer"],
        "options": row.get("options") or [],
        "keywords": row.get("keywords") or [],
        "topic": row.get("topic", ""),
        "marks": row.get("marks", 5),
    }


def assignment_sort_key(item):
    last_assigned = item.get("last_assigned_at")
    last_assigned_value = last_assigned.timestamp() if last_assigned else 0
    return (item.get("assignment_count", 0), last_assigned_value, random.random())


def parse_question_sets(value):
    if not value:
        return []
    items = []
    for part in str(value).replace("|", ",").replace("\n", ",").split(","):
        label = part.strip()
        if not label:
            continue
        if label.isdigit():
            label = f"Set {label}"
        elif label.lower().startswith("set"):
            digits = "".join(ch for ch in label if ch.isdigit())
            label = f"Set {digits}" if digits else label
        if label.lower() not in {item.lower() for item in items}:
            items.append(label)
    return items


def active_sets_for_role(conn, role_slug):
    rows = conn.execute(
        """
        SELECT DISTINCT question_set
        FROM question_bank
        WHERE role_slug = %s AND active = TRUE AND deleted_at IS NULL
        ORDER BY question_set
        """,
        (role_slug,),
    ).fetchall()
    return [row["question_set"] for row in rows if row["question_set"]]


def select_questions_for_role(role_slug, excluded_ids=None, allowed_question_sets=""):
    excluded_ids = {int(value) for value in (excluded_ids or set()) if str(value).isdigit()}
    selected = []
    now = datetime.now()

    with get_db() as conn:
        question_sets = parse_question_sets(allowed_question_sets)
        for section, count in SECTION_COUNTS.items():
            params = [role_slug, section]
            excluded_sql = ""
            set_sql = ""
            if question_sets:
                set_sql = "AND question_set = ANY(%s)"
                params.append(question_sets)
            if excluded_ids:
                excluded_sql = "AND question_id <> ALL(%s)"
                params.append(list(excluded_ids))
            pool = conn.execute(
                f"""
                SELECT *
                FROM question_bank
                WHERE role_slug = %s
                  AND section = %s
                  {set_sql}
                  AND active = TRUE
                  AND deleted_at IS NULL
                  {excluded_sql}
                """,
                tuple(params),
            ).fetchall()
            if len(pool) < count:
                source_label = f" in selected sets: {', '.join(question_sets)}" if question_sets else ""
                raise ValueError(
                    f"PostgreSQL question bank has only {len(pool)} active {section} questions for role '{role_slug}'{source_label}. "
                    f"At least {count} are required."
                )
            pool.sort(key=assignment_sort_key)
            chosen = pool[:count]
            random.shuffle(chosen)
            selected.extend(chosen)
            conn.execute(
                """
                UPDATE question_bank
                SET assignment_count = assignment_count + 1,
                    last_assigned_at = %s,
                    updated_at = %s
                WHERE question_id = ANY(%s)
                """,
                (now, now, [item["question_id"] for item in chosen]),
            )

    return [normalize_question(item) for item in selected]


def import_questions_from_json(path):
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(payload, list):
        raise ValueError("Question import file must contain a JSON array.")

    operations = 0
    now = datetime.now()
    with get_db() as conn:
        for item in payload:
            required = {"question_code", "role_slug", "section", "topic", "question_text", "correct_answer"}
            missing = required - set(item)
            if missing:
                raise ValueError(f"Question is missing required fields: {', '.join(sorted(missing))}")
            conn.execute(
                """
                INSERT INTO question_bank
                    (question_code, role_slug, question_set, section, topic, difficulty, question_text,
                     options, correct_answer, keywords, marks, active, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (question_code) DO UPDATE SET
                    role_slug = EXCLUDED.role_slug,
                    question_set = EXCLUDED.question_set,
                    section = EXCLUDED.section,
                    topic = EXCLUDED.topic,
                    difficulty = EXCLUDED.difficulty,
                    question_text = EXCLUDED.question_text,
                    options = EXCLUDED.options,
                    correct_answer = EXCLUDED.correct_answer,
                    keywords = EXCLUDED.keywords,
                    marks = EXCLUDED.marks,
                    active = EXCLUDED.active,
                    updated_at = EXCLUDED.updated_at
                """,
                (
                    item["question_code"],
                    item["role_slug"],
                    item.get("question_set", "Set 1"),
                    item["section"],
                    item["topic"],
                    item.get("difficulty", "Medium"),
                    item["question_text"],
                    Jsonb(item.get("options", [])),
                    item["correct_answer"],
                    Jsonb(item.get("keywords", [])),
                    item.get("marks", 5),
                    item.get("active", True),
                    now,
                    now,
                ),
            )
            operations += 1
    return operations
