import { test, expect } from '@playwright/test';

for (const variant of ['neutral', 'primary', 'secondary']) {
  test(`text button ${variant}: configurable label/icon and keyboard focus`, async ({ page }, info) => {
    const theme = info.project.use.colorScheme || 'light';
    const id = 'buttons-text-button--floating';
    const query = new URLSearchParams({ id, viewMode: 'story', globals: `theme:${theme}`, args: `theme:${theme};variant:${variant};icon:plus;label:Create item` });
    await page.goto(`iframe.html?${query}`);
    await expect(page.locator('html')).toHaveAttribute('data-storybook-ready', id);
    const button = page.getByRole('button', { name: 'Create item', exact: true });
    await expect(page.locator('#storybook-root > button.text-button')).toHaveCount(1);
    await expect(button).toHaveText('Create item');
    await expect(button).toHaveAttribute('title', 'Create item');
    await expect(button.locator('i')).toHaveClass(/fa-plus/);
    await button.focus();
    await expect(button).toBeFocused();
  });
}

for (const layout of ['floating', 'tight']) {
  test(`text button ${layout}: icon can be omitted while label remains`, async ({ page }, info) => {
    const theme = info.project.use.colorScheme || 'light';
    const id = `buttons-text-button--${layout}`;
    const query = new URLSearchParams({ id, viewMode: 'story', globals: `theme:${theme}`, args: `theme:${theme};variant:neutral;icon:none;label:Browse;layout:${layout}` });
    await page.goto(`iframe.html?${query}`);
    await expect(page.locator('html')).toHaveAttribute('data-storybook-ready', id);
    const button = page.getByRole('button', { name: 'Browse', exact: true });
    await expect(button).toHaveText('Browse');
    await expect(button.locator('i')).toHaveCount(0);
  });
}
