import { test, expect } from '@playwright/test';
import { surfaceColors } from '../../src/design/surfaceColors.js';
import { buttonColors } from '../../src/design/buttonColors.js';
import { textColors } from '../../src/design/textColors.js';
import { contrastRatio } from '../../src/design/colorMath.js';

const rgb = hex => `rgb(${[1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16)).join(', ')})`;

test('Colors documents the shared app palette and generated values', async ({ page }) => {
  await page.goto('?path=/docs/colors--docs');
  const docs = page.frameLocator('#storybook-preview-iframe');
  await expect(docs.getByRole('heading', { name: /Colors$/ })).toBeVisible();
  await expect(docs.getByText('Draft shared color reference for the whole app.', { exact: false })).toBeVisible();
  await expect(docs.getByText('Primary is yellow; Secondary is navy.', { exact: false })).toBeVisible();

  for (const [theme, surface] of Object.entries({ light: surfaceColors.light.neutral.level2, dark: surfaceColors.dark.neutral.level2 })) {
    await expect(docs.getByRole('region', { name: `${theme[0].toUpperCase()}${theme.slice(1)} theme surfaces`, exact: true }))
      .toHaveCSS('background-color', rgb(surface));
  }

  await expect(docs.getByText(/Neutral buttons inherit the surface level they occupy/)).toBeVisible();
  // The reference must publish current tokens; changing a palette shouldn't require editing this test.
  await expect(docs.getByText(new RegExp(`--button-dark-primary-default-middle: ${buttonColors.dark.primary.background}`))).toBeVisible();
  await expect(docs.getByText(new RegExp(`--button-dark-neutral-level-5-border: ${buttonColors.dark.neutralByLevel[5].border}`))).toBeVisible();
  await expect(docs.locator('.colors-neutral-row')).toHaveCount(6);
  const darkLevel4 = Number.parseInt(textColors.muted.dark.neutral.level4.slice(1, 3), 16);
  const darkLevel5 = Number.parseInt(textColors.muted.dark.neutral.level5.slice(1, 3), 16);
  expect(darkLevel5).toBeGreaterThan(darkLevel4);
  expect(contrastRatio(surfaceColors.dark.neutral.level5, textColors.muted.dark.neutral.level5)).toBeGreaterThanOrEqual(4.5);
});
