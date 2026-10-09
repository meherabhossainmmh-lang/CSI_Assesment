# AI Usage Disclosure — FSE 01

This assessment permits AI assistance provided the candidate explains and can defend the code. This document records
how AI was actually used.

## What was used

* An AI coding agent (Arena.ai Agent Mode) was used to **draft, run, test and document** the backend in this repository,
  working from the written assessment (7 pages) and a detailed implementation brief supplied by the candidate.
* The candidate **defined the requirements, architecture constraints, and acceptance criteria**, reviewed the design
  decisions (in particular the two recorded assumption choices in `TECHNICAL_EXPLANATION.md`), and directed testing
  against a real PostgreSQL instance and the live MQTT broker.

## What the AI produced

* Project scaffolding, TypeScript source under `src/`, SQL migrations `database/migrations/001_init.sql` and
  `002_production_sources_ext.sql`.
* The backend Vitest suite under `tests/` (34 tests) and the documentation files (`README.md`,
  `TECHNICAL_EXPLANATION.md`, this file) and the Postman collection.
* The React/Vite/Tailwind dashboard under `frontend/` (six pages) and its jsdom test suite (9 tests).

## Human direction & review

* The ambiguity resolutions (composite `(source_id,event_id)` identity vs. "globally unique" wording; batch atomicity
  vs. "valid items survive") were flagged in the brief and are documented as assumptions; the candidate approved the
  chosen strategy.
* All business rules were cross-checked against the assessment text; test failures caused by test-data mistakes were
  diagnosed and fixed rather than hidden.

## Verification (actually executed)

* `npx tsc --noEmit` (backend) and `frontend` `tsc` + `vite build` — clean.
* `npm run migrate` against PostgreSQL 17 — applied `001_init.sql` and `002_production_sources_ext.sql`.
* Backend `npm test` — 34/34 passing against a dedicated test database.
* Frontend `npm test` — 9/9 passing (jsdom, stubbed fetch).
* Live REST smoke test, live MQTT challenge/replay, and a browser-preview end-to-end pass against
  `152.42.238.142:1883` (recorded in the conversation).

## What was NOT delegated

No secrets are committed (`.env` is gitignored; `.env.example` holds placeholders only). The candidate remains
responsible for understanding and being able to explain every function, per the assessment's review stage.
