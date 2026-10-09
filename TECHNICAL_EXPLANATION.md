# Technical Explanation — FSE 01 Backend

## Entity model

| Entity / table | Purpose | Key columns |
|---|---|---|
| `production_sources` | A line/device reporting counts | `source_id` (PK), `display_name` |
| `production_events` | One logical COUNT or VOID; never deleted | `id` (PK), `UNIQUE(source_id,event_id)`, `event_type`, `quantity`, `target_event_id`, `status`, `normalized_hash`, `acknowledged_at`, `reversed_by_event_id`, `reversed_quantity` |
| `submission_attempts` | Every received item, whatever the outcome | `raw_payload`, `source_id`, `event_id`, `classification`, `error`, `received_at`, `channel`, `challenge_id` |
| `mqtt_challenges` | Durable challenge/response for replay + conflict detection | `challenge_id` (UNIQUE), `request_digest`, `response_body`, `status`, `error_code` |

Corrections are **separate VOID rows**; the original COUNT is kept and merely stamped with
`reversed_by_event_id`. This preserves full history.

## Module responsibilities (modular monolith)

* `modules/events` — validation (Zod), COUNT/VOID business rules, persistence. Owns `processEvents()`.
* `modules/state` — durable summary/pending/exceptions queries. Owns `getSummary()` etc.
* `modules/acknowledgement` — review/ack. Owns `acknowledgeEvents()`.
* `modules/mqtt` — transport only: envelope validation, replay/conflict, publish/subscribe. Calls the **same** `processEvents()`/`getSummary()`.
* `modules/audit` — post-commit domain-event log stream.
* `shared/` — db pool/transactions, domain-event bus, middleware, types.

REST and MQTT both converge on `validateEvent() -> processEvents() -> PostgreSQL`, so there is exactly one
implementation of the COUNT/VOID rules.

## COUNT / VOID rules

* COUNT must carry a positive integer `quantity`; it is added exactly once (`UNIQUE(source_id,event_id)` + `ON CONFLICT DO NOTHING` claim).
* VOID must reference a COUNT in the **same source**; a COUNT is reversed only once (row-level lock + `reversed_by_event_id` guard).
* VOID before COUNT is stored `PENDING_REFERENCE` and resolved automatically when the COUNT lands (`resolve_pending_voids`); the first stored valid VOID wins, losers become `REJECTED` with reasons.
* Completed (applied/resolved) VOID rows are **auto-acknowledged**, matching the factory workflow note; the pending view therefore shows COUNTs for supervisor review.

## Duplicate / conflict handling

Identity = `(source_id, event_id)`. A stable `normalized_hash` (SHA-256 over the normalized fields) classifies a
repeat: same hash → `DUPLICATE` (recorded, never reprocessed); different hash → `CONFLICT` (recorded, original kept).

## PostgreSQL transaction & concurrency strategy

* **One transaction per batch** (`withTransaction`). Items are processed in order inside it; a business `REJECTED`
  item is *recorded*, not a rollback trigger, so valid items still succeed. A hard DB failure rolls the whole batch back.
* **Identity claim**: `INSERT ... ON CONFLICT (source_id,event_id) DO NOTHING RETURNING *`. The winner processes;
  losers re-read `FOR UPDATE` and are classified DUPLICATE/CONFLICT. This makes concurrent identical COUNTs count once.
* **Reversal & ack**: target COUNT / event rows are locked with `SELECT ... FOR UPDATE` before mutation, so competing
  VOIDs and acks are mutually exclusive.
* **Totals are always SQL aggregates** over `production_events` / `submission_attempts` — never process memory.

## Acknowledgement

`acknowledgeEvents()` resolves a bare `event_id` to the earliest stored logical event (composite identity is the true
key; bare ids are a supervisor convenience). `ACKED` / `ALREADY_ACKED` / `NOT_READY` / `NOT_FOUND`. Ack never deletes
history and never blocks a later valid VOID.

## Restart behaviour

All state is durable. On boot the server re-runs idempotent migrations and the MQTT worker reconnects/resubscribes.
Summary values are recomputed from the tables, so a restart shows identical totals.

## MQTT processing & replay

`handleChallenge()` validates protocol → candidate → challenge_id → command → expiry → events (in that order), then:
existing id + same digest → return stored response (no reprocessing); same id + different digest → `FAILED/CHALLENGE_CONFLICT`
(no processing); new id → claim, run shared `processEvents()`, read shared `getSummary()`, store + publish `COMPLETED`.
Failures publish stable codes (`VALIDATION_ERROR`, `UNSUPPORTED_PROTOCOL`, `CHALLENGE_EXPIRED`, `CANDIDATE_MISMATCH`,
`CHALLENGE_CONFLICT`, `INTERNAL_ERROR`).

## Future microservice migration path

Modules communicate through plain function calls plus a small in-process domain-event bus (`shared/domainEvents.ts`).
To extract, e.g., MQTT into its own service: deploy it separately, replace the direct `processEvents()` call with an HTTP/gRPC
contract (same input/output shapes), and swap the domain-event bus for a real broker (Kafka/RabbitMQ). Because data
contracts and ownership are already isolated, no business rule needs to move.

## Frontend architecture & data flow

The React/Vite dashboard (`frontend/`) is a thin, read-mostly client over the same REST contract. Data flow:

```
Browser (React) --relative /api--> Vite dev proxy --> Express --> services --> PostgreSQL
Browser (React) <-- JSON -- Vite dev proxy <-- Express (state/analytics/mqtt-status/lines)
```

* The frontend holds **no authoritative accounting**; every figure on the Dashboard comes from
  `GET /api/state?view=summary` and `GET /api/analytics` (SQL aggregates). Charts render real rows only and show an
  empty state when there is no history.
* MQTT runs exclusively in the backend worker. `GET /api/mqtt/status` merges an in-memory runtime view
  (connection, heartbeats, last challenge) with the durable `mqtt_challenges` history; it exposes no credentials.
* `GET/POST/PATCH /api/production-lines` manage `production_sources` (extra `description`/`status` columns added in
  migration 002). Sources auto-created by ingestion keep defaults, so the required event APIs are unchanged.
* Additional endpoints are strictly additive and read-only where possible; the three assessment APIs
  (`POST /api/events`, `GET /api/state`, `POST /api/ack`) keep their exact behavior.

## Assumptions & ambiguities (recorded per instructions)

1. **event_id uniqueness.** §5.1 says an event ID is "globally unique across all production sources," while the DB
   modelling note mandates `UNIQUE(source_id, event_id)` "allowing different production lines to use the same event ID."
   These conflict. I implemented the **composite key** as the authoritative identity (it is the specific, DB-level
   instruction and is what makes duplicate/conflict detection well-defined). Global uniqueness is treated as a
   client-side convention, not an extra server constraint. Verified: two sources may both use `EV-1` (source-filter test).
2. **Batch atomicity.** "Commit the whole batch or roll it back if any event fails validation" conflicts with "an invalid
   item is REJECTED but valid items still succeed / do not undo valid items." I run the batch in **one transaction**
   (atomic against crashes) while a per-item business `REJECTED` is recorded and does **not** abort the batch — satisfying
   both the atomicity intent and the "valid items survive" rule. Only a hard database error rolls back.
3. **Bare `event_id` in `/api/ack`.** With composite identity, a bare id is a convenience handle; it resolves to the
   earliest stored logical event with that id. Distinct ids per source (the assessment's own examples) are unaffected.
4. Completed VOID rows are auto-acknowledged (factory workflow note), so `pending` shows COUNTs; VOID acks via the API
   return `ALREADY_ACKED`.
