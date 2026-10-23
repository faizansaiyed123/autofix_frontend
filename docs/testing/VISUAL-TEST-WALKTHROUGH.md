# AutoFix — Visual Product Walkthrough & Verified Full-Stack Flows

AutoFix brings the customer experience and the workshop's day-to-day operation into one automotive service platform. This walkthrough is written for customers, recruiters, reviewers and anyone who wants to understand the product from its actual screens—not from a list of code modules.

> **Evidence boundary:** screenshots in this document are captured by the Playwright browser run against a running Next.js app, a running FastAPI app and a disposable PostgreSQL database. Mutating scenarios are described as verified only when the test observes the real HTTP response and reads the resulting record back. A screenshot proves what the screen displayed; it does not, on its own, prove persistence.

## The product at a glance

**Customer portal → service request → workshop queue → customer & vehicle → appointment → check-in → inspection → estimate → repair order → quality control → invoice → payment → stock & purchasing → reporting**

The application is designed around a single source of business data. The browser sends requests to the API, the backend applies authentication, permission checks and domain rules, PostgreSQL stores or retrieves the rows, and the response is rendered back into the UI.

```mermaid
flowchart LR
  C[Customer] --> P[Customer portal]
  S[Workshop team] --> W[Workshop workspace]
  P --> A[FastAPI API]
  W --> A
  A --> R[Validation, rules and permissions]
  R --> DB[(PostgreSQL)]
  DB --> R
  R --> A
  A --> P
  A --> W
```

## 1. Entering AutoFix

### Public homepage

![AutoFix public homepage](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/00-homepage.png)

The public page introduces the workshop platform and provides entry points for customer accounts and staff sign-in. The browser suite checks that the page is reachable and that the narrow mobile layout does not overflow the viewport.

### Customer account creation

![Customer account creation form](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/00-signup.png)

Customers submit their own details. Public signup does not let a new user choose a staff role. The backend creates the user, assigns the customer role, connects a customer record, and queues a verification email as one database transaction. Duplicate-email responses intentionally do not reveal whether an account already exists.

### Verify the address and recover access

![Verification link error handling](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/40-invalid-verification-link.png)

An actual invalid verification link is submitted to the API and rejected. The UI removes the token fragment from the address bar before the user confirms the action. A used, expired or invalid token does not activate an account.

![Password reset error handling](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/41-invalid-password-reset.png)

Password recovery uses a one-time link. In a successful flow, the reset token is carried in the email fragment, the backend checks it, updates the password hash, and invalidates the old authentication generation. The test suite also checks that reusing an already-consumed reset token is rejected.

### Successful verification and password recovery

![Registration submitted to the real API](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/28-registration-submitted.png)

The form submits to `POST /api/v1/auth/register` and expects HTTP 202. The next step reads the email actually delivered by the backend outbox worker; the verification token is extracted from that message, not invented by the browser test.

![Email verified and customer portal opened](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/29-verified-customer-portal.png)

The test follows the message link and submits the one-time token to `POST /api/v1/auth/verify-email`. HTTP 200 establishes the customer's session and the UI reaches the customer portal.

![Password reset request submitted](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/30-password-reset-requested.png)

The forgot-password page submits the email to `POST /api/v1/auth/password-reset/request`. The actual reset email is read from the test SMTP inbox, and its token is used in the next step.

![Password has been updated](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/31-password-reset-confirmed.png)

The reset confirmation endpoint changes the password and invalidates the previous authentication generation. The test then confirms the old password receives HTTP 401, the new password receives HTTP 200, and the customer can sign in again.

![Customer signed in with the new password](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/32-password-changed-login.png)

### Live service-flow data versus UI-only behavior

Registration, verification and recovery are tested against the actual backend API. In CI, a local SMTP inbox receives mail via SMTP with STARTTLS so the backend's email outbox worker and PostgreSQL token lifecycle are exercised. It is a controlled test inbox, not a fake browser response or a test of delivery to a real customer's mailbox.

## 2. Workshop workspace

### Dashboard

![AutoFix dashboard](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/01-dashboard.png)

The dashboard gives the team a quick read on active workshop work and financial activity. The browser test waits for the live dashboard API response and confirms the invoiced, collected and work-in-progress summary areas appear.

### Attention centre

![AutoFix attention centre](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/02-attention-centre.png)

The attention centre collects operational items that need somebody to act. It is backed by the application's API rather than a static list.

### Customers

![Customer directory](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/03-customers.png)

The customer book holds names, contact details, preferred contact method and status. Staff can search and filter the directory, open a customer record and work with the vehicle and service history attached to that customer.

### Diary and appointments

![Workshop diary](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/04-diary.png)

The diary offers calendar and list views of workshop bookings. Appointment rules restrict status changes to the transitions allowed by the backend; a cancelled booking also requires a reason. Conflict checking is an API capability and should be treated as a business rule, not merely a calendar decoration.

### Check-ins

![Vehicle check-ins](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/05-check-ins.png)

Check-in records a vehicle's arrival, the odometer and condition notes. The browser persistence scenario creates a real vehicle, refuses an invalid odometer in the UI, submits a valid check-in to the API, changes its status and reloads the list to verify the stored status and vehicle association.

![Vehicle details after API read-back](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/26-vehicle-details.png)

The vehicle detail view is the read-back step after vehicle creation. The test observes the create response, requests the new record by ID and confirms it appears on the page.

![Check-in status transition after API update](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/27-checkin-status-transition.png)

The check-in's status update is an actual PATCH request. A subsequent GET after navigation verifies the updated status came back from the backend.

### Inspections

![Inspection records](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/06-inspections.png)

Inspections connect findings to the relevant vehicle and customer. Each item can capture a condition, measurement, notes and a recommendation. The backend freezes completed inspection findings and refuses completion if the inspection has no items.

### Estimates

![Workshop estimates](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/07-estimates.png)

An estimate turns proposed labour and parts into a customer decision. The API calculates and stores totals; customer decisions are made per line, so optional work can be declined without silently appearing on the final bill.

### Repair orders

![Repair orders](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/08-repair-orders.png)

Repair orders turn agreed work into assigned tasks, technicians, bays and milestones. A repair order cannot be completed while tasks remain open, and task breakdowns are frozen after work begins.

### Quality control

![Quality control queue](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/09-quality-control.png)

Quality control independently checks finished work. The backend prevents the same technician from inspecting their own work and blocks a pass when a mandatory check fails. A failed check sends the work back for rework rather than treating the job as ready to invoice.

### Invoices

![Invoice book](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/10-invoices.png)

Invoices are raised against work that has passed quality control or has been delivered. The backend derives totals from stored line items, discounts and tax; once issued, the bill's copied approved lines are frozen.

### Payments

![Payment ledger](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/11-payments.png)

Payments are recorded against invoices and remain as an audit-able financial event. Voiding a payment reverses its effect on the balance without erasing the original record. Customer portal payments are scoped to the signed-in customer's own invoices.

### Inventory

![Inventory ledger](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/12-inventory.png)

Inventory is ledger-based: receipts and issues change the running stock balance. The quantity is derived from the ledger rather than being treated as a freely editable number.

#### Recording a real stock receipt

![Stock receipt reflected in inventory](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/45-inventory-receipt.png)

In the browser flow, parts staff open **Record movement**, choose the seeded brake-pad part and first enter quantity zero. The form blocks that invalid value before any write. Changing quantity to one creates a real `POST /api/v1/inventory/transactions` receipt. After a page reload, a separate authenticated `GET /api/v1/inventory/stock-levels` confirms the stored on-hand quantity is the transaction's `quantity_after` value.

### Reports

![Operational and financial reports](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/13-reports.png)

Reports combine workshop and finance records. Backend lifecycle tests observe reports at multiple points in the repair journey, so the figures are checked while work is in progress as well as at the end.

## 3. A customer request reaches the workshop

### Step 1 — Submit a request from the portal

![Customer request created](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/14-customer-portal-request-created.png)

The browser test signs in as a customer, enters a request title and description, then submits the real portal form. The test waits for the actual `POST /api/v1/portal/service-requests` response and expects HTTP 201 before displaying the created request.

### Step 2 — Staff reads the same request

![Request appears in the workshop queue](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/15-staff-queue-received-request.png)

A separate browser context signs in as staff, opens the workshop service-request queue, performs a reload and reads the record back from `GET /api/v1/service_requests/`. The test checks that the exact request title is visible in the staff queue.

**What this proves:** the customer and staff screens are not two copies of local state. The created record crossed the API/database boundary and was returned to a separate authenticated session.

## 4. Other workshop tools

### Audit log

![Audit log](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/16-audit.png)

The audit history records significant actions, including authentication activity and changes that matter for accountability.

### Labour

![Labour records](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/17-labour.png)

Labour entries capture the technician, work performed, actual and billable hours, rate and calculated labour cost. The backend lifecycle test records labour against an active repair order.

### My work

![Technician work queue](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/18-my-work.png)

Technicians have a focused view of their assigned work rather than needing the broad operational view for every task.

### Part requests

![Part requests](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/19-part-requests.png)

A technician can request a part for a repair task. The backend workflow distinguishes requesting, approving or rejecting and fulfilling the request, and tests the approval boundary between the requesting technician and parts staff.

### Parts catalog

![Parts catalog](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/20-parts.png)

The parts catalogue holds reusable stock and pricing data and includes low-stock views to make shortages visible before they interrupt a job.

### Purchase orders

![Purchase orders](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/21-purchase-orders.png)

Purchase orders connect demand to suppliers. Receiving an order creates inventory receipts as part of one transaction, so a bad line cannot partially apply the good lines.

### Service requests

![Workshop service-request queue](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/22-service-requests.png)

Staff triage new requests, review them, approve or reject them, and convert approved work into appointments.

### Staff

![Staff administration](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/23-staff.png)

Staff administration is protected by the role and permission system. Public registration cannot elevate a customer to a workshop role.

### Suppliers

![Supplier directory](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/24-suppliers.png)

Supplier records support purchasing. A supplier with order history cannot be deleted in a way that would orphan historical purchasing; the API supports deactivation instead.

### Vehicles

![Vehicle directory](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/25-vehicles.png)

The vehicle book keeps identifying details, ownership and mileage separate from individual visits, so the same car can have a service history across many appointments and repair orders.

#### Creating a supplier and reading it back

![Supplier creation and search](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/46-supplier-created.png)

An owner creates a new supplier from the real form. Playwright observes `POST /api/v1/suppliers/` returning HTTP 201, verifies the returned name and email, searches for the supplier, reloads the page and confirms it is still searchable. This is a write/read-back scenario, not a seeded supplier screenshot.

#### From a workshop quote to the customer's decision

![New estimate created and sent by staff](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/47-estimate-created-and-sent.png)

The staff browser creates a new estimate for the portal-linked customer, with 1.5 hours at $95 per hour. The backend returns a draft total of $142.50; staff then send it using the estimate action. A separate browser context signs in as the customer and reads the new estimate from the portal.

![Customer approves the estimate](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/48-customer-approves-created-estimate.png)

The customer approves the line in the real portal UI. The test checks the API response's approved status and $142.50 approved total, then returns to the staff session, reloads and confirms the saved estimate and line decision via a fresh GET. The flow verifies that the two roles see one shared backend record.

## 5. The customer portal

The portal is a customer-specific view over the same data model. Portal endpoints derive the customer from the authenticated account and do not accept an arbitrary customer ID to select another person's data.

### Customer home

![Customer portal home](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/33-customer-portal-home.png)

The home screen summarises outstanding balances, overdue amounts, decisions waiting on the customer, ready-for-pickup work and the next appointment where available.

### Appointments

![Customer appointments](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/34-portal-appointments.png)

Customers can see their own appointments. Appointment booking and conflict rules are enforced by the backend, which remains the source of truth for time slots.

#### Requesting a booking from the portal

![Customer appointment request in the portal](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/43-portal-appointment-booked.png)

The browser takes a vehicle returned by the customer's real portal API, selects a supported service type and submits a preferred slot. The actual `POST /api/v1/portal/appointments` must return HTTP 201 with the same vehicle ID, `DIAGNOSTIC` service type and `REQUESTED` status.

![Appointment request after reload](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/44-portal-appointment-requested.png)

After a full page reload, the test performs a new authenticated GET to `/api/v1/portal/appointments` and finds the same appointment ID with the original vehicle association, service type and status. The portal appointment form was also corrected to submit the backend-supported service-type enum instead of arbitrary free text.

### Estimates

![Customer estimates](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/35-portal-estimates.png)

Customers can see estimates and the lines awaiting a decision. The full backend lifecycle test approves required lines and declines optional work, then verifies that the repair order and final bill only include approved work.

![Line-level decision handling](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/42-customer-estimate-line-decisions.png)

The browser test also approves and declines individual seeded estimate lines through the customer portal. It checks the real decision responses and reloads the estimate; the separate cross-role flow above verifies the same behavior on an estimate created live by workshop staff.

### Invoices

![Customer invoices](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/36-portal-invoices.png)

Invoices are presented with their financial totals and balance. The customer can access the invoice document from the detail flow where available.

#### Settling an invoice through the portal

![Customer invoice settled through a real API payment](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/43-portal-invoice-settled.png)

The customer opens an issued invoice with a remaining balance. Entering more than the balance is rejected by the form. Entering the exact balance sends a real `POST /api/v1/portal/invoices/{id}/payments` request; the response shows the invoice as `PAID`, with a zero balance. A separate GET after reloading confirms that the database-backed invoice remains settled.

### Payments

![Customer payment history](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/37-portal-payments.png)

The portal shows a customer's own recorded payments. The backend tests verify that portal-level payment activity is not interchangeable with the workshop-wide payment ledger.

### Service requests

![Customer service requests](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/38-portal-service-requests.png)

Customers can revisit their requests and check progress. The browser handoff test proves a newly created request appears in the workshop queue after a separate authenticated read.

### Vehicles and history

![Customer vehicles](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/39-portal-vehicles.png)

Customers can see their own registered vehicles and the service history available to their account, without being granted access to the workshop-wide vehicle book.

## 6. Verified interaction evidence

The table separates browser-driven full-stack scenarios from backend HTTP lifecycle tests. Both use the real FastAPI routes and a real PostgreSQL database, but they prove different things.

| User action | Real API boundary | Evidence checked | Status |
|---|---|---|---|
| Open the public homepage and signup on a narrow viewport | Page navigation; no fake data required for static content | Expected headings, entry links and no horizontal overflow | Browser check |
| Submit a customer service request | `POST /api/v1/portal/service-requests` | HTTP 201 and request visible in the customer portal | Browser end-to-end |
| Read that request as workshop staff | `GET /api/v1/service_requests/` | Request appears after a separate login and reload | Browser end-to-end |
| Create a customer as staff | `POST /api/v1/customers/`, followed by list/detail reads | Record searchable, opens by ID and remains after reload | Browser persistence |
| Create a vehicle as staff | `POST /api/v1/vehicles/`, followed by `GET /api/v1/vehicles/{id}` | ID and returned fields match the created record | Browser persistence |
| Reject invalid vehicle data | Frontend validation before submit | Year outside accepted range and an invalid VIN prevent submission | Browser validation |
| Check a vehicle in | `POST /api/v1/check_ins/` | HTTP 201, associated vehicle ID and initial PENDING state | Browser end-to-end |
| Reject an invalid odometer | Frontend validation before submit | Zero odometer prevents the form submission | Browser validation |
| Advance check-in status | `PATCH /api/v1/check_ins/{id}/status`, followed by list GET | IN_PROGRESS state persists after navigation/reload | Browser persistence |
| Book, confirm, and cancel a workshop appointment | `POST /api/v1/appointments/check-conflicts`, `POST /api/v1/appointments/`, `PATCH /api/v1/appointments/{id}/status` | Free slot allowed; overlapping booking disabled; CONFIRMED state read back; CANCELLED requires and stores a reason | Browser end-to-end |
| Request a customer appointment | `POST /api/v1/portal/appointments`, then an authenticated GET after reload | HTTP 201, actual vehicle association and DIAGNOSTIC / REQUESTED state read back from the backend | Browser persistence |
| Create and settle a portal invoice | `POST /api/v1/portal/invoices/{id}/payments`, then GET invoice detail | Overpayment blocked; exact balance creates payment and invoice remains PAID with zero balance after reload | Browser persistence |
| Record stock received | `POST /api/v1/inventory/transactions`, then `GET /api/v1/inventory/stock-levels` | Zero quantity blocked; valid receipt adds one unit and the new on-hand balance survives reload | Browser persistence |
| Create a supplier | `POST /api/v1/suppliers/`, then search and reload | HTTP 201; new supplier is still searchable after reload | Browser persistence |
| Create and send an estimate, approve as customer | Staff `POST /api/v1/estimates/` and `/send`; customer `POST /api/v1/portal/estimates/{id}/items/{item_id}/decision`; staff GET | $142.50 quote appears in a separate customer session; approval and amount are visible after staff reload | Cross-role browser end-to-end |
| Confirm an invalid email-verification token is handled honestly | `POST /api/v1/auth/verify-email` | Real API rejection (400), request token and error UI | Browser negative case |
| Confirm an invalid password-reset token is handled honestly | `POST /api/v1/auth/password-reset/confirm` | Real API rejection (400), request body and error UI | Browser negative case |
| Register, receive verification email and verify account | `POST /api/v1/auth/register`, outbox worker, SMTP, `POST /api/v1/auth/verify-email` | Actual message and token, verified account and portal redirect | Browser end-to-end; passed in run #79 |
| Reset password, reject token replay, sign in with new password | Reset-request and reset-confirm endpoints, then `POST /api/v1/auth/login` | Actual email link, one-time token, old password rejected and new password accepted | Browser end-to-end; passed in run #79 |
| Inspect the central repair-to-payment lifecycle | Customer, vehicle, request, appointment, check-in, inspection, estimate, repair order, labour, part request, QC, invoice and payment APIs | State transitions, totals, line-level decisions, payment and read-back assertions | Backend HTTP end-to-end |
| Verify workshop-wide access boundaries | Shop-wide API endpoints and user roles | Automated sweep confirms customer cannot read staff-only endpoints | Backend security tests |
| Validate business rules across feature endpoints | Resource-specific API routes and PostgreSQL constraints | Validation, status transitions, conflicts, duplicate records, bad financial values and forbidden actions | Backend API test suite |

## 7. Feature coverage checklist

**Reading this checklist:** “Browser read” means the actual page was visited and it made successful API requests. “Backend write/lifecycle” refers to automated API tests running against the backend and PostgreSQL, not a claim that every mutation button was clicked in the browser. This distinction prevents a page screenshot from being mistaken for proof of every CRUD path.

| Feature | Screenshot / UI path | Backend test coverage | Browser mutation coverage |
|---|---|---|---|
| Public homepage and responsive signup entry | [Homepage](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/00-homepage.png), [Signup](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/00-signup.png) | Auth and registration suites | Layout and reachability |
| Login, token lifecycle and permissions | Login page; dashboard entry | Auth, rate-limit, RBAC and access-boundary suites | Real login for staff/customer; auth error and signup/recovery scenarios |
| Customer registration and email verification | Signup, verification screens | Registration and email-outbox suites | Real flow through local SMTP inbox (current CI result determines final status) |
| Password recovery | Reset screenshots above | Auth and email-outbox suites | Request, email, confirmation, replay rejection and new-password login (current CI result determines final status) |
| Dashboard | [Dashboard](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/01-dashboard.png) | Reports and lifecycle suites | Live read |
| Attention centre and notifications | [Attention](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/02-attention-centre.png) | Notifications and audit suites | Live read |
| Customers | [Customers](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/03-customers.png) | Customers and lifecycle suites | Create, search, detail and reload |
| Vehicles and mileage | [Vehicles](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/25-vehicles.png), [Vehicle detail](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/26-vehicle-details.png) | Vehicles and lifecycle suites | Create, invalid year/VIN checks and persisted GET read-back in browser CI |
| Appointments and diary | [Diary](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/04-diary.png), [Confirmed booking](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/49-workshop-appointment-confirmed.png), [Cancelled booking](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/50-workshop-appointment-cancelled.png) | Appointments and lifecycle suites | Staff creates/confirm/cancels; conflict and cancellation-reason validation; fresh GET persistence check in browser CI |
| Check-ins | [Check-ins](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/05-check-ins.png), [Status transition](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/27-checkin-status-transition.png) | Check-ins and lifecycle suites | Create, invalid odometer, status transition and persisted API read-back in browser CI |
| Inspections and item findings | [Inspections](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/06-inspections.png) | Inspections and lifecycle suites | Live list read; complete API lifecycle |
| Estimates and line decisions | [Estimates](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/07-estimates.png) | Estimates, portal and lifecycle suites | Live list read; line decisions verified through API lifecycle |
| Repair orders and tasks | [Repair orders](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/08-repair-orders.png) | Repair orders and lifecycle suites | Live list read; state machine and task writes API-tested |
| Labour | [Labour](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/17-labour.png) | Labour and lifecycle suites | Live read; labour creation API-tested |
| Part requests and fulfilment | [Part requests](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/19-part-requests.png) | Part requests and lifecycle suites | Live read; approval and fulfilment API-tested |
| Quality control | [QC](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/09-quality-control.png) | QC and lifecycle suites, including independent inspector rule | Live read; full lifecycle through API |
| Invoices | [Invoices](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/10-invoices.png) | Invoices and lifecycle suites | Live read; issue/create paths API-tested |
| Payments | [Payments](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/11-payments.png) | Payments, portal and lifecycle suites | Live read; paid-balance and payment transitions API-tested |
| Parts catalogue | [Parts](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/20-parts.png) | Parts/inventory and lifecycle suites | Live read |
| Inventory ledger | [Inventory](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/12-inventory.png), [Receipt persisted](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/45-inventory-receipt.png) | Parts/inventory and purchasing suites | Stock receipt, quantity validation and fresh stock-level GET in browser CI |
| Suppliers and purchasing | [Suppliers](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/24-suppliers.png), [Supplier created](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/46-supplier-created.png), [Purchase orders](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/21-purchase-orders.png) | Supplier/purchase-order suite | Supplier creation/search/reload in browser CI; purchasing and receive rules covered by API tests |
| Service requests | [Service requests](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/22-service-requests.png) | Service requests and lifecycle suites | Customer request create + staff queue read-back |
| Staff and RBAC | [Staff](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/23-staff.png) | RBAC, contract and staff-boundary suites | Live read; role boundary tested through backend |
| Audit log | [Audit](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/16-audit.png) | Audit and lifecycle suites | Live read |
| My work | [My work](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/18-my-work.png) | Repair-order and labour suites | Live read |
| Reports | [Reports](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/13-reports.png) | Reports and lifecycle suites | Live read and dashboard API check |
| Customer portal home | [Portal home](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/33-customer-portal-home.png) | Portal and lifecycle suites | Live read |
| Customer appointments | [Portal appointments](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/34-portal-appointments.png), [Request created](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/43-portal-appointment-booked.png), [Reload/read-back](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/44-portal-appointment-requested.png) | Portal and appointments suites | Real booking POST and authenticated GET read-back after reload |
| Customer estimates | [Portal estimates](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/35-portal-estimates.png), [Line decisions](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/42-customer-estimate-line-decisions.png), [Cross-role approval](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/48-customer-approves-created-estimate.png) | Portal and estimate suites | Staff creates/sends quote, customer approves in separate context, staff reads status back |
| Customer invoices | [Portal invoices](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/36-portal-invoices.png), [Settled invoice](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/43-portal-invoice-settled.png) | Portal and invoice suites | Portal payment, overpayment validation and persisted PAID/zero-balance read-back |
| Customer payments | [Portal payments](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/37-portal-payments.png), [Settled invoice](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/43-portal-invoice-settled.png) | Portal and payment suites | Payment mutation and invoice read-back verified in browser CI; void/reversal still API-layer coverage |
| Customer service requests | [Portal requests](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/38-portal-service-requests.png) | Portal and service-request suites | Create + staff cross-account read-back |
| Customer vehicles | [Portal vehicles](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/39-portal-vehicles.png) | Portal and vehicle suites | Live read |
| Database migrations and constraints | N/A | Migration suite and PostgreSQL-backed resource tests | Disposable PostgreSQL migration + seed in frontend CI |

## 8. Test environment and limits

### What is actually exercised

- Frontend CI builds and starts the Next.js app, starts the FastAPI app, applies migrations to a disposable PostgreSQL instance and seeds isolated test records.
- Playwright/Chromium drives the actual UI. Tests wait for real HTTP responses; new records are read back through the API and after reload wherever stated above.
- The backend test suite covers resource-level validation, permissions, state transitions, database constraints and a full HTTP-only repair lifecycle. Its lifecycle test creates and reads real database-backed records through the routes and verifies audit/notification effects.
- The latest completed backend workflow run reported **951 passed** tests; see [backend CI run](https://github.com/faizansaiyed123/autofix_backend/actions/runs/39979742357).
- Frontend browser run [#78](https://github.com/faizansaiyed123/autofix_frontend/actions/runs/39991373701) completed successfully: **16 passed**, including the hardened vehicle/check-in persistence reads. The latest expanded run [#79](https://github.com/faizansaiyed123/autofix_frontend/actions/runs/39991375279) completed successfully: **17 passed**, including SMTP account verification/password recovery, customer/workshop persistence flows, and staff appointment conflict/cancellation validation. Visual screenshot publishing and browser-evidence upload succeeded; see the [`docs/testing/visuals/manifest.json`](https://github.com/faizansaiyed123/autofix_frontend/blob/main/docs/testing/visuals/manifest.json).

### Production deployment is not certified by the CI run

The screenshots and mutation tests above are produced in an isolated CI stack; they do not prove a successful connection to the deployed production database.

The frontend's API URL defaults to `http://localhost:8000` when `NEXT_PUBLIC_API_URL` is not present at build time. I could not verify a configured production API URL from the Vercel project environment listing, and I do not have a confirmed backend service URL or permission to select a Render workspace. Therefore this document does **not** claim that a public production browser session has been verified against the production API or production database. Confirming that requires identifying the intended backend service/workspace and checking the deployed build's API URL and health endpoint; no live production records were modified as part of this work.

### What browser coverage does not yet claim

Every listed page is included in the browser walkthrough and its API-backed read check. Browser mutations now verify customer request handoff, customer and vehicle creation, check-in status, email verification/password recovery, customer appointment requests, staff appointment creation/confirmation/cancellation (including conflict and reason validation), customer invoice payment, inventory receipts, supplier creation, and staff-estimate-to-customer approval. The full backend lifecycle test separately drives the complete repair-to-payment journey over real HTTP and PostgreSQL. The browser suite still does **not** click every edit/delete/status-transition control in inspection, repair order/task, independent QC, invoice issue, payment void, parts catalog and purchase-order receipt flows. Those operations have backend/API coverage, but the remaining UI mutation paths are **not yet independently verified end to end in the browser**.

## 9. Feature inventory

Use this final list as the checklist for future regression runs:

- [x] Public homepage and narrow-viewport layout
- [x] Staff authentication and dashboard read
- [x] Workshop page read-through with live API requests
- [x] Customer portal page read-through with live API requests
- [x] Customer request create → staff queue read-back
- [x] Staff customer create → search → detail → reload
- [x] Vehicle create → details by ID; check-in create → status change → persisted read-back
- [x] Real SMTP account registration → verification → password reset → token-replay rejection → login with changed password
- [x] Customer appointment request → create response → fresh authenticated API read after reload
- [x] Portal invoice payment → overpayment validation → PAID/zero-balance read-back
- [x] Inventory receipt → stock-level balance read-back
- [x] Supplier create → search → reload
- [x] Staff creates/sends estimate → separate customer session approves → staff confirms persisted approval
- [x] Backend customer/vehicle/service request/appointment/check-in/inspection/estimate/repair-order/labour/part request/QC/invoice/payment lifecycle over HTTP
- [x] Backend role and shop/customer access-boundary sweep
- [x] Backend validation, negative cases, migrations and database constraints
- [x] Browser run #73 passed 16/16 after disambiguating the portal appointment assertion; [view run #73](https://github.com/faizansaiyed123/autofix_frontend/actions/runs/39990053744)
- [x] Browser run #74 passed 16/16 with the appointment page assertion after authenticated persistence read-back; [view run #74](https://github.com/faizansaiyed123/autofix_frontend/actions/runs/39990472993)
- [x] Browser run #75 passed 16/16 with fresh authenticated API persistence checks; [view run #75](https://github.com/faizansaiyed123/autofix_frontend/actions/runs/39990609977)
- [x] Browser run #78 passed 16/16 after replacing brittle vehicle/check-in response interception with fresh authenticated GETs; screenshot publishing and evidence upload succeeded; [view run #78](https://github.com/faizansaiyed123/autofix_frontend/actions/runs/39991373701)
- [x] Browser run #79 passed 17/17 with workshop booking conflict and cancellation-reason validation; screenshot publishing and evidence upload succeeded; [view run #79](https://github.com/faizansaiyed123/autofix_frontend/actions/runs/39991375279)
- [ ] Verify Vercel production API URL and run non-destructive live smoke checks after the backend service/workspace is identified
- [ ] Add dedicated browser mutations for the remaining inspection, repair-order/task, independent QC, invoice issue, payment void, parts catalogue, and purchase-order receipt/edit flows

---

**Use this walkthrough as a guide to the product, not as a claim that the production deployment has been certified.** The CI-backed flows show actual UI-to-API behavior against a disposable PostgreSQL database; the remaining items above are intentionally visible so the next reviewer can see exactly what is and is not proven.
