# EduClaw — Project Context & Progress Tracker

> **Last Updated:** 2026-05-08 13:30 IST  
> **Machine:** Pavan's ASUS VivoBook (Linux/Ubuntu)  
> **Hackathon Deadline:** 8 May 2026 EOD  
> **GitHub:** github.com/pavannaik2004/EduClaw  
> **Agent Handoff Doc:** Any AI agent can read this file and continue from where the last left off.

---

## 1. Hardware Specs

| Component | Detail |
|-----------|--------|
| **CPU** | AMD Ryzen 5 5600H with Radeon Graphics (6 cores / 12 threads) |
| **RAM** | 16 GB (15Gi total, ~10Gi available) |
| **GPU** | NO dedicated GPU — integrated Radeon only |
| **Disk** | 99 GB NVMe, 48 GB free |
| **OS** | Ubuntu (kernel-based, apt package manager) |
| **Swap** | 4 GB |

### Hardware Impact on Project Decisions

- ❌ **Cannot run local LLMs** (no dedicated GPU)
- ✅ **Use OpenAI API** for all LLM tasks
- ✅ **Skip the Ollama container** in docker-compose
- ✅ **Node.js + Python dev is comfortable** on this hardware

---

## 2. Software Installed

| Tool | Status | Version |
|------|--------|---------|
| Git | ✅ Installed | 2.43.0 |
| Python | ✅ Installed | 3.12.3 |
| Docker | ✅ Installed | 29.4.3 |
| Docker Compose | ✅ Installed | (via docker-compose-plugin) |
| Node.js | ✅ Installed | v22.22.2 |
| pnpm | ✅ Installed | 11.0.8 |
| uv (Python pkg mgr) | ✅ Installed | 0.11.11 (at ~/.local/bin/uv) |

> **PATH NOTE:** `uv` is at `~/.local/bin/uv`. Always run: `export PATH="$HOME/.local/bin:$PATH"` first.

---

## 3. API Keys & LLM

| Service | Status | Notes |
|---------|--------|-------|
| **Telegram Bot Token** | ✅ Configured | In `.env` |
| **OpenAI API Key** | ✅ Configured | In `.env` — using `gpt-4o-mini` model |
| **LLM Provider** | **OpenAI** (NOT Anthropic) | Code was adapted from Anthropic to OpenAI |
| **LLM Model** | `gpt-4o-mini` | Set in `.env` as `LLM_MODEL` |

> **IMPORTANT:** Original Master Document references Anthropic Claude. **ALL code has been rewritten to use OpenAI API instead.** Do NOT switch back without updating `pdf_digest/ingest.py`, `quiz_gen/generate.py`, and `main.py`.

---

## 4. Architecture

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

- **Gateway:** Node.js 22/TypeScript — Telegram bot with polling, inline keyboards, menu commands
- **Skills Runtime:** Python 3.12/FastAPI — exposes `/skill/*` endpoints
- **LLM:** OpenAI `gpt-4o-mini` via `openai` Python SDK
- **Memory:** YAML files (Cognitive RAM pattern) — one folder per course, one file per student
- **SOUL.md:** Defines agent persona, constraints, response format
- **HEARTBEAT.md:** Cron-like scheduler for proactive actions

---

## 5. Project Structure

```
/home/pavan/Educlaw/
├── EduClaw_Master_Document.md     # Reference doc (DO NOT MODIFY)
├── context.md                      # THIS FILE — agent handoff
├── README.md                       # Hackathon submission README
├── AI_DISCLOSURE.md                # Required by hackathon
├── .env / .env.example             # API keys (NEVER COMMIT .env)
├── .gitignore
├── docker-compose.yml
│
├── gateway/                        # Node.js 22 / TypeScript
│   ├── package.json / pnpm-lock.yaml
│   └── src/
│       ├── index.ts                # Entry point — starts Telegram bot
│       ├── adapters/telegram.ts    # Bot: all commands, buttons, PDF upload
│       └── types/MessageEnvelope.ts
│
├── pi-engine/                      # OpenClaw config
│   ├── SOUL.md / HEARTBEAT.md
│   └── skills/                     # 5 skill definitions
│
├── skills-runtime/                 # Python 3.12 / FastAPI
│   ├── pyproject.toml
│   ├── .venv/                      # Python venv (uv created)
│   ├── main.py                     # FastAPI: /health, /skill/* (17 endpoints)
│   ├── utils/                      # logger.py, sanitise.py, yaml_io.py
│   ├── pdf_digest/
│   │   ├── ingest.py               # PDF → text → chunks → summarise → YAML KB
│   │   └── watcher.py              # Folder watcher (watchdog)
│   ├── quiz_gen/generate.py        # KB → MCQ questions via OpenAI
│   ├── calendar_watch/watch.py     # Deadline alerts with weak-topic warnings
│   ├── instructor_report/generate_docx.py
│   └── meeting_scribe/
│
├── scripts/seed_demo_data.py       # Creates sample course + 5 students
│
└── data/                           # Runtime data (gitignored)
    ├── inbox/{course_id}/          # Uploaded PDFs per course
    ├── memory/courses/{course_id}/ # kb.yaml + schedule.yaml per course
    ├── memory/students/            # Per-student YAML profiles
    ├── reports/
    └── logs/
```

---

## 6. How to Run (Quick Resume)

```bash
cd /home/pavan/Educlaw
export PATH="$HOME/.local/bin:$PATH"

# Terminal 1: Skills Runtime (Python)
cd skills-runtime && DATA_DIR=../data \
  OPENAI_API_KEY=$(grep OPENAI_API_KEY ../.env | cut -d= -f2) \
  LLM_MODEL=gpt-4o-mini \
  .venv/bin/uvicorn main:app --host 0.0.0.0 --port 8001 --reload

# Terminal 2: Gateway (Telegram Bot)
cd gateway && cp ../.env .env && SKILLS_RUNTIME_PORT=8001 npx tsx src/index.ts
```

> ⚠️ **IMPORTANT:** Only run ONE gateway instance at a time! Multiple instances cause Telegram "409 Conflict" errors where commands randomly stop working. Always `pkill -f "tsx src/index"` before starting a new one.

---

## 7. Skills Runtime API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Health check |
| `/skill/pdf_digest` | POST | Ingest PDF → extract → chunk → summarize → KB |
| `/skill/quiz_gen` | POST | Generate MCQ quiz (supports `topic_id: "random"`) |
| `/skill/doubt` | POST | Answer question from course KB with citations |
| `/skill/deadlines` | POST | Check upcoming deadlines with urgency indicators |
| `/skill/student_status` | POST | Quiz scores, weak topics, doubt count |
| `/skill/instructor_report` | POST | Generate weekly .docx report |
| `/skill/topics/{course_id}` | GET | List all topics in a course KB |
| `/skill/courses` | GET | List all courses |
| `/skill/create_course` | POST | Create new course folder with empty KB |
| `/skill/set_active_course` | POST | Set student's active course |
| `/skill/active_course/{student_id}` | GET | Get student's active course |

---

## 8. Telegram Bot Commands & UX

All commands registered in ☰ menu via `setMyCommands`:

| Command | Description |
|---------|-------------|
| `/start` | Welcome with main menu buttons |
| `/help` | All commands |
| `/quiz` | Random topic quiz (3 MCQ polls) |
| `/quiz <topic_id>` | Quiz on specific topic |
| `/topics` | List topics — tap to quiz |
| `/courses` | List & switch active course |
| `/newcourse <name>` | Create course (e.g. `/newcourse Operating Systems`) |
| `/status` | Quiz scores, weak topics |
| `/deadlines` | Upcoming assignments/exams |
| Send **PDF** | Auto-ingests into active course KB |
| Type **question** | Doubt answering with citations |

### Inline Keyboard Buttons
Every response has tap-friendly buttons — zero manual typing needed:
- **Main menu:** Quiz Me · Topics · Status · Deadlines · Switch Course · Help
- **After quiz:** Another Quiz · Pick Topic · Status · Switch Course
- **After PDF upload:** Quiz this topic · Random Quiz · All Topics · Courses
- **After doubt answer:** Quiz Me · More Topics
- **Topic list:** One button per topic → tap to quiz + Random button
- **Course list:** One button per course → tap to switch + Add New Course

---

## 9. Multi-Course System

### How it works:
- Each user has an `active_course` field in their YAML profile
- All quiz/doubt/status/deadlines use the active course automatically
- `/courses` shows all courses, tap to switch
- `/newcourse <name>` creates `data/memory/courses/{slug}/kb.yaml`
- PDF uploads go to the active course's KB

### Data structure:
```
data/memory/courses/
  networks_2024/          ← created by seed script
    kb.yaml               ← 4 topics (tcp_ip, scrum, gen_ai, cc_exp2)
    schedule.yaml         ← seeded assignments/exams
  operating_systems_2026/ ← created by /newcourse
    kb.yaml               ← grows as PDFs uploaded
```

### How `kb.yaml` updates:
- **Upload PDF via Telegram** → downloads → PyMuPDF extracts text → 512-word chunks → OpenAI summarizes → new topic appended to `kb.yaml`
- **Deduplication:** same topic_id won't be re-ingested
- **schedule.yaml** is currently static (seeded data only) — no bot flow to add deadlines yet

---

## 10. Known Bugs & Fixes Applied

| Bug | Fix | Date |
|-----|-----|------|
| Doubt answering always returned TCP/IP for any question | Score-based topic matching with stop-word removal; returns "not in notes" when score=0 | May 7 |
| PDF upload success message broke Telegram markdown | Strip `_*[]` chars from dynamic content before sending | May 7 |
| `/quiz` always generated TCP/IP questions | `topic_id: "random"` picks randomly from ALL KB topics | May 8 |
| Multiple bot instances caused 409 Conflict | Kill all `tsx` processes before starting; only run ONE gateway | May 8 |
| `/courses` command didn't work from menu | Anchored all regexes with `^`; wrapped handlers in `safe()` try-catch | May 8 |
| `/newcourse` name input treated as doubt | Replaced fragile multi-step Map flow with single-step `/newcourse <name>` | May 8 |
| LLM model typo `gpt-5-mini` | Fixed to `gpt-4o-mini` | May 7 |

---

## 11. Execution Progress

### Phase 0 — Environment Setup ✅
- [x] All tools installed (Node.js 22, Python 3.12, pnpm, uv, Docker)
- [x] Telegram bot created, OpenAI key configured
- [x] Project scaffolded, dependencies installed
- [x] All code adapted from Anthropic to OpenAI
- [x] Demo data seeded (1 course, 5 students)
- [x] Both services start and work
- [x] Git repo initialized and pushed to GitHub

### Phase 1 — PDF Ingestion ✅
- [x] PyMuPDF + pdfplumber extraction
- [x] 512-word chunking with overlap
- [x] OpenAI summarization (5 points + key terms + formulas + tags)
- [x] YAML KB writer with atomic writes
- [x] Folder watcher (watchdog)
- [x] Telegram PDF upload → auto-ingest
- [x] Confirmed: 4 topics ingested into kb.yaml

### Phase 2 — Doubt Answering ✅
- [x] Score-based KB retrieval (not naive fallback)
- [x] OpenAI prompt with course context + citations
- [x] Doubt logging to student Cognitive RAM
- [x] Rejects off-topic questions cleanly

### Phase 3 — Quiz System ✅
- [x] MCQ generation via OpenAI
- [x] Telegram poll delivery
- [x] Random topic + specific topic + topic picker
- [x] `/skill/topics/{course_id}` API endpoint
- [ ] Answer collection + score logging to student profile

### Phase 4 — Deadline Prep-Coach ✅
- [x] 3-day lookahead from schedule.yaml
- [x] Weak-topic warnings
- [x] `/deadlines` and `/status` commands

### Phase 5 — Instructor Report (Partial)
- [x] `generate_docx.py` implemented
- [ ] Email delivery (SendGrid/SMTP)
- [ ] HEARTBEAT trigger

### Phase 6 — UX & Multi-Course ✅
- [x] Bot menu commands (`setMyCommands`)
- [x] Inline keyboard buttons on every response
- [x] Multi-course: create, switch, per-user active course
- [x] Single-step `/newcourse <name>`
- [x] All handlers wrapped in `safe()` try-catch
- [x] All regexes anchored with `^`

### Phase 7 — Documentation & Submission
- [x] README.md updated (correct tech stack, commands, setup)
- [x] AI_DISCLOSURE.md updated (OpenAI, not Anthropic)
- [x] context.md maintained as agent handoff doc
- [x] GitHub pushed — github.com/pavannaik2004/EduClaw
- [ ] Record demo video (10 minutes)
- [ ] Submit via Google Form

---

## 12. Key Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Skip Ollama/local LLM | ✅ | No dedicated GPU |
| Use **OpenAI** (not Anthropic) | ✅ | User had OpenAI key |
| LLM Model: `gpt-4o-mini` | ✅ | Cost-efficient, fast, good JSON |
| Python 3.12 | ✅ | Already installed |
| Telegram-only (skip WhatsApp) | ✅ | Demo reliability |
| No vector DB — YAML search | ✅ | Sufficient for MVP |
| Run locally (no Docker) for dev | ✅ | Faster iteration |
| Single-step `/newcourse` (not multi-step) | ✅ | Fragile in-memory state broke |
| Score-based KB matching (not fallback) | ✅ | Prevents off-topic TCP/IP answers |

---

## 13. Agent Handoff Notes

> **For the next AI agent continuing this project:**
> 
> 1. **Read this file first.** It has everything you need.
> 2. Check the progress checklist in Section 11 to see what's done.
> 3. Master Document: `/home/pavan/Educlaw/EduClaw_Master_Document.md`
> 4. **LLM is OpenAI, NOT Anthropic.** All code uses `openai` Python SDK.
> 5. The user's machine has NO dedicated GPU — skip all local LLM/Ollama stuff.
> 6. Python venv: `/home/pavan/Educlaw/skills-runtime/.venv/`
> 7. uv: `~/.local/bin/uv` — add to PATH first.
> 8. The deadline is **8 May 2026 EOD**.
> 9. Focus on Telegram-only (skip WhatsApp/Discord).
> 10. Data lives at `/home/pavan/Educlaw/data/` (not inside skills-runtime/).
> 11. The user (Pavan) is a 3rd-year CSE student. Team: Pavan Naik + Sumanth Hegde.
> 12. **ONLY run ONE gateway instance.** Multiple instances cause 409 Conflict.
> 13. The gateway `telegram.ts` has `safe()` wrappers — check terminal for "Handler error:" logs.
> 14. `kb.yaml` and `schedule.yaml` are per-course at `data/memory/courses/{course_id}/`.
> 15. Each student YAML has `active_course` field — all commands use it dynamically.
> 16. `/newcourse` is single-step: `/newcourse Operating Systems` (no multi-step flow).
> 17. README.md and AI_DISCLOSURE.md are up-to-date and pushed.

---

*This document is the single source of truth for project progress. Update it after every significant milestone.*
