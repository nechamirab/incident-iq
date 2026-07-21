# IncidentIQ

An AI-assisted incident-response and root-cause investigation tool for a university final
project. IncidentIQ helps engineering teams organize incident evidence, reconstruct timelines,
and reason carefully about root causes — while keeping humans in control of the final judgment.

The system is designed to always separate **facts** (directly supported by evidence), from
**assumptions** (plausible but unproven), **hypotheses** (explanations requiring testing), and
**actions** (concrete next steps). It never presents a hypothesis as a confirmed root cause.

> **Status:** Stage 2 — Shared Domain Models and Mock Data. Stage 1 established the
> frontend/backend skeleton and a working health check. Stage 2 adds the full domain model layer
> (Incident, Evidence, Hypothesis, Bias Findings, Recommended Actions, Analysis Runs, Postmortem)
> with Zod validation, three richly detailed synthetic incident datasets, and an in-memory
> repository. Incident intake, file upload, and AI analysis are introduced in later stages.

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

## Technology stack

| Layer    | Technology                                                                 |
| -------- | --------------------------------------------------------------------------- |
| Frontend | React, Vite, TypeScript (strict), React Router, Material UI, TanStack Query |
| Backend  | Node.js, Express, TypeScript (strict), CORS, dotenv, Zod                    |
| Tooling  | ESLint (flat config), Prettier, Vitest, npm workspaces                      |

## Project structure

```
incident-iq/
  src/                     # Frontend application
    app/                   # App root, router, providers
    components/layout/     # Shared layout (header, shell)
    pages/                 # Route-level page components
    hooks/                 # React hooks (e.g. useHealthCheck)
    services/              # Typed API clients
    constants/              # Routes, query keys
    theme/                 # MUI theme tokens
  server/                  # Backend application
    src/
      app.ts               # Express app factory
      server.ts            # HTTP listener entry point
      config/              # Environment configuration
      controllers/         # Request handlers
      routes/               # Route definitions
      middleware/           # Error handling, 404 handling
      repositories/         # IncidentRepository interface + in-memory implementation
      data/incidents/       # Bundled synthetic sample incidents
      utils/                # ApiError, id generation, shared backend utilities
    tests/                 # Vitest unit tests (schemas, mock data, repository)
  shared/
    schemas/               # Zod schemas (source of truth for every domain model)
    types/                 # TypeScript types inferred from the Zod schemas
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
npm run test   # Vitest: schemas, sample data integrity, repository behavior (53 tests)
```

Backend unit tests live in `server/tests/` and cover: every Zod schema (accepting valid data,
rejecting invalid enums/out-of-range confidence/missing fields), integrity of the three sample
incident datasets (unique ids, evidence linkage, parseable timestamps), and full CRUD behavior of
the in-memory `IncidentRepository`. Frontend and API-level tests are introduced in later stages.

## Known limitations (Stage 2)

- No AI integration yet — `AnalysisRun`, `Hypothesis`, `BiasFinding`, and `RecommendedAction` are
  fully modeled and tested but have no real instances until Stage 4's AI provider generates them.
- Nothing is wired to HTTP yet: the repository and mock data exist and are tested directly, but no
  `/api/incidents` routes exist until Stage 3.
- The New Incident and Incident Workspace pages are still navigation/layout placeholders.
- No frontend or API-level test suite yet (Stage 10).

## Roadmap

See the project brief for the full ten-stage plan: shared models & mock data, incident input &
file upload, AI provider architecture, evidence workspace, timeline & hypotheses, reasoning-risk
detection, critical AI review, postmortem export, and final testing/polish.
