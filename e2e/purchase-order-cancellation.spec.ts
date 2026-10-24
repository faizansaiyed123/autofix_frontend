import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const OWNER = { email: "owner@autofix.demo", password: "demo1234" };
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
  const response = page.waitForResponse(
    (item) => item.request().method() === "POST" && new URL(item.url()).pathname === "/api/v1/auth/login",
  );
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  expect((await response).status()).toBe(200);
  await expect.poll(() => page.url()).not.toContain("/login");
  await page.goto(destination, { waitUntil: "networkidle" });
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

test("a draft purchase order is cancelled through the UI and remains closed in the API", async ({ page }) => {
  test.setTimeout(90_000);
  await login(page, OWNER, "/purchase-orders");

  const suppliers = await readApi<Array<{ id: string; name: string }>>(page, "/suppliers/active");
  expect(suppliers.length).toBeGreaterThan(0);
  const parts = await readApi<{ data: Array<{ id: string; part_number: string; unit_cost: number; status: string }> }>(
    page,
    "/parts/?page=1&size=100",
  );
  const part = parts.data.find((candidate) => candidate.status === "ACTIVE" && candidate.unit_cost > 0);
  if (!part) throw new Error("No active part with a positive catalog cost was available for cancellation setup");

  await page.getByRole("button", { name: "New order", exact: true }).click();
  const createDialog = page.getByRole("dialog", { name: "New purchase order" });
  await createDialog.locator("select").first().selectOption(suppliers[0].id);
  await createDialog.getByLabel("Part 1").selectOption(part.id);
  await createDialog.getByLabel("Quantity").fill("1");
  await createDialog.getByLabel("Unit cost").fill(part.unit_cost.toFixed(2));
  await createDialog.getByLabel("Supplier-facing notes").fill("Cancellation regression test");

  const createPromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/v1/purchase_orders/" &&
      response.status() === 201,
  );
  await createDialog.getByRole("button", { name: "Create draft order", exact: true }).click();
  const created = (await (await createPromise).json()) as {
    id: string;
    po_number: string;
    status: string;
    items: Array<{ id: string; part_id: string }>;
  };
  expect(created.status).toBe("DRAFT");
  expect(created.items).toHaveLength(1);
  await expect(page.getByRole("dialog", { name: created.po_number })).toBeVisible();
  const draft = await readApi<{ id: string; status: string; items: Array<{ part_id: string }> }>(
    page,
    "/purchase_orders/" + created.id,
  );
  expect(draft).toMatchObject({ id: created.id, status: "DRAFT", items: [{ part_id: part.id }] });

  await page.getByRole("dialog", { name: created.po_number }).getByRole("button", { name: "Cancel", exact: true }).click();
  const cancelDialog = page.getByRole("dialog", { name: "Cancel this purchase order" });
  const reason = "Supplier lead time changed; buyer cancelled the draft.";
  await cancelDialog.getByLabel("Reason").fill(reason);

  const cancelPromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/v1/purchase_orders/" + created.id + "/cancel" &&
      response.status() === 200,
  );
  await cancelDialog.getByRole("button", { name: "Cancel order", exact: true }).click();
  const cancelled = (await (await cancelPromise).json()) as {
    id: string;
    status: string;
    cancel_reason: string | null;
    is_terminal: boolean;
  };
  expect(cancelled).toMatchObject({
    id: created.id,
    status: "CANCELLED",
    cancel_reason: reason,
    is_terminal: true,
  });

  const saved = await readApi<{
    id: string;
    status: string;
    cancel_reason: string | null;
    is_terminal: boolean;
    items: Array<{ part_id: string; quantity_received: number }>;
  }>(page, "/purchase_orders/" + created.id);
  expect(saved).toMatchObject({
    id: created.id,
    status: "CANCELLED",
    cancel_reason: reason,
    is_terminal: true,
    items: [{ part_id: part.id, quantity_received: 0 }],
  });
  await screenshot(page, "72-purchase-order-cancelled.png");
});
