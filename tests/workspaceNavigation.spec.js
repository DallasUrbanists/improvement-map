import { test, expect } from './ux/fixture.js';

const camera = page => page.evaluate(async () => {
  const { sharedBrowseMap } = await import('/src/services/sharedBrowseMap.js');
  const map = sharedBrowseMap.value?.map;
  return map && { ...map.getCenter().toJSON(), zoom: map.getZoom() };
});

test('map controls stay in the requested positions across map views', async ({ page }) => {
  await page.goto('/?view=map');
  const search = page.getByRole('textbox', { name: 'Search address or neighborhood' });
  const settings = page.getByRole('button', { name: 'Style settings', exact: true });
  const location = page.getByRole('button', { name: 'Center on my location' });
  const create = page.getByRole('button', { name: 'New', exact: true });
  await expect(search).toBeVisible();
  await expect(settings).toBeVisible();
  await expect(page.locator('.workspace-route-layer')).toHaveCSS('z-index', '20');
  await expect(settings).toHaveCSS('z-index', '10');
  await expect(location).toHaveCSS('z-index', '10');
  await expect(location.locator('i')).toHaveClass(/fa-satellite/);
  await expect(create).toBeVisible();
  await expect(page.getByRole('button', { name: 'Zoom in' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Zoom out' })).toHaveCount(0);
  const layout = await page.evaluate(() => {
    const box = selector => {
      const { x, y, width, height } = document.querySelector(selector).getBoundingClientRect();
      return { x, y, width, height };
    };
    return { settings: box('.style-settings-launch'), location: box('.style-location-launch'), create: box('.new-idea-fab'), searchIcon: box('.map-search-icon'), input: box('.map-search-panel input') };
  });
  expect(layout.settings.width).toBe(48);
  expect(layout.settings.height).toBe(48);
  expect(layout.location.width).toBe(48);
  expect(layout.location.height).toBe(48);
  expect(layout.location.y - (layout.settings.y + layout.settings.height)).toBe(12);
  expect(layout.searchIcon.x).toBeGreaterThan(layout.input.x + layout.input.width / 2);
  expect(layout.create.width).toBe(72);
  expect(layout.create.height).toBe(72);
  await page.goto('/suggestion/1');
  await expect(page.getByRole('region', { name: 'Idea details', exact: true })).toBeVisible();
  await expect(create).toHaveCSS('z-index', '10');
  await expect(page.getByRole('button', { name: 'Zoom in' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'New', exact: true })).toBeVisible();
});

test('map actions open Browse and New, and Style Settings switches map imagery', { tag: '@critical' }, async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Browse ideas | Improvement Map');
  await page.getByRole('button', { name: 'List', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Browse ideas' })).toBeVisible();
  await page.getByRole('button', { name: 'Close Browse ideas', exact: true }).click();
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await expect(page.getByTestId('pin-and-continue')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel pin', exact: true }).click();
  await expect(page.getByTestId('pin-and-continue')).toHaveCount(0);
  await page.getByRole('button', { name: 'List', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Browse ideas' })).toBeVisible();
  await page.getByRole('button', { name: 'Close Browse ideas', exact: true }).click();
  await page.getByRole('button', { name: 'Style settings', exact: true }).click();
  await page.getByRole('radio', { name: 'Satellite' }).check();
  await page.getByRole('dialog', { name: 'Style settings', exact: true }).getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Style settings', exact: true })).toBeHidden();
  await page.reload();
  await page.getByRole('button', { name: 'Style settings', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Satellite' })).toBeChecked();
  await page.getByRole('radio', { name: 'Streets' }).check();
  await page.getByRole('dialog', { name: 'Style settings', exact: true }).getByRole('button', { name: 'Close', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Style settings', exact: true })).toBeVisible();
});

test('theme follows the system until a manual choice and remembers that choice', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.getByRole('button', { name: 'Style settings', exact: true }).click();
  await expect(page.locator('.theme-choice-dark')).toHaveCount(2);
  expect(await page.locator('.theme-choice').evaluateAll(choices => choices.map(choice => choice.textContent.trim()))).toEqual(['Light', 'Dark', 'System']);
  await expect(page.locator('.map-style-choice').first()).toHaveCSS('background-image', /map-style-streets-dark\.png/);
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveClass(/light/);
  await expect(page.locator('.theme-choice-light')).toHaveCount(2);
  expect(await page.locator('.theme-choice').evaluateAll(choices => choices.map(choice => choice.textContent.trim()))).toEqual(['System', 'Light', 'Dark']);
  await expect(page.locator('.map-style-choice').first()).toHaveCSS('background-image', /map-style-streets-light\.png/);
  await page.getByRole('dialog', { name: 'Style settings', exact: true }).getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Style settings', exact: true }).click();
  await page.getByRole('radio', { name: 'Dark', exact: true }).check();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.getByRole('button', { name: 'Style settings', exact: true }).click();
  await page.getByRole('radio', { name: 'Light', exact: true }).check();
  await page.getByRole('dialog', { name: 'Style settings', exact: true }).getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await expect(page.getByRole('menuitemcheckbox', { name: 'Dark mode' })).toHaveAttribute('aria-checked', 'false');
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/light/);
});

test('style settings persist marker size and rail visibility', async ({ page }) => {
  await page.goto('/?view=map');
  await page.getByRole('button', { name: 'Style settings', exact: true }).click();
  await expect(page.locator('.map-style-choice').nth(1)).toHaveCSS('background-image', /map-style-satellite\.png/);
  const styleRatio = await page.locator('.map-style-choice').first().evaluate(el => el.getBoundingClientRect().width / el.getBoundingClientRect().height);
  expect(styleRatio).toBeCloseTo(1.5, 1);
  await page.getByRole('button', { name: 'More map settings' }).click();
  await expect(page.getByRole('dialog', { name: 'Map settings', exact: true })).toBeVisible();
  await page.getByRole('dialog', { name: 'Map settings', exact: true }).getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Style settings', exact: true })).toBeFocused();
  await expect(page.getByRole('textbox', { name: 'Search address or neighborhood' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Search address or neighborhood', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Style settings', exact: true }).click();
  await page.getByLabel('Icon size').fill('125');
  await expect(page.locator('output[for="style-icon-size"]')).toHaveText('125%');
  await page.getByRole('checkbox', { name: 'Show rail lines' }).uncheck();
  await expect(page.getByRole('checkbox', { name: 'Show rail lines' })).toHaveCSS('border-top-width', '0px');
  await expect(page.getByRole('checkbox', { name: 'Show rail lines' })).toHaveCSS('padding-left', '0px');
  await expect(page.getByLabel('Rail line thickness')).toHaveCount(0);
  await page.getByRole('dialog', { name: 'Style settings', exact: true }).getByRole('button', { name: 'Close', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Style settings', exact: true }).click();
  await expect(page.getByLabel('Icon size')).toHaveValue('125');
  await expect(page.getByRole('checkbox', { name: 'Show rail lines' })).not.toBeChecked();
  await page.getByRole('dialog', { name: 'Style settings', exact: true }).getByRole('button', { name: 'Close', exact: true }).click();
  await page.goto('/suggestion/1');
  await expect(page.locator('.submission-detail-tray')).toHaveAttribute('aria-busy', 'false');
  await page.getByRole('button', { name: 'Style settings', exact: true }).click();
  await page.getByRole('radio', { name: 'Satellite' }).check();
  await page.reload();
  await page.getByRole('button', { name: 'Style settings', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Satellite' })).toBeChecked();
});

test('map camera persists after pan and zoom, and GPS recenters it', async ({ page }) => {
  await page.goto('/?view=map');
  await expect.poll(() => camera(page)).toBeTruthy();
  const custom = { lat: 32.85, lng: -96.7, zoom: 15 };
  await page.evaluate(async ({ lat, lng, zoom }) => {
    const { sharedBrowseMap } = await import('/src/services/sharedBrowseMap.js');
    sharedBrowseMap.value.map.setCenter({ lat, lng });
    sharedBrowseMap.value.map.setZoom(zoom);
  }, custom);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('improvement_map_view')))).toMatchObject(custom);
  await page.reload();
  await expect.poll(() => camera(page)).toEqual(custom);
  await page.evaluate(() => {
    navigator.geolocation.getCurrentPosition = resolve => resolve({
      coords: { latitude: 32.81, longitude: -96.76, accuracy: 10 },
    });
  });
  await page.getByRole('button', { name: 'Center on my location' }).click();
  await expect.poll(async () => {
    const { lat, lng } = await camera(page);
    return { lat, lng };
  }).toEqual({ lat: 32.81, lng: -96.76 });
});

test('Browse sorting survives reload and long details remain scrollable', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.geolocation.getCurrentPosition = resolve => resolve({
      coords: { latitude: 32.78, longitude: -96.8, accuracy: 10 },
    });
  });
  await page.goto('/?view=list');
  await page.getByRole('button', { name: 'Nearest to me' }).click();
  await expect(page.getByRole('button', { name: 'Nearest to me' })).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Nearest to me' })).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() => { window.__ux.details = 'A safer crossing for everyone. '.repeat(300); });
  await page.locator('[data-suggestion-id="1"]').click();
  await page.getByRole('button', { name: 'Expand details' }).click();
  const scroller = page.getByRole('region', { name: 'Idea details', exact: true }).locator('.map-tray-content');
  await expect.poll(() => scroller.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
  await scroller.evaluate(el => { el.scrollTop = el.scrollHeight; });
  await expect.poll(() => scroller.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
});

test('author profile survives reload and a completed submission resets the draft', async ({ page }) => {
  await page.goto('/submit');
  await page.getByTestId('pin-and-continue').click();
  await page.getByRole('button', { name: 'Skip photos', exact: true }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.locator('#input-author-name').fill('Alex Mercer');
  await page.locator('#input-author-email').fill('alex@example.com');
  await page.reload();
  await expect(page.locator('#input-author-name')).toHaveValue('Alex Mercer');
  await expect(page.locator('#input-author-email')).toHaveValue('alex@example.com');
  await page.getByTestId('step-four-navigation').getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Submission complete!' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('improvement_map_author_profile'))))
    .toEqual({ name: 'Alex Mercer', email: 'alex@example.com' });
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('improvement_map_wizard_draft_v1'))?.details || '')).toBe('');
});
