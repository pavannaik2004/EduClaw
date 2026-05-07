"""
Quiz Generation Skill
Generates MCQ questions from course knowledge base content using OpenAI API.
"""

import yaml
import json
import re
import os
from pathlib import Path
from openai import OpenAI

import structlog

log = structlog.get_logger()

LLM_MODEL = os.getenv("LLM_MODEL", "gpt-4o-mini")
client = OpenAI()


def get_today_topic(course_id: str, today: str, memory_dir: str = "./data/memory") -> dict | None:
    """Get today's topic from course schedule."""
    schedule_path = Path(memory_dir) / "courses" / course_id / "schedule.yaml"
    if not schedule_path.exists():
        return None

    with open(schedule_path) as f:
        schedule = yaml.safe_load(f)

    for entry in schedule.get("schedule", []):
        if entry["date"] == today:
            return entry
    return None


def get_kb_chunks_for_topic(
    course_id: str, topic_id: str, memory_dir: str = "./data/memory"
) -> list[str]:
    """Retrieve knowledge base chunks for a specific topic."""
    kb_path = Path(memory_dir) / "courses" / course_id / "kb.yaml"
    if not kb_path.exists():
        return []

    with open(kb_path) as f:
        kb = yaml.safe_load(f)

    for topic in kb.get("topics", []):
        if topic["topic_id"] == topic_id:
            context_parts = topic.get("summary_points", []) + [
                c["text"] for c in topic.get("raw_chunks", [])[:3]
            ]
            return context_parts

    # If exact topic_id not found, try partial match
    for topic in kb.get("topics", []):
        if topic_id in topic["topic_id"] or topic["topic_id"] in topic_id:
            context_parts = topic.get("summary_points", []) + [
                c["text"] for c in topic.get("raw_chunks", [])[:3]
            ]
            return context_parts

    return []


def generate_quiz(topic_name: str, context_chunks: list[str], count: int = 3) -> list[dict]:
    """Generate MCQs using OpenAI API."""
    context = "\n\n".join(context_chunks)

    prompt = f"""Generate exactly {count} multiple-choice questions about "{topic_name}".

COURSE CONTENT:
{context}

REQUIREMENTS:
- Each question needs exactly 4 options (A, B, C, D)
- Exactly one correct answer
- Questions must be directly answerable from the content
- Difficulty: moderate

OUTPUT (valid JSON only, no markdown fences):
{{
  "questions": [
    {{
      "question": "...",
      "options": {{"A": "...", "B": "...", "C": "...", "D": "..."}},
      "correct": "A",
      "explanation": "..."
    }}
  ]
}}"""

    response = client.chat.completions.create(
        model=LLM_MODEL,
        messages=[
            {"role": "system", "content": "You are an academic quiz generator. Output valid JSON only."},
            {"role": "user", "content": prompt},
        ],
        max_tokens=1000,
        temperature=0.5,
    )

    raw = response.choices[0].message.content.strip()
    raw = re.sub(r"^```json\s*|```$", "", raw).strip()

    try:
        data = json.loads(raw)
        return data["questions"]
    except (json.JSONDecodeError, KeyError) as e:
        log.error("quiz_json_parse_error", error=str(e), raw=raw[:200])
        return [
            {
                "question": f"What is the main concept of {topic_name}?",
                "options": {
                    "A": "Option A",
                    "B": "Option B",
                    "C": "Option C",
                    "D": "Option D",
                },
                "correct": "A",
                "explanation": "Quiz generation encountered an error. Please try again.",
            }
        ]


def format_quiz_for_telegram(questions: list[dict]) -> list[dict]:
    """
    Format quiz questions for Telegram.
    Returns list of {text, options, correct_index, explanation}
    """
    formatted = []
    for q in questions:
        opts = [
            q["options"]["A"],
            q["options"]["B"],
            q["options"]["C"],
            q["options"]["D"],
        ]
        correct_letter = q["correct"]
        correct_idx = ord(correct_letter) - ord("A")

        formatted.append(
            {
                "text": q["question"],
                "options": opts,
                "correct_index": correct_idx,
                "explanation": q["explanation"],
            }
        )
    return formatted
