import sys
from pathlib import Path

from dotenv import load_dotenv
from psycopg.types.json import Jsonb

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))
load_dotenv()

from utils.ai_wrapper import ai_wrapper
from utils.database import QUESTION_TOPICS, ROLES, get_db, init_db
from utils.question_bank import ensure_question_bank_indexes


def split_options(question_text):
    if "\nOptions:\n" not in question_text:
        return question_text, []
    prompt, options_text = question_text.split("\nOptions:\n", 1)
    return prompt, [line.strip() for line in options_text.splitlines() if line.strip()]


if __name__ == "__main__":
    init_db()
    ensure_question_bank_indexes()
    total = 0
    with get_db() as conn:
        for role_slug, role_name in ROLES:
            for section, topics in QUESTION_TOPICS[role_slug].items():
                for index, topic in enumerate(topics, start=1):
                    generated = ai_wrapper.generate_question(role_name, section, topic, index)
                    prompt, options = split_options(generated["question"])
                    question_code = f"{role_slug}-{section.lower()}-{index:03d}"
                    conn.execute(
                        """
                        INSERT INTO question_bank
                            (question_code, role_slug, section, topic, difficulty, question_text,
                             options, correct_answer, keywords, marks, active, updated_at)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, TRUE, now())
                        ON CONFLICT (question_code) DO UPDATE SET
                            role_slug = EXCLUDED.role_slug,
                            section = EXCLUDED.section,
                            topic = EXCLUDED.topic,
                            difficulty = EXCLUDED.difficulty,
                            question_text = EXCLUDED.question_text,
                            options = EXCLUDED.options,
                            correct_answer = EXCLUDED.correct_answer,
                            keywords = EXCLUDED.keywords,
                            marks = EXCLUDED.marks,
                            active = EXCLUDED.active,
                            updated_at = now()
                        """,
                        (
                            question_code,
                            role_slug,
                            section,
                            topic,
                            generated["difficulty"],
                            prompt,
                            Jsonb(options),
                            generated["expected_answer"],
                            Jsonb([topic.lower(), role_name.lower(), section.lower()]),
                            5,
                        ),
                    )
                    total += 1
    print(f"Seeded or updated {total} starter PostgreSQL questions.")
