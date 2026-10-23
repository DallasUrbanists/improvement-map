import { test, expect } from '@playwright/test';
import { buttonColors } from '../../src/design/buttonColors.js';

const rgb = hex => `rgb(${[1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16).toString(10)).join(', ')})`;

for (const [story, labels, type] of [
  ['all-icon-buttons', ['Menu', 'Search', 'Saved'], 'icon'],
  ['all-text-buttons', ['New', 'Locate', 'Browse'], 'text'],
]) {
  test(`toolbar ${type}: shared variant and button composition`, async ({ page }, info) => {
    const theme = info.project.use.colorScheme || 'light';
    const id = `bars-toolbar--${story}`;
    const query = new URLSearchParams({ id, viewMode: 'story', globals: `theme:${theme}`, args: `theme:${theme};variant:primary` });
    await page.goto(`iframe.html?${query}`);
    await expect(page.locator('html')).toHaveAttribute('data-storybook-ready', id);
    const toolbar = page.locator('#storybook-root > .toolbar');
    await expect(toolbar).toHaveCSS('width', '320px');
    const buttons = toolbar.getByRole('button');
    await expect(buttons).toHaveCount(labels.length);
    for (const [index, label] of labels.entries()) {
      const button = buttons.nth(index);
      await expect(button).toHaveAccessibleName(label);
      await expect(button).toHaveCSS('background-color', rgb(buttonColors[theme].primary.background));
      await expect(button).toHaveCSS('color', rgb(buttonColors[theme].primary.foreground));
      await expect(button).toHaveCSS('border-color', rgb(buttonColors[theme].primary.border));
      await expect(button).toHaveCSS('margin', '4px');
      if (type === 'text') await expect(button).toContainText(label);
      else await expect(button).toHaveText('');
    }
  });
}
