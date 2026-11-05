import { test, expect } from '@playwright/test';

for (const variant of ['neutral', 'primary', 'secondary']) {
  test(`big circle ${variant}: configurable label/icon and keyboard focus`, async ({ page }, info) => {
    const theme = info.project.use.colorScheme || 'light';
    const label = variant === 'primary' ? 'New' : 'List';
    const icon = variant === 'primary' ? 'plus' : 'list-ul';
    const id = 'buttons-big-circle-button--floating';
    const query = new URLSearchParams({ id, viewMode: 'story', globals: `theme:${theme}`, args: `theme:${theme};variant:${variant};icon:${icon};label:${label}` });
    await page.goto(`iframe.html?${query}`);
    await expect(page.locator('html')).toHaveAttribute('data-storybook-ready', id);
    const button = page.getByRole('button', { name: label, exact: true });
    await expect(page.locator('#storybook-root > button.big-circle-button')).toHaveCount(1);
    await expect(button).toHaveText(label);
    await expect(button).toHaveAttribute('title', label);
    await expect(button.locator('i')).toHaveClass(new RegExp(`fa-${icon}`));
    await button.focus();
    await expect(button).toBeFocused();
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
    await button.evaluate(element => element.focus());
    await expect(button).not.toBeFocused();
  });
}
