import { test, expect, draft, draftKey, photo, items } from './ux/fixture.js';

const modal = (page, name) => page.getByRole('dialog', { name, exact: true });
async function openMenuItem(page, name) {
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('link', { name, exact: true }).click();
}
async function expectConfiguration(dialog, formFactor, position, blocking) {
  await expect(dialog).toBeVisible();
  await dialog.evaluate(async element => { await Promise.all(element.closest('.floating-modal-layer').getAnimations({ subtree: true }).map(animation => animation.finished)); });
  await expect(dialog).toHaveClass(new RegExp(`floating-modal--${formFactor}`));
  await expect(dialog).toHaveClass(new RegExp(`floating-modal--${position}`));
  await expect(dialog).toHaveAttribute('aria-modal', String(blocking));
  const bounds = await dialog.boundingBox();
  expect(bounds.y).toBe(formFactor === 'full' ? 8 : 64);
  if (formFactor === 'full') expect(bounds.x).toBe(8);
  const label = await dialog.getAttribute('aria-label');
  await dialog.page().screenshot({ path: test.info().outputPath(`${label.toLowerCase().replace(/[^a-z]+/g, '-')}.png`), animations: 'disabled' });
}

test('saved lists use non-blocking left panels and preserve route exits', async ({ page }) => {
  for (const [path, name] of [['/bookmarks', 'Saved ideas'], ['/my-actions', 'Saved actions']]) {
    await page.goto(path);
    const dialog = modal(page, name);
    await expectConfiguration(dialog, 'tall', 'left', false);
    await expect(page.locator('.floating-modal__backdrop, .workspace-backdrop')).toHaveCount(0);
    await expect(page.getByTestId('persistent-map')).not.toHaveAttribute('inert');
    // Non-blocking panels leave the map's controls available outside the panel.
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    await expect(page.getByRole('link', { name: 'Welcome guide' })).toBeVisible();
    await page.getByRole('button', { name: 'Close menu', exact: true }).click();
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page).not.toHaveURL(new RegExp(`${path}$`));
  }
});

test('saved panels retain list scroll, remove and undo behavior', async ({ page }) => {
  await page.addInitScript(items => {
    const key = 'improvement_map_bookmarks_v1';
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ version: 1, saved: Object.fromEntries(items.map(suggestion => [suggestion.id, { suggestion, savedAt: '2026-10-19T12:00:00Z' }])) }));
    const action = { key: 'crossing', summary: 'Request a safer crossing', instructions: 'Contact the city.', reason: 'Improve safety.', sourceUrl: '' };
    localStorage.setItem('improvement_map_actions_v1', JSON.stringify({ version: 1, saved: { crossing: { action, suggestionId: '1', suggestionSummary: 'Suggestion 1', savedAt: '2026-10-19T12:00:00Z' } }, hidden: {}, generated: {} }));
  }, items);
  await page.goto('/bookmarks');
  const saved = modal(page, 'Saved ideas');
  await expect(saved.locator('.idea-row')).toHaveCount(items.length);
  const body = saved.locator('.floating-modal__content');
  await body.evaluate(element => { element.scrollTop = 300; });
  await expect.poll(() => page.evaluate(() => history.state.ideaView?.scroll)).toBe(300);
  await page.reload();
  await expect.poll(() => body.evaluate(element => element.scrollTop)).toBe(300);
  await saved.getByRole('button', { name: 'Remove bookmark', exact: true }).first().click();
  await expect(saved.locator('.idea-row')).toHaveCount(items.length - 1);
  await saved.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(saved.locator('.idea-row')).toHaveCount(items.length);
  await page.goto('/my-actions');
  const actions = modal(page, 'Saved actions');
  await actions.getByRole('button', { name: 'View action', exact: true }).click();
  const details = page.getByRole('dialog', { name: 'Action details', exact: true });
  await expect(details).toBeVisible();
  await details.getByRole('button', { name: 'Close Action details', exact: true }).click();
  await actions.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(actions.getByText('No saved actions yet.', { exact: false })).toBeVisible();
  await actions.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(actions.getByRole('heading', { name: 'Request a safer crossing' })).toBeVisible();
});

test('welcome and release history use the requested blocking form factors', async ({ page }) => {
  await page.goto('/');
  await openMenuItem(page, 'Welcome guide');
  const welcome = modal(page, 'Welcome guide');
  await expectConfiguration(welcome, 'full', 'center', true);
  const footer = welcome.locator('.floating-modal__footer');
  const before = await footer.boundingBox();
  await welcome.locator('.floating-modal__content').evaluate(element => { element.scrollTop = element.scrollHeight; });
  expect(await footer.boundingBox()).toEqual(before);
  await welcome.getByRole('checkbox').check();
  await welcome.getByRole('button', { name: 'Go to app' }).click();
  await openMenuItem(page, "What's new");
  const releases = modal(page, "What's new");
  await expectConfiguration(releases, 'tall', 'center', true);
  const controls = releases.locator('button, a[href], [tabindex="0"]');
  await controls.last().focus();
  await page.keyboard.press('Tab');
  await expect(releases.getByRole('button', { name: 'Close', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(releases).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Menu', exact: true })).toBeFocused();
});

test('style settings and advanced map settings preserve controls and focus', async ({ page }) => {
  await page.goto('/');
  const opener = page.getByRole('button', { name: 'Style settings', exact: true });
  await opener.click();
  const style = modal(page, 'Style settings');
  await expectConfiguration(style, 'tall', 'center', true);
  await style.getByRole('radio', { name: 'Satellite', exact: true }).check();
  await style.getByLabel('Icon size').fill('125');
  await style.getByRole('button', { name: 'More map settings' }).click();
  const settings = modal(page, 'Map settings');
  await expectConfiguration(settings, 'tall', 'center', true);
  await expect(style).toHaveCount(0);
  await settings.getByRole('button', { name: 'Reset markers settings' }).click();
  await settings.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(opener).toBeFocused();
  await opener.click();
  await expect(style.getByRole('radio', { name: 'Satellite', exact: true })).toBeChecked();
  await expect(style.getByLabel('Icon size')).toHaveValue('125');
  await page.keyboard.press('Escape');
  await expect(style).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test('photo step uses a blocking modal with fixed navigation and retains the draft', async ({ page }) => {
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
    key: draftKey, value: { ...draft, step: 2, photos: [{ id: 'photo-1', dataUrl: photo, caption: 'Original caption' }] },
  });
  await page.goto('/submit');
  const photos = modal(page, 'Attach photos');
  await expectConfiguration(photos, 'tall', 'center', true);
  await photos.getByRole('textbox', { name: 'Caption for photo 1' }).fill('Updated caption');
  const footer = photos.locator('.floating-modal__footer');
  const before = await footer.boundingBox();
  await photos.locator('.floating-modal__content').evaluate(element => { element.scrollTop = element.scrollHeight; });
  expect(await footer.boundingBox()).toEqual(before);
  await photos.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Describe your idea' })).toBeVisible();
  await expect(photos).toHaveCount(0);
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).photos[0].caption, draftKey)).toBe('Updated caption');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(photos).toBeVisible();
  await photos.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByTestId('pin-and-continue')).toBeVisible();
  await expect(page.locator('.floating-modal__backdrop')).toHaveCount(0);
});
