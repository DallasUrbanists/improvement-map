import { test, expect } from '@playwright/test';

const photos = [
  { id: 'photo-1', dataUrl: 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=', caption: 'First photo' },
  { id: 'photo-2', dataUrl: 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=', caption: 'Second photo' },
];





test('editable photo slides preserve captions and removal in the draft', async ({ page }) => {
  await page.addInitScript((photos) => {
    localStorage.setItem('improvement_map_wizard_draft_v1', JSON.stringify({ step: 2, photos }));
  }, photos);
  await page.goto('/submit');
  await page.getByRole('textbox', { name: 'Caption for photo 1' }).fill('Updated caption');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('improvement_map_wizard_draft_v1')).photos[0].caption)).toBe('Updated caption');
  await page.getByRole('button', { name: 'Next photo', exact: true }).click();
  await expect(page.getByText('2 / 2', { exact: true })).toBeVisible();
  // Reduced motion must reverse an in-progress scroll immediately, not leave
  // the counter and image on different photos until an animation completes.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const viewer = page.getByTestId('photo-swipe-viewer');
  await page.getByRole('button', { name: 'Previous photo', exact: true }).click();
  expect(await viewer.evaluate(element => Math.abs(element.scrollLeft))).toBeLessThan(3);
  await expect(page.getByText('1 / 2', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next photo', exact: true }).click();
  expect(await viewer.evaluate(element => Math.abs(element.scrollWidth - element.clientWidth - element.scrollLeft))).toBeLessThan(3);
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
  await page.getByRole('button', { name: 'Open photo 2: Second photo' }).click();
  const lightbox = page.getByRole('dialog', { name: 'Photo preview' });
  await expect(lightbox).toBeVisible();
  await expect(lightbox.getByText('Second photo', { exact: true })).toBeVisible();
});
