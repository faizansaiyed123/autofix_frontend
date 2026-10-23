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

async function readAuthenticatedApi<T>(page: Page, apiPath: string): Promise<T> {
  const token = await page.evaluate(() => localStorage.getItem("autofix.access_token"));
  if (!token) throw new Error("No access token available for authenticated API readback");
  const apiBase = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000").replace(/\/+$/, "");
  const response = await page.request.get(apiBase + "/api/v1" + apiPath, {
    headers: { Authorization: "Bearer " + token },
  });
  expect(response.status()).toBe(200);
  return (await response.json()) as T;
}

type MailpitSummary = {
  ID: string;
  Subject: string;
  To: Array<{ Address: string }>;
};

type MailpitMessage = MailpitSummary & {
  Text: string;
  HTML: string;
};

async function waitForMail(page: Page, recipient: string, subject: string): Promise<MailpitMessage> {
  let found: MailpitSummary | undefined;
  await expect.poll(async () => {
    const response = await page.request.get("http://127.0.0.1:8025/api/v1/messages?limit=50");
    if (!response.ok()) return false;
    const mailbox = (await response.json()) as { messages?: MailpitSummary[] };
    found = mailbox.messages?.find(
      (message) =>
        message.Subject === subject &&
        message.To?.some((to) => to.Address.toLowerCase() === recipient.toLowerCase()),
    );
    return Boolean(found);
  }, { timeout: 30_000, intervals: [250, 500, 1000, 2000] }).toBe(true);

  if (!found) throw new Error("Mailpit did not receive " + subject + " for " + recipient);
  const detailResponse = await page.request.get(
    "http://127.0.0.1:8025/api/v1/message/" + encodeURIComponent(found.ID),
  );
  expect(detailResponse.status()).toBe(200);
  return (await detailResponse.json()) as MailpitMessage;
}

function tokenFromEmail(message: MailpitMessage, path: "verify-email" | "reset-password"): string {
  const link = message.Text.match(new RegExp("https?://[^\\s<]+/" + path + "#token=[^\\s<]+"));
  if (!link) throw new Error("The real email did not contain a " + path + " token link");
  const token = new URL(link[0]).hash.slice(1);
  const value = new URLSearchParams(token).get("token");
  if (!value) throw new Error("Could not extract the one-time token from the email");
  return value;
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
    expect(apiResponses.some((status) => status >= 200 && status < 300), "Expected a successful backend read on " + route).toBe(true);
    expect(apiResponses.some((status) => status >= 500), "Backend 5xx response on " + route).toBe(false);
  }
  await screenshot(page, filename);
  page.off("response", onResponse);
}

test.describe("AutoFix user-facing full-stack walkthrough", () => {
  test("verification fragment is stripped and the real API rejects an invalid token", async ({ page }) => {
    await page.goto("/verify-email#token=fragment-only-test-token");
    await expect.poll(() => new URL(page.url()).hash).toBe("");
    await expect(page.getByRole("heading", { name: "Confirm your email address" })).toBeVisible();

    const responsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/api/v1/auth/verify-email"),
    );
    await page.getByRole("button", { name: "Verify email address" }).click();
    const response = await responsePromise;
    expect(response.status()).toBe(400);
    expect(response.request().postDataJSON()).toEqual({ token: "fragment-only-test-token" });
    await expect(page.getByRole("heading", { name: "This link needs attention" })).toBeVisible();
    await expect(page.getByText(/may have expired or already been used/i)).toBeVisible();
    await screenshot(page, "40-invalid-verification-link.png");
  });

  test("password-reset fragment is stripped and the real API rejects an invalid token", async ({ page }) => {
    await page.goto("/reset-password#token=reset-fragment-only-token");
    await expect.poll(() => new URL(page.url()).hash).toBe("");
    await page.locator('input[type="password"]').nth(0).fill("test-safe-password-42");
    await page.locator('input[type="password"]').nth(1).fill("test-safe-password-42");

    const responsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/api/v1/auth/password-reset/confirm"),
    );
    await page.getByRole("button", { name: "Update password" }).click();
    const response = await responsePromise;
    expect(response.status()).toBe(400);
    expect(response.request().postDataJSON()).toEqual({
      token: "reset-fragment-only-token",
      new_password: "test-safe-password-42",
    });
    await expect(page.getByText(/invalid or expired reset token/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Choose a new password" })).toBeVisible();
    await screenshot(page, "41-invalid-password-reset.png");
  });

  test("public homepage and customer signup are responsive and reachable", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: /Run the workshop/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Sign in/ }).first()).toBeVisible();
    const homeWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(homeWidth).toBeLessThanOrEqual(390);
    await screenshot(page, "00-homepage.png");

    await page.goto("/register", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Start with AutoFix" })).toBeVisible();
    await expect(page.getByLabel("First name")).toBeVisible();
    await expect(page.getByLabel("Last name")).toBeVisible();
    await expect(page.getByLabel("Email address")).toBeVisible();
    await expect(page.getByLabel("Password", { exact: false }).first()).toBeVisible();
    const signupWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(signupWidth).toBeLessThanOrEqual(390);
    await screenshot(page, "00-signup.png");
  });

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

  test("vehicle and check-in writes persist through the real API and PostgreSQL", async ({ page }) => {
    await login(page, STAFF, "/vehicles");
    await expectPage(page, "Vehicles");
    await page.getByRole("button", { name: "Add vehicle", exact: true }).click();
    const vehicleDialog = page.getByRole("dialog");
    await vehicleDialog.getByLabel("Owner").selectOption({ label: "David Wilson" });
    await vehicleDialog.getByLabel("Make").fill("E2E");
    await vehicleDialog.getByLabel("Model").fill("PersistenceCheck");
    await vehicleDialog.getByLabel("Year").fill("1800");
    await vehicleDialog.getByLabel("VIN").fill("I12345678901");
    await expect(vehicleDialog.getByText("Outside 1900 to 2030")).toBeVisible();
    await expect(vehicleDialog.getByText("Not a valid VIN")).toBeVisible();
    await expect(vehicleDialog.getByRole("button", { name: "Add vehicle", exact: true })).toBeDisabled();

    await vehicleDialog.getByLabel("Year").fill("2022");
    await vehicleDialog.getByLabel("VIN").fill("1E2EABC1234567890");
    const createVehicleResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/api/v1/vehicles/") &&
        response.status() === 201,
    );
    await vehicleDialog.getByRole("button", { name: "Add vehicle", exact: true }).click();
    const vehicleResponse = await createVehicleResponse;
    const vehicle = (await vehicleResponse.json()) as { id: string; make: string; model: string };
    expect(vehicle.make).toBe("E2E");
    expect(vehicle.model).toBe("PersistenceCheck");

    await page.goto("/vehicles/" + vehicle.id, { waitUntil: "networkidle" });
    const persistedVehicle = await readAuthenticatedApi<{ id: string; make: string; model: string }>(
      page,
      "/vehicles/" + vehicle.id,
    );
    expect(persistedVehicle.id).toBe(vehicle.id);
    await expect(page.getByText("PersistenceCheck", { exact: true }).first()).toBeVisible();
    await screenshot(page, "26-vehicle-details.png");

    await page.goto("/check-ins", { waitUntil: "networkidle" });
    await expectPage(page, "Check-ins");
    await page.getByRole("button", { name: "Check a vehicle in", exact: true }).click();
    const checkInDialog = page.getByRole("dialog");
    await checkInDialog.locator("select").first().selectOption(vehicle.id);
    await checkInDialog.getByLabel("Odometer").fill("0");
    await expect(checkInDialog.getByText("Must be greater than zero")).toBeVisible();
    await expect(checkInDialog.getByRole("button", { name: "Check in", exact: true })).toBeDisabled();
    await checkInDialog.getByLabel("Odometer").fill("12345");

    const createCheckInResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/api/v1/check_ins/") &&
        response.status() === 201,
    );
    await checkInDialog.getByRole("button", { name: "Check in", exact: true }).click();
    const checkIn = (await (await createCheckInResponse).json()) as {
      id: string;
      status: string;
      vehicle_id: string;
    };
    expect(checkIn.vehicle_id).toBe(vehicle.id);
    expect(checkIn.status).toBe("PENDING");

    const row = page.getByRole("row").filter({ hasText: "PersistenceCheck" });
    await expect(row).toBeVisible();
    await row.click();
    const detailDialog = page.getByRole("dialog");
    await expect(detailDialog.getByText("PENDING", { exact: true })).toBeVisible();
    const statusResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "PATCH" &&
        response.url().includes("/api/v1/check_ins/" + checkIn.id + "/status") &&
        response.status() === 200,
    );
    await detailDialog.getByRole("button", { name: "In Progress", exact: true }).click();
    const transitioned = (await (await statusResponse).json()) as { status: string };
    expect(transitioned.status).toBe("IN_PROGRESS");
    await screenshot(page, "27-checkin-status-transition.png");

    await page.goto("/check-ins", { waitUntil: "networkidle" });
    const checkInsRead = await readAuthenticatedApi<{
      data: Array<{ id: string; status: string; vehicle_id: string }>;
    }>(page, "/check_ins/?page=1&size=100");
    const reloaded = checkInsRead.data.find((record) => record.id === checkIn.id);
    expect(reloaded).toMatchObject({ id: checkIn.id, vehicle_id: vehicle.id, status: "IN_PROGRESS" });
    await expect(page.getByRole("row").filter({ hasText: "PersistenceCheck" })).toContainText(/In progress|IN_PROGRESS/i);
  });

  test("customer registration, email verification, password reset, and sign-in use real services", async ({ page }) => {
    test.setTimeout(90_000);
    const email = "e2e.signup." + Date.now() + "@example.test";
    const originalPassword = "FirstPass-test42!";
    const newPassword = "ChangedPass-test73!";

    await page.goto("/register", { waitUntil: "networkidle" });
    await page.getByLabel("First name").fill("E2E");
    await page.getByLabel("Last name").fill("Verified");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Phone number").fill("+1-503-555-0108");
    await page.locator('input[type="password"]').nth(0).fill(originalPassword);
    await page.locator('input[type="password"]').nth(1).fill(originalPassword);

    const registerResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/api/v1/auth/register"),
    );
    await page.getByRole("button", { name: "Create account", exact: true }).click();
    const registered = await registerResponse;
    expect(registered.status()).toBe(202);
    await expect(page.getByRole("heading", { name: "Check your inbox" })).toBeVisible();
    await screenshot(page, "28-registration-submitted.png");

    const verificationMessage = await waitForMail(page, email, "Verify your AutoFix account");
    const verificationToken = tokenFromEmail(verificationMessage, "verify-email");
    expect(verificationMessage.Text).toContain("Verify your email address within 24 hours");

    await page.goto("/verify-email#token=" + encodeURIComponent(verificationToken), { waitUntil: "networkidle" });
    await expect.poll(() => new URL(page.url()).hash).toBe("");
    await expect(page.getByRole("heading", { name: "Confirm your email address" })).toBeVisible();
    const verificationResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/api/v1/auth/verify-email"),
    );
    await page.getByRole("button", { name: "Verify email address", exact: true }).click();
    const verified = await verificationResponse;
    expect(verified.status()).toBe(200);
    await expect(page).toHaveURL(/\/portal$/);
    await expect(page.getByRole("heading").first()).toBeVisible();
    await screenshot(page, "29-verified-customer-portal.png");

    await page.goto("/forgot-password", { waitUntil: "networkidle" });
    await page.getByLabel("Email address").fill(email);
    const resetRequestResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/api/v1/auth/password-reset/request"),
    );
    await page.getByRole("button", { name: "Send reset link", exact: true }).click();
    expect((await resetRequestResponse).status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
    await screenshot(page, "30-password-reset-requested.png");

    const resetMessage = await waitForMail(page, email, "Reset your AutoFix password");
    const resetToken = tokenFromEmail(resetMessage, "reset-password");
    expect(resetMessage.Text).toContain("Reset your password within 60 minutes");

    await page.goto("/reset-password#token=" + encodeURIComponent(resetToken), { waitUntil: "networkidle" });
    await page.locator('input[type="password"]').nth(0).fill(newPassword);
    await page.locator('input[type="password"]').nth(1).fill(newPassword);
    const confirmResetResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/api/v1/auth/password-reset/confirm"),
    );
    await page.getByRole("button", { name: "Update password", exact: true }).click();
    expect((await confirmResetResponse).status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Password updated" })).toBeVisible();
    await screenshot(page, "31-password-reset-confirmed.png");
    await page.getByRole("link", { name: "Continue to sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("status")).toContainText("Your password has been updated");

    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(originalPassword);
    const oldPasswordLogin = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/api/v1/auth/login"),
    );
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    expect((await oldPasswordLogin).status()).toBe(401);
    await expect(page.getByText(/Invalid email or password/i)).toBeVisible();

    await page.locator('input[type="password"]').fill(newPassword);
    const newPasswordLogin = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/api/v1/auth/login") &&
        response.status() === 200,
    );
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await newPasswordLogin;
    await expect(page).toHaveURL(/\/portal$/);
    await expect(page.getByRole("heading").first()).toBeVisible();
    await screenshot(page, "32-password-changed-login.png");

    const replayPage = await page.context().newPage();
    await replayPage.goto("/reset-password#token=" + encodeURIComponent(resetToken), { waitUntil: "networkidle" });
    await replayPage.locator('input[type="password"]').nth(0).fill("another-password-42");
    await replayPage.locator('input[type="password"]').nth(1).fill("another-password-42");
    const replayResponse = replayPage.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/api/v1/auth/password-reset/confirm"),
    );
    await replayPage.getByRole("button", { name: "Update password", exact: true }).click();
    expect((await replayResponse).status()).toBe(400);
    await expect(replayPage.getByText(/invalid or expired reset token/i)).toBeVisible();
    await replayPage.close();
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


  test("a customer books a supported appointment type through the portal", async ({ page }) => {
    test.setTimeout(60_000);
    await login(page, CUSTOMER);

    const vehiclesResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "GET" &&
        response.url().includes("/api/v1/portal/vehicles") &&
        response.status() === 200,
    );
    await page.goto("/portal/appointments", { waitUntil: "networkidle" });
    const vehicles = (await (await vehiclesResponsePromise).json()) as Array<{
      id: string;
      make: string;
      model: string;
      year: number;
    }>;
    expect(vehicles.length).toBeGreaterThan(0);
    const vehicle = vehicles[0];

    await page.getByRole("button", { name: "Ask for a slot", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Which car").selectOption(vehicle.id);
    await dialog.getByLabel("Service type").selectOption("DIAGNOSTIC");

    const future = new Date();
    future.setDate(future.getDate() + 20);
    future.setHours(11, 0, 0, 0);
    const localDateTime = new Date(future.getTime() - future.getTimezoneOffset() * 60_000)
      .toISOString()
      .slice(0, 16);
    await dialog.getByLabel("Preferred time").fill(localDateTime);
    await dialog.getByLabel("Anything we should know").fill("E2E appointment request; diagnostic warning light.");

    const createResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/api/v1/portal/appointments") &&
        response.status() === 201,
    );
    await dialog.getByRole("button", { name: "Request this slot", exact: true }).click();
    const createResponse = await createResponsePromise;
    const created = (await createResponse.json()) as {
      id: string;
      vehicle_id: string;
      service_type: string;
      status: string;
      scheduled_start: string;
    };
    expect(created.id).toBeTruthy();
    expect(created.vehicle_id).toBe(vehicle.id);
    expect(created.service_type).toBe("DIAGNOSTIC");
    expect(created.status).toBe("REQUESTED");

    await page.reload({ waitUntil: "networkidle" });
    // Read persisted state in a fresh HTTP request after the browser reload. This
    // bypasses the page navigation lifecycle while still using the real API and
    // the access token issued by the backend.
    const accessToken = await page.evaluate(() => localStorage.getItem("autofix.access_token"));
    expect(accessToken).toBeTruthy();
    const appointmentsResponse = await page.request.get(
      `${process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000"}/api/v1/portal/appointments`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    expect(appointmentsResponse.status()).toBe(200);
    const appointments = (await appointmentsResponse.json()) as Array<{
      id: string;
      vehicle_id: string;
      service_type: string;
      status: string;
    }>;
    expect(appointments.find((appointment) => appointment.id === created.id)).toMatchObject({
      id: created.id,
      vehicle_id: vehicle.id,
      service_type: "DIAGNOSTIC",
      status: "REQUESTED",
    });
    await expect(page.getByRole("heading", { name: "Appointments", exact: true })).toBeVisible();
    await screenshot(page, "43-portal-appointment-booked.png");
  });

  test("a customer approves and declines estimate lines in the real portal", async ({ page }) => {
    test.setTimeout(60_000);
    await login(page, CUSTOMER);

    const listResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "GET" &&
        response.url().includes("/api/v1/portal/estimates") &&
        !/\/api\/v1\/portal\/estimates\/[^?]+/.test(response.url()) &&
        response.status() === 200,
    );
    await page.goto("/portal/estimates", { waitUntil: "networkidle" });
    const listResponse = await listResponsePromise;
    const estimates = (await listResponse.json()) as Array<{
      id: string;
      estimate_number: string;
      items: Array<{ id: string; description: string; can_decide: boolean; status: string }>;
    }>;
    const target = estimates.find((estimate) => estimate.items.filter((item) => item.can_decide).length >= 2);
    expect(target, "Seeded portal customer should have an estimate with multiple undecided lines").toBeTruthy();
    if (!target) throw new Error("No estimate with at least two undecided lines was returned by the API");

    const detailResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "GET" &&
        response.url().includes("/api/v1/portal/estimates/" + target.id) &&
        response.status() === 200,
    );
    await page.getByRole("link", { name: target.estimate_number, exact: true }).click();
    const detailResponse = await detailResponsePromise;
    const detail = (await detailResponse.json()) as {
      id: string;
      estimate_number: string;
      items: Array<{ id: string; description: string; can_decide: boolean; status: string }>;
    };
    expect(detail.id).toBe(target.id);
    const pending = detail.items.filter((item) => item.can_decide);
    expect(pending.length).toBeGreaterThanOrEqual(2);
    const approveLine = pending[0];
    const declineLine = pending[1];

    const approveRow = page.getByRole("row").filter({ hasText: approveLine.description });
    const approveResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/api/v1/portal/estimates/" + target.id + "/items/" + approveLine.id + "/decision") &&
        response.status() === 200,
    );
    await approveRow.getByRole("button", { name: "Approve", exact: true }).click();
    const approveResponse = await approveResponsePromise;
    const approved = (await approveResponse.json()) as { estimate_status: string; remaining_to_decide: number };
    expect(approved.estimate_status).toMatch(/PARTIALLY_APPROVED|APPROVED/);
    expect(approved.remaining_to_decide).toBe(pending.length - 1);
    await expect(approveRow).toContainText(/Approved/i);

    const declineRow = page.getByRole("row").filter({ hasText: declineLine.description });
    await declineRow.getByRole("button", { name: "Decline", exact: true }).click();
    const declineDialog = page.getByRole("dialog");
    await declineDialog.getByLabel(/Reason \(optional\)/i).fill("Testing the real customer decision flow.");
    const declineResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/api/v1/portal/estimates/" + target.id + "/items/" + declineLine.id + "/decision") &&
        response.status() === 200,
    );
    await declineDialog.getByRole("button", { name: "Decline this line", exact: true }).click();
    const declineResponse = await declineResponsePromise;
    const declined = (await declineResponse.json()) as { remaining_to_decide: number; estimate_status: string };
    expect(declined.remaining_to_decide).toBe(pending.length - 2);
    await expect(page.getByRole("row").filter({ hasText: declineLine.description })).toContainText(/Declined/i);

    const readBackPromise = page.waitForResponse(
      (response) =>
        response.request().method() === "GET" &&
        response.url().includes("/api/v1/portal/estimates/" + target.id) &&
        response.status() === 200,
    );
    await page.reload({ waitUntil: "networkidle" });
    const readBack = (await (await readBackPromise).json()) as {
      id: string;
      items: Array<{ id: string; description: string; status: string; can_decide: boolean }>;
    };
    expect(readBack.id).toBe(target.id);
    expect(readBack.items.find((item) => item.id === approveLine.id)?.status).toBe("APPROVED");
    expect(readBack.items.find((item) => item.id === declineLine.id)?.status).toBe("DECLINED");
    await expect(page.getByRole("row").filter({ hasText: approveLine.description })).toContainText(/Approved/i);
    await expect(page.getByRole("row").filter({ hasText: declineLine.description })).toContainText(/Declined/i);
    await screenshot(page, "42-customer-estimate-line-decisions.png");
  });

});
