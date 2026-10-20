import { test, expect } from './ux/fixture.js';

const camera = page => page.evaluate(async () => {
  const { sharedBrowseMap } = await import('/src/services/sharedBrowseMap.js');
  const map = sharedBrowseMap.value?.map;
  return map && { ...map.getCenter().toJSON(), zoom: map.getZoom() };
});

test('toolbar opens Browse and Submit and Style Settings switches map imagery', { tag: '@critical' }, async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Browse ideas | Improvement Map');
  await page.getByRole('button', { name: 'Browse', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Browse ideas' })).toBeVisible();
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(page.getByTestId('pin-and-continue')).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByTestId('pin-and-continue')).toHaveCount(0);
  await page.getByRole('button', { name: 'Browse', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Browse ideas' })).toBeVisible();
  await page.getByRole('button', { name: 'Browse', exact: true }).click();
  await page.getByRole('button', { name: 'Style settings', exact: true }).click();
  await page.getByRole('radio', { name: 'Satellite' }).check();
  await page.getByRole('button', { name: 'Close Style Settings' }).click();
  await expect(page.locator('dialog.style-settings-dialog')).toBeHidden();
  await page.reload();
  await page.getByRole('button', { name: 'Style settings', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Satellite' })).toBeChecked();
  await page.getByRole('radio', { name: 'Streets' }).check();
  await page.getByRole('button', { name: 'Close Style Settings' }).click();
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
  await page.getByRole('button', { name: 'Close Style Settings' }).click();
  await page.getByRole('button', { name: 'Style settings', exact: true }).click();
  await page.getByRole('radio', { name: 'Dark', exact: true }).check();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.getByRole('button', { name: 'Style settings', exact: true }).click();
  await page.getByRole('radio', { name: 'Light', exact: true }).check();
  await page.getByRole('button', { name: 'Close Style Settings' }).click();
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
  await expect(page.getByRole('heading', { name: 'Map settings' })).toBeVisible();
  await page.getByRole('button', { name: 'Close Map settings' }).click();
  await expect(page.getByRole('button', { name: 'Style settings', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Search address or neighborhood' }).click();
  await expect(page.getByRole('button', { name: 'Style settings', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Style settings', exact: true }).click();
  await page.getByLabel('Icon size').fill('125');
  await expect(page.locator('output[for="style-icon-size"]')).toHaveText('125%');
  await page.getByRole('checkbox', { name: 'Show rail lines' }).uncheck();
  await expect(page.getByRole('checkbox', { name: 'Show rail lines' })).toHaveCSS('border-top-width', '0px');
  await expect(page.getByRole('checkbox', { name: 'Show rail lines' })).toHaveCSS('padding-left', '0px');
  await expect(page.getByLabel('Rail line thickness')).toHaveCount(0);
  await page.getByRole('button', { name: 'Close Style Settings' }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Style settings', exact: true }).click();
  await expect(page.getByLabel('Icon size')).toHaveValue('125');
  await expect(page.getByRole('checkbox', { name: 'Show rail lines' })).not.toBeChecked();
  await page.getByRole('button', { name: 'Close Style Settings' }).click();
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
