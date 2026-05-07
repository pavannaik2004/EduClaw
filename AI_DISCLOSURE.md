# AI Disclosure — EduClaw

> **Required by Samsung PRISM OpenClaw — Clash of the Claws 2026**

## AI Models Used

### 1. Anthropic Claude (claude-sonnet-4-20250514) — Primary LLM
- **Purpose:** PDF summarization, quiz question generation, doubt answering, meeting scribe
- **How:** API calls via `@anthropic-ai/sdk` (Node.js) and `anthropic` (Python)
- **Why:** Best instruction-following for structured JSON output; 200K context window handles long PDFs; strong performance on Indian academic content
- **Cost:** Pay-per-use API pricing

### 2. OpenClaw Framework — Agent Runtime
- **Purpose:** Core agent infrastructure — Pi Engine for reasoning, HEARTBEAT for scheduling, Cognitive RAM for persistent memory
- **How:** Installed via `npm install -g openclaw@latest`; EduClaw extends it with custom Skills
- **What we customized:** SOUL.md (persona), HEARTBEAT.md (schedule), 5 custom SKILL.md files

## AI-Assisted Development

### Code Generation
- Parts of the codebase were developed with assistance from AI coding tools (Claude, Copilot)
- All generated code was reviewed, tested, and modified by the team
- Architecture decisions and system design were made by the team

### Documentation
- This master document was structured with AI assistance
- Technical content and architecture decisions are team-originated

## What AI Does NOT Do
- EduClaw does NOT provide assignment solutions
- The agent explicitly refuses exam cheating assistance (enforced via SOUL.md)
- No student data is used for model training
- All LLM calls use course-specific content only — no general web knowledge

## Data Privacy
- All student data stays on-premises (VPS or local machine)
- LLM API calls include only course content + questions — no PII
- Student profiles stored as local YAML files, not in any cloud service
