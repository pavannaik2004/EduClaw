# EduClaw — AI-Powered Academic Productivity Agent

> **Samsung PRISM OpenClaw — Clash of the Claws 2026**  
> **Theme 3:** Productivity Platforms  
> **Team:** EduClaw

---

## 🎯 Problem

Indian engineering students face:
1. **PDF Overload** — 60-page lecture PDFs with buried key concepts
2. **Instructor Blindspot** — No visibility into which topics confuse students
3. **Deadline Blindness** — Assignment calendars exist but students ignore them
4. **Passive Review** — No proactive revision or knowledge testing

## 💡 Solution

**EduClaw** is a proactive AI academic agent built on the **OpenClaw** framework. It:

- 📚 **Automatically summarizes** lecture PDFs into 5-point digests
- ❓ **Answers student doubts** using course-specific knowledge (with citations!)
- 📝 **Generates quizzes** as interactive Telegram polls from uploaded material
- 📅 **Alerts 3 days before deadlines** with personalised weak-topic warnings
- 📊 **Tracks student performance** with per-topic score breakdowns
- 📚 **Multi-course support** — switch between subjects, each with its own knowledge base

All via **Telegram** — zero app installation required. Fully navigable with inline buttons — no typing needed.

## 🏗️ Architecture

```
Students (Telegram) → Gateway (Node.js/TS) → Skills Runtime (Python/FastAPI)
                              ↓                         ↓
                     Inline Keyboards           OpenAI GPT-4o-mini
                     Menu Commands              (Summarize/Quiz/Answer)
                     PDF Upload                         ↓
                                              Cognitive RAM (YAML files)
                                              ├── courses/{id}/kb.yaml
                                              ├── courses/{id}/schedule.yaml
                                              └── students/{id}.yaml
```

## 🛠️ Tech Stack

| Component | Technology |
|-----------|-----------|
| Agent Framework | OpenClaw Base (Pi Engine, SOUL.md, HEARTBEAT.md) |
| Gateway | Node.js 22 / TypeScript (Telegram Bot API) |
| Skills Runtime | Python 3.12 / FastAPI |
| LLM | OpenAI GPT-4o-mini |
| Messaging | Telegram Bot API (polling mode) |
| Storage | YAML files (OpenClaw Cognitive RAM pattern) |
| Reports | python-docx |
| Deployment | Docker Compose (optional) / Local dev |

## 🚀 Quick Start

### Prerequisites
- Node.js ≥ 22 + pnpm
- Python 3.11+ + uv (or pip)
- Telegram Bot Token (from [@BotFather](https://t.me/BotFather))
- OpenAI API Key

### Setup

```bash
# 1. Clone
git clone https://github.com/pavannaik2004/EduClaw.git
cd EduClaw

# 2. Configure
cp .env.example .env
# Edit .env — add TELEGRAM_BOT_TOKEN and OPENAI_API_KEY

# 3. Install dependencies
cd gateway && pnpm install && cd ..
cd skills-runtime && uv venv && uv pip install -e . && cd ..

# 4. Seed demo data
python scripts/seed_demo_data.py

# 5. Run (two terminals)
# Terminal 1: Skills Runtime (Python)
cd skills-runtime && DATA_DIR=../data \
  OPENAI_API_KEY=<your-key> LLM_MODEL=gpt-4o-mini \
  .venv/bin/uvicorn main:app --host 0.0.0.0 --port 8001 --reload

# Terminal 2: Gateway (Telegram Bot)
cd gateway && cp ../.env .env && SKILLS_RUNTIME_PORT=8001 npx tsx src/index.ts
```

## 📱 Telegram Bot Commands

All commands are accessible from the ☰ menu button and as inline keyboard buttons:

| Command | Description |
|---------|-------------|
| `/start` | Welcome message with main menu buttons |
| `/help` | Show all commands |
| `/quiz` | Random topic quiz (3 MCQ polls) |
| `/quiz <topic_id>` | Quiz on a specific topic |
| `/topics` | List all topics — tap to quiz |
| `/courses` | List & switch active course |
| `/newcourse <name>` | Create a new course (e.g. `/newcourse Operating Systems`) |
| `/status` | Quiz scores, weak topics, doubt count |
| `/deadlines` | Upcoming assignments & exams with urgency indicators |
| Send a **PDF** | Auto-ingests into active course KB |
| Type a **question** | Doubt answering from course notes with citations |

### Interactive Inline Buttons

Every response includes tap-friendly buttons — no manual typing needed:
- **After `/start`:** Quiz Me · Topics · Status · Deadlines · Switch Course · Help
- **After a quiz:** Another Quiz · Pick Topic · My Status · Switch Course
- **After uploading a PDF:** Quiz this topic · Random Quiz · All Topics
- **After a doubt answer:** Quiz Me · More Topics

## 📂 Project Structure

```
EduClaw/
├── gateway/                    # Node.js/TypeScript — Telegram bot
│   └── src/
│       ├── index.ts            # Entry point
│       └── adapters/telegram.ts # Bot: commands, buttons, PDF upload
│
├── skills-runtime/             # Python 3.12 / FastAPI
│   ├── main.py                 # API: /health, /skill/* endpoints
│   ├── pdf_digest/             # PDF extraction + OpenAI summarization
│   ├── quiz_gen/               # MCQ generation from KB
│   ├── calendar_watch/         # Deadline alerts with weak-topic warnings
│   ├── instructor_report/      # Weekly .docx reports
│   └── utils/                  # Logger, YAML I/O, sanitizer
│
├── pi-engine/                  # OpenClaw config
│   ├── SOUL.md                 # Agent persona & safety rules
│   ├── HEARTBEAT.md            # Cron scheduler
│   └── skills/                 # 5 skill definitions
│
├── data/                       # Runtime data (gitignored)
│   ├── inbox/{course_id}/      # Uploaded PDFs
│   ├── memory/courses/{id}/    # kb.yaml + schedule.yaml per course
│   └── memory/students/{id}.yaml # Per-student profiles
│
├── scripts/seed_demo_data.py   # Seed test data
├── .env.example                # Environment template
├── context.md                  # Agent handoff document
└── AI_DISCLOSURE.md            # Required by hackathon
```

## 🤖 OpenClaw Integration

EduClaw extends OpenClaw Base with:
- **SOUL.md** — Academic assistant persona with safety constraints (refuses exam cheating)
- **HEARTBEAT.md** — Cron scheduler for proactive daily quizzes and deadline alerts
- **Cognitive RAM** — Per-student YAML profiles tracking quiz scores, doubts, and weak topics
- **5 Custom Skills** — PDF digest, quiz generation, doubt answering, calendar watch, instructor report

## 🔑 Key Features

### Multi-Course Support
- Create courses: `/newcourse Data Structures`
- Switch active course: `/courses` → tap to switch
- Each course has its own KB, schedule, and inbox folder
- PDFs, quizzes, and doubts are all scoped to the active course

### Smart Doubt Answering
- Score-based topic matching (not naive keyword fallback)
- Returns "not in course notes" for unrelated questions
- Cites source PDF in every answer
- Logs doubts to student profile for weak-topic tracking

### PDF Ingestion Pipeline
- Upload PDF → extract text (PyMuPDF) → chunk (512 words) → summarize (OpenAI) → append to KB
- Deduplication: same PDF won't be re-ingested
- Works via Telegram file upload or folder watcher

## 👥 Team

- Pavan Naik
- Sumanth Hegde

## 📄 License

MIT License — See [LICENSE](LICENSE) for details.
