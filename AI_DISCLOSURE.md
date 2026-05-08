# AI Disclosure

**Required by Samsung PRISM OpenClaw - Clash of the Claws 2026**

This document details the usage of Artificial Intelligence tools and models in the development and operation of the EduClaw project.

## AI Models Used in the Application

### 1. OpenAI GPT-4o-mini (Primary LLM)
- Purpose: Natural language understanding and generation for core application features. Specifically, it is used for:
  - Summarizing uploaded PDF documents into concise bullet points.
  - Generating multiple-choice quiz questions based on the ingested course material.
  - Answering student queries by synthesizing information retrieved from the knowledge base.
- Implementation: The model is accessed via API calls using the `openai` Python SDK within the Skills Runtime microservice.
- Rationale: GPT-4o-mini was selected for its balance of cost-efficiency, low latency, and strong capability in following instructions for structured JSON output, which is crucial for features like automated quiz generation and formatting doubt responses.

### 2. OpenClaw Framework (Agent Runtime)
- Purpose: Provides the foundational agent infrastructure. This includes the Pi Engine for reasoning, the HEARTBEAT mechanism for task scheduling, and Cognitive RAM for maintaining persistent memory state.
- Implementation: EduClaw extends the base OpenClaw framework by introducing custom Skills and a Telegram gateway adapter.
- Customizations: We defined the agent's persona and constraints in `SOUL.md`, configured the scheduling rules in `HEARTBEAT.md`, and implemented five custom skill modules to handle the specific academic use cases.

## AI-Assisted Development

The development process of EduClaw involved the utilization of AI coding assistants to improve productivity.

### Code Generation and Refactoring
- Tools Used: AI coding assistants (such as Claude and GitHub Copilot) were utilized during the development phase.
- Application: These tools assisted in generating boilerplate code, writing utility functions, and suggesting refactoring improvements across both the Node.js Gateway and Python Skills Runtime.
- Human Oversight: All AI-generated code was thoroughly reviewed, tested, and modified by the development team to ensure correctness, security, and alignment with the project's architecture. The overall system design, architecture decisions, and business logic remain team-originated.

### Documentation
- AI assistance was used to help structure and draft sections of the project documentation, including the README and internal context trackers. The technical content and factual accuracy were verified by the team.

## Safety and Limitations

The application is designed with strict boundaries regarding its AI capabilities:

- No Academic Dishonesty: EduClaw is explicitly programmed NOT to provide direct solutions to assignments or assist in exam cheating. This constraint is strictly enforced via the agent's persona definition (`SOUL.md`).
- Contextual Boundaries: The agent is restricted to answering questions based solely on the course materials uploaded by the user. It does not utilize its general pre-training knowledge to answer specific academic queries. If an answer cannot be found in the provided notes, it will explicitly state its inability to answer.
- Data Privacy: No student data or uploaded course material is used to train or fine-tune any AI models. Data processing is limited to the immediate context window required to fulfill a specific request via the API.
