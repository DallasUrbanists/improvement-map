import { existsSync } from 'node:fs';
import { test, expect } from './fixture.js';

test('map loading surface follows theme independently of rendered tiles', async ({ page }, info) => {
  await page.goto('/?view=map');
  const canvas = page.locator('.workspace-map-canvas');
  const tiles = canvas.locator('.fake-map-tiles');
  await expect(tiles).toBeVisible();
  const dark = info.project.use.colorScheme === 'dark';
  const surfaceColor = isDark => isDark ? 'rgb(77, 96, 89)' : 'rgb(255, 255, 255)';
  await expect(canvas).toHaveCSS('background-color', surfaceColor(dark));
  await expect(canvas.locator(':scope > .gm-style')).toHaveCSS('background-color', surfaceColor(dark));
  await expect(tiles).toHaveCSS('background-color', 'rgb(77, 96, 89)');
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('menuitemcheckbox', { name: 'Dark mode' }).click();
  await expect(canvas).toHaveCSS('background-color', surfaceColor(!dark));
  await expect(canvas.locator(':scope > .gm-style')).toHaveCSS('background-color', surfaceColor(!dark));
  await expect(tiles).toHaveCSS('background-color', 'rgb(77, 96, 89)');
});

test('toolbar visual baseline', async ({ page }, info) => {
  await page.goto('/?view=map');
  const toolbar = page.getByRole('group', { name: 'Map view options' });
  await expect(toolbar).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const options = { animations: 'disabled', caret: 'hide', maxDiffPixels: 16 };
  if (existsSync(info.snapshotPath('toolbar.png')) || process.env.UX_VISUAL === '1') {
    await expect(toolbar).toHaveScreenshot('toolbar.png', options);
  } else {
    info.annotations.push({ type: 'visual-review', description: 'Toolbar baseline requires review on this OS/profile.' });
    await info.attach('toolbar-candidate.png', { body: await toolbar.screenshot(options), contentType: 'image/png' });
  }
});
