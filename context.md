# EduClaw — Project Context & Progress Tracker

> **Last Updated:** 2026-05-07 23:48 IST  
> **Machine:** Pavan's ASUS VivoBook (Linux/Ubuntu)  
> **Hackathon Deadline:** 8 May 2026 EOD  
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

- ❌ **Cannot run local LLMs** (no dedicated GPU, Ollama + DeepSeek-7B on CPU would be painfully slow ~5 tok/s)
- ✅ **Use OpenAI API** for all LLM tasks (summarization, quiz gen, doubt answering)
- ✅ **Skip the Ollama container** in docker-compose — don't start `--profile local-llm`
- ✅ **Docker will run fine** — 16GB RAM is plenty for 2-3 containers (gateway + skills-runtime)
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
| **SendGrid** | ⬜ Not needed for demo | Skipped |

> **IMPORTANT:** Original Master Document references Anthropic Claude. **ALL code has been rewritten to use OpenAI API instead.** Do NOT switch back without updating `pdf_digest/ingest.py`, `quiz_gen/generate.py`, and `main.py`.

---

## 4. OpenClaw Version & Details

| Property | Value |
|----------|-------|
| **Framework** | OpenClaw (open-source, TypeScript-based agentic AI framework) |
| **Variant** | OpenClaw Base (free, has Pi Engine + SOUL.md + HEARTBEAT.md + Cognitive RAM) |
| **Key Features Used** | Pi Engine, SOUL.md (persona), HEARTBEAT.md (cron scheduler), Cognitive RAM (persistent YAML memory), Skills API, Telegram integration |

### Architecture
- **Gateway:** Node.js/TypeScript daemon (Telegram bot polling) → calls Skills Runtime
- **Skills Runtime:** Python 3.12/FastAPI → exposes /skill/* endpoints
- **LLM:** OpenAI `gpt-4o-mini` via `openai` Python SDK
- **Memory:** YAML files (Cognitive RAM pattern)
- **SOUL.md:** Defines agent persona, constraints, response format
- **HEARTBEAT.md:** Cron-like scheduler for proactive actions

---

## 5. Project Structure (Actual)

```
/home/pavan/Educlaw/
├── EduClaw_Master_Document.md     # Reference document (DO NOT MODIFY)
├── context.md                      # THIS FILE
├── README.md                       # Hackathon submission README
├── AI_DISCLOSURE.md                # Required by hackathon
├── .env.example / .env             # API keys (NEVER COMMIT .env)
├── .gitignore
├── docker-compose.yml
│
├── gateway/                        # Node.js 22 / TypeScript
│   ├── Dockerfile
│   ├── package.json / pnpm-lock.yaml
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts                # Entry point — starts Telegram bot
│       ├── adapters/telegram.ts    # Bot: /start, /help, /quiz, doubt answering
│       └── types/MessageEnvelope.ts
│
├── pi-engine/                      # OpenClaw config
│   ├── SOUL.md
│   ├── HEARTBEAT.md
│   └── skills/                     # 5 skill definitions
│
├── skills-runtime/                 # Python 3.12 / FastAPI
│   ├── Dockerfile
│   ├── pyproject.toml
│   ├── .venv/                      # Python venv (uv created)
│   ├── main.py                     # FastAPI app: /health, /skill/*
│   ├── utils/                      # logger, sanitise, yaml_io
│   ├── pdf_digest/ingest.py        # PDF → text → chunks → summarise → YAML KB
│   ├── quiz_gen/generate.py        # KB → MCQ questions via OpenAI
│   ├── instructor_report/generate_docx.py
│   ├── calendar_watch/
│   └── meeting_scribe/
│
├── scripts/
│   └── seed_demo_data.py           # Creates sample course + 5 students
│
└── data/                           # Runtime data (seeded)
    ├── inbox/networks_2024/
    ├── memory/courses/networks_2024/{kb.yaml, schedule.yaml}
    ├── memory/students/{5 YAML profiles}
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

---

## 7. Execution Progress

### Phase 0 — Environment Setup
- [x] Read full Master Document (3203 lines)
- [x] Assessed hardware specs and compatibility
- [x] Created context.md
- [x] Install Docker Engine + Docker Compose (v29.4.3)
- [x] Install Node.js v22+ (v22.22.2)
- [x] Install pnpm (v11.0.8)
- [x] Install uv (v0.11.11 at ~/.local/bin)
- [x] Create Telegram bot via @BotFather → token obtained
- [x] Get OpenAI API key (using gpt-4o-mini instead of Anthropic Claude)
- [x] Create `.env` file with tokens
- [x] Create project directory structure (37 files)
- [x] Initialize Node.js gateway project
- [x] Initialize Python skills-runtime project
- [x] Run `pnpm install` in gateway/ (336 packages)
- [x] Run `uv pip install` in skills-runtime/ (all deps installed)
- [x] Adapted ALL code from Anthropic to OpenAI API
- [x] Seed demo data (1 course, 5 students, KB with TCP/IP topic)
- [x] Skills Runtime starts → http://localhost:8001/health returns OK
- [x] Gateway starts → Telegram bot polling
- [x] `/start` command returns welcome message
- [ ] Test: doubt answering via Telegram (needs user to test)
- [ ] Test: `/quiz` command via Telegram (needs user to test)

### Phase 1 — PDF Ingestion Pipeline
- [x] Implement `pdf_digest/ingest.py` (PyMuPDF + pdfplumber extraction)
- [x] Implement text chunking (512 words, 50 overlap)
- [x] Implement summarization via OpenAI API
- [x] Implement YAML KB writer (atomic write pattern)
- [ ] Implement folder watcher (watchdog)
- [ ] Test: drop PDF → verify kb.yaml updated

### Phase 2 — Telegram Bot + Doubt Answering
- [x] Implement Telegram adapter (telegram.ts)
- [x] Implement intent classifier (regex-based)
- [x] Implement KB retrieval (keyword search from YAML)
- [x] Implement prompt assembly + OpenAI API call
- [x] Implement doubt logging to student Cognitive RAM
- [ ] Test: student asks doubt → gets cited answer (NEEDS USER TEST)

### Phase 3 — HEARTBEAT Quiz System
- [x] Implement `quiz_gen/generate.py`
- [x] Configure HEARTBEAT.md with 6 PM trigger
- [x] Quiz delivery via Telegram (sendPoll)
- [ ] Answer collection + score logging
- [ ] Test: quiz arrives at scheduled time

### Phase 4 — Deadline Prep-Coach
- [ ] Implement `calendar_watch/watch.py`
- [ ] 3-day lookahead from schedule.yaml
- [ ] Personalized weak-topic drill alerts
- [ ] HEARTBEAT.md 9 AM daily trigger

### Phase 5 — Instructor Report
- [x] Implement `instructor_report/generate_docx.py`
- [ ] Email via SendGrid or Gmail SMTP
- [ ] HEARTBEAT.md Friday 5 PM trigger

### Phase 6 — Student Onboarding
- [x] `/start` multi-step onboarding (welcome message)
- [ ] Collect name, roll number, courses (interactive)
- [ ] Write student YAML profile (on first message)

### Phase 7 — Integration Testing & Demo
- [ ] End-to-end test all flows
- [x] Seed demo data (5 test students)
- [ ] Record demo video (10 minutes)
- [x] Write README.md
- [x] Write AI_DISCLOSURE.md
- [ ] Create GitHub repo (public)
- [ ] Submit via Google Form

---

## 8. Key Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Skip Ollama/local LLM | ✅ | No dedicated GPU |
| Use **OpenAI** (not Anthropic) | ✅ | User had OpenAI key available |
| LLM Model: `gpt-4o-mini` | ✅ | Cost-efficient, fast, good JSON output |
| Python 3.12 | ✅ | Already installed, all deps work |
| Skip WhatsApp | ✅ | Telegram-only for demo reliability |
| No vector DB | ✅ | YAML keyword search sufficient for MVP |
| Run locally (no Docker) for dev | ✅ | Faster iteration |

---

## 9. Agent Handoff Notes

> **For the next AI agent continuing this project:**
> 
> 1. Read this file first. It has everything you need.
> 2. Check the progress checklist in Section 7 to see what's done.
> 3. Master Document: `/home/pavan/Educlaw/EduClaw_Master_Document.md`
> 4. **LLM is OpenAI, NOT Anthropic.** All code uses `openai` Python SDK.
> 5. The user's machine has NO dedicated GPU — skip all local LLM/Ollama stuff.
> 6. Python venv is at `/home/pavan/Educlaw/skills-runtime/.venv/`
> 7. uv is at `~/.local/bin/uv` — add to PATH first.
> 8. The deadline is **8 May 2026 EOD** — prioritize working demo over perfect code.
> 9. Focus on Telegram-only (skip WhatsApp/Discord for demo).
> 10. Update this file's progress checkboxes as you complete tasks.
> 11. Data lives at `/home/pavan/Educlaw/data/` (not inside skills-runtime/).
> 12. The user (Pavan) is a 3rd-year CSE student.

---

*This document is the single source of truth for project progress. Update it after every significant milestone.*
