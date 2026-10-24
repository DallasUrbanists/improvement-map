import { test, expect } from '@playwright/test';
import { buttonColors } from '../../src/design/buttonColors.js';

const rgb = hex => `rgb(${[1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16)).join(', ')})`;

for (const variant of ['neutral', 'primary', 'secondary']) {
  test(`big circle ${variant}: dimensions, label and interaction states`, async ({ page }, info) => {
    const theme = info.project.use.colorScheme || 'light';
    const label = variant === 'primary' ? 'New' : 'List';
    const icon = variant === 'primary' ? 'plus' : 'list-ul';
    const id = 'buttons-big-circle-button--floating';
    const query = new URLSearchParams({ id, viewMode: 'story', globals: `theme:${theme}`, args: `theme:${theme};variant:${variant};icon:${icon};label:${label}` });
    await page.goto(`iframe.html?${query}`);
    await expect(page.locator('html')).toHaveAttribute('data-storybook-ready', id);
    const button = page.getByRole('button', { name: label, exact: true });
    const palette = buttonColors[theme][variant];
    await expect(page.locator('#storybook-root > button.big-circle-button')).toHaveCount(1);
    await expect(button).toHaveCSS('width', '72px');
    await expect(button).toHaveCSS('height', '72px');
    await expect(button).toHaveCSS('border-radius', '50%');
    await expect(button).toHaveCSS('margin', '4px');
    expect(await button.evaluate(element => getComputedStyle(element).boxShadow)).not.toBe('none');
    await expect(button).toHaveText(label);
    await expect(button).toHaveAttribute('title', label);
    await expect(button.locator('i')).toHaveClass(new RegExp(`fa-${icon}`));
    await expect(button).toHaveCSS('background-color', rgb(palette.background));
    await button.hover();
    await expect(button).toHaveCSS('background-color', rgb(palette.hover));
    await page.mouse.down();
    await expect(button).toHaveCSS('background-color', rgb(palette.press));
    await page.mouse.up();
    await page.mouse.move(200, 200);
    await button.focus();
    await expect(button).toHaveCSS('outline-width', '2px');
  });

  test(`big circle ${variant}: disabled action`, async ({ page }, info) => {
    const theme = info.project.use.colorScheme || 'light';
    const label = variant === 'primary' ? 'New' : 'List';
    const icon = variant === 'primary' ? 'plus' : 'list-ul';
    const id = 'buttons-big-circle-button--floating';
    const query = new URLSearchParams({ id, viewMode: 'story', globals: `theme:${theme}`, args: `theme:${theme};variant:${variant};icon:${icon};label:${label};disabled:true` });
    await page.goto(`iframe.html?${query}`);
    await expect(page.locator('html')).toHaveAttribute('data-storybook-ready', id);
    const button = page.getByRole('button', { name: label, exact: true });
    await expect(button).toBeDisabled();
    await expect(button).toHaveCSS('opacity', '0.4');
  });
}
