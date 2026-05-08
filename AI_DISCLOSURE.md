# AI Disclosure — EduClaw

> **Required by Samsung PRISM OpenClaw — Clash of the Claws 2026**

## AI Models Used

### 1. OpenAI GPT-4o-mini — Primary LLM
- **Purpose:** PDF summarization, quiz question generation, doubt answering
- **How:** API calls via `openai` Python SDK
- **Why:** Cost-efficient, fast response times, strong JSON output formatting, handles academic content well
- **Cost:** Pay-per-use API pricing (~$0.15/1M input tokens)

### 2. OpenClaw Framework — Agent Runtime
- **Purpose:** Core agent infrastructure — Pi Engine for reasoning, HEARTBEAT for scheduling, Cognitive RAM for persistent memory
- **How:** EduClaw extends OpenClaw with custom Skills and adapters
- **What we customized:** SOUL.md (persona), HEARTBEAT.md (schedule), 5 custom SKILL.md files, Telegram gateway adapter

## AI-Assisted Development

### Code Generation
- Parts of the codebase were developed with assistance from AI coding tools
- All generated code was reviewed, tested, and modified by the team
- Architecture decisions and system design were made by the team

### Documentation
- Documentation was structured with AI assistance
- Technical content and architecture decisions are team-originated

## What AI Does NOT Do
- EduClaw does NOT provide assignment solutions
- The agent explicitly refuses exam cheating assistance (enforced via SOUL.md)
- No student data is used for model training
- All LLM calls use course-specific content only — no general web knowledge
- Questions not found in course notes are explicitly rejected ("I don't have that in the course notes")

## Data Privacy
- All student data stays on the local machine
- LLM API calls include only course content + questions — no PII
- Student profiles stored as local YAML files, not in any cloud service
- API keys stored in `.env` (gitignored, never committed)
