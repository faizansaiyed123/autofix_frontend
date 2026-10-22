import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const SCREENSHOT_DIR = path.join(process.cwd(), "e2e", "evidence");
const STAFF = { email: "manager@autofix.demo", password: "demo1234" };
const CUSTOMER = { email: "customer@autofix.demo", password: "demo1234" };

function evidence(name: string) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  return path.join(SCREENSHOT_DIR, name);
}

async function login(page: Page, account: { email: string; password: string }, destination?: string) {
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.getByLabel("Email").first().fill(account.email);
  await page.getByLabel("Password").first().fill(account.password);

  const response = page.waitForResponse(
    (r) => r.request().method() === "POST" && r.url().includes("/api/v1/auth/login"),
  );
  await page.getByRole("button", { name: "Sign in" }).click();
  await response;

  await expect.poll(() => page.url()).not.toContain("/login");
  if (destination) await page.goto(destination, { waitUntil: "networkidle" });
}

async function screenshot(page: Page, filename: string) {
  await page.screenshot({ path: evidence(filename), fullPage: true });
}

async function expectPage(page: Page, heading?: string) {
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.locator("body")).not.toContainText(/Application error|Unhandled Runtime Error/i);
  if (heading) {
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  }
}

async function visitFeaturePage(
  page: Page,
  route: string,
  filename: string,
  heading?: string,
  requireApi = true,
) {
  const apiResponses: number[] = [];
  const onResponse = (response: { url(): string; status(): number }) => {
    if (response.url().includes("/api/v1/")) {
      apiResponses.push(response.status());
    }
  };

  page.on("response", onResponse);
  const response = await page.goto(route, { waitUntil: "networkidle" });
  if (response) expect(response.status()).toBeLessThan(400);
  await expectPage(page, heading);
  if (requireApi) {
    expect(apiResponses.length, "Expected " + route + " to call the backend API").toBeGreaterThan(0);
    expect(apiResponses.some((status) => status >= 500), "Backend 5xx response on " + route).toBe(false);
  }
  await screenshot(page, filename);
  page.off("response", onResponse);
}

test.describe("AutoFix user-facing full-stack walkthrough", () => {
  test("staff sees live workshop and money data from the API", async ({ page }) => {
    const dashboardResponse = page.waitForResponse(
      (r) =>
        r.request().method() === "GET" &&
        r.url().includes("/api/v1/reports/dashboard") &&
        r.status() === 200,
    );

    await login(page, STAFF);
    await dashboardResponse;
    await expectPage(page, "Dashboard");
    await expect(page.getByText("Invoiced", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Collected", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("On the floor", { exact: true })).toBeVisible();
    await screenshot(page, "01-dashboard.png");

    const pages: Array<[string, string, string]> = [
      ["/attention", "Attention centre", "02-attention-centre.png"],
      ["/customers", "Customers", "03-customers.png"],
      ["/appointments", "Diary", "04-diary.png"],
      ["/check-ins", "Check-ins", "05-check-ins.png"],
      ["/inspections", "Inspections", "06-inspections.png"],
      ["/estimates", "Estimates", "07-estimates.png"],
      ["/repair-orders", "Repair orders", "08-repair-orders.png"],
      ["/qc", "Quality control", "09-quality-control.png"],
      ["/invoices", "Invoices", "10-invoices.png"],
      ["/payments", "Payments", "11-payments.png"],
      ["/inventory", "Inventory", "12-inventory.png"],
      ["/reports", "Reports", "13-reports.png"],
      ["/audit", "Audit log", "16-audit.png"],
      ["/labour", "Labour", "17-labour.png"],
      ["/my-work", "My work", "18-my-work.png"],
      ["/part-requests", "Part requests", "19-part-requests.png"],
      ["/parts", "Parts", "20-parts.png"],
      ["/purchase-orders", "Purchase orders", "21-purchase-orders.png"],
      ["/service-requests", "Service requests", "22-service-requests.png"],
      ["/staff", "Staff", "23-staff.png"],
      ["/suppliers", "Suppliers", "24-suppliers.png"],
      ["/vehicles", "Vehicles", "25-vehicles.png"],
    ];

    for (const [route, heading, filename] of pages) {
      await visitFeaturePage(page, route, filename, heading);
    }

  });

  test("a customer request travels from portal UI into the staff queue", async ({ browser }) => {
    const customerContext = await browser.newContext({ baseURL: BASE_URL });
    const customerPage = await customerContext.newPage();

    await login(customerPage, CUSTOMER, "/portal/service-requests");
    await expectPage(customerPage, "Requests");
    await customerPage.getByRole("button", { name: "Ask for work", exact: true }).click();
    await customerPage.getByLabel("What is it for").fill("E2E brake inspection");
    await customerPage
      .getByLabel("Anything more we should know")
      .fill("Created by the browser integration test and should appear in the shop queue.");

    const createResponse = customerPage.waitForResponse(
      (r) =>
        r.request().method() === "POST" &&
        r.url().includes("/api/v1/portal/service-requests") &&
        r.status() === 201,
    );
    await customerPage.getByRole("button", { name: "Send", exact: true }).click();
    await createResponse;
    await expect(customerPage.getByText("E2E brake inspection", { exact: true })).toBeVisible();
    await screenshot(customerPage, "14-customer-portal-request-created.png");
    await customerContext.close();

    const staffContext = await browser.newContext({ baseURL: BASE_URL });
    const staffPage = await staffContext.newPage();
    await login(staffPage, STAFF, "/service-requests");
    await expectPage(staffPage, "Service requests");

    const serviceRequestsResponse = staffPage.waitForResponse(
      (r) =>
        r.request().method() === "GET" &&
        r.url().includes("/api/v1/service_requests/") &&
        r.status() === 200,
    );
    await staffPage.reload({ waitUntil: "networkidle" });
    await serviceRequestsResponse;
    await expect(staffPage.getByText("E2E brake inspection", { exact: true })).toBeVisible();
    await screenshot(staffPage, "15-staff-queue-received-request.png");
    await staffContext.close();
  });

  test("a staff-created customer survives navigation and reload", async ({ page }) => {
    await login(page, STAFF, "/customers");
    await expectPage(page, "Customers");
    await page.getByRole("button", { name: "New customer", exact: true }).click();

    const uniqueEmail = "e2e.customer@autofix.demo";
    await page.getByLabel("First name").fill("E2E");
    await page.getByLabel("Last name").fill("Customer");
    await page.getByRole("dialog").getByLabel("Email", { exact: true }).fill(uniqueEmail);
    await page.getByRole("dialog").getByLabel("Phone", { exact: true }).fill("+1-503-555-0199");

    const createResponse = page.waitForResponse(
      (r) =>
        r.request().method() === "POST" &&
        r.url().includes("/api/v1/customers/") &&
        r.status() === 201,
    );
    await page.getByRole("button", { name: "Create customer", exact: true }).click();
    const response = await createResponse;
    const created = (await response.json()) as { id: string };

    await page.goto("/customers", { waitUntil: "networkidle" });
    await page.getByPlaceholder("Name, email, phone or company").fill(uniqueEmail);
    await expect(page.getByText("E2E Customer", { exact: true })).toBeVisible();

    await page.goto("/customers/" + created.id, { waitUntil: "networkidle" });
    await expect(page.getByText("E2E Customer", { exact: true })).toBeVisible();
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByText(uniqueEmail, { exact: true })).toBeVisible();
  });

  test("customer portal pages are all backed by their live API data", async ({ page }) => {
    await login(page, CUSTOMER);

    const pages: Array<[string, string, string]> = [
      ["/portal", "", "33-customer-portal-home.png"],
      ["/portal/appointments", "Appointments", "34-portal-appointments.png"],
      ["/portal/estimates", "Estimates", "35-portal-estimates.png"],
      ["/portal/invoices", "Invoices", "36-portal-invoices.png"],
      ["/portal/payments", "Payments", "37-portal-payments.png"],
      ["/portal/service-requests", "Requests", "38-portal-service-requests.png"],
      ["/portal/vehicles", "My vehicles", "39-portal-vehicles.png"],
    ];

    for (const [route, heading, filename] of pages) {
      await visitFeaturePage(page, route, filename, heading);
    }

  });
});
