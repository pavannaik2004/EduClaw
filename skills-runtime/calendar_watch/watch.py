"""
Calendar Watch — Deadline Prep-Coach
Reads course schedules and sends personalized deadline alerts.
"""

import os
import yaml
from pathlib import Path
from datetime import datetime, timedelta

import structlog

log = structlog.get_logger()


def get_upcoming_deadlines(
    course_id: str,
    lookahead_days: int = 3,
    memory_dir: str = "./data/memory",
) -> dict:
    """
    Check course schedule for upcoming assignments and exams.
    Returns dict with upcoming items and personalized recommendations.
    """
    schedule_path = Path(memory_dir) / "courses" / course_id / "schedule.yaml"
    if not schedule_path.exists():
        return {"items": [], "error": f"No schedule found for {course_id}"}

    with open(schedule_path) as f:
        schedule = yaml.safe_load(f)

    today = datetime.now().date()
    cutoff = today + timedelta(days=lookahead_days)
    upcoming = []

    # Check assignments
    for assignment in schedule.get("assignments", []):
        try:
            due_date = datetime.strptime(assignment["due_date"], "%Y-%m-%d").date()
            if today <= due_date <= cutoff:
                days_left = (due_date - today).days
                upcoming.append({
                    "type": "assignment",
                    "title": assignment["title"],
                    "due_date": assignment["due_date"],
                    "days_left": days_left,
                    "topic_ids": assignment.get("topic_ids", []),
                    "description": assignment.get("description", ""),
                    "urgency": "🔴" if days_left <= 1 else "🟡" if days_left <= 2 else "🟢",
                })
        except (ValueError, KeyError):
            continue

    # Check exams
    for exam in schedule.get("exams", []):
        try:
            exam_date = datetime.strptime(exam["date"], "%Y-%m-%d").date()
            if today <= exam_date <= cutoff:
                days_left = (exam_date - today).days
                upcoming.append({
                    "type": "exam",
                    "title": exam["title"],
                    "due_date": exam["date"],
                    "days_left": days_left,
                    "topic_ids": exam.get("topics", []),
                    "urgency": "🔴" if days_left <= 1 else "🟡" if days_left <= 2 else "🟢",
                })
        except (ValueError, KeyError):
            continue

    # Sort by urgency (days_left)
    upcoming.sort(key=lambda x: x["days_left"])

    return {"items": upcoming, "course_name": schedule.get("course_name", course_id)}


def get_student_weak_topics(
    student_id: str,
    memory_dir: str = "./data/memory",
) -> list[str]:
    """Get weak topics for a student from their profile."""
    from utils.yaml_io import read_yaml

    profile_path = Path(memory_dir) / "students" / f"{student_id}.yaml"
    profile = read_yaml(str(profile_path))
    if not profile:
        return []
    return profile.get("weak_topics", [])


def format_deadline_alert(deadlines: dict, weak_topics: list[str] = None) -> str:
    """Format deadline alerts as a Telegram message."""
    if not deadlines.get("items"):
        return None

    course = deadlines.get("course_name", "Your Course")
    lines = [f"📅 *Upcoming Deadlines — {course}*\n"]

    for item in deadlines["items"]:
        emoji = "📝" if item["type"] == "assignment" else "📋"
        lines.append(
            f"{item['urgency']} {emoji} *{item['title']}*\n"
            f"   Due: {item['due_date']} ({item['days_left']} day{'s' if item['days_left'] != 1 else ''} left)\n"
        )

        if item.get("description"):
            lines.append(f"   _{item['description']}_\n")

        # Check if any deadline topics overlap with weak topics
        if weak_topics:
            overlap = set(item.get("topic_ids", [])) & set(weak_topics)
            if overlap:
                lines.append(
                    f"   ⚠️ *Heads up:* You scored low on: {', '.join(overlap)}\n"
                    f"   💡 Review these topics before the deadline!\n"
                )

    lines.append("\n_Stay ahead! Use /quiz to practice weak topics._")
    return "\n".join(lines)


def check_all_students_deadlines(
    course_id: str,
    memory_dir: str = "./data/memory",
) -> list[dict]:
    """
    Check deadlines and generate personalized alerts for all students.
    Returns list of {student_id, message} dicts.
    """
    deadlines = get_upcoming_deadlines(course_id, memory_dir=memory_dir)
    if not deadlines.get("items"):
        return []

    students_dir = Path(memory_dir) / "students"
    alerts = []

    if students_dir.exists():
        for yaml_file in students_dir.glob("*.yaml"):
            with open(yaml_file) as f:
                profile = yaml.safe_load(f)

            if not profile or course_id not in profile.get("enrolled_courses", []):
                continue

            student_id = profile["student_id"]
            weak_topics = profile.get("weak_topics", [])
            message = format_deadline_alert(deadlines, weak_topics)

            if message:
                alerts.append({
                    "student_id": student_id,
                    "chat_id": student_id.replace("telegram_", ""),
                    "message": message,
                })

    log.info("deadline_alerts_generated", course_id=course_id, alert_count=len(alerts))
    return alerts
