import { existsSync } from 'node:fs';
import { test, expect } from './fixture.js';

test('toolbar visual baseline', async ({ page }, info) => {
  await page.goto('/?view=map');
  const toolbar = page.getByRole('group', { name: 'Map view options' });
  await expect(toolbar).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const options = { animations: 'disabled', caret: 'hide' };
  if (existsSync(info.snapshotPath('toolbar.png')) || process.env.UX_VISUAL === '1') {
    await expect(toolbar).toHaveScreenshot('toolbar.png', options);
  } else {
    info.annotations.push({ type: 'visual-review', description: 'Toolbar baseline requires review on this OS/profile.' });
    await info.attach('toolbar-candidate.png', { body: await toolbar.screenshot(options), contentType: 'image/png' });
  }
});
