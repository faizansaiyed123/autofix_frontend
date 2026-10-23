import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const CUSTOMER = { email: "customer@autofix.demo", password: "demo1234" };
const OWNER = { email: "owner@autofix.demo", password: "demo1234" };
const PARTS = { email: "parts@autofix.demo", password: "demo1234" };
const SCREENSHOT_DIR = path.join(process.cwd(), "e2e", "evidence");

function evidence(name: string) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  return path.join(SCREENSHOT_DIR, name);
}

async function screenshot(page: Page, filename: string) {
  await page.screenshot({ path: evidence(filename), fullPage: true });
}

async function readApi<T>(page: Page, apiPath: string): Promise<T> {
  const token = await page.evaluate(() => localStorage.getItem("autofix.access_token"));
  if (!token) throw new Error("No access token available for authenticated API readback");
    const base = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000").replace(/\/+$/, "");
  const response = await page.request.get(base + "/api/v1" + apiPath, {
    headers: { Authorization: "Bearer " + token },
  });
  expect(response.status()).toBe(200);
  return (await response.json()) as T;
}

async function login(page: Page, account: { email: string; password: string }, destination: string) {
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.locator('input[type="email"]').fill(account.email);
  await page.locator('input[type="password"]').fill(account.password);

  const responsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().endsWith("/api/v1/auth/login"),
  );
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  expect((await responsePromise).status()).toBe(200);
  await expect.poll(() => page.url()).not.toContain("/login");
  await page.goto(destination, { waitUntil: "networkidle" });
}

test.describe("Additional customer and workshop write paths", () => {
  test("customer appointment request persists through the portal API", async ({ page }) => {
    await login(page, CUSTOMER, "/portal/appointments");
    await page.getByRole("button", { name: "Ask for a slot", exact: true }).click();
    const dialog = page.getByRole("dialog");

    const vehicleSelect = dialog.getByLabel("Which car");
    const vehicleOption = vehicleSelect.locator("option").filter({ hasText: "Tesla Model 3" }).first();
    const vehicleId = await vehicleOption.getAttribute("value");
    if (!vehicleId) throw new Error("The portal customer Tesla was not returned by the vehicles API");
    await vehicleSelect.selectOption(vehicleId);
    await dialog.getByLabel("Service type").selectOption("DIAGNOSTIC");
    await dialog.getByLabel("Preferred time").fill("2035-06-12T09:00");
    await dialog.getByLabel("Anything we should know").fill("Full-stack test appointment request");

    const createResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === "/api/v1/portal/appointments" &&
        response.status() === 201,
    );
    await dialog.getByRole("button", { name: "Request this slot", exact: true }).click();
    const appointment = (await (await createResponse).json()) as {
      id: string;
      vehicle_id: string;
      service_type: string;
      status: string;
    };
    expect(appointment.vehicle_id).toBe(vehicleId);
    expect(appointment.service_type).toBe("DIAGNOSTIC");
    expect(appointment.status).toBe("REQUESTED");

    await page.reload({ waitUntil: "networkidle" });
    const accessToken = await page.evaluate(() => localStorage.getItem("autofix.access_token"));
    expect(accessToken).toBeTruthy();
    const listRead = await page.request.get(
      `${process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000"}/api/v1/portal/appointments`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    expect(listRead.status()).toBe(200);
    const persisted = (await listRead.json()) as Array<{ id: string; status: string }>;
    expect(persisted.find((record) => record.id === appointment.id)?.status).toBe("REQUESTED");
    await screenshot(page, "44-portal-appointment-requested.png");
  });

  test("customer invoice overpayment is blocked and a real portal payment settles the balance", async ({ page }) => {
    await login(page, CUSTOMER, "/portal/invoices");

    await page.reload({ waitUntil: "networkidle" });
    const invoices = await readApi<Array<{
      id: string;
      invoice_number: string;
      status: string;
      balance: number;
    }>>(page, "/portal/invoices");
    const payable = invoices.find(
      (invoice) => invoice.balance > 0 && invoice.status !== "DRAFT" && invoice.status !== "VOID",
    );
    if (!payable) throw new Error("The seeded customer has no issued invoice with a balance to settle");

    await page.goto("/portal/invoices/" + payable.id, { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: payable.invoice_number, exact: true })).toBeVisible();
    await page.getByRole("button", { name: /^Pay / }).first().click();
    const dialog = page.getByRole("dialog");
    const amount = dialog.getByLabel("How much");

    await amount.fill((payable.balance + 1).toFixed(2));
    await expect(dialog.getByText(/That is more than/i)).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Pay", exact: true })).toBeDisabled();

    await amount.fill(payable.balance.toFixed(2));
    const paymentResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === "/api/v1/portal/invoices/" + payable.id + "/payments" &&
        response.status() === 201,
    );
    await dialog.getByRole("button", { name: "Pay", exact: true }).click();
    const result = (await (await paymentResponse).json()) as {
      invoice_status: string;
      invoice_balance: number;
      payment: { amount: number };
    };
    expect(result.invoice_status).toBe("PAID");
    expect(result.invoice_balance).toBe(0);
    expect(result.payment.amount).toBe(payable.balance);
    await expect(page.getByRole("button", { name: "Settled", exact: true })).toBeVisible();
    await screenshot(page, "43-portal-invoice-settled.png");

    await page.reload({ waitUntil: "networkidle" });
    const saved = await readApi<{ status: string; balance: number }>(
      page,
      "/portal/invoices/" + payable.id,
    );
    expect(saved).toMatchObject({ status: "PAID", balance: 0 });
  });

  test("parts staff records a stock receipt and the updated stock balance is read back", async ({ page }) => {
    await login(page, PARTS, "/inventory");
    await expect(page.getByRole("heading", { name: "Inventory", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Record movement", exact: true }).click();
    const dialog = page.getByRole("dialog");
    const partSelect = dialog.getByLabel("Part");
    const option = partSelect.locator("option").filter({ hasText: "BRK-PAD-1042" }).first();
    const partId = await option.getAttribute("value");
    if (!partId) throw new Error("The seeded BRK-PAD-1042 part was not returned by the stock API");
    await partSelect.selectOption(partId);

    await dialog.getByLabel("Quantity").fill("0");
    await expect(dialog.getByText("A movement has to be greater than zero.")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Record movement", exact: true })).toBeDisabled();

    await dialog.getByLabel("Quantity").fill("1");
    await dialog.getByLabel("Unit cost").fill("38.50");
    const reference = "E2E-RECEIPT-" + Date.now();
    await dialog.getByLabel("Reference").fill(reference);
    const createResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === "/api/v1/inventory/transactions" &&
        response.status() === 201,
    );
    await dialog.getByRole("button", { name: "Record movement", exact: true }).click();
    const movement = (await (await createResponse).json()) as {
      part_id: string;
      transaction_type: string;
      quantity_before: number;
      quantity_after: number;
      reference: string;
    };
    expect(movement.part_id).toBe(partId);
    expect(movement.transaction_type).toBe("RECEIPT");
    expect(movement.quantity_after).toBe(movement.quantity_before + 1);
    expect(movement.reference).toBe(reference);
    await expect(page.getByText(reference, { exact: true })).toBeVisible();

    await page.reload({ waitUntil: "networkidle" });
    const levels = await readApi<Array<{ part_id: string; quantity_on_hand: number }>>(
      page,
      "/inventory/stock-levels",
    );
    expect(levels.find((level) => level.part_id === partId)?.quantity_on_hand).toBe(movement.quantity_after);
    await page.getByRole("button", { name: "Stock", exact: true }).click();
    await expect(page.getByText("BRK-PAD-1042", { exact: true })).toBeVisible();
    await screenshot(page, "45-inventory-receipt.png");
  });

  test("owner creates a supplier that remains searchable after reload", async ({ page }) => {
    await login(page, OWNER, "/suppliers");
    await expect(page.getByRole("heading", { name: "Suppliers", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "New supplier", exact: true }).click();
    const dialog = page.getByRole("dialog");
    const name = "E2E Supplier " + Date.now();
    const email = "e2e.supplier." + Date.now() + "@example.test";
    await dialog.getByLabel("Name").first().fill(name);
    await dialog.locator('input[type="email"]').fill(email);

    const createResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === "/api/v1/suppliers/" &&
        response.status() === 201,
    );
    await dialog.getByRole("button", { name: "Add supplier", exact: true }).click();
    const supplier = (await (await createResponse).json()) as { id: string; name: string; email: string };
    expect(supplier).toMatchObject({ name, email });

    const search = page.getByPlaceholder("Name, contact, email");
    await search.fill(name);
    await expect(page.getByText(name, { exact: true })).toBeVisible();
    await page.reload({ waitUntil: "networkidle" });
    await page.getByPlaceholder("Name, contact, email").fill(name);
    await expect(page.getByText(name, { exact: true })).toBeVisible();
    await screenshot(page, "46-supplier-created.png");
  });
  test("staff creates and sends an estimate that the customer approves in a separate session", async ({ browser }) => {
    test.setTimeout(240_000);
    const staffContext = await browser.newContext();
    const staffPage = await staffContext.newPage();
    await login(staffPage, OWNER, "/estimates");
    await expect(staffPage.getByRole("heading", { name: "Estimates", exact: true })).toBeVisible();

    await staffPage.getByRole("button", { name: "New estimate", exact: true }).click();
    const dialog = staffPage.getByRole("dialog");
    const customerSelect = dialog.locator("select").nth(0);
    const customerOption = customerSelect.locator("option").filter({ hasText: "David Wilson" }).first();
    const customerId = await customerOption.getAttribute("value");
    if (!customerId) throw new Error("The seeded portal customer was not returned by the customer API");
    await customerSelect.selectOption(customerId);

    const vehicleSelect = dialog.locator("select").nth(1);
    const vehicleOption = vehicleSelect.locator("option").filter({ hasText: "Honda Accord" }).first();
    const vehicleId = await vehicleOption.getAttribute("value");
    if (!vehicleId) throw new Error("David Wilson's Honda Accord was not returned by the vehicle reference API");
    await vehicleSelect.selectOption(vehicleId);

    const description = "E2E diagnostic " + Date.now();
    await dialog.getByLabel("Description").fill(description);
    await dialog.getByLabel("Hours").fill("1.5");
    await dialog.getByLabel("Hourly rate").fill("95");

    const createResponse = staffPage.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === "/api/v1/estimates/" &&
        response.status() === 201,
    );
    await dialog.getByRole("button", { name: "Create draft", exact: true }).click();
    const created = (await (await createResponse).json()) as {
      id: string;
      estimate_number: string;
      status: string;
      total: number;
      items: Array<{ id: string; description: string; line_total: number }>;
    };
    expect(created.status).toBe("DRAFT");
    expect(created.total).toBe(142.5);
    expect(created.items.some((item) => item.description === description && item.line_total === 142.5)).toBe(true);
    await expect(staffPage.getByRole("heading", { name: created.estimate_number, exact: true })).toBeVisible();

    const sendResponse = staffPage.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === "/api/v1/estimates/" + created.id + "/send" &&
        response.status() === 200,
    );
    await staffPage.getByRole("button", { name: "Send to customer", exact: true }).click();
    const sent = (await (await sendResponse).json()) as { status: string; sent_at: string | null };
    expect(sent.status).toBe("SENT");
    expect(sent.sent_at).toBeTruthy();
    await screenshot(staffPage, "47-estimate-created-and-sent.png");

    const customerContext = await browser.newContext();
    const customerPage = await customerContext.newPage();
    await login(customerPage, CUSTOMER, "/portal/estimates");
    const estimateLink = customerPage.getByRole("link", { name: created.estimate_number, exact: true });
    await expect(estimateLink).toBeVisible();
    await estimateLink.click();
    await expect(customerPage.getByRole("heading", { name: created.estimate_number, exact: true })).toBeVisible();

    const line = customerPage.getByRole("row").filter({ hasText: description });
    await expect(line).toBeVisible();
    const item = created.items.find((entry) => entry.description === description);
    if (!item) throw new Error("The created estimate line was missing from the create response");
    const decisionResponse = customerPage.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === "/api/v1/portal/estimates/" + created.id +
          "/items/" + item.id + "/decision" &&
        response.status() === 200,
    );
    await line.getByRole("button", { name: "Approve", exact: true }).click();
    const decision = (await (await decisionResponse).json()) as {
      item_status: string;
      estimate_status: string;
      approved_total: number;
      remaining_to_decide: number;
    };
    expect(decision.item_status).toBe("APPROVED");
    expect(decision.estimate_status).toBe("APPROVED");
    expect(decision.approved_total).toBe(142.5);
    expect(decision.remaining_to_decide).toBe(0);
    await screenshot(customerPage, "48-customer-approves-created-estimate.png");

    await staffPage.reload({ waitUntil: "networkidle" });
    const persisted = await readApi<{
      status: string;
      approved_total: number;
      items: Array<{ description: string; status: string }>;
    }>(staffPage, "/estimates/" + created.id);
    expect(persisted.status).toBe("APPROVED");
    expect(persisted.approved_total).toBe(142.5);
    expect(persisted.items.find((entry) => entry.description === description)?.status).toBe("APPROVED");

    // Continue the same approved quote into an operational repair order using the UI.
    await staffPage.goto("/repair-orders", { waitUntil: "networkidle" });
    await expect(staffPage.getByRole("heading", { name: "Repair orders", exact: true })).toBeVisible();
    await staffPage.getByRole("button", { name: "New repair order", exact: true }).click();
    const orderDialog = staffPage.getByRole("dialog", { name: "New repair order" });
    const orderCustomer = orderDialog.locator("select").nth(0);
    await orderCustomer.selectOption(customerId);
    const orderVehicle = orderDialog.locator("select").nth(1);
    await orderVehicle.selectOption(vehicleId);
    const orderEstimate = orderDialog.locator("select").nth(2);
    await expect(orderEstimate.locator("option").filter({ hasText: created.estimate_number })).toHaveCount(1);
    await orderEstimate.selectOption(created.id);
    const orderTechnician = orderDialog.locator("select").nth(5);
    const technicianOption = orderTechnician.locator("option").filter({ hasText: "Mike Rodriguez" }).first();
    const technicianId = await technicianOption.getAttribute("value");
    if (!technicianId) throw new Error("The seeded technician was not returned by the staff reference API");
    await orderTechnician.selectOption(technicianId);
    await orderDialog.getByLabel("Odometer in").fill("74210");
    const bay = "E2E-RO-" + Date.now().toString().slice(-7);
    await orderDialog.getByLabel("Bay").fill(bay);

    const createOrderResponsePromise = staffPage.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === "/api/v1/repair_orders/" &&
        response.status() === 201,
    );
    await orderDialog.getByRole("button", { name: "Create repair order", exact: true }).click();
    const createdOrder = (await (await createOrderResponsePromise).json()) as {
      id: string;
      ro_number: string;
      customer_id: string;
      vehicle_id: string;
      estimate_id: string | null;
      status: string;
      tasks: Array<{ id: string; description: string; status: string }>;
    };
    expect(createdOrder).toMatchObject({
      customer_id: customerId,
      vehicle_id: vehicleId,
      estimate_id: created.id,
      status: "DRAFT",
    });
    expect(createdOrder.tasks.length).toBeGreaterThan(0);
    await expect(staffPage).toHaveURL(new RegExp("/repair-orders/" + createdOrder.id + "$"));
    await expect(staffPage.getByRole("heading", { name: createdOrder.ro_number, exact: true })).toBeVisible();
    await screenshot(staffPage, "52-repair-order-created.png");

    const statusSelect = staffPage.getByLabel("New status");
    const approveOrderPromise = staffPage.waitForResponse(
      (response) =>
        response.request().method() === "PATCH" &&
        new URL(response.url()).pathname === "/api/v1/repair_orders/" + createdOrder.id + "/status" &&
        new URL(response.url()).searchParams.get("status") === "APPROVED" &&
        response.status() === 200,
    );
    await statusSelect.selectOption("APPROVED");
    await staffPage.getByRole("button", { name: "Apply", exact: true }).click();
    const approvedOrder = (await (await approveOrderPromise).json()) as { status: string };
    expect(approvedOrder.status).toBe("APPROVED");

    await expect(statusSelect.locator('option[value="IN_PROGRESS"]')).toBeAttached();
    const startOrderPromise = staffPage.waitForResponse(
      (response) =>
        response.request().method() === "PATCH" &&
        new URL(response.url()).pathname === "/api/v1/repair_orders/" + createdOrder.id + "/status" &&
        new URL(response.url()).searchParams.get("status") === "IN_PROGRESS" &&
        response.status() === 200,
    );
    await statusSelect.selectOption("IN_PROGRESS");
    await staffPage.getByRole("button", { name: "Apply", exact: true }).click();
    const startedOrder = (await (await startOrderPromise).json()) as { status: string };
    expect(startedOrder.status).toBe("IN_PROGRESS");

    const task = createdOrder.tasks[0];
    const labourDialogOpen = staffPage.getByRole("button", { name: "Log labour", exact: true });
    await labourDialogOpen.click();
    const labourDialog = staffPage.getByRole("dialog", { name: "Log labour" });
    await labourDialog.getByLabel("Work done").fill("E2E diagnostic work performed");
    const labourNumbers = labourDialog.locator('input[type="number"]');
    await labourNumbers.nth(0).fill("1.5");
    await labourNumbers.nth(1).fill("1.5");
    await labourNumbers.nth(2).fill("95");
    await labourDialog.getByLabel("Task").selectOption(task.id);

    const labourResponsePromise = staffPage.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === "/api/v1/labor/" &&
        response.status() === 201,
    );
    await labourDialog.getByRole("button", { name: "Record", exact: true }).click();
    const labourRecord = (await (await labourResponsePromise).json()) as {
      id: string;
      repair_order_id: string;
      repair_task_id: string | null;
      actual_hours: number;
      labor_cost: number;
    };
    expect(labourRecord).toMatchObject({
      repair_order_id: createdOrder.id,
      repair_task_id: task.id,
      actual_hours: 1.5,
      labor_cost: 142.5,
    });

    const taskStatusSelect = staffPage.getByLabel("Status for " + task.description);
    const taskStartPromise = staffPage.waitForResponse(
      (response) =>
        response.request().method() === "PATCH" &&
        new URL(response.url()).pathname === "/api/v1/repair_orders/" +
          createdOrder.id + "/tasks/" + task.id + "/status" &&
        new URL(response.url()).searchParams.get("status") === "IN_PROGRESS" &&
        response.status() === 200,
    );
    await taskStatusSelect.selectOption("IN_PROGRESS");
    const taskStartedOrder = (await (await taskStartPromise).json()) as {
      tasks: Array<{ id: string; status: string }>;
    };
    expect(taskStartedOrder.tasks.find((record) => record.id === task.id)?.status).toBe("IN_PROGRESS");

    const taskCompletePromise = staffPage.waitForResponse(
      (response) =>
        response.request().method() === "PATCH" &&
        new URL(response.url()).pathname === "/api/v1/repair_orders/" +
          createdOrder.id + "/tasks/" + task.id + "/status" &&
        new URL(response.url()).searchParams.get("status") === "COMPLETED" &&
        response.status() === 200,
    );
    await taskStatusSelect.selectOption("COMPLETED");
    const taskCompletedOrder = (await (await taskCompletePromise).json()) as {
      tasks: Array<{ id: string; status: string }>;
      all_tasks_done: boolean;
    };
    expect(taskCompletedOrder.tasks.find((record) => record.id === task.id)?.status).toBe("COMPLETED");
    expect(taskCompletedOrder.all_tasks_done).toBe(true);
    await screenshot(staffPage, "53-repair-order-labour-and-task.png");

    const completeOrderPromise = staffPage.waitForResponse(
      (response) =>
        response.request().method() === "PATCH" &&
        new URL(response.url()).pathname === "/api/v1/repair_orders/" + createdOrder.id + "/status" &&
        new URL(response.url()).searchParams.get("status") === "COMPLETED" &&
        response.status() === 200,
    );
    await statusSelect.selectOption("COMPLETED");
    await staffPage.getByRole("button", { name: "Apply", exact: true }).click();
    const completedOrder = (await (await completeOrderPromise).json()) as { id: string; status: string };
    expect(completedOrder).toMatchObject({ id: createdOrder.id, status: "COMPLETED" });

    await staffPage.reload({ waitUntil: "networkidle" });
    const savedOrder = await readApi<{
      status: string;
      tasks: Array<{ id: string; status: string }>;
    }>(staffPage, "/repair_orders/" + createdOrder.id);
    expect(savedOrder.status).toBe("COMPLETED");
    expect(savedOrder.tasks.find((record) => record.id === task.id)?.status).toBe("COMPLETED");
    await screenshot(staffPage, "54-repair-order-completed.png");

    // Independent quality control: a workshop owner must be able to verify work
    // completed by a different technician, and the backend moves the order to QC_PASSED.
    await staffPage.goto("/qc", { waitUntil: "networkidle" });
    await expect(staffPage.getByRole("heading", { name: "Quality control", exact: true })).toBeVisible();
    const queueRow = staffPage.getByRole("row").filter({ hasText: createdOrder.ro_number });
    await expect(queueRow).toBeVisible();
    const startQcResponsePromise = staffPage.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === "/api/v1/qc/" &&
        response.status() === 201,
    );
    await queueRow.getByRole("button", { name: "Start check", exact: true }).click();
    const qualityCheck = (await (await startQcResponsePromise).json()) as {
      id: string;
      repair_order_id: string;
      status: string;
      attempt_number: number;
      checks: Array<{ check_type: string; passed: boolean; blocking: boolean }>;
    };
    expect(qualityCheck).toMatchObject({
      repair_order_id: createdOrder.id,
      status: "IN_PROGRESS",
      attempt_number: 1,
    });
    await staffPage.getByRole("button", { name: "Checks", exact: true }).click();
    const checkRow = staffPage.getByRole("row").filter({ hasText: createdOrder.ro_number });
    await expect(checkRow).toBeVisible();
    await checkRow.click();
    const qcDialog = staffPage.getByRole("dialog", { name: "Inspection · attempt 1" });
    await expect(qcDialog.getByText("No blocking check is failing, so this inspection can be passed.")).toBeVisible();
    const passResponsePromise = staffPage.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === "/api/v1/qc/" + qualityCheck.id + "/pass" &&
        response.status() === 200,
    );
    await qcDialog.getByRole("button", { name: "Pass", exact: true }).click();
    const passedQc = (await (await passResponsePromise).json()) as { id: string; status: string };
    expect(passedQc).toMatchObject({ id: qualityCheck.id, status: "PASSED" });
    const savedQc = await readApi<{ status: string; repair_order_id: string }>(staffPage, "/qc/" + qualityCheck.id);
    expect(savedQc).toMatchObject({ status: "PASSED", repair_order_id: createdOrder.id });
    const qcPassedOrder = await readApi<{ status: string }>(staffPage, "/repair_orders/" + createdOrder.id);
    expect(qcPassedOrder.status).toBe("QC_PASSED");
    await screenshot(staffPage, "55-repair-order-passed-quality-control.png");

    // Create and issue a real invoice from that QC-passed order.
    await staffPage.goto("/invoices", { waitUntil: "networkidle" });
    await expect(staffPage.getByRole("heading", { name: "Invoices", exact: true })).toBeVisible();
    await staffPage.getByRole("button", { name: "Raise invoice", exact: true }).click();
    const invoiceDialog = staffPage.getByRole("dialog", { name: "Raise an invoice" });
    const billableOrderSelect = invoiceDialog.getByLabel("Repair order");
    await expect(billableOrderSelect.locator("option").filter({ hasText: createdOrder.ro_number })).toHaveCount(1);
    await billableOrderSelect.selectOption(createdOrder.id);
    const createInvoiceResponsePromise = staffPage.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === "/api/v1/invoices/" &&
        response.status() === 201,
    );
    await invoiceDialog.getByRole("button", { name: "Create draft", exact: true }).click();
    const createdInvoice = (await (await createInvoiceResponsePromise).json()) as {
      id: string;
      invoice_number: string;
      repair_order_id: string;
      status: string;
      total: number;
      balance: number;
      items: Array<{ description: string; source: string }>;
    };
    expect(createdInvoice).toMatchObject({
      repair_order_id: createdOrder.id,
      status: "DRAFT",
    });
    expect(createdInvoice.items.some((item) => item.description === description && item.source === "ESTIMATE")).toBe(true);
    await expect(staffPage.getByRole("heading", { name: createdInvoice.invoice_number, exact: true })).toBeVisible();

    const issueResponsePromise = staffPage.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === "/api/v1/invoices/" + createdInvoice.id + "/issue" &&
        response.status() === 200,
    );
    await staffPage.getByRole("button", { name: "Issue", exact: true }).click();
    const issuedInvoice = (await (await issueResponsePromise).json()) as { status: string; balance: number; total: number };
    expect(issuedInvoice.status).toBe("ISSUED");
    expect(issuedInvoice.balance).toBeGreaterThan(0);
    await screenshot(staffPage, "56-workshop-invoice-issued.png");

    await staffPage.getByRole("button", { name: "Record payment", exact: true }).click();
    const payDialog = staffPage.getByRole("dialog", { name: "Record a payment" });
    const payAmount = payDialog.getByLabel("Amount");
    await payAmount.fill((issuedInvoice.balance + 1).toFixed(2));
    await expect(payDialog.getByText(/More than the balance/)).toBeVisible();
    await expect(payDialog.getByRole("button", { name: "Record payment", exact: true })).toBeDisabled();

    await payAmount.fill(issuedInvoice.balance.toFixed(2));
    const paymentResponsePromise = staffPage.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === "/api/v1/payments/" &&
        response.status() === 201,
    );
    await payDialog.getByRole("button", { name: "Record payment", exact: true }).click();
    const recordedPayment = (await (await paymentResponsePromise).json()) as {
      id: string;
      invoice_id: string;
      amount: number;
      status: string;
    };
    expect(recordedPayment).toMatchObject({
      invoice_id: createdInvoice.id,
      amount: issuedInvoice.balance,
      status: "RECORDED",
    });
    const settledInvoice = await readApi<{ status: string; amount_paid: number; balance: number; total: number }>(
      staffPage,
      "/invoices/" + createdInvoice.id,
    );
    expect(settledInvoice).toMatchObject({
      status: "PAID",
      amount_paid: issuedInvoice.balance,
      balance: 0,
    });
    await screenshot(staffPage, "57-workshop-invoice-settled.png");

    // Read the same invoice from the customer account after the payment is settled.
    await customerPage.goto("/portal/invoices/" + createdInvoice.id, { waitUntil: "networkidle" });
    await expect(customerPage.getByRole("heading", { name: createdInvoice.invoice_number, exact: true })).toBeVisible();
    await expect(customerPage.getByText(/settled|paid/i).first()).toBeVisible();
    const portalInvoice = await readApi<{ status: string; balance: number }>(
      customerPage,
      "/portal/invoices/" + createdInvoice.id,
    );
    expect(portalInvoice).toMatchObject({ status: "PAID", balance: 0 });
    await screenshot(customerPage, "58-customer-portal-settled-invoice.png");

    await customerContext.close();
    await staffContext.close();
  });



  test("staff books, confirms and cancels an appointment with conflict and reason validation", async ({ page }) => {
    test.setTimeout(90_000);
    await login(page, OWNER, "/appointments");
    await expect(page.getByRole("heading", { name: "Diary", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "New booking", exact: true }).click();

    const booking = page.getByRole("dialog", { name: "New booking" });
    const customerSelect = booking.locator("select").nth(0);
    const customerOption = customerSelect.locator("option").filter({ hasText: "David Wilson" }).first();
    const customerId = await customerOption.getAttribute("value");
    if (!customerId) throw new Error("The seeded portal customer was not returned by the customer reference API");
    await customerSelect.selectOption(customerId);

    const vehicleSelect = booking.locator("select").nth(1);
    const vehicleOption = vehicleSelect.locator("option").filter({ hasText: "Honda Accord" }).first();
    const vehicleId = await vehicleOption.getAttribute("value");
    if (!vehicleId) throw new Error("The seeded Honda Accord was not returned for David Wilson");
    await vehicleSelect.selectOption(vehicleId);

    const future = new Date();
    future.setDate(future.getDate() + 45);
    future.setHours(11, 0, 0, 0);
    const localDateTime = new Date(future.getTime() - future.getTimezoneOffset() * 60_000)
      .toISOString()
      .slice(0, 16);
    const bay = "E2E-" + Date.now().toString().slice(-8);
    await booking.getByLabel("Work").selectOption("DIAGNOSTIC");
    await booking.getByLabel("Bay").fill(bay);
    await booking.getByLabel("What the customer said").fill("Dashboard warning light; E2E booking validation.");

    const freeSlotResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === "/api/v1/appointments/check-conflicts" &&
        response.status() === 200,
    );
    await booking.getByLabel("Starts").fill(localDateTime);
    const freeSlotResponse = await freeSlotResponsePromise;
    const freeSlot = (await freeSlotResponse.json()) as { has_conflict: boolean };
    expect(freeSlot.has_conflict).toBe(false);
    await expect(booking.getByText("The slot is free.")).toBeVisible();

    const createResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === "/api/v1/appointments/" &&
        response.status() === 201,
    );
    await booking.getByRole("button", { name: "Book it", exact: true }).click();
    const created = (await (await createResponsePromise).json()) as {
      id: string;
      customer_id: string;
      vehicle_id: string;
      service_type: string;
      status: string;
      scheduled_start: string;
      bay: string;
    };
    expect(created).toMatchObject({
      customer_id: customerId,
      vehicle_id: vehicleId,
      service_type: "DIAGNOSTIC",
      status: "REQUESTED",
      bay,
    });

    await page.getByRole("button", { name: "List", exact: true }).click();
    const bookingDate = new Date(created.scheduled_start);
    const renderedDate = bookingDate.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
    const renderedTime = bookingDate.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
    // Multiple legitimate bookings can share a vehicle and service type, so tie
    // subsequent status transitions to the exact slot returned by the create API.
    const appointmentRow = page.getByRole("row")
      .filter({ hasText: renderedDate })
      .filter({ hasText: renderedTime });
    await expect(appointmentRow).toBeVisible();
    await appointmentRow.click();
    const details = page.getByRole("dialog", { name: "Diagnostic" });
    await expect(details.getByText("REQUESTED", { exact: true })).toBeVisible();

    const confirmResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "PATCH" &&
        new URL(response.url()).pathname === "/api/v1/appointments/" + created.id + "/status" &&
        response.status() === 200,
    );
    await details.getByRole("button", { name: "Confirmed", exact: true }).click();
    await details.getByRole("button", { name: "Apply", exact: true }).click();
    const confirmed = (await (await confirmResponsePromise).json()) as { id: string; status: string };
    expect(confirmed).toMatchObject({ id: created.id, status: "CONFIRMED" });
    await screenshot(page, "49-workshop-appointment-confirmed.png");
    const confirmedReadback = await readApi<{ status: string; vehicle_id: string }>(page, "/appointments/" + created.id);
    expect(confirmedReadback).toMatchObject({ status: "CONFIRMED", vehicle_id: vehicleId });

    await details.getByRole("button", { name: "Close dialog" }).click();
    await page.getByRole("button", { name: "New booking", exact: true }).click();
    const duplicate = page.getByRole("dialog", { name: "New booking" });
    await duplicate.locator("select").nth(0).selectOption(customerId);
    await duplicate.locator("select").nth(1).selectOption(vehicleId);
    await duplicate.getByLabel("Work").selectOption("DIAGNOSTIC");
    await duplicate.getByLabel("Bay").fill(bay);

    const conflictResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === "/api/v1/appointments/check-conflicts" &&
        response.status() === 200,
    );
    await duplicate.getByLabel("Starts").fill(localDateTime);
    const conflictResponse = await conflictResponsePromise;
    const conflict = (await conflictResponse.json()) as {
      has_conflict: boolean;
      conflicts: Array<{ appointment_id: string }>;
    };
    expect(conflict.has_conflict).toBe(true);
    expect(conflict.conflicts.some((item) => item.appointment_id === created.id)).toBe(true);
    await expect(duplicate.getByText("That slot is already taken.")).toBeVisible();
    await expect(duplicate.getByRole("button", { name: "Book it", exact: true })).toBeDisabled();
    await duplicate.getByRole("button", { name: "Close dialog" }).click();

    const cancelResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "PATCH" &&
        new URL(response.url()).pathname === "/api/v1/appointments/" + created.id + "/status" &&
        response.status() === 200,
    );
    await appointmentRow.click();
    const refreshedDetails = page.getByRole("dialog", { name: "Diagnostic" });
    await refreshedDetails.getByRole("button", { name: "Cancelled", exact: true }).click();
    const applyCancel = refreshedDetails.getByRole("button", { name: "Apply", exact: true });
    await expect(refreshedDetails.getByLabel("Why is it being cancelled")).toBeVisible();
    await expect(applyCancel).toBeDisabled();
    await refreshedDetails.getByLabel("Why is it being cancelled").fill("Customer asked to move this E2E booking.");
    await expect(applyCancel).toBeEnabled();
    await applyCancel.click();
    const cancelled = (await (await cancelResponsePromise).json()) as {
      id: string;
      status: string;
      cancellation_reason: string | null;
    };
    expect(cancelled).toMatchObject({
      id: created.id,
      status: "CANCELLED",
      cancellation_reason: "Customer asked to move this E2E booking.",
    });
    await screenshot(page, "50-workshop-appointment-cancelled.png");

    await page.reload({ waitUntil: "networkidle" });
    const cancelledReadback = await readApi<{ status: string; cancellation_reason: string | null }>(
      page,
      "/appointments/" + created.id,
    );
    expect(cancelledReadback).toMatchObject({
      status: "CANCELLED",
      cancellation_reason: "Customer asked to move this E2E booking.",
    });
  });


  test("invoice issuance stays blocked until its linked repair order passes QC", async ({ page }) => {
    await login(page, OWNER, "/invoices");
    const list = await readApi<{
      data: Array<{ id: string; invoice_number: string; status: string; repair_order_id: string }>;
    }>(page, "/invoices/?page=1&size=100");
    const draft = list.data.find((invoice) => invoice.invoice_number === "INV-2026-0003");
    expect(draft, "The seeded in-progress repair order should have a draft invoice").toBeTruthy();
    if (!draft) throw new Error("Expected seeded draft invoice INV-2026-0003");

    await page.goto("/invoices/" + draft.id, { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: draft.invoice_number, exact: true })).toBeVisible();
    const invoice = await readApi<{
      id: string;
      status: string;
      repair_order_id: string;
      issued_at: string | null;
    }>(page, "/invoices/" + draft.id);
    expect(invoice.status).toBe("DRAFT");
    expect(invoice.issued_at).toBeNull();

    const repairOrder = await readApi<{ id: string; status: string; ro_number: string }>(
      page,
      "/repair_orders/" + invoice.repair_order_id,
    );
    expect(repairOrder.status).toBe("IN_PROGRESS");
    const issueButton = page.getByRole("button", { name: "Issue", exact: true });
    await expect(issueButton).toBeDisabled();
    await expect(issueButton).toHaveAttribute(
      "title",
      /repair order is IN_PROGRESS; quality control must pass/i,
    );

    // Exercise the server guard directly as well, so a caller cannot bypass the disabled UI.
    const token = await page.evaluate(() => localStorage.getItem("autofix.access_token"));
    if (!token) throw new Error("No owner session available for invoice issue guard check");
    const base = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000").replace(/\\/+$/, "");
    const attempt = await page.request.post(base + "/api/v1/invoices/" + draft.id + "/issue", {
      headers: { Authorization: "Bearer " + token },
    });
    expect(attempt.status()).toBe(400);
    const problem = (await attempt.json()) as { detail: string };
    expect(problem.detail).toContain("IN_PROGRESS");
    expect(problem.detail).toContain("quality control has passed");

    const unchanged = await readApi<{ status: string; issued_at: string | null }>(
      page,
      "/invoices/" + draft.id,
    );
    expect(unchanged).toMatchObject({ status: "DRAFT", issued_at: null });
    await screenshot(page, "59-invoice-issue-blocked-until-qc.png");
  });

});
