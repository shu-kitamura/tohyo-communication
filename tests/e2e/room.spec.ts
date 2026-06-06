import { expect, test } from "@playwright/test";

test("shows the participant waiting view without host controls", async ({ page }) => {
  await page.goto("/rooms/room-123");

  await expect(
    page.getByRole("heading", {
      name: "質問が始まるまでお待ちください",
    }),
  ).toBeVisible();
  await expect(page.getByText("Room ID: room-123")).toBeVisible();
  await expect(page.getByRole("button", { name: "質問を追加" })).toHaveCount(0);
});

test("adds a draft question from the host view", async ({ page }) => {
  await page.goto("/rooms/room-123/host");

  await expect(page.getByRole("heading", { name: "質問一覧" })).toBeVisible();
  await page.getByRole("button", { name: "質問を追加", exact: true }).click();

  const dialog = page.getByRole("dialog", { name: "質問を追加" });
  await expect(dialog).toBeVisible();

  await dialog.getByRole("button", { name: "下書きとして追加" }).click();
  await expect(dialog.getByRole("alert")).toContainText("質問を入力してください。");

  await dialog.getByLabel("質問", { exact: true }).fill("次に扱いたいテーマは？");
  await dialog.getByLabel("複数選択").check();
  await dialog
    .getByRole("textbox", { name: "新しい選択肢1", exact: true })
    .fill("プロトタイピング");
  await dialog
    .getByRole("textbox", { name: "新しい選択肢2", exact: true })
    .fill("ユーザーリサーチ");
  await dialog.getByRole("button", { name: "選択肢を追加", exact: true }).click();
  await dialog.getByRole("textbox", { name: "新しい選択肢3", exact: true }).fill("データ可視化");
  await dialog.getByRole("button", { name: "下書きとして追加" }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByRole("heading", { name: "次に扱いたいテーマは？" })).toBeVisible();
  await expect(page.getByText("下書き", { exact: true })).toBeVisible();
  await expect(page.getByText("複数選択", { exact: true })).toBeVisible();
});
