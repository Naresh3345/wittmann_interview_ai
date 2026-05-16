import sys
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from utils.ai_wrapper import ai_wrapper
from utils.database import QUESTION_TOPICS, ROLES
from utils.question_bank import ensure_question_bank_indexes, get_database


def split_options(question_text):
    if "\nOptions:\n" not in question_text:
        return question_text, []
    prompt, options_text = question_text.split("\nOptions:\n", 1)
    return prompt, [line.strip() for line in options_text.splitlines() if line.strip()]


if __name__ == "__main__":
    load_dotenv()
    ensure_question_bank_indexes()
    db = get_database()
    total = 0
    for role_slug, role_name in ROLES:
        for section, topics in QUESTION_TOPICS[role_slug].items():
            for index, topic in enumerate(topics, start=1):
                generated = ai_wrapper.generate_question(role_name, section, topic, index)
                prompt, options = split_options(generated["question"])
                question_code = f"{role_slug}-{section.lower()}-{index:03d}"
                db.questions.update_one(
                    {"question_code": question_code},
                    {
                        "$set": {
                            "question_code": question_code,
                            "role_slug": role_slug,
                            "section": section,
                            "topic": topic,
                            "difficulty": generated["difficulty"],
                            "question_text": prompt,
                            "options": options,
                            "correct_answer": generated["expected_answer"],
                            "keywords": [topic.lower(), role_name.lower(), section.lower()],
                            "marks": 5,
                            "active": True,
                            "updated_at": datetime.utcnow(),
                        },
                        "$setOnInsert": {
                            "created_at": datetime.utcnow(),
                            "assignment_count": 0,
                        },
                    },
                    upsert=True,
                )
                total += 1
    print(f"Seeded or updated {total} starter MongoDB questions.")
