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
  const responsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/v1/auth/login",
  );
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  expect((await responsePromise).status()).toBe(200);
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

test.describe("Inspection and parts catalogue mutations", () => {
  test("inspection item creation, editing, photo attachment and deletion persist through the real API", async ({ page }) => {
    test.setTimeout(90_000);
    await login(page, OWNER, "/inspections");

    const customers = await readApi<{ data: Array<{ id: string; first_name: string; last_name: string }> }>(
      page,
      "/customers/?page=1&size=100",
    );
    const customer = customers.data.find(
      (record) => record.first_name === "David" && record.last_name === "Wilson",
    );
    if (!customer) throw new Error("The seeded customer was not returned by the customers API");

    const vehicles = await readApi<{ data: Array<{ id: string; customer_id: string; make: string; model: string; year: number }> }>(
      page,
      "/vehicles/?page=1&size=100",
    );
    const vehicle = vehicles.data.find((record) => record.customer_id === customer.id);
    if (!vehicle) throw new Error("No vehicle belonging to the seeded customer was returned by the vehicles API");

    // Create from the browser now that the inspection list exposes the
    // previously-missing entry point. Verify both its HTTP response and that
    // the UI follows the returned database ID into the details editor.
    await page.getByRole("button", { name: "New inspection", exact: true }).click();
    const createDialog = page.getByRole("dialog", { name: "New inspection" });
    await expect(createDialog.getByRole("button", { name: "Create inspection", exact: true })).toBeDisabled();
    await createDialog.getByLabel("Customer").selectOption(customer.id);
    await createDialog.getByLabel("Vehicle").selectOption(vehicle.id);
    await createDialog.getByLabel("Mileage").fill("18300");
    await createDialog.getByLabel("Overall notes").fill("Created from the UI for inspection item lifecycle verification.");

    const createInspectionPromise = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === "/api/v1/inspections/" &&
        response.status() === 201,
    );
    await createDialog.getByRole("button", { name: "Create inspection", exact: true }).click();
    const createdInspection = (await (await createInspectionPromise).json()) as {
      id: string;
      status: string;
      customer_id: string;
      vehicle_id: string;
      mileage: number;
      items: Array<{ id: string }>;
    };
    expect(createdInspection).toMatchObject({
      status: "DRAFT",
      customer_id: customer.id,
      vehicle_id: vehicle.id,
      mileage: 18300,
      items: [],
    });
    await expect(page).toHaveURL(new RegExp("/inspections/" + createdInspection.id + "$"));
    await expect(page.getByRole("button", { name: "Add item", exact: true })).toBeVisible();

    const statusResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "PATCH" &&
        new URL(response.url()).pathname === "/api/v1/inspections/" + createdInspection.id + "/status" &&
        new URL(response.url()).searchParams.get("status") === "IN_PROGRESS" &&
        response.status() === 200,
    );
    await page.getByRole("button", { name: "In Progress", exact: true }).click();
    const inspectionStatus = (await (await statusResponsePromise).json()) as { status: string };
    expect(inspectionStatus.status).toBe("IN_PROGRESS");
    await expect(page.getByRole("button", { name: "Completed", exact: true })).toBeDisabled();
    await expect(page.getByText("Record at least one item before completing", { exact: false })).toBeVisible();

    await page.getByRole("button", { name: "Add item", exact: true }).click();
    const addDialog = page.getByRole("dialog", { name: "Add inspection item" });
    const itemName = "E2E brake finding " + Date.now();
    const photoUrl = "https://example.test/inspection-evidence-" + Date.now() + ".jpg";
    await addDialog.getByLabel("Category").selectOption("BRAKES");
    await addDialog.getByLabel("Status").selectOption("ATTENTION");
    await addDialog.getByLabel("What was checked").fill(itemName);
    await addDialog.getByLabel("Measurement").fill("3.2 mm");
    await addDialog.getByLabel("Recommendation").selectOption("REPLACE");
    await addDialog.getByLabel("Notes").fill("Pad wear is close to the replacement limit.");
    await addDialog.getByLabel("Photo URL").fill(photoUrl);
    await addDialog.getByLabel("Photo caption").fill("Initial brake pad evidence");

    const addItemResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === "/api/v1/inspections/" + createdInspection.id + "/items" &&
        response.status() === 201,
    );
    await addDialog.getByRole("button", { name: "Add item", exact: true }).click();
    const inspectionWithItem = (await (await addItemResponsePromise).json()) as {
      id: string;
      status: string;
      items: Array<{
        id: string;
        category: string;
        item_name: string;
        status: string;
        measurement: string;
        recommendation: string;
        photos: Array<{ photo_url: string; caption: string }>;
      }>;
    };
    expect(inspectionWithItem.id).toBe(createdInspection.id);
    expect(inspectionWithItem.status).toBe("IN_PROGRESS");
    const addedItem = inspectionWithItem.items.find((item) => item.item_name === itemName);
    expect(addedItem).toBeTruthy();
    if (!addedItem) throw new Error("The inspection POST response did not include the created item");
    expect(addedItem).toMatchObject({
      category: "BRAKES",
      item_name: itemName,
      status: "ATTENTION",
      measurement: "3.2 mm",
      recommendation: "REPLACE",
    });
    expect(addedItem.photos[0]).toMatchObject({ photo_url: photoUrl, caption: "Initial brake pad evidence" });

    const itemRow = page.getByRole("row").filter({ hasText: itemName });
    await expect(itemRow).toBeVisible();
    await expect(itemRow.getByText("1 photo(s)", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Completed", exact: true })).toBeEnabled();

    await itemRow.getByRole("button", { name: "Edit", exact: true }).click();
    await itemRow.getByLabel("Item status").selectOption("URGENT");
    await itemRow.locator("input").fill("2.6 mm");
    await itemRow.getByLabel("Recommendation").selectOption("REPLACE");
    await itemRow.locator("textarea").fill("Updated through the inspection editor.");
    const editResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "PATCH" &&
        new URL(response.url()).pathname === "/api/v1/inspections/" +
          createdInspection.id + "/items/" + addedItem.id &&
        response.status() === 200,
    );
    await itemRow.getByRole("button", { name: "Save", exact: true }).click();
    const editedItem = (await (await editResponsePromise).json()) as {
      id: string;
      status: string;
      measurement: string;
      notes: string;
    };
    expect(editedItem).toMatchObject({
      id: addedItem.id,
      status: "URGENT",
      measurement: "2.6 mm",
      notes: "Updated through the inspection editor.",
    });

    const savedInspection = await readApi<{
      status: string;
      items: Array<{ id: string; status: string; measurement: string; notes: string; photos: Array<{ photo_url: string }> }>;
    }>(page, "/inspections/" + createdInspection.id);
    expect(savedInspection.status).toBe("IN_PROGRESS");
    expect(savedInspection.items.find((item) => item.id === addedItem.id)).toMatchObject({
      status: "URGENT",
      measurement: "2.6 mm",
      notes: "Updated through the inspection editor.",
      photos: [{ photo_url: photoUrl }],
    });
    await screenshot(page, "63-inspection-item-created-and-edited.png");

    page.once("dialog", (dialog) => dialog.accept());
    const deleteResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "DELETE" &&
        new URL(response.url()).pathname === "/api/v1/inspections/" +
          createdInspection.id + "/items/" + addedItem.id &&
        response.status() < 400,
    );
    await itemRow.getByRole("button", { name: "Remove", exact: true }).click();
    await deleteResponsePromise;

    const afterDelete = await readApi<{ status: string; items: Array<{ id: string }> }>(
      page,
      "/inspections/" + createdInspection.id,
    );
    expect(afterDelete.status).toBe("IN_PROGRESS");
    expect(afterDelete.items.some((item) => item.id === addedItem.id)).toBe(false);
    await expect(page.getByRole("button", { name: "Completed", exact: true })).toBeDisabled();
    await screenshot(page, "64-inspection-empty-after-remove.png");

    // Completion is allowed once there is a recorded finding. This time leave
    // one valid item on the inspection and verify the completed report is frozen.
    await page.getByRole("button", { name: "Add item", exact: true }).click();
    const finalItemDialog = page.getByRole("dialog", { name: "Add inspection item" });
    const finalItemName = "E2E completed finding " + Date.now();
    await finalItemDialog.getByLabel("Category").selectOption("BRAKES");
    // Leave the UI default GOOD status selected; it is the valid API enum.
    await finalItemDialog.getByLabel("What was checked").fill(finalItemName);
    await finalItemDialog.getByLabel("Measurement").fill("4.1 mm");
    await finalItemDialog.getByLabel("Notes").fill("Completion-path verification.");
    const finalItemResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === "/api/v1/inspections/" +
          createdInspection.id + "/items" &&
        response.status() === 201,
    );
    await finalItemDialog.getByRole("button", { name: "Add item", exact: true }).click();
    const inspectionWithFinalItem = (await (await finalItemResponsePromise).json()) as {
      id: string;
      items: Array<{ id: string; item_name: string; status: string }>;
    };
    const finalItem = inspectionWithFinalItem.items.find((item) => item.item_name === finalItemName);
    expect(finalItem).toBeTruthy();
    if (!finalItem) throw new Error("The final inspection finding was not returned by the API");

    const completePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "PATCH" &&
        new URL(response.url()).pathname === "/api/v1/inspections/" +
          createdInspection.id + "/status" &&
        new URL(response.url()).searchParams.get("status") === "COMPLETED" &&
        response.status() === 200,
    );
    await page.getByRole("button", { name: "Completed", exact: true }).click();
    const completedResponse = (await (await completePromise).json()) as { id: string; status: string };
    expect(completedResponse).toMatchObject({ id: createdInspection.id, status: "COMPLETED" });

    const completedReadback = await readApi<{
      id: string;
      status: string;
      items: Array<{ id: string; item_name: string; status: string; measurement: string }>;
    }>(page, "/inspections/" + createdInspection.id);
    expect(completedReadback.status).toBe("COMPLETED");
    expect(completedReadback.items).toContainEqual(expect.objectContaining({
      id: finalItem.id,
      item_name: finalItemName,
      status: "GOOD",
      measurement: "4.1 mm",
    }));
    await expect(page.getByRole("button", { name: "Completed", exact: true })).toBeDisabled();
    await screenshot(page, "71-inspection-completed-report.png");
  });

  test("part catalogue creation, pricing update, stock immutability and eligible deletion use real API calls", async ({ page }) => {
    test.setTimeout(90_000);
    await login(page, OWNER, "/parts");
    await expect(page.getByRole("heading", { name: "Parts", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "New part", exact: true }).click();

    const createDialog = page.getByRole("dialog", { name: "New part" });
    const partNumber = "E2E-" + Date.now();
    const originalName = "E2E catalogue item " + Date.now();
    await createDialog.getByLabel("Part number").fill(partNumber);
    await createDialog.getByLabel("Name").fill(originalName);
    // Use a category returned by the live reference API; shops may not have
    // every built-in category in use yet, so "OTHER" is not guaranteed present.
    await createDialog.getByLabel("Category").selectOption({ index: 0 });
    await createDialog.getByLabel("Unit cost").fill("4.25");
    await createDialog.getByLabel("Unit price").fill("9.95");
    await createDialog.getByLabel("Reorder at").fill("2");
    await createDialog.getByLabel("Brand").fill("E2E Workshop");
    await createDialog.getByLabel("Location").fill("E2E-A1");

    const createPartPromise = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === "/api/v1/parts/" &&
        response.status() === 201,
    );
    await createDialog.getByRole("button", { name: "Add to catalog", exact: true }).click();
    const createdPart = (await (await createPartPromise).json()) as {
      id: string;
      part_number: string;
      name: string;
      unit_cost: number;
      unit_price: number;
      quantity_on_hand: number;
    };
    expect(createdPart).toMatchObject({
      part_number: partNumber,
      name: originalName,
      unit_cost: 4.25,
      unit_price: 9.95,
      quantity_on_hand: 0,
    });

    await page.getByPlaceholder("Part number, name, brand").fill(partNumber);
    const partRow = page.getByRole("row").filter({ hasText: partNumber });
    await expect(partRow).toBeVisible();
    await partRow.click();
    const editDialog = page.getByRole("dialog").filter({ hasText: partNumber });
    const updatedName = originalName + " Updated";
    await editDialog.getByLabel("Name").fill(updatedName);
    await editDialog.getByLabel("Unit cost").fill("4.75");
    await editDialog.getByLabel("Unit price").fill("12.50");
    await editDialog.getByLabel("Reorder at").fill("3.5");
    await editDialog.getByLabel("Location").fill("E2E-B2");

    const updatePartPromise = page.waitForResponse(
      (response) =>
        response.request().method() === "PATCH" &&
        new URL(response.url()).pathname === "/api/v1/parts/" + createdPart.id &&
        response.status() === 200,
    );
    await editDialog.getByRole("button", { name: "Save changes", exact: true }).click();
    const updatedPart = (await (await updatePartPromise).json()) as {
      id: string;
      name: string;
      unit_cost: number;
      unit_price: number;
      reorder_level: number;
      location: string;
      quantity_on_hand: number;
    };
    expect(updatedPart).toMatchObject({
      id: createdPart.id,
      name: updatedName,
      unit_cost: 4.75,
      unit_price: 12.5,
      reorder_level: 3.5,
      location: "E2E-B2",
      quantity_on_hand: 0,
    });

    const persistedPart = await readApi<{
      id: string;
      name: string;
      unit_cost: number;
      unit_price: number;
      reorder_level: number;
      location: string;
      quantity_on_hand: number;
    }>(page, "/parts/" + createdPart.id);
    expect(persistedPart).toMatchObject({
      id: createdPart.id,
      name: updatedName,
      unit_cost: 4.75,
      unit_price: 12.5,
      reorder_level: 3.5,
      location: "E2E-B2",
      quantity_on_hand: 0,
    });
    await screenshot(page, "65-part-catalogue-updated.png");

    // Active catalog rows are deliberately not deletable. Retire this unused row
    // first, then delete it because no inventory movements or stock exist.
    await expect(editDialog.getByText(/retire it \(DISCONTINUED\) before it can be deleted/i)).toBeVisible();
    await editDialog.getByLabel("Trading status").selectOption("DISCONTINUED");
    const retirePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "PATCH" &&
        new URL(response.url()).pathname === "/api/v1/parts/" + createdPart.id &&
        response.status() === 200,
    );
    await editDialog.getByRole("button", { name: "Save changes", exact: true }).click();
    const retiredPart = (await (await retirePromise).json()) as { id: string; status: string; quantity_on_hand: number };
    expect(retiredPart).toMatchObject({ id: createdPart.id, status: "DISCONTINUED", quantity_on_hand: 0 });
    await expect(editDialog.getByRole("button", { name: "Delete line", exact: true })).toBeVisible();

    const deletePartPromise = page.waitForResponse(
      (response) =>
        response.request().method() === "DELETE" &&
        new URL(response.url()).pathname === "/api/v1/parts/" + createdPart.id &&
        response.status() === 204,
    );
    await editDialog.getByRole("button", { name: "Delete line", exact: true }).click();
    await deletePartPromise;
    const token = await page.evaluate(() => localStorage.getItem("autofix.access_token"));
    if (!token) throw new Error("No access token available to verify deleted part");
    const apiBase = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000").replace(/\/+$/, "");
    const deletedRead = await page.request.get(apiBase + "/api/v1/parts/" + createdPart.id, {
      headers: { Authorization: "Bearer " + token },
    });
    expect(deletedRead.status()).toBe(404);
  });
});
