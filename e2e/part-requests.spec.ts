import { test, expect, type Browser, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

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
  const loginPromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/v1/auth/login",
  );
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  expect((await loginPromise).status()).toBe(200);
  await expect.poll(() => page.url()).not.toContain("/login");
  await page.goto(destination, { waitUntil: "networkidle" });
}

async function accessToken(page: Page) {
  const token = await page.evaluate(() => localStorage.getItem("autofix.access_token"));
  if (!token) throw new Error("No access token available for authenticated API verification");
  return token;
}

async function readApi<T>(page: Page, apiPath: string): Promise<T> {
  const token = await accessToken(page);
  const base = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000").replace(/\/+$/, "");
  const response = await page.request.get(base + "/api/v1" + apiPath, {
    headers: { Authorization: "Bearer " + token },
  });
  expect(response.status()).toBe(200);
  return (await response.json()) as T;
}

test("part request flows from requester UI through server-side self-decision guard to parts approval and fulfillment", async ({ browser }) => {
  test.setTimeout(90_000);
  const requesterContext = await browser.newContext();
  const requesterPage = await requesterContext.newPage();
  await login(requesterPage, OWNER, "/part-requests");

  const repairOrders = await readApi<{
    data: Array<{ id: string; ro_number: string; status: string; tasks: Array<{ id: string; description: string }> }>;
  }>(requesterPage, "/repair_orders/?page=1&size=100");
  const requestableOrder = repairOrders.data.find((order) =>
    ["APPROVED", "IN_PROGRESS", "ON_HOLD"].includes(order.status),
  );
  if (!requestableOrder) throw new Error("No requestable repair order was returned by the real repair-order API");

  await requesterPage.getByRole("button", { name: "Raise a request", exact: true }).click();
  const createDialog = requesterPage.getByRole("dialog", { name: "Raise a part request" });
  await createDialog.getByRole("button", { name: "Send to parts", exact: true }).click();
  await expect(createDialog.getByText("Choose the repair order that needs the part", { exact: true })).toBeVisible();
  await expect(createDialog.getByText("Name the part", { exact: true })).toBeVisible();
  await expect(createDialog.getByText("Say why the part is needed", { exact: true })).toBeVisible();

  await createDialog.getByLabel("Repair order").selectOption(requestableOrder.id);
  const partName = "E2E part request " + Date.now();
  await createDialog.getByLabel("Part number").fill("E2E-PR-" + Date.now().toString().slice(-7));
  await createDialog.getByLabel("Part name").fill(partName);
  await createDialog.getByLabel("Quantity").fill("0");
  await createDialog.getByLabel("Why it is needed").fill("Validation and cross-role workflow verification");
  await createDialog.getByRole("button", { name: "Send to parts", exact: true }).click();
  await expect(createDialog.getByText("Quantity must be greater than zero", { exact: true })).toBeVisible();

  await createDialog.getByLabel("Quantity").fill("2");
  const createPromise = requesterPage.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/v1/part_requests/" &&
      response.status() === 201,
  );
  await createDialog.getByRole("button", { name: "Send to parts", exact: true }).click();
  const created = (await (await createPromise).json()) as {
    id: string;
    repair_order_id: string;
    requested_by_id: string;
    part_name: string;
    quantity: number;
    status: string;
    reason: string;
  };
  expect(created).toMatchObject({
    repair_order_id: requestableOrder.id,
    part_name: partName,
    quantity: 2,
    status: "PENDING",
    reason: "Validation and cross-role workflow verification",
  });
  expect(created.requested_by_id).toBeTruthy();

  const requesterRow = requesterPage.getByRole("row").filter({ hasText: partName });
  await expect(requesterRow).toBeVisible();
  await expect(requesterRow.getByText("You raised this request; another staff member must decide it.", { exact: true })).toBeVisible();
  await expect(requesterRow.getByRole("button", { name: "Approve", exact: true })).toHaveCount(0);
  await expect(requesterRow.getByRole("button", { name: "Reject", exact: true })).toHaveCount(0);

  // Prove the API guard independently of the disabled/hidden controls.
  const ownerToken = await accessToken(requesterPage);
  const apiBase = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000").replace(/\/+$/, "");
  const ownDecision = await requesterPage.request.post(
    apiBase + "/api/v1/part_requests/" + created.id + "/decision",
    {
      headers: { Authorization: "Bearer " + ownerToken },
      data: { decision: "APPROVED", decision_reason: "Should never be accepted" },
    },
  );
  expect(ownDecision.status()).toBe(400);
  expect((await ownDecision.json()).detail).toMatch(/cannot approve or reject their own request/i);
  const stillPending = await readApi<{ status: string; decided_by_id: string | null }>(
    requesterPage,
    "/part_requests/" + created.id,
  );
  expect(stillPending).toMatchObject({ status: "PENDING", decided_by_id: null });
  await screenshot(requesterPage, "73-part-request-awaiting-other-staff.png");

  const partsContext = await browser.newContext();
  const partsPage = await partsContext.newPage();
  await login(partsPage, PARTS, "/part-requests");
  const partsRow = partsPage.getByRole("row").filter({ hasText: partName });
  await expect(partsRow).toBeVisible();
  await expect(partsRow.getByRole("button", { name: "Approve", exact: true })).toBeVisible();

  const approvePromise = partsPage.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/v1/part_requests/" + created.id + "/decision" &&
      response.status() === 200,
  );
  await partsRow.getByRole("button", { name: "Approve", exact: true }).click();
  const approved = (await (await approvePromise).json()) as {
    id: string;
    status: string;
    requested_by_id: string;
    decided_by_id: string;
    decision_reason: string | null;
  };
  expect(approved.status).toBe("APPROVED");
  expect(approved.requested_by_id).toBe(created.requested_by_id);
  expect(approved.decided_by_id).not.toBe(approved.requested_by_id);

  const approvedReadback = await readApi<{
    id: string;
    status: string;
    requested_by_id: string;
    decided_by_id: string;
  }>(partsPage, "/part_requests/" + created.id);
  expect(approvedReadback).toMatchObject({
    id: created.id,
    status: "APPROVED",
    requested_by_id: created.requested_by_id,
    decided_by_id: approved.decided_by_id,
  });
  await expect(partsRow.getByRole("button", { name: "Fulfill", exact: true })).toBeVisible();

  const fulfilPromise = partsPage.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/v1/part_requests/" + created.id + "/fulfil" &&
      response.status() === 200,
  );
  await partsRow.getByRole("button", { name: "Fulfill", exact: true }).click();
  const fulfilled = (await (await fulfilPromise).json()) as {
    id: string;
    status: string;
    requested_by_id: string;
    decided_by_id: string;
  };
  expect(fulfilled).toMatchObject({
    id: created.id,
    status: "FULFILLED",
    requested_by_id: created.requested_by_id,
    decided_by_id: approved.decided_by_id,
  });

  const finalReadback = await readApi<{
    id: string;
    status: string;
    requested_by_id: string;
    decided_by_id: string;
  }>(partsPage, "/part_requests/" + created.id);
  expect(finalReadback).toMatchObject({
    id: created.id,
    status: "FULFILLED",
    requested_by_id: created.requested_by_id,
    decided_by_id: approved.decided_by_id,
  });
  await screenshot(partsPage, "74-part-request-approved-and-fulfilled.png");

  await partsContext.close();
  await requesterContext.close();
});


test("parts staff must provide a reason before rejecting a part request", async ({ browser }) => {
  test.setTimeout(90_000);
  const requesterContext = await browser.newContext();
  const requesterPage = await requesterContext.newPage();
  await login(requesterPage, OWNER, "/part-requests");
  const repairOrders = await readApi<{
    data: Array<{ id: string; ro_number: string; status: string }>;
  }>(requesterPage, "/repair_orders/?page=1&size=100");
  const order = repairOrders.data.find((record) =>
    ["APPROVED", "IN_PROGRESS", "ON_HOLD"].includes(record.status),
  );
  if (!order) throw new Error("No requestable repair order was returned for the rejection test");

  await requesterPage.getByRole("button", { name: "Raise a request", exact: true }).click();
  const createDialog = requesterPage.getByRole("dialog", { name: "Raise a part request" });
  const partName = "E2E rejection reason " + Date.now();
  await createDialog.getByLabel("Repair order").selectOption(order.id);
  await createDialog.getByLabel("Part name").fill(partName);
  await createDialog.getByLabel("Quantity").fill("1");
  await createDialog.getByLabel("Why it is needed").fill("The test must verify a rejection reason is saved");
  const createPromise = requesterPage.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/v1/part_requests/" &&
      response.status() === 201,
  );
  await createDialog.getByRole("button", { name: "Send to parts", exact: true }).click();
  const created = (await (await createPromise).json()) as { id: string; status: string };
  expect(created.status).toBe("PENDING");

  const partsContext = await browser.newContext();
  const partsPage = await partsContext.newPage();
  await login(partsPage, PARTS, "/part-requests");
  const row = partsPage.getByRole("row").filter({ hasText: partName });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Reject", exact: true }).click();
  const rejectDialog = partsPage.getByRole("dialog", { name: "Reject this request" });

  // Bypass the form deliberately to prove the server rejects a blank reason too.
  const partsToken = await accessToken(partsPage);
  const apiBase = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000").replace(/\/+$/, "");
  const apiBypass = await partsPage.request.post(
    apiBase + "/api/v1/part_requests/" + created.id + "/decision",
    {
      headers: { Authorization: "Bearer " + partsToken },
      data: { decision: "REJECTED", decision_reason: "   " },
    },
  );
  expect(apiBypass.status()).toBe(422);
  expect(JSON.stringify((await apiBypass.json()).detail)).toMatch(/decision_reason is required/i);
  const remainsPending = await readApi<{ status: string; decision_reason: string | null }>(
    partsPage,
    "/part_requests/" + created.id,
  );
  expect(remainsPending).toMatchObject({ status: "PENDING", decision_reason: null });

  await rejectDialog.getByRole("button", { name: "Reject request", exact: true }).click();
  await expect(rejectDialog.getByRole("alert")).toHaveText("A reason is required to reject this request.");

  const reason = "Supplier cannot source this component at the required lead time";
  await rejectDialog.getByLabel("Reason").fill(reason);
  const rejectPromise = partsPage.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/v1/part_requests/" + created.id + "/decision" &&
      response.status() === 200,
  );
  await rejectDialog.getByRole("button", { name: "Reject request", exact: true }).click();
  const rejected = (await (await rejectPromise).json()) as {
    id: string;
    status: string;
    decision_reason: string | null;
  };
  expect(rejected).toMatchObject({
    id: created.id,
    status: "REJECTED",
    decision_reason: reason,
  });
  const saved = await readApi<{ id: string; status: string; decision_reason: string | null }>(
    partsPage,
    "/part_requests/" + created.id,
  );
  expect(saved).toMatchObject({ id: created.id, status: "REJECTED", decision_reason: reason });
  await screenshot(partsPage, "75-part-request-rejected-with-reason.png");
  await partsContext.close();
  await requesterContext.close();
});
