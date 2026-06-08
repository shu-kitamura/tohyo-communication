import { expect, type Page, test } from "@playwright/test";

test("shows the participant waiting view without host controls", async ({ browser, page }) => {
  const roomId = await createRoom(page, "ゲスト表示テスト");
  const participantPage = await browser.newPage({
    baseURL: new URL(page.url()).origin,
  });

  await participantPage.goto(`/rooms/${roomId}`);

  await expect(
    participantPage.getByRole("heading", {
      name: "現在表示できる投票はありません",
    }),
  ).toBeVisible();
  await expect(participantPage.getByText(`Room ID: ${roomId}`)).toBeVisible();
  await expect(participantPage.getByRole("button", { name: "質問を追加" })).toHaveCount(0);

  await participantPage.close();
});

test("starts a question and accepts a participant vote", async ({ browser, page }) => {
  const roomId = await createRoom(page, "リアルタイム投票テスト");
  const participantPage = await browser.newPage({
    baseURL: new URL(page.url()).origin,
  });
  await participantPage.goto(`/rooms/${roomId}`);
  await expect(
    participantPage.getByRole("heading", {
      name: "現在表示できる投票はありません",
    }),
  ).toBeVisible();

  await page.getByRole("button", { name: "質問を追加", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "質問を追加" });

  await dialog.getByRole("button", { name: "下書きとして追加" }).click();
  await expect(dialog.getByRole("alert")).toContainText("質問を入力してください。");

  await dialog.getByLabel("質問", { exact: true }).fill("次に扱いたいテーマは？");
  await dialog.getByLabel("複数選択").check();
  await dialog
    .getByRole("textbox", { name: "新しい選択肢1", exact: true })
    .fill("プロトタイピング");
  await dialog
    .getByRole("textbox", { name: "新しい選択肢2", exact: true })
    .fill("プロトタイピング");
  await dialog.getByRole("button", { name: "下書きとして追加" }).click();
  await expect(dialog.getByRole("alert")).toContainText("選択肢は重複しないようにしてください。");
  await dialog
    .getByRole("textbox", { name: "新しい選択肢2", exact: true })
    .fill("ユーザーリサーチ");
  await dialog.getByRole("button", { name: "選択肢を追加", exact: true }).click();
  await dialog.getByRole("textbox", { name: "新しい選択肢3", exact: true }).fill("データ可視化");
  await dialog.getByRole("button", { name: "下書きとして追加" }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByRole("heading", { name: "次に扱いたいテーマは？" })).toBeVisible();
  await expect(participantPage.getByText("次に扱いたいテーマは？", { exact: true })).toBeVisible();
  await expect(participantPage.getByText("開始前", { exact: true })).toBeVisible();
  await expect(participantPage.getByRole("radio")).toHaveCount(0);
  await expect(participantPage.getByText("プロトタイピング", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "＋ 追加" }).click();
  await dialog.getByLabel("質問", { exact: true }).fill("イベントの満足度は？");
  await dialog.getByRole("textbox", { name: "新しい選択肢1", exact: true }).fill("満足");
  await dialog.getByRole("textbox", { name: "新しい選択肢2", exact: true }).fill("不満");
  await dialog.getByRole("button", { name: "下書きとして追加" }).click();
  await expect(dialog).toBeHidden();
  await expect(participantPage.getByText("イベントの満足度は？", { exact: true })).toBeVisible();

  await page.reload();
  const firstQuestionCard = page.getByRole("article", {
    name: "質問: 次に扱いたいテーマは？",
  });
  const secondQuestionCard = page.getByRole("article", {
    name: "質問: イベントの満足度は？",
  });

  await firstQuestionCard.getByRole("button", { name: "投票を開始" }).click();
  await expect(firstQuestionCard.getByRole("button", { name: "投票を終了" })).toBeVisible();
  await secondQuestionCard.getByRole("button", { name: "投票を開始" }).click();
  await expect(secondQuestionCard.getByRole("button", { name: "投票を終了" })).toBeVisible();

  const participantFirstQuestion = participantPage.getByRole("article", {
    name: "質問1: 次に扱いたいテーマは？",
  });
  const participantSecondQuestion = participantPage.getByRole("article", {
    name: "質問2: イベントの満足度は？",
  });
  const firstVoteForm = participantFirstQuestion.getByRole("form", {
    name: "次に扱いたいテーマは？に回答",
  });
  const secondVoteForm = participantSecondQuestion.getByRole("form", {
    name: "イベントの満足度は？に回答",
  });

  await expect(firstVoteForm).toBeVisible();
  await expect(secondVoteForm).toBeVisible();
  await firstVoteForm.getByLabel("プロトタイピング").check();
  await firstVoteForm.getByLabel("データ可視化").check();
  await firstVoteForm.getByRole("button", { name: "投票する" }).click();

  await expect(
    participantPage.getByText("投票を受け付けました。結果は投票一覧で確認できます。"),
  ).toBeVisible();
  await expect(secondVoteForm).toBeVisible();
  await expect(participantFirstQuestion.getByLabel("プロトタイピング: 1票、100%")).toBeVisible();
  await expect(participantFirstQuestion.getByLabel("ユーザーリサーチ: 0票、0%")).toBeVisible();
  await expect(firstQuestionCard.getByLabel("プロトタイピング: 1票、100%")).toBeVisible();
  await expect(firstQuestionCard.getByLabel("ユーザーリサーチ: 0票、0%")).toBeVisible();

  page.once("dialog", (confirmation) => confirmation.accept());
  await firstQuestionCard.getByRole("button", { name: "投票を終了" }).click();

  await expect(firstQuestionCard.getByRole("button", { name: "投票を終了" })).toHaveCount(0);
  await expect(secondQuestionCard.getByRole("button", { name: "投票を終了" })).toBeVisible();
  await expect(secondVoteForm).toBeVisible();
  await expect(
    participantFirstQuestion.getByText("受付は終了しました。最終結果です。"),
  ).toBeVisible();

  await secondVoteForm.getByLabel("満足").check();
  await secondVoteForm.getByRole("button", { name: "投票する" }).click();
  await expect(participantSecondQuestion.getByLabel("満足: 1票、100%")).toBeVisible();

  await participantPage.close();
});

async function createRoom(page: Page, title: string): Promise<string> {
  await page.goto("/rooms/");
  await page.getByLabel("ルーム名").fill(title);
  await page.getByLabel("管理パスワード").fill("example-password");
  await page.getByRole("button", { name: "ルームを作成" }).click();
  await expect(page).toHaveURL(/\/rooms\/room-[a-f0-9]{8}\/host$/);

  const roomId = page.url().match(/\/rooms\/(room-[a-f0-9]{8})\/host$/)?.[1];

  if (!roomId) {
    throw new Error("Room ID was not found in the host URL");
  }

  return roomId;
}
