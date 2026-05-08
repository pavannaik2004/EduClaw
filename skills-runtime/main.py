"""
EduClaw Skills Runtime — FastAPI Application
Exposes skill endpoints for the Gateway to call.
"""

import os
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv

from utils.logger import setup_logging

load_dotenv()
setup_logging()

DATA_DIR = os.getenv("DATA_DIR", "./data")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Ensure data directories exist on startup."""
    dirs = [
        f"{DATA_DIR}/inbox",
        f"{DATA_DIR}/memory/courses",
        f"{DATA_DIR}/memory/students",
        f"{DATA_DIR}/reports",
        f"{DATA_DIR}/logs",
    ]
    for d in dirs:
        Path(d).mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(
    title="EduClaw Skills Runtime",
    description="Python skill execution engine for EduClaw academic agent",
    version="1.0.0",
    lifespan=lifespan,
)


# ── Request/Response Models ──────────────────────────────────────────────────


class PDFDigestRequest(BaseModel):
    course_id: str
    pdf_path: str
    topic_name: str


class PDFDigestResponse(BaseModel):
    success: bool
    topic_id: str | None = None
    summary_points: list[str] | None = None
    topic_tags: list[str] | None = None
    error: str | None = None


class QuizGenRequest(BaseModel):
    course_id: str
    topic_id: str = "random"  # "random" picks a random topic from KB
    count: int = 3
    student_ids: list[str] | None = None


class QuizQuestion(BaseModel):
    question: str
    options: list[str]
    correct_index: int
    explanation: str


class QuizGenResponse(BaseModel):
    success: bool
    questions: list[QuizQuestion] | None = None
    error: str | None = None


class DoubtRequest(BaseModel):
    student_id: str
    course_id: str
    question: str


class DoubtResponse(BaseModel):
    success: bool
    answer: str | None = None
    source: str | None = None
    error: str | None = None


class ReportRequest(BaseModel):
    course_id: str
    instructor_email: str
    period: str = "last_7_days"


class ReportResponse(BaseModel):
    success: bool
    report_path: str | None = None
    email_sent: bool = False
    error: str | None = None


# ── Endpoints ────────────────────────────────────────────────────────────────


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "educlaw-skills-runtime"}


@app.post("/skill/pdf_digest", response_model=PDFDigestResponse)
async def pdf_digest(req: PDFDigestRequest):
    """Ingest a PDF: extract text, chunk, summarize, write to KB."""
    try:
        from pdf_digest.ingest import ingest_pdf

        result = ingest_pdf(req.pdf_path, req.course_id, req.topic_name, DATA_DIR)
        if result["success"]:
            return PDFDigestResponse(
                success=True,
                topic_id=result["topic_id"],
                summary_points=result["summary"].get("summary_points", []),
                topic_tags=result["summary"].get("topic_tags", []),
            )
        else:
            return PDFDigestResponse(success=False, error=result.get("error", "Unknown error"))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/skill/quiz_gen", response_model=QuizGenResponse)
async def quiz_gen(req: QuizGenRequest):
    """Generate MCQ quiz questions from course KB."""
    try:
        import random
        from quiz_gen.generate import get_kb_chunks_for_topic, generate_quiz, format_quiz_for_telegram
        from pdf_digest.ingest import get_kb_for_course

        topic_id = req.topic_id
        topic_name = topic_id

        # If "random", pick a random topic from the KB
        if topic_id == "random":
            kb = get_kb_for_course(req.course_id, f"{DATA_DIR}/memory")
            if kb and kb.get("topics"):
                chosen = random.choice(kb["topics"])
                topic_id = chosen["topic_id"]
                topic_name = chosen.get("topic_name", topic_id)
            else:
                return QuizGenResponse(success=False, error="No course material uploaded yet. Send me a PDF first!")

        chunks = get_kb_chunks_for_topic(req.course_id, topic_id, f"{DATA_DIR}/memory")
        if not chunks:
            return QuizGenResponse(success=False, error=f"No KB content found for topic '{topic_id}'. Use /topics to see available topics.")

        questions = generate_quiz(topic_name, chunks, req.count)
        formatted = format_quiz_for_telegram(questions)

        return QuizGenResponse(
            success=True,
            questions=[
                QuizQuestion(
                    question=q["text"],
                    options=q["options"],
                    correct_index=q["correct_index"],
                    explanation=q["explanation"],
                )
                for q in formatted
            ],
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/skill/doubt", response_model=DoubtResponse)
async def answer_doubt(req: DoubtRequest):
    """Answer a student's doubt using course KB."""
    try:
        from pdf_digest.ingest import get_kb_for_course
        from utils.sanitise import sanitise_user_input

        sanitised_question = sanitise_user_input(req.question)
        if sanitised_question.startswith("[Message filtered"):
            return DoubtResponse(success=False, error="Message contained disallowed content")

        # Retrieve relevant chunks from KB
        kb = get_kb_for_course(req.course_id, f"{DATA_DIR}/memory")
        if not kb:
            return DoubtResponse(
                success=False,
                error=f"No course material uploaded yet for {req.course_id}",
            )

        # Find relevant chunks by keyword matching — score each topic
        question_words = set(sanitised_question.lower().split())
        # Remove common stop words so they don't inflate scores
        stop_words = {"what", "is", "are", "the", "a", "an", "how", "does", "do", "why",
                      "when", "where", "who", "which", "tell", "me", "about", "explain"}
        content_words = question_words - stop_words

        best_chunks = []
        source_file = "Unknown"
        best_score = 0

        for topic in kb.get("topics", []):
            topic_tags = set(tag.lower() for tag in topic.get("topic_tags", []))
            key_terms = set(k.lower() for k in topic.get("key_terms", {}).keys())
            topic_name_words = set(topic.get("topic_name", "").lower().split())
            raw_text = " ".join(
                chunk["text"] for chunk in topic.get("raw_chunks", [])[:3]
            ).lower()

            # Score: keyword overlap + raw text mentions
            overlap = content_words & (topic_tags | key_terms | topic_name_words)
            raw_hits = sum(1 for w in content_words if w in raw_text)
            score = len(overlap) * 2 + raw_hits

            if score > best_score:
                best_score = score
                best_chunks = topic.get("summary_points", []) + [
                    chunk["text"] for chunk in topic.get("raw_chunks", [])[:3]
                ]
                source_file = topic.get("source_file", "Unknown")

        # If no topic scored at all, return early — don't hallucinate with unrelated content
        if best_score == 0:
            return DoubtResponse(
                success=True,
                answer=(
                    f"I don't have information about that in the {req.course_id.replace('_', ' ').title()} course notes. "
                    "Try asking about a topic covered in your uploaded lecture PDFs, "
                    "or upload the relevant PDF first so I can learn from it!"
                ),
                source="N/A",
            )

        relevant_chunks = best_chunks

        # Call OpenAI API for answer
        from openai import OpenAI

        llm_model = os.getenv("LLM_MODEL", "gpt-4o-mini")
        client = OpenAI()
        context = "\n".join(relevant_chunks[:10])

        response = client.chat.completions.create(
            model=llm_model,
            messages=[
                {
                    "role": "system",
                    "content": f"You are EduClaw, an academic assistant for {req.course_id.replace('_', ' ').title()}. Answer ONLY based on the course material provided. If the answer is not in the material, say: \"I don't have that in the course notes.\" Maximum 4 sentences. End with source citation.",
                },
                {
                    "role": "user",
                    "content": f"COURSE MATERIAL:\n{context}\n\nSTUDENT QUESTION:\n{sanitised_question}\n\nEnd your answer with: \"Source: {source_file}\"",
                },
            ],
            max_tokens=300,
            temperature=0.3,
        )

        answer = response.choices[0].message.content.strip()

        # Log doubt to student profile
        from utils.yaml_io import append_doubt_log

        append_doubt_log(
            req.student_id,
            req.course_id,
            sanitised_question,
            f"{DATA_DIR}/memory",
        )

        return DoubtResponse(success=True, answer=answer, source=source_file)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/skill/instructor_report", response_model=ReportResponse)
async def instructor_report(req: ReportRequest):
    """Generate weekly instructor analytics report."""
    try:
        from instructor_report.generate_docx import generate_weekly_report

        report_path = generate_weekly_report(
            req.course_id,
            req.instructor_email,
            memory_dir=f"{DATA_DIR}/memory",
            output_dir=f"{DATA_DIR}/reports",
        )
        return ReportResponse(success=True, report_path=report_path, email_sent=False)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class DeadlineRequest(BaseModel):
    course_id: str
    student_id: str | None = None


class DeadlineResponse(BaseModel):
    success: bool
    message: str | None = None
    item_count: int = 0
    error: str | None = None


@app.post("/skill/deadlines", response_model=DeadlineResponse)
async def check_deadlines(req: DeadlineRequest):
    """Check upcoming deadlines for a course."""
    try:
        from calendar_watch.watch import get_upcoming_deadlines, format_deadline_alert, get_student_weak_topics

        deadlines = get_upcoming_deadlines(req.course_id, memory_dir=f"{DATA_DIR}/memory")
        weak_topics = []
        if req.student_id:
            weak_topics = get_student_weak_topics(req.student_id, memory_dir=f"{DATA_DIR}/memory")

        message = format_deadline_alert(deadlines, weak_topics)
        if message:
            return DeadlineResponse(success=True, message=message, item_count=len(deadlines["items"]))
        else:
            return DeadlineResponse(success=True, message="🎉 No upcoming deadlines in the next 3 days!", item_count=0)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class StudentStatusRequest(BaseModel):
    student_id: str
    course_id: str


class StudentStatusResponse(BaseModel):
    success: bool
    status_message: str | None = None
    error: str | None = None


@app.post("/skill/student_status", response_model=StudentStatusResponse)
async def student_status(req: StudentStatusRequest):
    """Get detailed student status with quiz scores and weak topics."""
    try:
        from utils.yaml_io import read_yaml
        profile_path = f"{DATA_DIR}/memory/students/{req.student_id}.yaml"
        profile = read_yaml(profile_path)

        if not profile:
            return StudentStatusResponse(
                success=True,
                status_message=(
                    "📊 *Your EduClaw Status*\n\n"
                    "You're not registered yet!\n"
                    "Send any question to get started."
                ),
            )

        name = profile.get("name", "Student")
        courses = profile.get("enrolled_courses", [])
        quiz_scores = profile.get("quiz_scores", {}).get(req.course_id, {})
        weak_topics = profile.get("weak_topics", [])
        doubt_count = len([d for d in profile.get("doubt_log", []) if d.get("course") == req.course_id])

        # Compute per-topic averages
        topic_lines = []
        total_scores = []
        for topic, scores in quiz_scores.items():
            avg = sum(scores) / len(scores) if scores else 0
            total_scores.extend(scores)
            emoji = "🟢" if avg >= 70 else "🟡" if avg >= 50 else "🔴"
            topic_lines.append(f"   {emoji} {topic.replace('_', ' ').title()}: {avg:.0f}% ({len(scores)} quizzes)")

        overall_avg = sum(total_scores) / len(total_scores) if total_scores else 0

        msg = f"📊 *EduClaw Status — {name}*\n\n"
        msg += f"📚 Course: {req.course_id.replace('_', ' ').title()}\n"
        msg += f"✅ Subscription: Active\n"
        msg += f"❓ Doubts asked: {doubt_count}\n"
        msg += f"📝 Overall quiz avg: {overall_avg:.0f}%\n\n"

        if topic_lines:
            msg += "*Quiz Scores by Topic:*\n"
            msg += "\n".join(topic_lines)
            msg += "\n"

        if weak_topics:
            msg += f"\n⚠️ *Weak topics:* {', '.join(t.replace('_', ' ').title() for t in weak_topics)}\n"
            msg += "💡 Use `/quiz` to practice these!\n"

        return StudentStatusResponse(success=True, status_message=msg)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/skill/topics/{course_id}")
async def list_topics(course_id: str):
    """List all available topics in a course KB."""
    try:
        from pdf_digest.ingest import get_kb_for_course

        kb = get_kb_for_course(course_id, f"{DATA_DIR}/memory")
        if not kb or not kb.get("topics"):
            return {"success": False, "topics": [], "error": "No topics found. Upload a PDF first!"}

        topics = [
            {
                "topic_id": t["topic_id"],
                "topic_name": t.get("topic_name", t["topic_id"]),
                "source_file": t.get("source_file", "Unknown"),
                "summary_count": len(t.get("summary_points", [])),
                "chunk_count": len(t.get("raw_chunks", [])),
            }
            for t in kb["topics"]
        ]
        return {"success": True, "topics": topics, "count": len(topics)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/skill/courses")
async def list_courses():
    """List all courses that have a KB or schedule YAML."""
    try:
        courses_dir = Path(f"{DATA_DIR}/memory/courses")
        if not courses_dir.exists():
            return {"success": True, "courses": []}

        courses = []
        for course_dir in sorted(courses_dir.iterdir()):
            if not course_dir.is_dir():
                continue
            kb_path = course_dir / "kb.yaml"
            sched_path = course_dir / "schedule.yaml"

            topic_count = 0
            course_name = course_dir.name
            if kb_path.exists():
                import yaml
                with open(kb_path) as f:
                    kb = yaml.safe_load(f)
                if kb:
                    topic_count = len(kb.get("topics", []))
                    course_name = kb.get("course_name", course_dir.name)

            courses.append({
                "course_id": course_dir.name,
                "course_name": course_name,
                "topic_count": topic_count,
                "has_schedule": sched_path.exists(),
            })

        return {"success": True, "courses": courses, "count": len(courses)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class CreateCourseRequest(BaseModel):
    course_id: str       # slug like "os_2024" or "dsa_sem4"
    course_name: str     # human name like "Operating Systems"


@app.post("/skill/create_course")
async def create_course(req: CreateCourseRequest):
    """Create a new course folder with an empty KB. Idempotent."""
    try:
        import yaml
        from datetime import datetime

        course_dir = Path(f"{DATA_DIR}/memory/courses/{req.course_id}")
        course_dir.mkdir(parents=True, exist_ok=True)

        kb_path = course_dir / "kb.yaml"
        if not kb_path.exists():
            kb = {
                "course_id": req.course_id,
                "course_name": req.course_name,
                "created_at": datetime.utcnow().isoformat(),
                "topics": [],
            }
            with open(kb_path, "w") as f:
                yaml.dump(kb, f, default_flow_style=False, allow_unicode=True, sort_keys=False)

        inbox_dir = Path(f"{DATA_DIR}/inbox/{req.course_id}")
        inbox_dir.mkdir(parents=True, exist_ok=True)

        return {"success": True, "course_id": req.course_id, "course_name": req.course_name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class SetActiveCourseRequest(BaseModel):
    student_id: str
    course_id: str


@app.post("/skill/set_active_course")
async def set_active_course(req: SetActiveCourseRequest):
    """Set the student's currently active course."""
    try:
        from utils.yaml_io import read_yaml, write_yaml

        profile_path = Path(f"{DATA_DIR}/memory/students/{req.student_id}.yaml")
        profile = read_yaml(str(profile_path)) or {
            "student_id": req.student_id,
            "name": "Unknown",
            "enrolled_courses": [],
            "quiz_scores": {},
            "doubt_log": [],
            "weak_topics": [],
            "subscription_active": True,
        }

        profile["active_course"] = req.course_id
        if req.course_id not in profile.get("enrolled_courses", []):
            profile.setdefault("enrolled_courses", []).append(req.course_id)

        write_yaml(str(profile_path), profile)
        return {"success": True, "active_course": req.course_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/skill/active_course/{student_id}")
async def get_active_course(student_id: str):
    """Get the student's currently active course."""
    try:
        from utils.yaml_io import read_yaml

        profile_path = Path(f"{DATA_DIR}/memory/students/{student_id}.yaml")
        profile = read_yaml(str(profile_path))

        if not profile:
            return {"success": True, "active_course": "networks_2024"}  # default fallback

        active = profile.get("active_course") or (
            profile.get("enrolled_courses", ["networks_2024"])[0]
        )
        return {"success": True, "active_course": active}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("SKILLS_RUNTIME_PORT", "8001")))


