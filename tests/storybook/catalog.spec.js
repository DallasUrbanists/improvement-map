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
    if (story.title.startsWith('REFERENCE/Components/') || story.title.startsWith('BUTTONS/') || story.title === 'BARS/Idea row') {
      // Enforce the review contract at the rendered boundary, without resetting
      // component-owned padding, shadows, positioning or modal backdrops.
      const body = page.locator('body');
      for (const [property, value] of Object.entries({ margin: '0px', padding: '0px', 'border-radius': '0px', 'box-shadow': 'none', 'border-top-width': '0px' })) await expect(body).toHaveCSS(property, value);
      const root = page.locator('#storybook-root');
      const expectedRoot = {
        'REFERENCE/Components/Controls/Map control button': '.map-ui-button',
        'REFERENCE/Components/Controls/Bookmark toggle': '.idea-bookmark',
        'BARS/Idea row': 'ul.idea-list',
        'REFERENCE/Components/Navigation/Album paginator': '.album-paginator',
        'REFERENCE/Components/Panels/Map tray': '.map-tray',
        'BUTTONS/Square Icon Button': '.square-icon-button',
        'BUTTONS/New Idea Special Button': '.new-idea-special-button',
      }[story.title];
      if (story.title === 'REFERENCE/Components/Panels/Detail sheet' || story.id === 'reference-components-panels-map-tray--closed') await expect(root.locator(':scope > *')).toHaveCount(0);
      else {
        await expect(root.locator(':scope > *')).toHaveCount(1);
        await expect(root.locator(`:scope > ${expectedRoot}`)).toHaveCount(1);
      }
      if (story.title === 'BARS/Idea row') {
        for (const property of ['margin', 'padding']) await expect(root.locator('ul')).toHaveCSS(property, '0px');
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

test('map tray keyboard scrolls plain content', async ({ page }, info) => {
  await openStory(page, 'reference-components-panels-map-tray--long-content', info.project.use.colorScheme || 'light');
  const content = page.locator('.map-tray-content');
  expect(await content.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
  await page.getByRole('button', { name: 'Close Browse ideas' }).focus();
  await page.keyboard.press('Tab');
  await expect(content).toBeFocused();
  await expect(content).toHaveCSS('outline-style', 'solid');
  await expect(content).toHaveCSS('outline-width', '2px');
  await page.keyboard.press('PageDown');
  await expect.poll(() => content.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
});

test('map tray keyboard excludes busy and fixed content', async ({ page }, info) => {
  for (const state of ['busy', 'fixed-content']) {
    await openStory(page, `reference-components-panels-map-tray--${state}`, info.project.use.colorScheme || 'light');
    await expect(page.locator('.map-tray-content')).not.toHaveAttribute('tabindex');
    if (state === 'busy') await expect(page.locator('.map-tray-content')).toHaveAttribute('inert', '');
    else {
      await page.getByRole('button', { name: 'Close Browse ideas' }).focus();
      await page.keyboard.press('Tab');
      await expect(page.locator('.map-tray-content')).not.toBeFocused();
    }
  }
});

test('dialog keyboard restores the opener', async ({ page }, info) => {
  await openStory(page, 'reference-patterns-detail-sheet-with-opener--open', info.project.use.colorScheme || 'light');
  const dialog = page.getByRole('dialog', { name: 'Idea details' });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Open details' })).toBeFocused();
});

test('catalog documents and manifests load under the public subpath', async ({ page, request }) => {
  expect(Object.values(index.entries).every(entry => entry.title.startsWith('REFERENCE/') || entry.title.startsWith('BUTTONS/') || entry.title.startsWith('BARS/') || entry.title.startsWith('CONTAINERS/') || entry.title.startsWith('FORM/') || entry.title === 'Colors'), 'Catalog entries belong to documented component groups or Colors').toBe(true);
  expect(index.entries['reference-start-here--docs']?.type).toBe('docs');
  await page.goto('?path=/docs/reference-start-here--docs');
  const menu = page.getByRole('button', { name: 'Open navigation menu' });
  if (await menu.isVisible()) await menu.click();
  await expect(page.getByRole('link', { name: /Improvement Map/ })).toHaveAttribute('href', '../');
  for (const file of ['index.json', 'manifests/components.json', 'manifests/docs.json', 'fixtures/crossing.svg']) {
    const response = await request.get(file); expect(response.ok(), file).toBeTruthy();
  }
});
