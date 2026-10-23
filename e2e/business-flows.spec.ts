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

    const listRead = page.waitForResponse(
      (response) =>
        response.request().method() === "GET" &&
        new URL(response.url()).pathname === "/api/v1/portal/appointments" &&
        response.status() === 200,
    );
    await page.reload({ waitUntil: "networkidle" });
    const persisted = (await (await listRead).json()) as Array<{ id: string; status: string }>;
    expect(persisted.find((record) => record.id === appointment.id)?.status).toBe("REQUESTED");
    await screenshot(page, "44-portal-appointment-requested.png");
  });

  test("customer invoice overpayment is blocked and a real portal payment settles the balance", async ({ page }) => {
    await login(page, CUSTOMER, "/portal/invoices");

    const listRead = page.waitForResponse(
      (response) =>
        response.request().method() === "GET" &&
        new URL(response.url()).pathname === "/api/v1/portal/invoices" &&
        response.status() === 200,
    );
    await page.reload({ waitUntil: "networkidle" });
    const invoices = (await (await listRead).json()) as Array<{
      id: string;
      invoice_number: string;
      status: string;
      balance: number;
    }>;
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

    const detailRead = page.waitForResponse(
      (response) =>
        response.request().method() === "GET" &&
        new URL(response.url()).pathname === "/api/v1/portal/invoices/" + payable.id &&
        response.status() === 200,
    );
    await page.reload({ waitUntil: "networkidle" });
    const saved = (await (await detailRead).json()) as { status: string; balance: number };
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

    const stockRead = page.waitForResponse(
      (response) =>
        response.request().method() === "GET" &&
        new URL(response.url()).pathname === "/api/v1/inventory/stock-levels" &&
        response.status() === 200,
    );
    await page.reload({ waitUntil: "networkidle" });
    const levels = (await (await stockRead).json()) as Array<{ part_id: string; quantity_on_hand: number }>;
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
    await dialog.getByLabel("Name").fill(name);
    await dialog.getByLabel("Email").fill(email);

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
    const staffContext = await browser.newContext();
    const staffPage = await staffContext.newPage();
    await login(staffPage, OWNER, "/estimates");
    await expect(staffPage.getByRole("heading", { name: "Estimates", exact: true })).toBeVisible();

    await staffPage.getByRole("button", { name: "New estimate", exact: true }).click();
    const dialog = staffPage.getByRole("dialog");
    const customerSelect = dialog.getByLabel("Customer");
    const customerOption = customerSelect.locator("option").filter({ hasText: "David Wilson" }).first();
    const customerId = await customerOption.getAttribute("value");
    if (!customerId) throw new Error("The seeded portal customer was not returned by the customer API");
    await customerSelect.selectOption(customerId);

    const vehicleSelect = dialog.getByLabel("Vehicle");
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

    const staffReadback = staffPage.waitForResponse(
      (response) =>
        response.request().method() === "GET" &&
        new URL(response.url()).pathname === "/api/v1/estimates/" + created.id &&
        response.status() === 200,
    );
    await staffPage.reload({ waitUntil: "networkidle" });
    const persisted = (await (await staffReadback).json()) as {
      status: string;
      approved_total: number;
      items: Array<{ description: string; status: string }>;
    };
    expect(persisted.status).toBe("APPROVED");
    expect(persisted.approved_total).toBe(142.5);
    expect(persisted.items.find((entry) => entry.description === description)?.status).toBe("APPROVED");

    await customerContext.close();
    await staffContext.close();
  });

});
