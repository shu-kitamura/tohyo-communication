import { expect, test } from "@playwright/test";

test("shows the new application environment", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "TOHYO通信" })).toBeVisible();
  await expect(page.getByText("React + Vite")).toBeVisible();
  await expect(page.getByText("Hono + Workers")).toBeVisible();
});
