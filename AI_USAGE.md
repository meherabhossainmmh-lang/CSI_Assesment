# AI Usage Disclosure — FSE 01

This assessment permits AI assistance provided the candidate explains and can defend the code. This document records,
honestly and in plain terms, how AI was actually used. Two different AI tools were involved, and they are disclosed
separately below because they did very different things.

## 1. Planning discussion — ChatGPT (GPT-6 by OpenAI)

Before any code was written, the candidate held a planning discussion with **ChatGPT — GPT-6 by OpenAI**, written in
Bangla / Banglish. That conversation was about **understanding the assessment and deciding the approach**: reading the
scanned PDF, clarifying the ambiguous requirements (the `event_id` uniqueness conflict, batch atomicity, pending VOIDs),
choosing the modular-monolith architecture, and sketching the PostgreSQL schema and the MQTT flow.

ChatGPT was used **for reasoning and discussion only**. It never executed code, never touched this repository, and never
ran tests or git commands. A faithful, clearly-labelled record of that discussion is kept in `AI_CONVERSATION.md`.
Because the original transcript is not available verbatim, that file is a partial, translated/summarised reconstruction
and says so explicitly — no question, answer, timestamp, test result or git operation has been invented.

## 2. Implementation — an AI coding agent (Arena.ai Agent Mode)

The actual **drafting, running, testing and documenting** of the code in this repository was done with an AI coding
agent (Arena.ai Agent Mode), working from the written assessment and the candidate's implementation brief (which itself
was shaped by the ChatGPT planning discussion). This agent has shell access, so it installed PostgreSQL, ran the
migrations, ran the test suites, started the servers, exercised the live MQTT broker and captured screenshots.

The candidate **defined the requirements, the architecture constraints and the acceptance criteria**, reviewed the
design decisions (in particular the recorded assumption choices in `TECHNICAL_EXPLANATION.md`), and directed testing
against a real PostgreSQL instance and the live MQTT broker.

## What the AI produced

* Project scaffolding, TypeScript source under `src/`, SQL migrations `database/migrations/001_init.sql` and
  `002_production_sources_ext.sql`.
* The backend Vitest suite under `tests/` (50 tests) and the documentation files (`README.md`,
  `TECHNICAL_EXPLANATION.md`, `AI_CONVERSATION.md`, this file) and the Postman collection.
* The React/Vite/Tailwind dashboard under `frontend/` (six pages) and its jsdom test suite (12 tests).
* The FSE-01 change request: the 1..500 COUNT limit, `rejected_submissions` summary field, the shared
  "Production Source" filter and the seventh "Rejected Submissions" card (see `TECHNICAL_EXPLANATION.md`).

## Human direction & review

* The ambiguity resolutions (composite `(source_id,event_id)` identity vs. "globally unique" wording; batch atomicity
  vs. "valid items survive") were raised during the planning discussion, recorded in the brief, and documented as
  assumptions; the candidate approved the chosen strategy.
* All business rules were cross-checked against the assessment text; test failures caused by test-data mistakes were
  diagnosed and fixed rather than hidden.

## Verification (actually executed)

* `npx tsc --noEmit` (backend) and `frontend` `tsc` + `vite build` — clean.
* `npm run migrate` against PostgreSQL 17 — applied `001_init.sql` and `002_production_sources_ext.sql`.
* Backend `npm test` — 50/50 passing against a dedicated test database.
* Frontend `npm test` — 12/12 passing (jsdom, stubbed fetch).
* Live REST smoke test, live MQTT challenge/replay, and a browser end-to-end pass against `152.42.238.142:1883`,
  including the change-request scenarios (450 accepted / 501 rejected, source filter, rejected card).

## What was NOT delegated

No secrets are committed (`.env` is gitignored; `.env.example` holds placeholders only). The candidate remains
responsible for understanding and being able to explain every function, per the assessment's review stage.
