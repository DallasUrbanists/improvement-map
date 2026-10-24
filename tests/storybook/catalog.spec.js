import { readFileSync, existsSync } from 'node:fs';
import { test, expect } from '@playwright/test';
const index = JSON.parse(readFileSync('storybook-static/index.json', 'utf8'));
const selection = process.env.STORYBOOK_SELECTED === '1' ? JSON.parse(readFileSync('test-results/storybook/selection.json', 'utf8')).files : null;
const stories = Object.values(index.entries).filter(entry => entry.type === 'story' && (!selection || selection.includes(entry.importPath.replace(/^\.\//, ''))));
const blockedRequests = new WeakMap();

test.beforeEach(async ({ context, page, baseURL }) => {
  const origin = new URL(baseURL).origin;
  const blocked = [];
  blockedRequests.set(page, blocked);
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === origin && ['GET', 'HEAD'].includes(route.request().method())) return route.continue();
    blocked.push(`${route.request().method()} ${url.origin}${url.pathname}`);
    return route.abort('blockedbyclient');
  });
  await page.addInitScript(() => {
    // Detect any attempt to use real app storage or permissions, including reads.
    for (const method of ['getItem', 'setItem', 'removeItem']) {
      const original = Storage.prototype[method];
      Storage.prototype[method] = function (key, ...args) {
        if (String(key).startsWith('improvement_map_')) throw Error('Story attempted application storage access');
        return original.call(this, key, ...args);
      };
    }
    Storage.prototype.clear = () => { throw Error('Story attempted to clear browser storage'); };
    Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition() { throw Error('Story requested location'); }, watchPosition() { throw Error('Story requested location'); } } });
  });
});
test.afterEach(async ({ page }) => { expect(blockedRequests.get(page), 'Catalog attempted external traffic or a write request').toEqual([]); });

async function openStory(page, id, theme) {
  await page.goto(`iframe.html?id=${id}&viewMode=story&globals=theme:${theme}`);
  await expect(page.locator('html')).toHaveAttribute('data-storybook-preview', 'ready');
  await expect(page.locator('html')).toHaveAttribute('data-storybook-ready', id);
  await expect(page.locator('.sb-errordisplay')).not.toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  // Production transitions must settle before screenshots (including Teleports).
  await expect(page.locator('.map-tray-enter-active')).toHaveCount(0);
}

for (const story of stories) {
  test(`render ${story.id}`, async ({ page }, info) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await openStory(page, story.id, info.project.use.colorScheme);
    await expect(page.locator('html')).toHaveClass(new RegExp(info.project.use.colorScheme));
    expect(errors).toEqual([]);
    if (story.title.startsWith('BUTTONS/') || story.title === 'BARS/Idea row') {
      // Raw stories expose one component boundary for review; appearance is reviewed in screenshots.
      const root = page.locator('#storybook-root');
      await expect(root.locator(':scope > *')).toHaveCount(1);
      if (story.title === 'BARS/Idea row') {
        await expect(root.getByRole('list')).toHaveCount(1);
      }
    }
    const imageOptions = { animations: 'disabled', caret: 'hide' };
    if (existsSync(info.snapshotPath(`${story.id}.png`))) {
      await expect(page).toHaveScreenshot(`${story.id}.png`, imageOptions);
    } else {
      await info.attach(`${story.id}-candidate.png`, { body: await page.screenshot(imageOptions), contentType: 'image/png' });
      info.annotations.push({ type: 'visual-review-pending', description: 'Render passed; screenshot comparison is not covered until a baseline is reviewed and committed on this OS/profile.' });
    }
  });
}

test('catalog documents and manifests load under the public subpath', async ({ page, request }) => {
  expect(Object.values(index.entries).every(entry => entry.title.startsWith('BUTTONS/') || entry.title.startsWith('BARS/') || entry.title.startsWith('CONTAINERS/') || entry.title.startsWith('FORM/') || entry.title.startsWith('EMBEDDABLES/') || entry.title === 'Colors'), 'Catalog entries belong to the supported component groups or Colors').toBe(true);
  await page.goto('?path=/docs/buttons-square-icon-button--docs');
  const menu = page.getByRole('button', { name: 'Open navigation menu' });
  if (await menu.isVisible()) await menu.click();
  await expect(page.getByRole('link', { name: /Improvement Map/ })).toHaveAttribute('href', '../');
  for (const file of ['index.json', 'manifests/components.json', 'manifests/docs.json']) {
    const response = await request.get(file); expect(response.ok(), file).toBeTruthy();
  }
});
