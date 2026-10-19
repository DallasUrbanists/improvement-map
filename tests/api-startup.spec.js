import { test, expect } from '@playwright/test';

const suggestion = {
  id: 'cold-start', content: { summary: 'Make the crossing safer' },
  location: { latitude: 32.78, longitude: -96.8 },
};

test.beforeEach(async ({ page }) => {
  await page.route('**/*', route => new URL(route.request().url()).origin === 'http://localhost:5173'
    ? route.continue() : route.abort('blockedbyclient'));
  // Exercise the production API module in a fresh browser, without mounting
  // the app (which would make its own competing startup requests).
  await page.route('http://localhost:5173/', route => route.fulfill({
    contentType: 'text/html', body: '<html><body></body></html>',
  }));
  await page.route(/\/src\/services\/firebase(?:\.js)?(?:\?|$)/, route => route.fulfill({
    contentType: 'application/javascript', body: `
      const authVersion = { value: 0 };
      export function useAuth() { return {
        authVersion,
        waitForReady: async () => {
          if (!authVersion.value) {
            await new Promise(resolve => setTimeout(resolve, 50));
            authVersion.value++;
          }
        },
        getToken: async () => 'restored-user',
        getAppCheckToken: async () => {
          await new Promise(resolve => setTimeout(resolve, window.appCheckDelay || 0));
          if (window.changeIdentity) authVersion.value++;
          if (window.failAppCheck) throw new Error('App Check unavailable');
          return 'fresh-app-check';
        },
      }; }
    `,
  }));
  await page.goto('/');
});

test('first Ideas request survives cold credentials and a slow API without Retry', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/public-improvements/suggestions', async route => {
    requests++;
    expect(route.request().headers()).toMatchObject({
      authorization: 'Bearer restored-user', 'x-firebase-appcheck': 'fresh-app-check',
    });
    await new Promise(resolve => setTimeout(resolve, 2200));
    await route.fulfill({ json: { data: [suggestion] } });
  });
  const result = await page.evaluate(async () => {
    localStorage.clear();
    window.appCheckDelay = 2200;
    const { getSuggestions } = await import('/src/services/api.js');
    return getSuggestions(false, { strict: true });
  });
  expect(result).toMatchObject([suggestion]);
  expect(requests).toBe(1);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('improvement_map_cached_suggestions')).data)).toMatchObject([suggestion]);
});

test('identity changes during credential preparation still reject the request', async ({ page }) => {
  const error = await page.evaluate(async () => {
    window.changeIdentity = true;
    const { apiHeaders } = await import('/src/services/api.js');
    try { await apiHeaders(); } catch (error) { return { message: error.message, status: error.status }; }
  });
  expect(error).toEqual({ message: 'Authentication changed. Please try again.', status: 401 });
});

test('a failed initial credential lookup can be retried', async ({ page }) => {
  await page.route('**/api/public-improvements/suggestions', route => route.fulfill({ json: [suggestion] }));
  const result = await page.evaluate(async () => {
    const { getSuggestions } = await import('/src/services/api.js');
    window.failAppCheck = true;
    let message;
    try { await getSuggestions(false, { strict: true }); } catch (error) { message = error.message; }
    window.failAppCheck = false;
    return { message, items: await getSuggestions(true, { strict: true }) };
  });
  expect(result.message).toBe('App Check unavailable');
  expect(result.items).toMatchObject([suggestion]);
});
