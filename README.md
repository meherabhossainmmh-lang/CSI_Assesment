# CSI Smart Tech — FSE 01 Production Event Processing Backend

A production-minded, function-based **modular monolith** backend (Node.js + TypeScript + Express + PostgreSQL + MQTT) for the
*Full Stack Engineering Practical Assessment* (Production Event Processing Dashboard + MQTT Device Integration).

This repository contains the **backend and database only**. All REST APIs are ready for direct frontend integration.

Candidate: **Md. Meherab Hossain Talukder** — Candidate ID **08**.

---

## Technology stack

| Layer     | Choice                              |
|-----------|-------------------------------------|
| Runtime   | Node.js (>= 18, tested on 20)        |
| Language  | TypeScript                           |
| HTTP      | Express.js                           |
| Database  | PostgreSQL (driver `pg`)             |
| MQTT      | MQTT.js (MQTT 3.1.1)                 |
| Validate  | Zod                                  |
| Tests     | Vitest                               |
| Migrations| Plain SQL files + tiny runner        |
| Env       | dotenv                               |

No SQLite / MongoDB / JSON files / in-memory substitutes. One deployment, one PostgreSQL database.

---

## Requirements

* Node.js 18+ and npm
* PostgreSQL 9.6+ (tested on 17)
* (optional) outbound network access to the MQTT broker for live device integration

---

## Quick start

```bash
# 1. install dependencies
npm install

# 2. configure environment
cp .env.example .env     # then edit .env if your Postgres differs

# 3. create the databases (see guide below) then run migrations
npm run migrate

# 4. start the backend (REST + MQTT worker)
npm start                # or: npm run dev (watch mode)

# 5. run automated tests (uses a separate test database)
npm test
```

The REST API listens on `http://localhost:3000` by default.

---

## PostgreSQL Installation, Connection and Testing Guide (Windows, beginner friendly)

### 1. Install PostgreSQL
1. Go to https://www.postgresql.org/download/windows/ and click "Download the installer".
2. Run the installer. Keep clicking Next with the defaults.
3. When asked for a **password** for the `postgres` superuser, choose one and remember it (e.g. `postgres`).
4. Keep the default port **5432**. Finish the install (leave "Stack Builder" unchecked).

### 2. Install / open pgAdmin 4
1. pgAdmin 4 is installed with PostgreSQL. Open it from the Start menu.
2. In the left tree expand **Servers ▸ PostgreSQL Server**. You may be asked for the password from step 1.3.

### 3. Create the databases
In pgAdmin: right-click **Databases ▸ Create ▸ Database…** and create:
* `production_dashboard` (dev)
* `production_dashboard_test` (used by `npm test`)

Or with `psql` / the SQL Tool:
```sql
CREATE DATABASE production_dashboard;
CREATE DATABASE production_dashboard_test;
```

### 4. Configure a username and password
The installer created the superuser `postgres`. For this app we recommend a dedicated role:
```sql
CREATE ROLE fse LOGIN PASSWORD 'fse_dev_password';
GRANT ALL PRIVILEGES ON DATABASE production_dashboard TO fse;
GRANT ALL PRIVILEGES ON DATABASE production_dashboard_test TO fse;
```
(Any role/password works — just mirror it in `.env`.)

### 5. Create `.env` from `.env.example`
```bash
copy .env.example .env     # Windows cmd   (or: cp .env.example .env)
```

### 6. Set `DATABASE_URL`
Edit `.env`:
```
DATABASE_URL=postgresql://fse:fse_dev_password@localhost:5432/production_dashboard
TEST_DATABASE_URL=postgresql://fse:fse_dev_password@localhost:5432/production_dashboard_test
PORT=3000
MQTT_CANDIDATE_ID=08
```
Format: `postgresql://USER:PASSWORD@HOST:PORT/DBNAME`.

### 7. Run SQL migrations
```bash
npm run migrate
```
You should see `[migrate] applied: 001_init.sql` (or "up to date").

### 8. Start the backend
```bash
npm start
```
Expected log:
```
[server] REST API listening on http://0.0.0.0:3000
[mqtt] connected to 152.42.238.142:1883 as fse01-08-xxxxxx
[mqtt] subscribed to fse-01/08/challenge
```

### 9. Confirm the backend connects
```bash
curl http://localhost:3000/api/health
```
Returns `{"ok":true,...}`. If `ok:false`, your `DATABASE_URL` is wrong.

### 10–16. Verify data in pgAdmin Query Tool
Open pgAdmin ▸ select the database ▸ **Tools ▸ Query Tool**, then run:

```sql
-- tables created by the migration
SELECT table_name FROM information_schema.tables WHERE table_schema='public';

-- production sources & logical events
SELECT * FROM production_sources;
SELECT event_id, source_id, event_type, quantity, status, reversed_by_event_id,
       acknowledged_at, received_at
FROM production_events ORDER BY id;

-- every submission attempt (accepted/duplicate/conflict/rejected/pending)
SELECT id, channel, source_id, event_id, classification, error, received_at
FROM submission_attempts ORDER BY id;

-- MQTT challenge history + replay/conflict detection
SELECT challenge_id, status, error_code,
       (response_body->'state'->>'net_total') AS net_total, received_at
FROM mqtt_challenges ORDER BY id;
```

* **Inspect COUNT/VOID:** the `production_events` query shows a COUNT row and, after a VOID, the COUNT's `reversed_by_event_id` plus a separate VOID row (history preserved).
* **Inspect duplicates/conflicts:** `submission_attempts` rows with `classification` = `DUPLICATE` / `CONFLICT`.
* **Verify pending VOID resolution:** a VOID sent before its COUNT shows `status='PENDING_REFERENCE'` and `unresolved` in the summary; after the COUNT arrives it flips to `ACCEPTED`.
* **Verify acknowledgements:** `acknowledged_at` becomes non-null after `POST /api/ack`; completed VOID rows are auto-acknowledged.

### 17. Restart and confirm persistence
Stop the server (Ctrl+C), run `npm start` again, then `GET /api/state?view=summary`.
Totals are identical — everything is read from PostgreSQL, not memory.

### 18. Troubleshooting
| Symptom | Fix |
|---|---|
| `password authentication failed` | Wrong user/password in `DATABASE_URL`; re-check step 6. |
| `connection refused` / port error | Postgres not running or wrong port; ensure service is up on 5432. |
| `database "..." does not exist` | Create the DB (step 3) or fix the DB name in `DATABASE_URL`. |
| `relation "production_events" does not exist` | Migrations not run; run `npm run migrate`. |
| `EADDRINUSE :3000` | Another process on port 3000; change `PORT` in `.env`. |

---

## REST API examples

### POST /api/events — one event
```bash
curl -X POST http://localhost:3000/api/events -H 'Content-Type: application/json' \
 -d '{"source_id":"LINE-01","event_id":"EV-101","type":"COUNT","quantity":5,
      "target_event_id":null,"event_time":"2026-10-09T10:30:00Z"}'
```
`{"results":[{"event_id":"EV-101","status":"ACCEPTED","message":"Event processed"}]}`

### POST /api/events — batch (order preserved, invalid items don't drop valid ones)
```bash
curl -X POST http://localhost:3000/api/events -H 'Content-Type: application/json' \
 -d '[ {"source_id":"LINE-01","event_id":"EV-102","type":"COUNT","quantity":2,"event_time":"2026-10-09T10:31:00Z"},
      {"source_id":"LINE-01","event_id":"EV-103","type":"COUNT","quantity":"bad","event_time":"2026-10-09T10:31:00Z"} ]'
```

### GET /api/state
```bash
curl 'http://localhost:3000/api/state?view=summary'
curl 'http://localhost:3000/api/state?source_id=LINE-01&view=summary'
curl 'http://localhost:3000/api/state?view=pending'
curl 'http://localhost:3000/api/state?view=exceptions'
```

### POST /api/ack
```bash
curl -X POST http://localhost:3000/api/ack -H 'Content-Type: application/json' \
 -d '{"event_ids":["EV-101","EV-102"]}'
```

Allowed item statuses: `ACCEPTED`, `DUPLICATE`, `CONFLICT`, `PENDING_REFERENCE`, `REJECTED`.
Ack statuses: `ACKED`, `ALREADY_ACKED`, `NOT_READY`, `NOT_FOUND`.

---

## MQTT configuration

| Setting | Value |
|---|---|
| Broker | `152.42.238.142:1883` (MQTT 3.1.1) |
| Client ID | `fse01-{candidate_id}-{random}` |
| Subscribe | `fse-01/08/challenge` |
| Publish response | `fse-01/08/response` |
| Publish status | `fse-01/08/status` |
| QoS / retain | 1 / false |

The worker publishes `ONLINE` after subscribing, `HEARTBEAT` every 30s, an `OFFLINE` last-will, reconnects with exponential backoff and resubscribes. Replayed challenges return the stored response; a reused `challenge_id` with a changed body returns `FAILED`/`CHALLENGE_CONFLICT` without reprocessing.

Manual test with mosquitto clients:
```bash
mosquitto_sub -h 152.42.238.142 -p 1883 -t 'fse-01/08/response' -v &
mosquitto_pub -h 152.42.238.142 -p 1883 -t 'fse-01/08/challenge' -q 1 -m \
 '{"protocol_version":"1.0","candidate_id":"08","challenge_id":"CH-1","command":"PROCESS_EVENTS",
   "sent_at":"2026-10-09T10:45:00Z","expires_at":"2030-01-01T00:00:00Z",
   "events":[{"source_id":"LINE-01","event_id":"EV-101","type":"COUNT","quantity":5,
              "target_event_id":null,"event_time":"2026-10-09T10:30:00Z"}]}'
```

A ready-made Postman collection lives in `postman/CSI_FSE01.postman_collection.json`.

---

## Tests

```bash
npm test
```
29 automated tests cover COUNT totals, duplicates, VOID reversal, VOID-before-COUNT resolution, repeated acks,
conflicts, invalid input, mixed batches, competing pending VOIDs, source filtering, concurrent duplicates/VOIDs,
submission history, the HTTP contract, and MQTT replay/conflict/expiry/mismatch. Tests run against
`TEST_DATABASE_URL` (a dedicated DB) and never touch the dev database.

---

## Documentation

* `TECHNICAL_EXPLANATION.md` — architecture, entity model, transaction/concurrency strategy, assumptions.
* `AI_USAGE.md` — disclosure of AI assistance.
