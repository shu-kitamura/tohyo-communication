import { expect, test } from '@playwright/test';

test('投票フロー（作成→投票→集計反映）', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await page
    .getByRole('link', { name: '投票を作成する' })
    .click();

  await page.getByLabel('タイトル').fill('E2Eテスト');
  await page.getByLabel('選択肢1').fill('A案');
  await page.getByLabel('選択肢2').fill('B案');
  await page
    .getByRole('button', { name: '投票を作成' })
    .click();

  await expect(page).toHaveURL(
    /\/vote\/.+\?view=organizer/
  );

  const organizerUrl = page.url();
  const match = organizerUrl.match(
    /\/vote\/([^/?]+)\?view=organizer/
  );
  expect(match).not.toBeNull();
  const sessionId = match?.[1] ?? '';
  expect(sessionId).not.toBe('');

  await expect(
    page.getByText('総投票数:')
  ).toContainText('0票');

  const voterPage = await context.newPage();
  await voterPage.goto(`/vote/${sessionId}`);
  await voterPage
    .getByRole('radio', { name: 'A案' })
    .click();
  await voterPage
    .getByRole('button', { name: '投票する' })
    .click();

  await expect(
    voterPage.getByText('投票が完了しました')
  ).toBeVisible();

  await expect(
    page.getByText('総投票数:')
  ).toContainText('1票', { timeout: 5000 });
});
