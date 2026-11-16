import { expect, test } from "@playwright/test";

test("staff owner can use the workshop dashboard and customer directory", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Owner", exact: true }).click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByText("Billed against collected")).toBeVisible();

  await page.getByRole("link", { name: "Customers", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Customers" })).toBeVisible();
  await expect(page.getByText("David Wilson")).toBeVisible();
});

test("customer can review their portal and submit a service request", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Customer", exact: true }).click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  await expect(page).toHaveURL(/\/portal$/);
  await expect(page.getByRole("heading", { name: /hello, david/i })).toBeVisible();
  await page.getByRole("link", { name: "Requests", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Requests" })).toBeVisible();
  await expect(page.getByText("Brake vibration at highway speed")).toBeVisible();

  await page.getByRole("button", { name: "Ask for work" }).click();
  await page.getByLabel("What is it for").fill("Demo AC inspection");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByText("Demo AC inspection")).toBeVisible();
});
