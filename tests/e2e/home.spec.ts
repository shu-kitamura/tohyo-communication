import { expect, test } from "@playwright/test";

test("moves from the home page to the room creation page", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /その場の声を/ })).toBeVisible();
  await page.getByRole("link", { name: "投票を作成する" }).click();

  await expect(page).toHaveURL(/\/rooms\/$/);
  await expect(page.getByRole("heading", { name: "投票ルームを作成" })).toBeVisible();
});

test("creates an empty room and moves to the host view", async ({ page }) => {
  await page.goto("/rooms/");

  await page.getByRole("button", { name: "ルームを作成" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "ルーム名と管理パスワードを入力してください。",
  );

  await page.getByLabel("ルーム名").fill("デザイン勉強会");
  await page.getByLabel("管理パスワード").fill("example-password");

  await expect(page.getByText("デザイン勉強会", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "ルームを作成" }).click();

  await expect(page).toHaveURL(/\/rooms\/room-[a-f0-9]{8}\/host$/);
  await expect(page.getByRole("heading", { name: "デザイン勉強会" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "質問がまだありません" })).toBeVisible();
  await expect(page.getByRole("button", { name: "最初の質問を追加" })).toBeVisible();
});
