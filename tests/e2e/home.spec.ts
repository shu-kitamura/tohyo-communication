import { expect, test } from "@playwright/test";

test("moves from the home page to the room creation page", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /その場の声を/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "プライバシーについて" })).toBeVisible();
  await expect(page.getByText("終了したルームと関連データは終了から30日後")).toBeVisible();
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

  await expect(page).toHaveURL(
    /\/rooms\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
  await expect(page.getByRole("heading", { name: "デザイン勉強会" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "質問がまだありません" })).toBeVisible();
  await expect(page.getByRole("button", { name: "最初の質問を追加" })).toBeVisible();
});
