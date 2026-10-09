# AI Conversation Record — FSE 01 (partial, translated / summarised)

> **Honesty note.** This file records the AI-assisted **planning discussion** that took place before implementation,
> with **ChatGPT — GPT-6 by OpenAI**, conducted in **Bangla / Banglish**. The original verbatim transcript is **not
> available** to this repository, so what follows is a **partial, translated and summarised reconstruction** of the
> topics that were discussed. It is **not** a word-for-word log: no exact questions, replies, timestamps, test results
> or git operations are reproduced, and none have been invented. Where wording is given below it is an English
> paraphrase of the idea discussed, not a quotation.
>
> ChatGPT was used **only for discussion and planning**. It did not write files in this repository, did not run code or
> tests, and did not perform git operations. The code itself was produced and executed by an AI coding agent
> (Arena.ai Agent Mode), disclosed separately in `AI_USAGE.md`.

## Who was involved

* **Candidate** — Md. Meherab Hossain Talukder (Candidate ID 08), asking questions and setting constraints, in Bangla/Banglish.
* **ChatGPT (GPT-6 by OpenAI)** — answering, reasoning about the assessment, and suggesting an approach.

## Topics discussed (summarised, in the order they came up)

1. **Reading the assessment.** The candidate shared the scanned assessment (a photo/PDF of the FSE-01 brief) and asked
   ChatGPT to explain what was being asked: a production event processing backend with COUNT/VOID events, duplicates and
   conflicts, acknowledgements, a summary dashboard, and an MQTT device-integration channel.

2. **Architecture.** The candidate asked how to structure it. The agreed direction was a single, function-based
   **modular monolith** (Node + TypeScript + Express + PostgreSQL) with the MQTT worker living inside the same process,
   rather than splitting into microservices — so that the REST and MQTT paths would share one implementation of the
   business rules.

3. **The `event_id` uniqueness conflict.** The candidate noticed the brief says an event ID is "globally unique across
   all production sources" while the database note requires `UNIQUE(source_id, event_id)` (allowing different lines to
   reuse an ID). The discussion concluded the **composite key** should be the authoritative identity, with global
   uniqueness treated as a client convention. This was flagged as a recorded assumption.

4. **Batch atomicity.** The brief both says "commit or roll back the whole batch" and "an invalid item is rejected but
   valid items still succeed." The discussed resolution: run the batch in **one transaction** (atomic against crashes)
   while recording a business `REJECTED` item without aborting the batch. Recorded as an assumption.

5. **VOID before COUNT.** The candidate asked what happens when a VOID references a COUNT that has not arrived. The
   agreed behaviour: store it as `PENDING_REFERENCE` (counted in `unresolved`) and resolve it automatically once the
   COUNT lands; the first valid stored VOID wins.

6. **Duplicates and conflicts.** Discussed using a stable hash of the normalized payload so an identical re-send is
   `DUPLICATE` (never reprocessed) while a changed re-send with the same `(source_id,event_id)` is `CONFLICT`.

7. **PostgreSQL schema and durability.** The candidate asked for a schema that preserves history (never delete rows).
   The discussion produced the four-table shape (`production_sources`, `production_events`, `submission_attempts`,
   `mqtt_challenges`) and the rule that all totals are SQL aggregates, so a restart shows identical numbers.

8. **MQTT flow.** Discussed subscribing to the challenge topic, validating the envelope, guarding against replay and
   against a reused `challenge_id` with a changed body, and embedding the current summary in the completed response.

9. **Frontend.** Discussed a thin React dashboard that only renders real backend data (no fake totals) with loading,
   empty and error states.

10. **The FSE-01 change request.** In a later discussion the candidate walked through the four requested changes — the
    1..500 COUNT limit, storing rejected attempts, a `rejected_submissions` summary field, and a shared source filter
    plus a seventh "Rejected Submissions" card — and the constraint to implement them **on top of** the existing design
    with a single shared rule for REST and MQTT rather than a rewrite.

## What this record does NOT contain

* Verbatim questions or answers from the Bangla/Banglish chat.
* Any timestamps, message counts, or model internals.
* Any test output, commands or git operations (those were performed later by the coding agent, not by ChatGPT).

If a full verbatim transcript becomes available, it should be appended here unedited; until then this summary is the
record of the planning discussion.
