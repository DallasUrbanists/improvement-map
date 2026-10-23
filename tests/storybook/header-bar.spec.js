import { test, expect } from '@playwright/test';
import { buttonColors } from '../../src/design/buttonColors.js';

const rgb = hex => `rgb(${[1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16)).join(', ')})`;

for (const story of ['plain', 'with-buttons']) {
  test(`header bar ${story}: full width, label and border`, async ({ page }, info) => {
    const theme = info.project.use.colorScheme || 'light';
    const id = `bars-header-bar--${story}`;
    const query = new URLSearchParams({ id, viewMode: 'story', globals: `theme:${theme}`, args: `theme:${theme};variant:secondary;label:Projects` });
    await page.goto(`iframe.html?${query}`);
    await expect(page.locator('html')).toHaveAttribute('data-storybook-ready', id);
    const header = page.getByRole('banner');
    await expect(header).toHaveCSS('width', '320px');
    await expect(header).toHaveCSS('border-bottom-width', '1px');
    await expect(header).toHaveCSS('background-color', rgb(buttonColors[theme].secondary.background));
    await expect(header).toHaveCSS('color', rgb(buttonColors[theme].secondary.foreground));
    await expect(header).toHaveCSS('border-bottom-color', rgb(buttonColors[theme].secondary.border));
    await expect(header.locator('.header-bar__label')).toHaveText('Projects');
    await expect(header.locator('.header-bar__label')).toHaveCSS('font-weight', '700');
    const buttons = header.getByRole('button');
    if (story === 'with-buttons') {
      await expect(buttons).toHaveCount(1);
      const close = header.getByRole('button', { name: 'Close' });
      await expect(close).toBeVisible();
      await expect(close.locator('i')).toHaveClass(/fa-xmark/);
      await expect(close).toHaveCSS('margin', '0px');
      await expect(close).toHaveCSS('border-radius', '0px');
      await expect(close).toHaveCSS('background-color', rgb(buttonColors[theme].secondary.background));
      await expect(close).toHaveCSS('color', rgb(buttonColors[theme].secondary.foreground));
      await expect(close).toHaveCSS('border-top-width', '0px');
      await expect(close).toHaveCSS('border-bottom-width', '0px');
      await expect(close).toHaveCSS('border-left-width', '1px');
      await expect(close).toHaveCSS('border-right-width', '1px');
      await expect(close).toHaveCSS('border-left-color', rgb(buttonColors[theme].secondary.border));
      await expect(close).toHaveCSS('border-right-color', rgb(buttonColors[theme].secondary.border));
    } else await expect(buttons).toHaveCount(0);
  });
}
