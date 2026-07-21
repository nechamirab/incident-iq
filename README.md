# IncidentIQ

An AI-assisted incident-response and root-cause investigation tool for a university final
project. IncidentIQ helps engineering teams organize incident evidence, reconstruct timelines,
and reason carefully about root causes — while keeping humans in control of the final judgment.

The system is designed to always separate **facts** (directly supported by evidence), from
**assumptions** (plausible but unproven), **hypotheses** (explanations requiring testing), and
**actions** (concrete next steps). It never presents a hypothesis as a confirmed root cause.

> **Status:** Stage 3 — Incident Input and File Upload. Stage 1 established the frontend/backend
> skeleton; Stage 2 added the full domain model layer and mock data. Stage 3 makes incident
> creation real end-to-end: a validated New Incident form (React Hook Form + Zod), `.txt`/`.log`/
> `.json`/`.csv` file upload with format-specific parsing, evidence extraction/normalization, and
> a working `POST /api/incidents`. AI analysis is introduced in Stage 4.

## Architecture

Single repository, two runtimes, one shared model layer:

- **`src/`** — React + Vite + TypeScript frontend (Material UI, TanStack Query, React Router).
- **`server/`** — Express + TypeScript backend, exposing a REST API under `/api`.
- **`shared/`** — Zod schemas (source of truth) and inferred TypeScript types used by both the
  frontend and backend, so request/response/domain shapes are never duplicated.

### Domain model

Every domain entity is defined once as a Zod schema in `shared/schemas/`, with its TypeScript
type inferred from that schema (`z.infer<...>`) and re-exported from `shared/types/` for
ergonomic type-only imports. The model covers the full investigation lifecycle:

- **Incident** — metadata plus nested `evidence` and `analysisRuns`.
- **EvidenceItem** — a single, individually-referenceable piece of evidence.
- **ReasoningItem** — a categorized fact or assumption, always evidence-linked.
- **TimelineEvent** — a reconstructed event with an explicit timestamp-confidence label.
- **Hypothesis** — a falsifiable candidate explanation, with supporting/contradicting evidence.
- **BiasFinding** — a detected reasoning risk (confirmation bias, anchoring, etc.).
- **RecommendedAction** — a concrete, evidence-linked next step.
- **AnalysisRun** — the full, validated result of one AI (or mock) analysis pass.
- **Postmortem** — a human-reviewed draft report.

The AI never sets a hypothesis to `confirmed-by-human` — only an explicit human review action can.

### Mock data and persistence

`server/src/data/incidents/` ships three realistic, deliberately ambiguous synthetic incidents
(e-commerce checkout failure, course-registration slowdown, mobile login failure) — each with
8+ evidence items mixing plausible causes, red herrings, and contradictory signals, so no single
log line gives away the root cause. `server/src/repositories/` defines an `IncidentRepository`
interface and an in-memory implementation seeded from that data; later stages' controllers will
depend only on the interface, so a real database can be swapped in without touching calling code.

The frontend never talks to an AI provider directly and never holds an AI API key — all AI
integration happens on the backend (added in Stage 4).

### Incident intake and file parsing

The New Incident page lets a user describe an incident and paste evidence into seven
category-specific fields (application logs, error traces, monitoring alerts, deployment notes,
user complaints, API errors, database errors) — each mapped to its evidence source type via
a single shared lookup table (`shared/constants/evidenceFields.ts`) used by both the form and the
backend, so the mapping can never drift. Each non-empty pasted line becomes its own evidence item;
the description becomes a single evidence item.

Uploaded files (`.txt`, `.log`, `.json`, `.csv`, up to 2 MB each, 10 files per incident) are kept
in memory only (never written to disk, so a file name can never influence a server filesystem
path) and dispatched by extension to a dedicated parser:

- **`.txt` / `.log`** — one evidence item per non-empty line.
- **`.json`** — one evidence item per array element (or a single item for a top-level object),
  with a best-effort timestamp extracted from a recognizable field.
- **`.csv`** — one evidence item per data row, using the header row as field names.

Every parser only ever reads file content as text or parses it with `JSON.parse` / a hand-rolled
CSV tokenizer — uploaded content is never evaluated or executed. All evidence extraction (both
pasted text and uploaded files) is exercised end-to-end by `POST /api/incidents`, which creates
the incident and its full evidence list in one request.

## Technology stack

| Layer    | Technology                                                                 |
| -------- | --------------------------------------------------------------------------- |
| Frontend | React, Vite, TypeScript (strict), React Router, Material UI, TanStack Query, React Hook Form, Zod |
| Backend  | Node.js, Express, TypeScript (strict), CORS, dotenv, Zod, Multer            |
| Tooling  | ESLint (flat config), Prettier, Vitest, Supertest, npm workspaces           |

## Project structure

```
incident-iq/
  src/                     # Frontend application
    app/                   # App root, router, providers
    components/layout/     # Shared layout (header, shell)
    components/incidents/  # NewIncidentForm, LoadSampleIncidentButton, IncidentCreatedPanel
    components/evidence/   # FileUploadZone (drag-drop, preview, remove)
    pages/                 # Route-level page components
    hooks/                 # React hooks (useHealthCheck, useIncidents, useCreateIncident)
    services/              # Typed API clients
    schemas/               # Frontend-only Zod schemas (New Incident form)
    constants/              # Routes, query keys
    theme/                 # MUI theme tokens
    utils/                 # File validation/size formatting, sample-incident form mapping
  server/                  # Backend application
    src/
      app.ts               # Express app factory (dependency-injectable repository)
      server.ts            # HTTP listener entry point
      config/              # Environment configuration
      controllers/         # Request handlers
      routes/               # Route definitions
      middleware/           # Error handling, 404 handling, Multer upload, Zod body validation
      parsers/              # Text/JSON/CSV evidence parsers + extension dispatcher
      services/             # evidenceService, incidentService
      schemas/              # Server-only request schemas (incident intake)
      repositories/         # IncidentRepository interface + in-memory implementation
      data/incidents/       # Bundled synthetic sample incidents
      utils/                # ApiError, id generation, text normalization
    tests/                 # Vitest + Supertest (schemas, parsers, services, API routes)
  shared/
    schemas/               # Zod schemas (source of truth for every domain model)
    types/                 # TypeScript types inferred from the Zod schemas
    constants/              # File-upload limits, evidence-field-to-source-type mapping
  tests/                   # Frontend pure-logic Vitest tests (schemas, utils)
  .env.example
  package.json             # Frontend package + npm workspaces root
```

## Installation

Requires Node.js 20+ and npm 10+.

```bash
npm install
```

This installs both the frontend dependencies (root) and the backend dependencies
(`server/`, via the npm workspace).

## Environment variables

Copy the example file and adjust as needed:

```bash
cp .env.example .env
```

| Variable             | Used by  | Description                                                      |
| --------------------- | -------- | ------------------------------------------------------------------ |
| `PORT`                | backend  | Port the Express API listens on (default `4001`).                  |
| `NODE_ENV`             | backend  | `development`, `production`, or `test`.                            |
| `CORS_ORIGIN`          | backend  | Origin allowed to call the API (default the Vite dev server).      |
| `AI_PROVIDER`          | backend  | `mock` or `anthropic`. Introduced in Stage 4; leave as `mock`.      |
| `ANTHROPIC_API_KEY`    | backend  | Only required when `AI_PROVIDER=anthropic`. Never committed.       |
| `VITE_API_BASE_URL`    | frontend | Base URL the frontend uses to reach the backend (default `http://localhost:4001`). |

The backend loads `.env` from the repository root. The Anthropic API key is read only on the
backend and is never bundled into frontend code.

> If the backend fails to start with an "address already in use" error, another process on your
> machine already holds that port. Change `PORT` (and update `VITE_API_BASE_URL` to match) in
> `.env` and restart.

## Running the project

Run both frontend and backend together:

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:4001/api/health

Or run them separately:

```bash
npm run dev:client   # Vite dev server only
npm run dev:server   # Express API only (tsx watch mode)
```

The Dashboard page calls `/api/health` on load and displays the connection status, so a
successful load confirms the full stack is wired correctly.

## Building

```bash
npm run build            # builds frontend (dist/) and backend (server/dist/)
npm run build:client
npm run build:server
```

## Checks

```bash
npm run typecheck   # TypeScript project references, frontend + backend
npm run lint         # ESLint across the whole repository
npm run format        # Prettier --write
```

## Testing

```bash
npm run test          # frontend pure-logic tests, then backend tests
npm run test:client   # frontend only (Vitest, node environment)
npm run test --workspace=server   # backend only (Vitest + Supertest)
```

125 tests total:

- **Backend** (`server/tests/`, 100 tests) — every Zod schema, sample-data integrity, full
  `IncidentRepository` CRUD, every parser (text/JSON/CSV, including malformed-input rejection),
  `evidenceService`'s field-to-source-type mapping, the incident intake request schema, and full
  API route tests via Supertest (`POST`/`GET /api/incidents`, `GET /api/incidents/:id`) covering
  success paths, file uploads, invalid JSON, unsupported extensions, oversized files, and
  validation errors — each test run gets its own isolated in-memory repository via dependency
  injection (`createApp({ incidentRepository })`), never the shared process singleton.
- **Frontend** (`tests/`, 25 tests) — the New Incident form's Zod schema, client-side file
  validation, file-size formatting, and the sample-incident-to-form-values reconstruction logic.

Full component-level React Testing Library tests are introduced in Stage 10.

## Known limitations (Stage 3)

- No AI integration yet — `AnalysisRun`, `Hypothesis`, `BiasFinding`, and `RecommendedAction` are
  fully modeled and tested but have no real instances until Stage 4's AI provider generates them.
  The "Analyze incident" button is present but disabled, with a tooltip explaining why.
- The Incident Workspace page is still a navigation/layout placeholder — "View in workspace" after
  creating an incident links there, but the page itself doesn't render the incident yet (Stage 5+).
- Redaction of sensitive values (emails, tokens, credentials) is not implemented yet — the New
  Incident form shows a privacy warning, but no automatic redaction runs before storage (planned
  ahead of real AI calls in Stage 4).
- "Load sample incident" prefills the form's text fields from a bundled sample's evidence, but
  cannot reconstruct its uploaded files (samples have no underlying file objects, only their
  already-parsed evidence).
- No full-page/component-level frontend test suite (React Testing Library) yet — the form's logic
  is tested in isolation, but a real browser wasn't used to click through it (no browser tool is
  available in this environment); only the API layer was verified against a real running server.

## Roadmap

See the project brief for the full ten-stage plan: shared models & mock data, incident input &
file upload, AI provider architecture, evidence workspace, timeline & hypotheses, reasoning-risk
detection, critical AI review, postmortem export, and final testing/polish.
