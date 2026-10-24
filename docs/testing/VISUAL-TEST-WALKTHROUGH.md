# AutoFix — Visual Product Walkthrough

AutoFix brings customer communication and workshop operations together in one automotive service platform. Follow the screens to see how everyday tasks connect—from booking and inspection to repair, quality control, invoicing, inventory, and customer updates.


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

The public homepage introduces the workshop platform and directs customers and staff to the appropriate account entry points. Its responsive layout keeps the main content usable on narrow screens.

### Customer account creation

![Customer account creation form](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/00-signup.png)

Customers submit their own details. Public signup does not let a new user choose a staff role. The backend creates the user, assigns the customer role, connects a customer record, and queues a verification email as one database transaction. Duplicate-email responses intentionally do not reveal whether an account already exists.

### Account verification and password recovery

![Verification link error handling](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/40-invalid-verification-link.png)

If a verification link is expired, already used, or invalid, AutoFix rejects it and removes the token fragment from the address bar before the user confirms the action. An invalid link cannot activate an account.

![Password reset error handling](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/41-invalid-password-reset.png)

Password recovery uses a one-time email link. A valid link changes the password and invalidates the previous authentication generation; a consumed reset link cannot be reused.

### Completing account verification and password recovery

![Customer registration submitted](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/28-registration-submitted.png)

Submitting the registration form starts account creation and sends a verification message to the email address provided. The customer opens the link in that message to finish activating the account.

![Email verified and customer portal](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/29-verified-customer-portal.png)

Opening the verification link confirms the address, establishes the customer's session, and takes them to the customer portal.

![Customer requests a password reset](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/30-password-reset-requested.png)

From the sign-in page, customers can request a password reset and receive a one-time link by email.

![Password has been updated](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/31-password-reset-confirmed.png)

Submitting a valid reset link changes the password and invalidates the previous authentication generation. The customer can then sign in with the new password.

![Customer signed in with the new password](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/32-password-changed-login.png)

### Account email and access protection

AutoFix uses email-based one-time links for account verification and password recovery. These links help customers activate accounts and regain access while preventing reuse of old verification or reset tokens.

## 2. Workshop workspace

### Dashboard

![AutoFix dashboard](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/01-dashboard.png)

The dashboard gives the team a quick view of active workshop work and financial activity, including invoiced amounts, collections, and work in progress.

### Attention centre

![AutoFix attention centre](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/02-attention-centre.png)

The attention centre collects operational items that need somebody to act. It is backed by the application's API rather than a static list.

### Customers

![Customer directory](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/03-customers.png)

The customer book holds names, contact details, preferred contact method and status. Staff can search and filter the directory, open a customer record and work with the vehicle and service history attached to that customer.

### Diary and appointments

![Workshop diary](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/04-diary.png)

The diary offers calendar and list views of workshop bookings. Appointment rules restrict status changes to the transitions allowed by the backend; a cancelled booking also requires a reason. Conflict checking is an API capability and should be treated as a business rule, not merely a calendar decoration.

![Staff confirms a real booking](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/49-workshop-appointment-confirmed.png)

A staff browser creates a booking for the customer's actual vehicle, checks a future slot through the conflict API and submits it to the backend. The create response is read and then the appointment is moved from `REQUESTED` to `CONFIRMED` through the status endpoint.

![Staff cancels a booking with a reason](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/50-workshop-appointment-cancelled.png)

AutoFix prevents overlapping bookings for the same vehicle, bay, and time slot. Cancelling an appointment requires a reason, which remains attached to the cancelled booking.

### Check-ins

![Vehicle check-ins](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/05-check-ins.png)

Check-in records a vehicle's arrival, odometer reading, and condition notes. Staff can update its status as the vehicle moves through the workshop; invalid odometer values are blocked by the form.

![Vehicle details](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/26-vehicle-details.png)

The vehicle detail view brings the vehicle's identifying information and ownership details together in one place.

![Vehicle check-in status updated](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/27-checkin-status-transition.png)

The check-in's status update is an actual PATCH request. A subsequent GET after navigation verifies the updated status came back from the backend.

### Inspections

![Inspection records](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/06-inspections.png)

Inspections connect findings to the relevant vehicle and customer. Staff can start a record with **New inspection**, add findings and evidence, and complete it once at least one finding has been recorded.

![Inspection finding created, edited and photo attached](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/63-inspection-item-created-and-edited.png)

A finding is created and edited through the UI, including category, severity, measurement, recommendation, notes and photo URL/caption. A fresh API GET confirms the changes and photo metadata persisted.

![Inspection after removing its only finding](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/64-inspection-empty-after-remove.png)

Removing the finding updates the real record and restores the empty-inspection completion guard.

![Completed inspection report](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/71-inspection-completed-report.png)

Once findings are complete, the inspector can finish the report. Completed inspections remain available as a record and become read-only.

### Estimates

![Workshop estimates](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/07-estimates.png)

An estimate turns proposed labour and parts into a customer decision. The API calculates and stores totals; customer decisions are made per line, so optional work can be declined without silently appearing on the final bill.

### Repair orders

![Repair orders](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/08-repair-orders.png)

Repair orders turn agreed work into assigned tasks, technicians, bays and milestones. A repair order cannot be completed while tasks remain open, and task breakdowns are frozen after work begins.

![A repair order created from the approved quote](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/52-repair-order-created.png)

Staff can turn a customer-approved estimate into a repair order using **New repair order**. The order starts as a draft and includes its own task rows.

![Labour entry and task progress](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/53-repair-order-labour-and-task.png)

As work begins, staff can move the order through `APPROVED` and `IN_PROGRESS`, record technician labour, and track each task through completion. For example, 1.5 hours at $95 per hour produces a labour cost of $142.50.

![Repair order completed after its tasks](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/54-repair-order-completed.png)

Once the task is completed, the order can be completed. A fresh API read after reload verifies the order and task are still complete.

### Quality control

![Quality control queue](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/09-quality-control.png)

Quality control independently checks finished work. The backend prevents the same technician from inspecting their own work and blocks a pass when a mandatory check fails. A failed check sends the work back for rework rather than treating the job as ready to invoice.

![Independent quality control passed](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/55-repair-order-passed-quality-control.png)

A quality-control reviewer separate from the assigned technician can attach photo evidence and record a pass or a failure with a reason.

![QC photo evidence attached](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/66-qc-photo-attached.png)

![QC failed and repair returned for rework](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/67-qc-failed-and-sent-for-rework.png)

A failed check returns the repair order to `IN_PROGRESS` for rework. The team can open another attempt, record review notes, and update a check verdict before the final quality-control decision.

![Quality-control decision updated after review](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/70-qc-manual-override-survives-reverification.png)

The second attempt is passed through the UI. The API returns `PASSED` and fresh reads confirm that the linked repair order advances to `QC_PASSED`.

### Invoices

![Invoice book](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/10-invoices.png)

Invoices are raised against work that has passed quality control or has been delivered. The backend derives totals from stored line items, discounts and tax; once issued, the bill's copied approved lines are frozen.

![Invoice issued after quality control](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/56-workshop-invoice-issued.png)

Using the QC-passed repair order, staff creates a draft invoice, checks that its lines were copied from the approved estimate, and issues it through the actual invoice endpoint. The response confirms `ISSUED` and a positive balance due.

![Invoice settled at the workshop till](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/57-workshop-invoice-settled.png)

The payment modal blocks an amount above the outstanding balance. Recording the exact balance calls the real payments API and causes a subsequent invoice GET to return `PAID` with zero balance.

![The customer sees the same settled invoice](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/58-customer-portal-settled-invoice.png)

A separate customer session opens that same invoice in the portal. A fresh portal GET confirms `PAID` and a zero balance, demonstrating that the till and customer account read the same stored invoice.

### Payments

![Payment ledger](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/11-payments.png)

Payments are recorded against invoices and remain as an audit-able financial event. Voiding a payment reverses its effect on the balance without erasing the original record. Customer portal payments are scoped to the signed-in customer's own invoices.

### Inventory

![Inventory ledger](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/12-inventory.png)

Inventory is ledger-based: receipts and issues change the running stock balance. The quantity is derived from the ledger rather than being treated as a freely editable number.

#### Recording a real stock receipt

![Stock receipt reflected in inventory](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/45-inventory-receipt.png)

Parts staff can record a receipt from **Record movement**. The form rejects a zero quantity; a valid receipt updates the inventory ledger and the on-hand balance.

### Reports

![Operational and financial reports](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/13-reports.png)

Reports bring workshop and financial information together, helping the team review progress during a job and see outcomes as work is completed.

## 3. A customer request reaches the workshop

### Step 1 — Submit a request from the portal

![Customer request created](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/14-customer-portal-request-created.png)

Customers can submit a service request from the portal by entering a title and description. The request then appears in their account for future reference.

### Step 2 — Staff reads the same request

![Request appears in the workshop queue](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/15-staff-queue-received-request.png)

Workshop staff can review incoming requests in the service-request queue and see the details submitted by the customer.

### Step 3 — Review, approve and convert it to an appointment

![Request converted into a confirmed appointment](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/51-service-request-converted-to-appointment.png)

Staff can move a request from `NEW` to `IN_REVIEW` and `APPROVED`, then convert accepted work into a confirmed appointment linked to the original customer request.

**What this proves:** a customer enquiry can become an approved, schedulable workshop job through actual user actions and the shared database—not merely by copying its title to another screen.

## 4. Other workshop tools

### Audit log

![Audit log](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/16-audit.png)

The audit history records significant actions, including authentication activity and changes that matter for accountability.

### Labour

![Labour records](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/17-labour.png)

Labour entries capture the technician, work performed, actual and billable hours, rate, and calculated labour cost against an active repair order.

### My work

![Technician work queue](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/18-my-work.png)

Technicians have a focused view of their assigned work rather than needing the broad operational view for every task.

### Part requests

![Part requests](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/19-part-requests.png)

A technician can request a part for a repair task. The requester cannot approve or reject their own request—even if their account has owner-level permissions. That rule is enforced by the backend and the row UI, not just by hiding a button.

![Part request awaiting another staff member](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/73-part-request-awaiting-other-staff.png)

Parts staff can approve the request and then mark it fulfilled. A separate authenticated read confirms the requester and decider are different users and the final state is stored.

![Part request approved and fulfilled](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/74-part-request-approved-and-fulfilled.png)

Rejection is also a tested branch: a blank reason is blocked in the UI and rejected by the API if a caller tries to bypass the form.

![Part request rejected with a reason](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/75-part-request-rejected-with-reason.png)

### Parts catalog

![Parts catalog](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/20-parts.png)

The parts catalogue holds reusable stock and pricing details, with low-stock views to help staff spot shortages. Updating a part's price or reorder threshold does not change its on-hand quantity; stock changes are recorded as inventory movements.

![Updated catalogue item](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/65-part-catalogue-updated.png)

Unused parts can be retired before deletion, while stock and purchasing history remain protected by the catalogue's business rules.

### Purchase orders

![Purchase orders](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/21-purchase-orders.png)

Purchase orders connect demand to suppliers. Staff can create a draft with an expected date, tax/shipping values, and item lines, then edit the header or lines before sending the order.

![Purchase-order header details edited](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/68-purchase-order-header-edited.png)

![Draft purchase-order lines edited](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/69-purchase-order-draft-lines-edited.png)

Sending freezes the order's lines. Receiving it creates inventory receipts and increases the on-hand stock balance.

![Purchase order received into inventory](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/62-purchase-order-received.png)

A separate draft order is cancelled with a required reason; its terminal `CANCELLED` state and reason persist without receiving any stock.

![Purchase order cancelled with reason](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/72-purchase-order-cancelled.png)

### Service requests

![Workshop service-request queue](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/22-service-requests.png)

Staff triage requests, review their details, approve or reject them, and convert approved work into appointments. Customers can see the resulting request status in their own portal.

![Service request rejected by workshop staff](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/76-service-request-rejected.png)

![Customer portal displays the rejected request](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/77-customer-portal-shows-rejected-request.png)

### Staff

![Staff administration](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/23-staff.png)

Staff administration is protected by the role and permission system. Public registration cannot elevate a customer to a workshop role.

### Suppliers

![Supplier directory](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/24-suppliers.png)

Supplier records support purchasing. A supplier with order history cannot be deleted in a way that would orphan historical purchasing; the API supports deactivation instead.

### Vehicles

![Vehicle directory](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/25-vehicles.png)

The vehicle book keeps identifying details, ownership and mileage separate from individual visits, so the same car can have a service history across many appointments and repair orders.

#### Add a supplier

![Supplier creation and search](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/46-supplier-created.png)

Owners can add a supplier, then find the supplier by name or contact details in the supplier directory.

#### From a workshop quote to customer approval

![New estimate created and sent by staff](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/47-estimate-created-and-sent.png)

The staff browser creates a new estimate for the portal-linked customer, with 1.5 hours at $95 per hour. The backend returns a draft total of $142.50; staff then send it using the estimate action. A separate browser context signs in as the customer and reads the new estimate from the portal.

![Customer approves the estimate](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/48-customer-approves-created-estimate.png)

The customer approves the estimate line in the portal. Staff can then see that decision on the same estimate, keeping the workshop and customer views aligned. In this example, the approved total is $142.50.

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

Customers choose one of their registered vehicles, select a supported service type, and request a preferred appointment slot. The booking begins in `REQUESTED` status.

![Appointment request after reload](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/44-portal-appointment-requested.png)

The appointments page lists the customer's requests with their vehicle, service type, and current status.

### Estimates

![Customer estimates](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/35-portal-estimates.png)

Customers can review estimates and decide on individual lines. Only approved work is carried into the repair order and final bill; optional work can be declined.

![Line-level decision handling](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/42-customer-estimate-line-decisions.png)

Each estimate line can be approved or declined individually, giving customers control over optional work before repairs proceed.

### Invoices

![Customer invoices](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/36-portal-invoices.png)

Invoices are presented with their financial totals and balance. The customer can access the invoice document from the detail flow where available.

#### Settling an invoice through the portal

![Customer settles an invoice in the portal](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/43-portal-invoice-settled.png)

The customer opens an issued invoice with a remaining balance. Entering more than the balance is rejected by the form. Entering the exact balance sends a real `POST /api/v1/portal/invoices/{id}/payments` request; the response shows the invoice as `PAID`, with a zero balance. A separate GET after reloading confirms that the database-backed invoice remains settled.

### Payments

![Customer payment history](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/37-portal-payments.png)

The portal shows the customer's own payment history, while workshop staff can access the wider payment ledger according to their role.

### Service requests

![Customer service requests](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/38-portal-service-requests.png)

Customers can revisit their requests and check progress, while workshop staff can review those same requests in the workshop queue.

### Vehicles and history

![Customer vehicles](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/39-portal-vehicles.png)

Customers can see their own registered vehicles and the service history available to their account, without being granted access to the workshop-wide vehicle book.

## 6. A connected service journey

AutoFix connects the customer portal with the workshop's day-to-day operations, so each stage can build on the same service history.

1. **Customer enquiry:** a customer submits a service request or asks for an appointment from the portal.
2. **Workshop review:** staff reviews the request, checks vehicle and booking details, and schedules accepted work.
3. **Inspection and estimate:** the team records findings, attaches supporting details, prepares an estimate, and shares it with the customer.
4. **Repair execution:** approved work becomes a repair order with assigned tasks, technician labour, and parts requests.
5. **Quality control:** a reviewer records checks and evidence; failed checks send work back for rework before billing.
6. **Invoice and payment:** completed, billable work moves to an invoice, with balances and payment history visible to authorised staff and the customer.
7. **Inventory and reporting:** receipts and issues update the stock ledger, while reports bring operational and financial activity together.

Customer and staff screens present the same connected workflow with permissions appropriate to each role.

## 7. Explore AutoFix by feature

| Feature area | Screens | What it supports |
|---|---|---|
| Public homepage and responsive signup entry | [Homepage](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/00-homepage.png), [Signup](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/00-signup.png) | Introduces the platform and directs customers and workshop staff to their account entry points. |
| Login, token lifecycle and permissions | Login page; dashboard entry | Provides account access, email verification, password recovery, and role-aware permissions. |
| Customer registration and email verification | Signup, verification screens | Lets customers create an account and confirm their email address before using the portal. |
| Password recovery | Reset screenshots above | Helps customers regain access through a one-time reset link. |
| Dashboard | [Dashboard](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/01-dashboard.png) | Summarises workshop activity, financial totals, and work in progress. |
| Attention centre and notifications | [Attention](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/02-attention-centre.png) | Highlights operational items that need the team's attention. |
| Customers | [Customers](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/03-customers.png) | Organises customer profiles, contact details, preferences, vehicles, and service history. |
| Vehicles and mileage | [Vehicles](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/25-vehicles.png), [Vehicle detail](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/26-vehicle-details.png) | Keeps vehicle identity, ownership, mileage, and service history organised. |
| Appointments and diary | [Diary](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/04-diary.png), [Confirmed booking](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/49-workshop-appointment-confirmed.png), [Cancelled booking](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/50-workshop-appointment-cancelled.png) | Provides a calendar and list view for bookings, confirmations, conflicts, and cancellations. |
| Check-ins | [Check-ins](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/05-check-ins.png), [Status transition](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/27-checkin-status-transition.png) | Records vehicle arrival, odometer readings, condition notes, and check-in status. |
| Inspections and item findings | [Inspections](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/06-inspections.png), [Finding created/edited](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/63-inspection-item-created-and-edited.png), [Finding removed](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/64-inspection-empty-after-remove.png), [Completed report](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/71-inspection-completed-report.png) | Captures findings, severity, recommendations, notes, and photo details for each vehicle inspection. |
| Estimates and line decisions | [Estimates](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/07-estimates.png) | Builds repair estimates and lets customers decide on individual work items. |
| Repair orders and tasks | [Repair orders](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/08-repair-orders.png), [Created](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/52-repair-order-created.png), [Task and labour](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/53-repair-order-labour-and-task.png), [Completed](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/54-repair-order-completed.png) | Turns approved work into assigned tasks and tracks progress through completion. |
| Labour | [Labour](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/17-labour.png) | Records technician work, hours, rates, and calculated labour costs. |
| Part requests and fulfilment | [Part requests](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/19-part-requests.png), [Awaiting another staff member](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/73-part-request-awaiting-other-staff.png), [Approved/fulfilled](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/74-part-request-approved-and-fulfilled.png), [Rejected with reason](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/75-part-request-rejected-with-reason.png) | Routes parts requests for approval and fulfilment, with reasons for rejected requests. |
| Quality control | [QC](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/09-quality-control.png), [Photo attached](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/66-qc-photo-attached.png), [Failed and returned for rework](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/67-qc-failed-and-sent-for-rework.png), [Passed second attempt](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/55-repair-order-passed-quality-control.png), [Manual override survives re-verification](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/70-qc-manual-override-survives-reverification.png) | Supports independent inspection, photo evidence, rework, review notes, and final sign-off. |
| Invoices | [Invoices](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/10-invoices.png), [Issued](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/56-workshop-invoice-issued.png), [Settled](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/57-workshop-invoice-settled.png), [Issue blocked before QC](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/59-invoice-issue-blocked-until-qc.png) | Creates invoices from approved work and tracks issue status and outstanding balance. |
| Payments | [Payments](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/11-payments.png), [Voided payment](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/60-payment-voided-and-balance-restored.png) | Tracks collections and payment history while retaining records of reversals. |
| Parts catalogue | [Parts](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/20-parts.png), [Catalogue item updated](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/65-part-catalogue-updated.png) | Maintains part details, pricing, and reorder thresholds. |
| Inventory ledger | [Inventory](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/12-inventory.png), [Receipt persisted](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/45-inventory-receipt.png) | Tracks stock receipts and issues to calculate on-hand quantities. |
| Suppliers and purchasing | [Suppliers](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/24-suppliers.png), [Supplier created](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/46-supplier-created.png), [Purchase orders](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/21-purchase-orders.png), [Header edited](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/68-purchase-order-header-edited.png), [Draft lines edited](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/69-purchase-order-draft-lines-edited.png), [Received](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/62-purchase-order-received.png), [Cancelled](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/72-purchase-order-cancelled.png) | Manages supplier details and purchase orders from draft through receipt or cancellation. |
| Service requests | [Service requests](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/22-service-requests.png), [Staff rejection](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/76-service-request-rejected.png), [Customer portal rejection](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/77-customer-portal-shows-rejected-request.png) | Lets the team triage customer requests, approve or reject them, and convert approved work into appointments. |
| Staff and RBAC | [Staff](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/23-staff.png) | Provides staff administration with role- and permission-based access. |
| Audit log | [Audit](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/16-audit.png) | Keeps a record of significant actions for accountability. |
| My work | [My work](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/18-my-work.png) | Gives technicians a focused queue of their assigned work. |
| Reports | [Reports](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/13-reports.png) | Combines operational and financial information for workshop oversight. |
| Customer portal home | [Portal home](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/33-customer-portal-home.png) | Gives customers a personal overview of appointments, decisions, balances, and ready-for-pickup work. |
| Customer appointments | [Portal appointments](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/34-portal-appointments.png), [Request created](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/43-portal-appointment-booked.png), [Reload/read-back](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/44-portal-appointment-requested.png) | Lets customers request and track appointments for their registered vehicles. |
| Workshop appointments | [Confirmed](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/49-workshop-appointment-confirmed.png), [Cancelled with reason](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/50-workshop-appointment-cancelled.png) | Supports booking, confirmation, conflict prevention, and cancellation with a reason. |
| Customer estimates | [Portal estimates](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/35-portal-estimates.png), [Line decisions](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/42-customer-estimate-line-decisions.png), [Cross-role approval](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/48-customer-approves-created-estimate.png) | Shows estimates and supports line-by-line approval or rejection. |
| Customer invoices | [Portal invoices](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/36-portal-invoices.png), [Portal payment](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/43-portal-invoice-settled.png), [Workshop payment visible to customer](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/58-customer-portal-settled-invoice.png) | Displays invoice details, totals, and outstanding balances. |
| Customer payments | [Portal payments](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/37-portal-payments.png), [Settled invoice](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/43-portal-invoice-settled.png), [Workshop void/reversal](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/60-payment-voided-and-balance-restored.png) | Shows the signed-in customer's payment history. |
| Customer service requests | [Portal requests](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/38-portal-service-requests.png) | Lets customers submit service requests and follow their status. |
| Customer vehicles | [Portal vehicles](https://raw.githubusercontent.com/faizansaiyed123/autofix_frontend/main/docs/testing/visuals/39-portal-vehicles.png) | Shows each customer's own vehicles and available service history. |
| Database migrations and constraints | N/A | Keeps linked workshop records consistent as the application's data model evolves. |
