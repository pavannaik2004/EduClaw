"""
Atomic YAML read/write helpers.
All writes use tmp+rename pattern to prevent corruption.
"""

import yaml
from pathlib import Path
from datetime import datetime
from typing import Any

import structlog

log = structlog.get_logger()


def read_yaml(path: str | Path) -> dict | None:
    """Safely read a YAML file. Returns None if file doesn't exist or is empty."""
    path = Path(path)
    if not path.exists():
        return None
    try:
        with open(path) as f:
            data = yaml.safe_load(f)
        return data if data else None
    except yaml.YAMLError as e:
        log.error("yaml_read_error", path=str(path), error=str(e))
        return None


def write_yaml(path: str | Path, data: dict) -> None:
    """
    Atomically write data to a YAML file.
    Uses tmp+rename pattern to prevent corruption from crashes.
    """
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)

    tmp_path = path.with_suffix(".yaml.tmp")
    with open(tmp_path, "w") as f:
        yaml.dump(data, f, default_flow_style=False, allow_unicode=True, sort_keys=False)
    tmp_path.rename(path)

    log.info("yaml_written", path=str(path))


def append_doubt_log(
    student_id: str,
    course_id: str,
    question: str,
    memory_dir: str = "./data/memory",
) -> None:
    """Append a doubt entry to a student's profile."""
    profile_path = Path(memory_dir) / "students" / f"{student_id}.yaml"

    profile = read_yaml(profile_path) or {
        "student_id": student_id,
        "name": "Unknown",
        "enrolled_courses": [course_id],
        "quiz_scores": {},
        "doubt_log": [],
        "weak_topics": [],
        "subscription_active": True,
        "onboarded_at": datetime.utcnow().isoformat(),
        "last_interaction": datetime.utcnow().isoformat(),
    }

    profile.setdefault("doubt_log", []).append(
        {
            "date": datetime.utcnow().strftime("%Y-%m-%d"),
            "course": course_id,
            "question": question,
            "answered": True,
        }
    )
    profile["last_interaction"] = datetime.utcnow().isoformat()

    write_yaml(profile_path, profile)
    log.info("doubt_logged", student_id=student_id, course_id=course_id)


def update_quiz_score(
    student_id: str,
    course_id: str,
    topic_id: str,
    score: int,
    memory_dir: str = "./data/memory",
) -> None:
    """Append a quiz score to a student's profile."""
    profile_path = Path(memory_dir) / "students" / f"{student_id}.yaml"

    profile = read_yaml(profile_path) or {
        "student_id": student_id,
        "name": "Unknown",
        "enrolled_courses": [course_id],
        "quiz_scores": {},
        "doubt_log": [],
        "weak_topics": [],
        "subscription_active": True,
        "onboarded_at": datetime.utcnow().isoformat(),
        "last_interaction": datetime.utcnow().isoformat(),
    }

    profile.setdefault("quiz_scores", {}).setdefault(course_id, {}).setdefault(
        topic_id, []
    ).append(score)
    profile["last_interaction"] = datetime.utcnow().isoformat()

    # Recompute weak topics (avg score < 60%)
    weak = []
    for cid, topics in profile.get("quiz_scores", {}).items():
        for tid, scores in topics.items():
            if scores and sum(scores) / len(scores) < 60:
                weak.append(tid)
    profile["weak_topics"] = weak

    write_yaml(profile_path, profile)
    log.info("quiz_score_updated", student_id=student_id, topic_id=topic_id, score=score)


def create_student_profile(
    student_id: str,
    name: str,
    roll_number: str,
    courses: list[str],
    memory_dir: str = "./data/memory",
) -> dict:
    """Create a new student profile YAML."""
    profile = {
        "student_id": student_id,
        "name": name,
        "roll_number": roll_number,
        "enrolled_courses": courses,
        "quiz_scores": {},
        "doubt_log": [],
        "weak_topics": [],
        "subscription_active": True,
        "onboarded_at": datetime.utcnow().isoformat(),
        "last_interaction": datetime.utcnow().isoformat(),
    }

    profile_path = Path(memory_dir) / "students" / f"{student_id}.yaml"
    write_yaml(profile_path, profile)
    log.info("student_created", student_id=student_id, name=name)
    return profile
