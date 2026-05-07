# EduClaw — AI-Powered Academic Productivity Agent

> **Samsung PRISM OpenClaw — Clash of the Claws 2026**  
> **Theme 3:** Productivity Platforms  
> **Team:** YourCollege_EduClaw

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
- 📝 **Sends daily quizzes** at 6 PM without student prompting (HEARTBEAT-driven)
- 📅 **Alerts 3 days before deadlines** with personalised prep checklists
- 📊 **Generates weekly instructor reports** showing which topics confuse students most

All via **Telegram** — zero app installation required.

## 🏗️ Architecture

```
Students (Telegram) → Gateway (Node.js/TS) → Pi Engine (OpenClaw)
                                                    ↓
                                            Skills Runtime (Python)
                                                    ↓
                                    Claude API (Summarize/Quiz/Answer)
                                                    ↓
                                        Cognitive RAM (YAML files)
```

## 🛠️ Tech Stack

| Component | Technology |
|-----------|-----------|
| Agent Framework | OpenClaw Base (Pi Engine) |
| Gateway | Node.js 22 / TypeScript |
| Skills Runtime | Python 3.12 / FastAPI |
| LLM | Anthropic Claude (claude-sonnet-4-20250514) |
| Messaging | Telegram Bot API |
| Storage | YAML files (OpenClaw Cognitive RAM) |
| Reports | python-docx |
| Deployment | Docker Compose |

## 🚀 Quick Start

### Prerequisites
- Docker + Docker Compose v2
- Node.js ≥ 22
- Python 3.11+
- Telegram Bot Token (from @BotFather)
- Anthropic API Key

### Setup

```bash
# 1. Clone
git clone https://github.com/YourOrg/YourCollege_EduClaw.git
cd YourCollege_EduClaw

# 2. Configure
cp .env.example .env
# Edit .env — add TELEGRAM_BOT_TOKEN and ANTHROPIC_API_KEY

# 3. Install dependencies
cd gateway && pnpm install && cd ..
cd skills-runtime && pip install -e . && cd ..

# 4. Seed demo data
python scripts/seed_demo_data.py

# 5. Run (development)
# Terminal 1: Skills runtime
cd skills-runtime && uvicorn main:app --port 8001 --reload

# Terminal 2: Gateway
cd gateway && pnpm dev

# 6. Or run with Docker
docker compose up -d
```

### Usage

1. Open Telegram, search for your bot
2. Send `/start` to onboard
3. Ask a doubt: "What is TCP three-way handshake?"
4. Request a quiz: `/quiz tcp_ip`
5. Check status: `/status`

## 📂 Project Structure

```
├── gateway/             # Node.js/TypeScript - Telegram bot
├── pi-engine/           # OpenClaw config (SOUL.md, HEARTBEAT.md, Skills)
├── skills-runtime/      # Python - PDF ingestion, quiz gen, reports
├── scripts/             # Setup and seed scripts
├── data/                # Runtime data (YAML files, PDFs, reports)
└── tests/               # Unit and integration tests
```

## 🤖 OpenClaw Integration

EduClaw extends OpenClaw Base with:
- **SOUL.md** — Academic assistant persona with safety constraints
- **HEARTBEAT.md** — Cron scheduler for proactive daily quizzes and alerts
- **Cognitive RAM** — Per-student YAML profiles tracking quiz scores and doubts
- **5 Custom Skills** — PDF digest, quiz gen, calendar watch, instructor report, meeting scribe

## 👥 Team

- Pavan Naik
- Sumanth Hegde

## 📄 License

MIT License — See [LICENSE](LICENSE) for details.
