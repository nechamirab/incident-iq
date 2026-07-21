# IncidentIQ

An AI-assisted incident-response and root-cause investigation tool for a university final
project. IncidentIQ helps engineering teams organize incident evidence, reconstruct timelines,
and reason carefully about root causes — while keeping humans in control of the final judgment.

The system is designed to always separate **facts** (directly supported by evidence), from
**assumptions** (plausible but unproven), **hypotheses** (explanations requiring testing), and
**actions** (concrete next steps). It never presents a hypothesis as a confirmed root cause.

> **Status:** Stage 1 — Foundation. This stage establishes the frontend/backend skeleton,
> navigation, theming, and a working health check between the two. Incident intake, file parsing,
> and AI analysis are introduced in later stages.

## Architecture

Single repository, two runtimes, one shared type layer:

- **`src/`** — React + Vite + TypeScript frontend (Material UI, TanStack Query, React Router).
- **`server/`** — Express + TypeScript backend, exposing a REST API under `/api`.
- **`shared/`** — TypeScript types used by both the frontend and backend (e.g. the API response
  envelope), so request/response shapes are never duplicated.

The frontend never talks to an AI provider directly and never holds an AI API key — all AI
integration happens on the backend (added in Stage 4).

## Technology stack

| Layer    | Technology                                                                 |
| -------- | --------------------------------------------------------------------------- |
| Frontend | React, Vite, TypeScript (strict), React Router, Material UI, TanStack Query |
| Backend  | Node.js, Express, TypeScript (strict), CORS, dotenv                         |
| Tooling  | ESLint (flat config), Prettier, npm workspaces                              |

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
      utils/                # ApiError, shared backend utilities
  shared/
    types/                 # Types shared by frontend and backend
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
| `PORT`                | backend  | Port the Express API listens on (default `4000`).                  |
| `NODE_ENV`             | backend  | `development`, `production`, or `test`.                            |
| `CORS_ORIGIN`          | backend  | Origin allowed to call the API (default the Vite dev server).      |
| `AI_PROVIDER`          | backend  | `mock` or `anthropic`. Introduced in Stage 4; leave as `mock`.      |
| `ANTHROPIC_API_KEY`    | backend  | Only required when `AI_PROVIDER=anthropic`. Never committed.       |
| `VITE_API_BASE_URL`    | frontend | Base URL the frontend uses to reach the backend (default `http://localhost:4000`). |

The backend loads `.env` from the repository root. The Anthropic API key is read only on the
backend and is never bundled into frontend code.

## Running the project

Run both frontend and backend together:

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:4000/api/health

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

Automated tests are introduced in a later development stage.

## Known limitations (Stage 1)

- No incident data model, persistence, or AI integration yet — these arrive in Stages 2–4.
- The New Incident and Incident Workspace pages are navigation/layout placeholders only.
- No automated test suite yet (Stage 10).

## Roadmap

See the project brief for the full ten-stage plan: shared models & mock data, incident input &
file upload, AI provider architecture, evidence workspace, timeline & hypotheses, reasoning-risk
detection, critical AI review, postmortem export, and final testing/polish.
