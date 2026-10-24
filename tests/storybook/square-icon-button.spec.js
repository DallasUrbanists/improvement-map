import { existsSync } from 'node:fs';
import { test, expect } from '@playwright/test';

async function openButton(page, variant, theme, disabled = false, layout = 'floating') {
  const id = `buttons-square-icon-button--${layout}`;
  const query = new URLSearchParams({ id, viewMode: 'story', globals: `theme:${theme}`, args: `theme:${theme};variant:${variant};disabled:${disabled};layout:${layout}` });
  await page.goto(`iframe.html?${query}`);
  await expect(page.locator('html')).toHaveAttribute('data-storybook-ready', id);
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(200, 200);
  return page.getByRole('button', { name: 'Open menu', exact: true });
}
async function candidate(page, info, name) {
  const options = { animations: 'disabled', caret: 'hide' };
  if (existsSync(info.snapshotPath(`${name}.png`))) await expect(page).toHaveScreenshot(`${name}.png`, options);
  else {
    await info.attach(`${name}-candidate.png`, { body: await page.screenshot(options), contentType: 'image/png' });
    info.annotations.push({ type: 'visual-review-pending', description: 'State screenshot candidate; no approved baseline.' });
  }
}

for (const variant of ['neutral', 'primary', 'secondary']) {
  test(`square icon ${variant}: default, hover, press and focus`, async ({ page }, info) => {
    const theme = info.project.use.colorScheme || 'light';
    const button = await openButton(page, variant, theme);
    await expect(page.locator('#storybook-root > *')).toHaveCount(1);
    await expect(page.locator('#storybook-root > button.square-icon-button')).toHaveCount(1);
    await expect(button).toHaveText('');
    await expect(button).toHaveAttribute('title', 'Open menu');
    await candidate(page, info, `buttons-square-icon-button--floating-${variant}-default`);
    await button.hover();
    await candidate(page, info, `buttons-square-icon-button--floating-${variant}-hover`);
    await page.mouse.down();
    await candidate(page, info, `buttons-square-icon-button--floating-${variant}-press`);
    await page.mouse.up();
    await page.mouse.move(200, 200);
    await button.evaluate(element => element.blur());
    await page.keyboard.press('Tab');
    await button.focus();
    await expect(button).toBeFocused();
    await candidate(page, info, `buttons-square-icon-button--floating-${variant}-focus`);
  });
  test(`square icon ${variant}: disabled and configurable icon/label`, async ({ page }, info) => {
    const theme = info.project.use.colorScheme || 'light';
    const button = await openButton(page, variant, theme, true);
    await expect(button).toBeDisabled();
    await button.hover({ force: true });
    await button.evaluate(element => element.focus());
    await expect(button).not.toBeFocused();
    await candidate(page, info, `buttons-square-icon-button--floating-${variant}-disabled`);
    const query = new URLSearchParams({ id: 'buttons-square-icon-button--floating', viewMode: 'story', args: `theme:${theme};variant:${variant};icon:layer-group;label:Map layers` });
    await page.goto(`iframe.html?${query}`);
    const layers = page.getByRole('button', { name: 'Map layers', exact: true });
    await expect(layers).toHaveAttribute('title', 'Map layers');
    await expect(layers).toHaveText('');
    await expect(layers.locator('i')).toHaveClass(/fa-layer-group/);
  });
}
