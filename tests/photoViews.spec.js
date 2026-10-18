import { test, expect } from '@playwright/test';

const photos = [
  { id: 'photo-1', dataUrl: 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=', caption: 'First photo' },
  { id: 'photo-2', dataUrl: 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=', caption: 'Second photo' },
];

test('suggestion photos switch between read-only grid and slides', async ({ page }) => {
  await page.route('**/api/public-improvements/suggestions/photo-test', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: {
      id: 'photo-test',
      content: { summary: 'Photo test', details: 'Photo display test', photos },
      location: { address: 'Dallas, TX' },
    } }),
  }));
  await page.goto('/');
  await page.waitForFunction(async () => {
    const { useAuth } = await import('/src/services/firebase.js');
    return useAuth().ready.value;
  });
  await page.evaluate(() => document.querySelector('#app').__vue_app__.config.globalProperties.$router.push('/suggestion/photo-test'));
  await expect(page.getByRole('button', { name: 'Preview photo 1: First photo' })).toBeVisible();
  await page.getByRole('button', { name: 'Preview photo 1: First photo' }).click();
  await expect(page.getByAltText('Full size')).toBeVisible();
  await page.getByAltText('Full size').click();

  const slidesButton = page.getByRole('button', { name: 'Slides', exact: true });
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'Light theme', exact: true }).click();
  const lightBackground = await slidesButton.evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(lightBackground).not.toBe('rgba(0, 0, 0, 0)');
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'Dark theme', exact: true }).click();
  await expect.poll(() => slidesButton.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe(lightBackground);
  expect(await slidesButton.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');

  await slidesButton.click();
  expect(await page.getByRole('button', { name: 'Photo grid', exact: true }).evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
  const viewer = page.getByTestId('photo-swipe-viewer');
  await expect(viewer).toBeVisible();
  await expect(page.getByRole('textbox', { name: /Caption for photo/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Remove photo/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Next photo', exact: true }).click();
  await expect(page.getByText('2 / 2', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next photo', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Photo grid', exact: true }).click();
  await expect(viewer).toHaveCount(0);
  await page.getByRole('button', { name: 'Slides', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Next photo', exact: true })).toBeDisabled();
  await expect.poll(() => viewer.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
});

test('single-photo suggestions use slides without a display toggle or grid', async ({ page }) => {
  await page.route('**/api/public-improvements/suggestions/single-photo', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: {
      id: 'single-photo',
      content: { summary: 'Single photo', details: 'Single photo display', photos: photos.slice(0, 1) },
      location: { address: 'Dallas, TX' },
    } }),
  }));
  await page.goto('/');
  await page.waitForFunction(async () => {
    const { useAuth } = await import('/src/services/firebase.js');
    return useAuth().ready.value;
  });
  await page.evaluate(() => document.querySelector('#app').__vue_app__.config.globalProperties.$router.push('/suggestion/single-photo'));

  const viewer = page.getByTestId('photo-swipe-viewer');
  await expect(viewer).toBeVisible();
  await expect(viewer.locator('img')).toHaveCount(1);
  await expect(page.getByLabel('Photo display', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Preview photo/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Next photo', exact: true })).toHaveCount(0);
  await viewer.locator('img').click();
  await expect(page.getByAltText('Full size')).toBeVisible();
});

test('editable photo slides preserve captions and removal in the draft', async ({ page }) => {
  await page.addInitScript((photos) => {
    localStorage.setItem('improvement_map_wizard_draft_v1', JSON.stringify({ step: 2, photos }));
  }, photos);
  await page.goto('/submit');
  await page.getByRole('textbox', { name: 'Caption for photo 1' }).fill('Updated caption');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('improvement_map_wizard_draft_v1')).photos[0].caption)).toBe('Updated caption');
  await page.getByRole('button', { name: 'Next photo', exact: true }).click();
  await expect(page.getByText('2 / 2', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Remove photo 2', exact: true }).click();
  await expect(page.getByTestId('photo-swipe-viewer').locator('img')).toHaveCount(1);
  await expect(page.getByRole('textbox', { name: 'Caption for photo 1' })).toHaveValue('Updated caption');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('improvement_map_wizard_draft_v1')).photos.length)).toBe(1);
});

test('review photo grid opens the existing lightbox', async ({ page }) => {
  await page.addInitScript((photos) => {
    localStorage.setItem('improvement_map_wizard_draft_v1', JSON.stringify({ step: 4, photos }));
  }, photos);
  await page.goto('/submit');
  await page.getByRole('button', { name: 'Preview photo 2: Second photo' }).click();
  const lightbox = page.getByRole('dialog', { name: 'Photo preview' });
  await expect(lightbox).toBeVisible();
  await expect(lightbox.getByText('Second photo', { exact: true })).toBeVisible();
});
