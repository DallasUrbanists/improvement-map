import { test, expect } from '@playwright/test';

test('the Component tests widget completes a selected story and its accessibility checks', async ({ page }) => {
  const storyId = 'buttons-text-button--floating';
  const outcomes = [];
  page.on('websocket', socket => socket.on('framereceived', ({ payload }) => {
    let data;
    try { data = JSON.parse(payload); } catch { return; }
    if (data.type !== 'UNIVERSAL_STORE:storybook/test') return;
    for (const { event } of data.args || []) {
      if (['FATAL_ERROR', 'TEST_RUN_COMPLETED'].includes(event?.type)) outcomes.push(event);
    }
  }));
  await page.goto(`/?path=/story/${storyId}`, { waitUntil: 'domcontentloaded' });
  await expect(page.frameLocator('#storybook-preview-iframe').getByRole('button', { name: 'Open menu', exact: true })).toBeVisible({ timeout: 60000 });
  const widget = page.getByRole('region', { name: 'Component tests', exact: true });
  const expand = widget.getByRole('button', { name: 'Expand testing module', exact: true });
  if (await expand.isVisible()) await expand.click();
  await expect(widget.getByRole('checkbox', { name: 'Accessibility', exact: true })).toBeVisible();
  const accessibility = widget.getByRole('checkbox', { name: 'Accessibility', exact: true });
  // The widget's sticky run footer overlaps this visible option and intercepts
  // pointer input; force the setting, then verify its result in the completed run.
  await accessibility.check({ force: true });
  await expect(accessibility).toBeChecked();
  await page.getByRole('link', { name: 'Floating', exact: true }).click({ button: 'right' });
  await page.getByRole('button', { name: 'Open context menu', exact: true }).click();
  const menu = page.getByRole('dialog', { name: 'Open context menu', exact: true });
  await menu.getByRole('button', { name: 'Start test run', exact: true }).click();
  await expect.poll(() => outcomes.length, { timeout: 90000, message: 'The widget must finish or report a startup error' }).toBeGreaterThan(0);
  const fatal = outcomes.find(event => event.type === 'FATAL_ERROR');
  expect(fatal, JSON.stringify(fatal)).toBeUndefined();
  const result = outcomes.find(event => event.type === 'TEST_RUN_COMPLETED').payload;
  expect(result.componentTestStatuses).toEqual([expect.objectContaining({ storyId, value: 'status-value:success' })]);
  expect(result.a11yStatuses).toEqual([expect.objectContaining({ storyId, value: 'status-value:success' })]);
  await expect(widget).not.toContainText('Starting...');
  await expect(menu.getByRole('button', { name: 'Component tests passed', exact: true })).toBeVisible();
});
