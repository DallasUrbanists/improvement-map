import { test, expect } from '@playwright/test';

for (const [story, side] of [['slide-from-left', 'left'], ['slide-from-right', 'right']]) {
  test(`drawer enters from ${side} and supports drag close/reopen`, async ({ page }, info) => {
    const theme = info.project.use.colorScheme || 'light';
    const id = `containers-drawer--${story}`;
    const query = new URLSearchParams({ id, viewMode: 'story', globals: `theme:${theme}` });
    await page.goto(`iframe.html?${query}`);
    await expect(page.locator('html')).toHaveAttribute('data-storybook-ready', id);
    const drawer = page.getByRole('complementary', { name: 'Drawer' });
    await expect(drawer.locator('.header-bar')).toHaveText('Drawer');
    const backdrop = page.locator('.drawer-backdrop');
    await expect(drawer).toBeVisible();
    await expect(backdrop).toHaveCSS('opacity', '1');
    const box = await drawer.boundingBox();
    expect(box).not.toBeNull();
    if (side === 'left') expect(box.x).toBe(0);
    else expect(box.x + box.width).toBe(page.viewportSize().width);

    const closeHandle = page.locator('.drawer__handle');
    await expect(drawer.locator('.header-bar .square-icon-button')).toHaveAttribute('aria-label', 'Close drawer');
    const closeBox = await closeHandle.boundingBox();
    const drawerLayerZ = Number(await page.locator('.drawer-shell').evaluate(element => getComputedStyle(element).zIndex));
    const backdropZ = Number(await backdrop.evaluate(element => getComputedStyle(element).zIndex));
    expect(drawerLayerZ).toBeGreaterThan(backdropZ);
    await page.mouse.move(closeBox.x + closeBox.width / 2, closeBox.y + closeBox.height / 2);
    const closeDirection = side === 'left' ? -1 : 1;
    if (side === 'left') expect(closeBox.x).toBe(box.x + box.width);
    else expect(closeBox.x + closeBox.width).toBe(box.x);
    await page.mouse.down();
    await page.mouse.move(closeBox.x + closeBox.width / 2 + closeDirection * 180, closeBox.y + closeBox.height / 2, { steps: 8 });
    await page.mouse.up();
    await expect(drawer).toHaveAttribute('data-open', 'false');
    await expect(backdrop).toHaveCSS('opacity', '0');

    const openHandle = page.getByRole('button', { name: 'Open drawer' });
    const openBox = await openHandle.boundingBox();
    const closedBox = await drawer.boundingBox();
    if (side === 'left') expect(closedBox.x + closedBox.width).toBe(0);
    else expect(closedBox.x).toBe(page.viewportSize().width);
    if (side === 'left') expect(openBox.x).toBe(0);
    else expect(openBox.x + openBox.width).toBe(page.viewportSize().width);
    await page.mouse.move(openBox.x + openBox.width / 2, openBox.y + openBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(openBox.x + openBox.width / 2 - closeDirection * 180, openBox.y + openBox.height / 2, { steps: 8 });
    await page.mouse.up();
    await expect(drawer).toHaveAttribute('data-open', 'true');
  });

  test(`closed ${side} drawer hides the handle when opening is disabled`, async ({ page }) => {
    const id = `containers-drawer--${story}`;
    const query = new URLSearchParams({
      id,
      viewMode: 'story',
      args: 'open:false;canDragClose:false;canDragOpen:false',
    });
    await page.goto(`iframe.html?${query}`);
    await expect(page.locator('html')).toHaveAttribute('data-storybook-ready', id);
    await expect(page.getByRole('complementary', { name: 'Drawer' })).toHaveAttribute('data-open', 'false');
    await expect(page.getByRole('button', { name: 'Open drawer' })).toHaveCount(0);
  });
}
