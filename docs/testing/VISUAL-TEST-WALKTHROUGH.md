# AutoFix — Visual Product & End-to-End Workflow

This is the **user-facing product walkthrough** for AutoFix. It is intentionally different from a test log: each screenshot shows a real product screen, while the workflow behind it verifies the complete **frontend → API → backend → PostgreSQL → API response → frontend** path.

## What is AutoFix?

AutoFix is a full-stack automotive workshop platform covering the customer portal and the internal shop workflow:

**Customer portal → service request → workshop queue → customers → appointments → check-ins → inspections → estimates → repair orders → quality control → invoices → payments → inventory → reports**

The screenshots below are captured from the real Next.js frontend while it is connected to the real FastAPI backend and PostgreSQL database in CI.

## Architecture / request flow

```mermaid
flowchart LR
  U[Customer / Staff] --> FE[Next.js frontend]
  FE --> API[FastAPI REST API]
  API --> AUTH[Auth + authorization]
  API --> SVC[Domain services]
  SVC --> DB[(PostgreSQL)]
  DB --> SVC --> API --> FE
```

The browser tests do not mock the backend. They start PostgreSQL, apply migrations, seed data, start FastAPI, start Next.js, and then use Chromium against the running application.

## What the walkthrough proves

| Journey | What is verified |
|---|---|
| Staff dashboard | Dashboard data is loaded from the backend API |
| Customer portal request | Customer submits a request from the UI and receives a successful API response |
| Staff queue | The same persisted request is fetched by the staff UI after navigation/reload |
| Customer creation | Staff creates a customer through the UI, backend persists it, and the record survives reload |
| Workshop navigation | Core workshop modules render from the authenticated application |
| Full-stack environment | Frontend, FastAPI backend and PostgreSQL run together in CI |

## Visual walkthrough

### 01 — Dashboard

![AutoFix dashboard](visuals/01-dashboard.png)

The authenticated workshop dashboard is the starting point for the staff workflow. The test waits for the dashboard report API response before treating the page as verified.

### 02 — Attention centre

![AutoFix attention centre](visuals/02-attention-centre.png)

The operational attention view for work that needs staff action.

### 03 — Customers

![AutoFix customers](visuals/03-customers.png)

The customer directory used by the workshop team.

### 04 — Diary

![AutoFix diary](visuals/04-diary.png)

The appointment/diary workflow for scheduled workshop work.

### 05 — Check-ins

![AutoFix check-ins](visuals/05-check-ins.png)

The workshop check-in stage connecting incoming vehicles to operational work.

### 06 — Inspections

![AutoFix inspections](visuals/06-inspections.png)

Vehicle inspection information used before repair decisions.

### 07 — Estimates

![AutoFix estimates](visuals/07-estimates.png)

The estimate stage where proposed work can be reviewed before repair execution.

### 08 — Repair orders

![AutoFix repair orders](visuals/08-repair-orders.png)

The operational repair-order stage connecting approved work to workshop execution.

### 09 — Quality control

![AutoFix quality control](visuals/09-quality-control.png)

The quality-control stage before work is considered complete.

### 10 — Invoices

![AutoFix invoices](visuals/10-invoices.png)

The financial document stage after workshop work.

### 11 — Payments

![AutoFix payments](visuals/11-payments.png)

The payment and collection stage.

### 12 — Inventory

![AutoFix inventory](visuals/12-inventory.png)

Parts and inventory management used by the workshop.

### 13 — Reports

![AutoFix reports](visuals/13-reports.png)

Reporting and operational/financial visibility.

### 14 — Customer portal creates a request

![Customer portal request](visuals/14-customer-portal-request-created.png)

This is the important cross-system moment: a customer signs into the portal, submits **E2E brake inspection**, and the browser waits for the real `POST /api/v1/portal/service-requests` response with HTTP 201.

That means the screenshot is not just a frontend form demonstration—the request has crossed the API boundary successfully.

### 15 — Staff queue receives the persisted request

![Staff queue received request](visuals/15-staff-queue-received-request.png)

The test then signs in as staff, loads the service-request queue, waits for the real backend `GET /api/v1/service_requests/` response, and verifies the same request.

This demonstrates the full persistence path:

**Customer UI → FastAPI POST → PostgreSQL persistence → FastAPI GET → Staff UI**

## Customer creation persistence flow

The second end-to-end workflow creates a customer from the staff UI, captures the returned backend-created ID, navigates away, searches the customer directory, opens the created record, reloads the page, and verifies the email again.

That demonstrates:

**Staff UI → POST /api/v1/customers/ → PostgreSQL → GET/search → customer detail → browser reload**

## Technology stack

- **Frontend:** Next.js, React, TypeScript
- **Backend:** FastAPI, Python
- **Data access:** SQLAlchemy async
- **Database:** PostgreSQL
- **Authentication:** authenticated frontend sessions + backend authorization
- **Browser testing:** Playwright + Chromium
- **CI:** GitHub Actions

## Verification evidence

**Frontend full-stack CI — Run #13**

[View successful CI run](https://github.com/faizansaiyed123/autofix_frontend/actions/runs/39789883163)

The successful run completed:

- Frontend build ✅
- PostgreSQL service + migrations ✅
- Backend startup/health check ✅
- Frontend startup ✅
- Playwright browser suite: **3/3 passed** ✅
- Browser evidence uploaded by CI ✅

The backend repository also has its independent automated test suite, with **935/935 tests passing** in the verification run used during this work.

## Why this matters in an interview

AutoFix demonstrates more than isolated screens. The important engineering boundary is:

**User action → React/Next.js UI → REST API → FastAPI authorization/domain logic → PostgreSQL persistence → API response → updated UI**

The walkthrough therefore gives a recruiter or interviewer both things they need:

1. **What the product looks like and how the user moves through it**
2. **Evidence that the visible workflows are backed by a real backend and database rather than mocked frontend state**

[Testing index](README.md) · [Screenshot manifest](visuals/manifest.json)
