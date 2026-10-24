import { test, expect } from '@playwright/test';
import { buttonColors } from '../../src/design/buttonColors.js';

const rgb = hex => `rgb(${[1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16)).join(', ')})`;

for (const variant of ['neutral', 'primary', 'secondary']) {
  test(`text button ${variant}: label, optional icon and interaction states`, async ({ page }, info) => {
    const theme = info.project.use.colorScheme || 'light';
    const id = 'buttons-text-button--floating';
    const query = new URLSearchParams({ id, viewMode: 'story', globals: `theme:${theme}`, args: `theme:${theme};variant:${variant};icon:plus;label:Create item` });
    await page.goto(`iframe.html?${query}`);
    await expect(page.locator('html')).toHaveAttribute('data-storybook-ready', id);
    const button = page.getByRole('button', { name: 'Create item', exact: true });
    const palette = buttonColors[theme][variant];
    await expect(page.locator('#storybook-root > button.text-button')).toHaveCount(1);
    await expect(button).toHaveCSS('margin', '4px');
    await expect(button).toHaveCSS('border-radius', '8px');
    await expect(button).toHaveCSS('background-color', rgb(palette.background));
    await expect(button).toHaveText('Create item');
    await expect(button).toHaveAttribute('title', 'Create item');
    await expect(button.locator('i')).toHaveClass(/fa-plus/);
    await button.hover();
    await expect(button).toHaveCSS('background-color', rgb(palette.hover));
    await page.mouse.down();
    await expect(button).toHaveCSS('background-color', rgb(palette.press));
    await page.mouse.up();
    await page.mouse.move(200, 200);
    await button.focus();
    await expect(button).toHaveCSS('outline-width', '2px');
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
    await expect(button).toHaveCSS('margin', layout === 'floating' ? '4px' : '0px');
    await expect(button).toHaveCSS('border-radius', layout === 'floating' ? '8px' : '0px');
    await expect(button).toHaveCSS('box-shadow', layout === 'floating' ? /.+/ : 'none');
  });
}
