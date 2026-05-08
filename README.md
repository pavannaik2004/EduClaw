# EduClaw

**Samsung PRISM OpenClaw - Clash of the Claws 2026**
**Theme 3:** Productivity Platforms
**Team:** EduClaw

---

## Problem Statement

Indian engineering students often face several challenges in managing their academic workload:
1. Information Overload: Lecture materials are often provided as lengthy, 60+ page PDFs, making it difficult to extract key concepts efficiently.
2. Lack of Feedback Loops: Instructors have limited visibility into which specific topics are causing confusion among students.
3. Poor Deadline Management: While assignment calendars exist, students frequently struggle to track and prepare for impending deadlines.
4. Passive Learning: Traditional study methods lack proactive revision mechanisms and regular knowledge testing.

## Solution

EduClaw is a proactive AI-driven academic agent built on the OpenClaw framework. It acts as a personalized academic assistant accessible entirely via Telegram, requiring no additional app installations.

Key features include:
- Automated Digest Generation: Automatically summarizes uploaded lecture PDFs into concise, 5-point digests.
- Context-Aware Doubt Resolution: Answers student questions using course-specific knowledge bases, providing citations for its answers.
- Proactive Quizzing: Generates interactive multiple-choice quizzes as Telegram polls based on uploaded course material.
- Deadline Alerts: Alerts students three days prior to deadlines, providing personalized warnings based on their weaker topics.
- Performance Tracking: Maintains per-topic score breakdowns to track student progress over time.
- Multi-Course Management: Allows students to switch between different subjects, maintaining separate knowledge bases and schedules for each.

## Architecture

Students interact with EduClaw through a Telegram bot interface. This interface is powered by a Node.js/TypeScript Gateway that communicates with a Python/FastAPI Skills Runtime. The runtime utilizes the OpenAI GPT-4o-mini model for natural language processing tasks (summarization, question answering, quiz generation) and maintains state using the OpenClaw Cognitive RAM pattern (YAML files).

## Tech Stack

- Agent Framework: OpenClaw Base (Pi Engine, SOUL.md, HEARTBEAT.md)
- Gateway: Node.js 22 / TypeScript (Telegram Bot API)
- Skills Runtime: Python 3.12 / FastAPI
- Large Language Model: OpenAI GPT-4o-mini
- Storage: YAML files (Cognitive RAM pattern)
- Reports: python-docx

---

## Setup Instructions

### Prerequisites
- Node.js (version 22 or higher) and pnpm
- Python (version 3.11 or higher) and uv (or pip)
- Telegram Bot Token (obtainable from @BotFather on Telegram)
- OpenAI API Key

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/pavannaik2004/EduClaw.git
   cd EduClaw
   ```

2. Configure environment variables:
   ```bash
   cp .env.example .env
   # Edit the .env file and add your TELEGRAM_BOT_TOKEN and OPENAI_API_KEY
   ```

3. Install dependencies for the Gateway:
   ```bash
   cd gateway
   pnpm install
   cd ..
   ```

4. Install dependencies for the Skills Runtime:
   ```bash
   cd skills-runtime
   uv venv
   uv pip install -e .
   cd ..
   ```

5. Seed demo data (optional but recommended for testing):
   ```bash
   python scripts/seed_demo_data.py
   ```

### Running the Application

You will need two terminal windows to run both services.

Terminal 1: Start the Skills Runtime (Python)
```bash
cd skills-runtime
export DATA_DIR=../data
export OPENAI_API_KEY=<your_openai_api_key>
export LLM_MODEL=gpt-4o-mini
.venv/bin/uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

Terminal 2: Start the Gateway (Telegram Bot)
```bash
cd gateway
cp ../.env .env
export SKILLS_RUNTIME_PORT=8001
npx tsx src/index.ts
```
Note: Ensure only one instance of the Gateway is running at any time to prevent Telegram polling conflicts.

---

## Usage Guide

Once both services are running, open Telegram and search for your bot.

### Commands

All commands can be accessed via the bot menu or typed directly:

- `/start`: Displays the welcome message and main menu.
- `/help`: Lists all available commands.
- `/quiz`: Starts a quiz with 3 random questions from the active course.
- `/quiz <topic_id>`: Starts a quiz on a specific topic.
- `/topics`: Lists all topics available in the active course.
- `/courses`: Lists all enrolled courses and allows switching the active course.
- `/newcourse <name>`: Creates a new course (e.g., `/newcourse Operating Systems`).
- `/status`: Displays your current quiz scores, weak topics, and doubt count.
- `/deadlines`: Shows upcoming assignments and exams.

### Interactions

- Uploading Material: Send a PDF document directly to the bot. It will be ingested into the currently active course's knowledge base.
- Asking Questions: Type any course-related question in the chat. The bot will answer based on the ingested course notes and provide citations.
- Inline Navigation: The bot makes extensive use of inline keyboard buttons. After most actions (like finishing a quiz, uploading a PDF, or getting an answer), the bot provides contextual buttons to easily navigate to the next action without typing.

## Team

- Pavan Naik
- Sumanth Hegde

## License

MIT License - See LICENSE file for details.
