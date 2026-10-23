import { existsSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { buttonColors } from '../../src/design/buttonColors.js';

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
const rgb = hex => `rgb(${[1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16)).join(', ')})`;

for (const variant of ['neutral', 'primary', 'secondary']) {
  test(`square icon ${variant}: default, hover, press and focus`, async ({ page }, info) => {
    const theme = info.project.use.colorScheme || 'light';
    const palette = buttonColors[theme][variant];
    const button = await openButton(page, variant, theme);
    await expect(page.locator('#storybook-root > *')).toHaveCount(1);
    await expect(page.locator('#storybook-root > button.square-icon-button')).toHaveCount(1);
    await expect(button).toHaveCSS('width', '48px');
    await expect(button).toHaveCSS('height', '48px');
    await expect(button).toHaveText('');
    await expect(button).toHaveAttribute('title', 'Open menu');
    await expect(button).toHaveCSS('background-color', rgb(palette.background));
    await expect(button).toHaveCSS('margin', '4px');
    expect(await button.evaluate(element => getComputedStyle(element).boxShadow)).not.toBe('none');
    await candidate(page, info, `buttons-square-icon-button--floating-${variant}-default`);
    await button.hover();
    await expect(button).toHaveCSS('background-color', rgb(palette.hover));
    await candidate(page, info, `buttons-square-icon-button--floating-${variant}-hover`);
    await page.mouse.down();
    await expect(button).toHaveCSS('background-color', rgb(palette.press));
    await candidate(page, info, `buttons-square-icon-button--floating-${variant}-press`);
    await page.mouse.up();
    await page.mouse.move(200, 200);
    await button.evaluate(element => element.blur());
    await page.keyboard.press('Tab');
    await button.focus();
    await expect(button).toBeFocused();
    await expect(button).toHaveCSS('outline-style', 'solid');
    await expect(button).toHaveCSS('outline-width', '2px');
    await candidate(page, info, `buttons-square-icon-button--floating-${variant}-focus`);
  });
  test(`square icon ${variant}: disabled and configurable icon/label`, async ({ page }, info) => {
    const theme = info.project.use.colorScheme || 'light';
    const button = await openButton(page, variant, theme, true);
    await expect(button).toBeDisabled();
    await button.hover({ force: true });
    await expect(button).toHaveCSS('background-color', rgb(buttonColors[theme][variant].background));
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

test('square icon Tight removes its margin and all shadows', async ({ page }, info) => {
  const theme = info.project.use.colorScheme || 'light';
  const query = new URLSearchParams({ id: 'buttons-square-icon-button--tight', viewMode: 'story', globals: `theme:${theme}`, args: `theme:${theme};variant:primary;layout:tight` });
  await page.goto(`iframe.html?${query}`);
  await expect(page.locator('html')).toHaveAttribute('data-storybook-ready', 'buttons-square-icon-button--tight');
  const button = page.getByRole('button', { name: 'Open menu', exact: true });
  await expect(button).toHaveCSS('margin', '0px');
  await expect(button).toHaveCSS('border-radius', '0px');
  await expect(button).toHaveCSS('box-shadow', 'none');
  await button.hover();
  await page.mouse.down();
  await expect(button).toHaveCSS('box-shadow', 'none');
  await page.mouse.up();
});
