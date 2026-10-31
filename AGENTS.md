# AICTE Approval360 architecture

This is an independent SIH 2026 demonstration, not an official AICTE service. Preserve that distinction in UI and documentation. Seeded people, institutions, documents, and decisions are fictional.

## Layout

- `src/`: React 18, TypeScript, Vite, React Router. `App.tsx` owns bootstrap state, dialogs, workspace context, session selection, navigation, and refresh. `pages/Dashboard.tsx` derives metrics/charts from API records. `pages/Modules.tsx` holds module views. Shared UI/forms/tables/application details are under `components/`.
- `src/styles.css`: restrained navy government-operations design, responsive sidebar/cards/tables, dialog states, print stylesheet. Tailwind is available. Lucide icons are the established visual vocabulary; no generated imagery is needed for this product.
- `server/api.ts`: Netlify data API with Identity authentication and intentionally public fictional demo sessions. `server/workflow.ts` is pure shared validation, scoring, and explainable advisory logic. It must stay free of Node-only imports because the frontend also imports it.
- `db/schema.ts`: authoritative Drizzle PostgreSQL schema. `db/index.ts` creates clients within request execution. `netlify/database/migrations/` contains generated schema changes and a deterministic seed SQL file.
- `netlify/functions/api.mts`: `/api/*`; `python-api.mts`: same-origin `/python-api/*` gateway; `deadline-monitor.mts`: daily production deadline alerts, escalations, and expired-session cleanup.
- `backend/`: separate Flask gateway and scikit-learn synthetic-data predictor. It forwards the caller's session to `/api/*`; it never holds a privileged service credential or writes an external/local database. `backend/Procfile` describes a production worker.
- `database/seed.py`: source generator for fictional migration data, not runtime persistence.

## Conventions and critical decisions

Use Netlify Database with `@netlify/database` and Drizzle beta for all structured persistence, and private Netlify Blobs for file bytes. New schema assumptions require generated migrations; never edit an applied migration. Netlify applies migrations, not application startup. No local JSON or in-memory application-state fallback.

Identity owns password hashing and JWT verification. Trusted Identity app roles can initialize officer roles; user metadata cannot. Regular users share the `live` workspace; institution administrators are additionally restricted by institution ownership. Public demo role sessions access only the `demo` workspace. Keep demo and real-account boundaries on every query and mutation.

Demo sessions use random HttpOnly cookies; persist only token hashes. They are intentionally available without passwords for a public walkthrough. Do not present them as production authentication. Do not log request cookies, JWTs, environment values, credentials, or document contents.

System administrators do not bypass workflow roles. Submission requires six document categories. Completing scrutiny and later approval gates require verified documents. Bureau recommendation/final approval require the configured weighted score. Status changes, history, alerts, and audit events commit transactionally with an optimistic version check. Final statuses are terminal. API authorization must back up UI restrictions.

Use mandatory evidence/decision comments, scoped lookups, parameterized Drizzle queries, PDF MIME/signature/size checks, randomized private blob keys, and authenticated downloads. API failures must not show success messages. CSV output must escape spreadsheet formulas.

The hosted assistant is deterministic advisory rules, clearly labeled. The separately hosted Python service adds a random forest trained on synthetic examples, with actual synthetic holdout error and explanations. Do not claim official checks, real-world model accuracy, or automatic AI approval.

The default frontend API base is `/api`. Connecting Flask requires `VITE_API_BASE_URL=/python-api` and runtime `PYTHON_API_ORIGIN`; Flask's upstream points to the core Netlify origin, preventing recursive forwarding. See README for commands and service configuration.

Tests live in `server/workflow.test.ts` and `backend/tests/`. Follow the active environment's validation restrictions: this generation run prohibited build/start/test commands and used file review only. Do not claim integration coverage has passed without executing it in an authorized environment.
