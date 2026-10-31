# AICTE Approval360

An independent Smart India Hackathon 2026 demonstration of institution approval workflows, compliance monitoring, document verification, explainable assistance, and alert management. All seeded institutions, people, documents, and decisions are fictional. This application has no official AICTE integration and does not perform regulatory verification.

## Architecture

The React 18 + TypeScript + Vite application uses React Router, Tailwind CSS, Lucide, Recharts, and Axios. The hosted data API uses Netlify Functions, managed PostgreSQL through `@netlify/database` and Drizzle, and private Netlify Blobs for PDFs. Netlify Identity handles password hashing, email confirmation, JWT sessions, and real account authentication.

Flask is included as a **separately hosted API gateway and Python AI service**, following the chosen split deployment. It forwards authenticated operations to the Netlify data API and runs a scikit-learn delay predictor. PostgreSQL migrations and operational persistence are owned by Drizzle; Flask-SQLAlchemy and Flask-JWT-Extended are deliberately not duplicated because the deployed storage and authentication layers are Netlify Database and Identity. This is an architectural adaptation of the requested stack, not a standalone Flask/SQLAlchemy database implementation.

```text
src/                         React application
  components/                Forms, dialogs, tables, application detail
  pages/                     Dashboard and functional workspace modules
  services/                  Axios API client and CSV export
  types/                     Shared data contracts and role names
db/                          PostgreSQL schema and Drizzle client
server/                      Data API, workflow rules, advisory rules, sample PDF generator
netlify/functions/           Hosted API, Flask proxy, daily deadline monitor
netlify/database/migrations/ Generated schema/integrity migrations and fictional seed migration
backend/                     Separate Flask service
  app/ai/                    Reproducible synthetic-data random forest model
  tests/                     Python model tests
database/seed.py             Deterministic SQL seed-source generator
```

## Quick start: hosted data API and React

Requirements: Node 22.12 or later, npm, Netlify CLI, and this project linked to its Netlify site.

```bash
npm install
netlify login
netlify link
netlify dev --port 8889
```

Open `http://localhost:8889`. Use Netlify Dev rather than the Vite server alone: authentication, functions, database connectivity, and file storage need the Netlify runtime. The first deployment provisions PostgreSQL and applies the committed migrations before publishing. If the initial database is not ready, the interface shows an explicit service error and Retry button, not fabricated metrics.

For frontend-only development against an already configured API, `npm run dev` runs Vite on port 5173, but same-origin Identity and server operations should be exercised through Netlify Dev.

There is no SQLite, local JSON, or in-memory persistence fallback. PostgreSQL and Netlify Blobs are required for working data operations.

## Demo roles

Open **Switch role → Explore demo**. Choose any of the five passwordless demo sessions:

| Role | Operations |
| --- | --- |
| Institution Administrator | Register institutions, create drafts, upload/replace evidence, submit/resubmit |
| Scrutiny Officer | Begin scrutiny, verify/reject documents, request clarification, complete scrutiny |
| Bureau Officer | Record eight compliance assessments, request clarification, recommend final review |
| Approving Authority | Record final approval or rejection with a mandatory comment |
| System Administrator | Manage user permissions, bureau assignments, bureaus, and demonstration settings |

These are explicitly public role previews in the shared `demo` workspace, **not privileged production accounts**. No demo passwords are required or stored. Sessions use cryptographically random, HttpOnly cookies with an eight-hour expiry; only their hashes are persisted. A visitor can switch roles intentionally for a complete SIH walkthrough. Other demo visitors can see shared changes. Use fictional data only.

The landing dashboard is a read-only database-backed demo overview. Opening a private document or performing an operation requires a role session. Regular Identity accounts operate in the separate `live` workspace. Institution administrators can only access institutions they own. Officer and administrator accounts can access the live team workspace according to their permissions.

## Real accounts and the first administrator

Use **Switch role → Register** to create an Institution Administrator account. Confirm the email before signing in. Netlify Identity stores and hashes passwords; the application never stores them.

For the first real system administrator, use the site's Netlify **Identity** screen to invite a user, then assign the trusted `admin` role. Accept the invite through the application. The trusted `admin` claim promotes that account's database role. Further workspace role assignments are managed in Users & bureaus. The other trusted role keys are `institution`, `scrutiny`, `bureau`, and `authority`.

User-controlled profile metadata cannot grant officer roles. System administrators cannot bypass workflow responsibilities or approve/reject applications. Use the role assigned to the actual workflow stage.

## Run the separate Flask service

Requirements: Python 3.11 or later.

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export NETLIFY_DATA_API_ORIGIN=http://localhost:8889
export FRONTEND_ORIGIN=http://localhost:8889
python run.py
```

The service listens on `http://localhost:5000`; `GET /health` reports process health. On Windows PowerShell, activate with `.venv\Scripts\Activate.ps1` and set the two variables using `$env:NAME = 'value'`.

To route the frontend through Flask locally, set the following non-secret configuration in the root `.env` and restart Netlify Dev:

```dotenv
VITE_API_BASE_URL=/python-api
PYTHON_API_ORIGIN=http://localhost:5000
```

Keep the Flask `NETLIFY_DATA_API_ORIGIN` pointed at the **core Netlify origin**, not the Flask gateway. The request path is browser → same-origin `/python-api` proxy → Flask `/api` → Netlify `/api` → PostgreSQL/Blobs. This avoids cross-domain browser cookies and keeps authorization checks at the data boundary. Flask forwards the user's session; it has no master application credential and cannot bypass roles.

When Flask is not connected, leave `VITE_API_BASE_URL` unset. All operational modules work through the default `/api`, and advisory results are honestly labeled as transparent rules. The trained Python model is used only when requests go through Flask.

## Complete demonstration walkthrough

1. Enter the Institution Administrator demo role. Register a fictional institution, then create a new draft application.
2. Open Documents inside the application and upload a PDF in each of the six required categories. PDFs must have a valid PDF signature, the PDF MIME type, and a size from 5 bytes to 4 MB. Existing categories can be replaced while Draft or Clarification Required.
3. Submission without all categories fails with a clear error. After completing the documents, submit with a comment.
4. Switch to Scrutiny Officer, open the submitted application in Approval workflow, and begin scrutiny. Preview evidence, then verify each document with comments. Completing scrutiny requires all six documents verified. Clarification sends the application back to its institution administrator, who can replace documents and resubmit.
5. Switch to Bureau Officer and assess all eight compliance categories. New institutions start at zero, so they need recorded assessments. The weighted score must meet the configured threshold before final review. Recommend the application for approval with a comment.
6. Switch to Approving Authority and record approval or rejection. Decisions require a comment. Approved/rejected applications are terminal.
7. Inspect the resulting notifications, per-user read state, approval history, and audit trail. Export CSV reports or print a report.
8. Open AI assistance in the application and run the analysis. Inspect missing categories, risk, priority, estimated delay, and the explanation. When the Flask gateway is connected, this includes a trained synthetic-data random forest and synthetic holdout metrics.

## Data, rules, and migrations

`db/schema.ts` defines normalized users, roles, institutions, applications, documents, officers, bureaus, compliance requirements and records, notifications and read receipts, approval history, audit logs, escalations, settings, and demo sessions. Foreign keys, unique indexes, score/intake checks, document checks, and status checks protect data integrity. Workflow status changes use transactions with optimistic version checks; history, notification, and audit events commit with the status change.

Committed migrations include 20 fictional institutions, 50 applications across eight statuses, 160 compliance assessments, fictional officers, sample document metadata, notifications, audit entries, stage snapshots, and escalations. Seed document downloads produce an actual clearly marked fictional PDF. No real uploaded file is claimed to be seeded evidence. Seed history is a demonstration snapshot, not a complete historical chain.

The compliance score is a weighted average over all eight requirements. Missing assessments count zero. Category thresholds and weights are documented in the seed. Admin settings configure the overall approval threshold, new application SLA, and warning window. Existing application deadlines are preserved when settings change.

After changing the schema, generate a new migration:

```bash
npm run db:generate -- --name describe_schema_change
```

Netlify applies migrations during deployment. Do not manually run migrations against the hosted database. `database/seed.py` regenerates the deterministic seed source; it does not connect to PostgreSQL. Do not regenerate or edit migrations that have already been deployed; roll forward instead.

The daily scheduled deadline monitor runs on published deploys, creates deduplicated deadline alerts, automatically escalates sufficiently overdue applications, and removes expired demo sessions. Deploy previews do not run the schedule. Interactive deadline and escalation views work independently of the schedule.

## AI model and its limits

`backend/app/ai/delay.py` generates 1,600 synthetic examples using NumPy seed 360, uses a reproducible 80/20 train/test split, and fits a 90-tree random forest regressor. Features: missing categories, number of violations, pending days, compliance score, and days to deadline. Training inputs are clipped to documented synthetic ranges for prediction. Responses include feature importance and actual synthetic holdout mean absolute error calculated by the service; no accuracy number is hardcoded.

Synthetic holdout performance does not establish real-world accuracy. The hosted rule-based fallback is not described as a trained model. Document completeness checks categories, not semantic PDF validity or official authenticity. No AI operation changes an application status. Authorized human officers make all final decisions.

## Verification instructions

Automated test sources are provided. Local build, server, and test commands were not executed during generation because this environment delegates validation to its deployment pipeline. The following commands are for the developer to run:

```bash
npm test
cd backend
python -m pytest tests -q
```

The TypeScript tests cover unauthorized transitions (including administrator decision bypass), missing-document submission, compliance gates, missing-category weighting, and explained overdue risk. Python tests cover deterministic, explained model output and increasing delay with adverse features.

After deployment, complete the walkthrough above and verify:

- Each of the five role sessions opens the correct operations; institutional users cannot access administrative modules.
- Direct unauthorized API calls return 401/403, and cross-workspace IDs cannot be accessed.
- Registration and drafts survive refresh; new institutions receive all eight assessment records.
- Non-PDF, incorrect PDF signatures, and oversized uploads fail without a success message.
- An unauthenticated PDF download fails; authorized previews and downloads work.
- Unverified documents and deficient scores block progression; invalid status jumps fail.
- Two stale transition requests do not both commit; the second returns 409.
- Notifications and audit records reflect actions; read state persists per user.
- Search/status/state/risk filters update results; CSV output matches the selected report and escapes formula cells.
- The six report types print/export, escalation resolve/reopen works, and settings persist.
- When connected, Flask predictions show the synthetic-model method and metrics, and unavailable services show errors.

These are verification instructions, not a claim that integration tests have passed.

## Publish the demonstration

The repository includes `netlify.toml`: install dependencies, run `npm run build`, publish `dist`, and deploy functions from `netlify/functions`. Link the repository in Netlify and publish. The platform provisions the database and applies migrations at deployment. Identity has been enabled; configure signup/invitation and email settings in the Netlify dashboard.

For the Python model, deploy `backend/` to a Python-capable host. Free service tiers, when available, may sleep and have changing limits; a local Flask service is also suitable for a live presentation. Use Python 3.11+, install `backend/requirements.txt`, and start with:

```bash
gunicorn run:app --bind 0.0.0.0:$PORT --workers 2 --timeout 60
```

Run this command from `backend/`. Set the Flask service's `NETLIFY_DATA_API_ORIGIN` to the published Netlify site origin and `FRONTEND_ORIGIN` to the same frontend origin. In Netlify, set `PYTHON_API_ORIGIN` to the HTTPS Flask service origin and `VITE_API_BASE_URL` to `/python-api`, then redeploy. The Flask host needs outbound HTTPS access to the Netlify site; no external database service is required.

Netlify hosting and database/storage usage are subject to the account's current quotas. This repository does not provision a separate Python host, guarantee free quotas, or claim that the Flask service is already published. Never put secrets in variables beginning with `VITE_`, source code, screenshots, or logs.
