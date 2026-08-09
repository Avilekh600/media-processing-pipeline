# Intelligent Media Processing Pipeline

Backend system for uploading vehicle images and asynchronously analyzing them for common
field-upload issues (blur, low light, duplicates, invalid plate format, etc).

**Status:** Core async pipeline complete (upload → queue → background processing → status/result APIs).
Image analysis checks (blur/brightness/duplicate/OCR) are the next phase — see Trade-offs below.

## Architecture

### Service Flow
1. Client uploads an image via `POST /api/upload`
2. Server saves the file to disk, inserts a `pending` row into SQLite, and immediately
   returns a unique `id` to the client — the HTTP request never waits for processing
3. The upload is pushed onto an in-memory queue and a background worker picks it up
4. Worker updates status to `processing`, runs analysis, then `completed` or `failed`
5. Client polls `GET /api/status/:id` or `GET /api/result/:id` to check progress

### Processing Flow

### Queue Strategy
Implemented a custom **in-memory FIFO queue** (array-based) rather than Redis/BullMQ or SQS.

**Reasoning:** for a 48-hour take-home with a single-instance server, an in-memory queue
demonstrates the same core concepts (async processing, status tracking, sequential job
handling) without the setup overhead of running a separate Redis instance. It processes
one job at a time via a recursive `processNext()` loop, so there's no race condition on
shared resources like the SQLite connection.

**Known limitation:** queue state is lost if the server restarts (jobs mid-flight are
gone). In production, I'd use BullMQ + Redis for persistence, retries, and horizontal
scaling across multiple worker processes.

### Major Design Decisions
- **SQLite (via Node's built-in `node:sqlite`) instead of PostgreSQL** — zero external
  service to install/configure, appropriate for a 48h scope and single-instance deployment.
  Switched from `better-sqlite3` after it caused native-module segfaults in dev; Node's
  built-in module (stable enough despite the "experimental" flag) avoided that entirely.
- **Multer + local disk storage instead of S3** — same reasoning: no cloud credentials
  needed to run this locally within the time constraint.

## Database Schema

`media_uploads` table:
| Column | Type | Notes |
|---|---|---|
| id | TEXT (PK) | UUID |
| filename | TEXT | original uploaded filename |
| filepath | TEXT | stored filename on disk |
| status | TEXT | pending / processing / completed / failed |
| phash | TEXT | perceptual hash, for duplicate detection |
| result | TEXT | JSON blob of analysis results |
| failure_reason | TEXT | populated only if status = failed |
| uploaded_at | TEXT | ISO timestamp |
| completed_at | TEXT | ISO timestamp |

## API Reference

### `POST /api/upload`
Multipart form upload, field name `image`.
```json
// Response 201
{ "id": "uuid", "status": "pending", "message": "..." }
```

### `GET /api/status/:id`
```json
{ "id": "uuid", "status": "completed" }
```

### `GET /api/result/:id`
```json
{ "id": "uuid", "status": "completed", "result": { ... } }
```

## AI Usage Disclosure

- Used Claude to scaffold the Express routes, SQLite schema, and in-memory queue logic.
- AI-generated code initially used `better-sqlite3`, which crashed with a native-module
  segfault (`-1073741819`) on my Windows machine — validated by testing the module in
  isolation via `node -e`, then switched to Node's built-in `node:sqlite` after confirming
  it worked standalone.
- Also hit a case where nodemon's default file-watcher (`watching path(s): *.*`) was
  restarting the server mid-request because it watched the `uploads/` folder our own API
  writes to — fixed via a `nodemon.json` ignore list. Diagnosed this by reading the nodemon
  log output rather than assuming the fix would work blindly.
- All code was run and manually tested (curl / Thunder Client / browser) after each step
  rather than accepted on faith — several syntax and stale-process issues were caught this way.

## Trade-offs

**What I intentionally simplified:**
- In-memory queue instead of Redis/BullMQ (see Queue Strategy above)
- Local disk storage instead of S3
- SQLite instead of PostgreSQL
- `.env` file present but not yet wired into the app (PORT is still hardcoded)

**What I'd improve with more time:**
- Move to Redis-backed queue for durability across restarts and horizontal scaling
- Add retry logic with exponential backoff for failed analysis jobs
- Add authentication on upload endpoints
- Add automated tests (currently manually tested via curl/Thunder Client)

**Scalability concerns:** the in-memory queue only works for a single server instance —
scaling to multiple instances would require a shared queue (Redis) since each instance
would otherwise have its own independent, inconsistent queue.

**Failure handling:** currently a single failed check doesn't fail the whole job (each
check is wrapped individually), but there's no retry mechanism yet if a check throws
transiently.

## Running Locally

```bash
cd backend
npm install
node --experimental-sqlite --no-warnings src/server.js
```

Server runs on `http://localhost:3000`.

### Sample request
```bash
curl.exe -X POST http://localhost:3000/api/upload -F "image=@path\to\image.jpg"
```

## Assumptions
- Single-instance deployment (no horizontal scaling required for this take-home)
- Vehicle plate format assumed to follow the Indian standard (2 letters, 2 digits,
  1-2 letters, 4 digits)