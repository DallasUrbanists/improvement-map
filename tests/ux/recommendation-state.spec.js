import { test, expect } from './fixture.js';
import AxeBuilder from '@axe-core/playwright';
const key = 'improvement_map_actions_v1';
const action = { id: 'catalog', summary: 'Attend a meeting', instructions: 'Share your idea.', why: 'Help the neighborhood.' };
test('real API adapter validates matches, handles HTTP failures, timeout and cancellation', async ({ page }) => {
  await page.goto('/');
  await page.unroute(/\/src\/services\/api(?:\.js)?(?:\?|$)/);
  const results = await page.evaluate(async () => {
    const api = await import('/src/services/api.js?contract-test');
    const originalFetch = window.fetch, originalTimeout = window.setTimeout;
    const outcomes = {};
    try {
      window.fetch = async (url, options) => {
        outcomes.request = { url, method: options.method, body: JSON.parse(options.body) };
        return new Response(JSON.stringify({ data: [{ id: 'accepted' }], eligibleActions: [{ id: 'rejected' }] }));
      };
      outcomes.matches = await api.matchSuggestionRecommendations({ text: 'A safer crossing', latitude: 32.78, longitude: -96.8 });
      window.fetch = async () => new Response(JSON.stringify({ data: {} }));
      try { await api.matchSuggestionRecommendations({ text: 'test' }); } catch (e) { outcomes.malformed = e.message; }
      window.fetch = async () => new Response(JSON.stringify({ message: 'Unavailable' }), { status: 503 });
      try { await api.matchSuggestionRecommendations({ text: 'test' }); } catch (e) { outcomes.http = e.message; }
      window.fetch = async (_, { signal }) => new Promise((resolve, reject) => {
        if (signal.aborted) reject(new DOMException('Aborted', 'AbortError'));
        else signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
      });
      const controller = new AbortController();
      const pending = api.matchSuggestionRecommendations({ text: 'test' }, { signal: controller.signal });
      controller.abort();
      try { await pending; } catch (e) { outcomes.cancel = e.name; }
      window.setTimeout = (callback, ms) => { outcomes.timeoutMs = ms; return originalTimeout(callback, 0); };
      try { await api.matchSuggestionRecommendations({ text: 'test' }); } catch (e) { outcomes.timeout = e.message; }
    } finally { window.fetch = originalFetch; window.setTimeout = originalTimeout; }
    return outcomes;
  });
  expect(results.request.method).toBe('POST');
  expect(results.request.url).toContain('/api/recommendables/match');
  expect(results.request.body).toMatchObject({ text: 'A safer crossing', latitude: 32.78, longitude: -96.8 });
  expect(results.matches).toEqual([{ id: 'accepted' }]);
  expect(results.malformed).toContain('not a list');
  expect(results.http).toBe('Unavailable');
  expect(results.cancel).toBe('AbortError');
  expect(results.timeoutMs).toBe(120000);
  expect(results.timeout).toContain('timed out');
});
async function open(page) {
  await page.goto('/suggestion/1');
  await expect(page.locator('.submission-detail-tray')).toHaveAttribute('aria-busy', 'false');
  await page.getByRole('button', { name: 'Recommended Actions', exact: true }).click();
  await expect(page.locator('.recommended-actions-content')).toBeVisible();
}
test('no-match, double click, and navigation discard a late generation', async ({ page }) => {
  await open(page);
  await page.evaluate(() => { window.__ux.delay = 400; });
  await page.getByRole('button', { name: 'Find actions' }).click();
  await expect(page.getByRole('button', { name: 'Generating…' })).toBeDisabled();
  await expect(page.getByText('No matching actions found.')).toBeVisible();
  expect(await page.evaluate(() => window.__ux.matches)).toBe(1);
  await page.evaluate(a => { window.__ux.generated = [a]; window.__ux.delay = 1500; }, action);
  await page.getByRole('button', { name: 'Find actions' }).click();
  await page.getByRole('link', { name: 'My actions (0)' }).click();
  await page.waitForTimeout(1700);
  expect(await page.evaluate(k => Object.values(JSON.parse(localStorage.getItem(k)).generated)[0].actions, key)).toEqual([]);
});
test('malformed storage is reported and preserved', async ({ page }) => {
  await page.addInitScript(k => { localStorage.setItem(k, '{broken'); window.__ux.actions = [{ id: 'a', summary: 'An action' }]; }, key);
  await open(page);
  await expect(page.getByRole('alert').filter({ hasText: 'Saved action data' })).toContainText('could not be read');
  await page.getByRole('button', { name: 'Add to My actions', exact: true }).click();
  expect(await page.evaluate(k => localStorage.getItem(k), key)).toBe('{broken');
  await expect(page.getByRole('link', { name: 'My actions (0)' })).toBeVisible();
});
test('changed generation input invalidates cache and preserves saved snapshots', async ({ page }) => {
  await page.addInitScript(a => { window.__ux.generated = [a]; }, action);
  await open(page);
  await page.getByRole('button', { name: 'Find actions' }).click();
  await page.getByRole('button', { name: 'Add to My actions', exact: true }).click();
  await page.evaluate(() => { window.__ux.details = 'A completely different suggestion description.'; });
  await page.getByRole('button', { name: 'Refresh idea', exact: true }).click();
  await expect(page.locator('.submission-detail-tray')).toHaveAttribute('aria-busy', 'false');
  await page.getByRole('button', { name: 'Recommended Actions', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Find actions' })).toBeVisible();
  await page.getByRole('link', { name: 'My actions (1)' }).click();
  await expect(page.getByRole('heading', { name: action.summary })).toBeVisible();
});
test('another tab updates saves and hiding without affecting other suggestions', async ({ page, context }) => {
  await page.addInitScript(a => { window.__ux.actions = [a]; }, action);
  await open(page);
  await page.getByRole('button', { name: 'Add to My actions', exact: true }).click();
  const other = await context.newPage();
  await other.goto('/');
  await other.evaluate(k => {
    const data = JSON.parse(localStorage.getItem(k));
    const actionKey = Object.keys(data.saved)[0];
    data.hidden[actionKey] = true; data.saved = {};
    localStorage.setItem(k, JSON.stringify(data));
  }, key);
  await expect(page.getByRole('link', { name: 'My actions (0)' })).toBeVisible();
  await expect(page.getByText('All recommendations are hidden.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Next idea', exact: true }).click();
  await expect(page.locator('.submission-detail-tray')).toHaveAttribute('aria-busy', 'false');
  await page.getByRole('button', { name: 'Recommended Actions', exact: true }).click();
  await expect(page.getByRole('heading', { name: action.summary })).toBeVisible();
  await other.close();
});
test('details and My actions have no new accessibility violations', async ({ page }, info) => {
  await page.addInitScript(a => { window.__ux.actions = [a]; }, action);
  await open(page);
  await expect(page.getByRole('heading', { name: action.summary })).toBeVisible();
  const detail = await new AxeBuilder({ page }).include('.actions-panel').analyze();
  expect(detail.violations).toEqual([]);
  await page.getByRole('button', { name: 'Add to My actions', exact: true }).click();
  await page.getByRole('link', { name: 'My actions (1)' }).click();
  const saved = await new AxeBuilder({ page }).include('.actions-panel').analyze();
  expect(saved.violations).toEqual([]);
  await page.screenshot({ path: info.outputPath('my-actions.png') });
});
test('menu opens My actions and direct-entry close returns to Browse', async ({ page }) => {
  await page.goto('/my-actions');
  await page.getByRole('button', { name: 'Close My actions', exact: true }).click();
  await expect(page).toHaveURL(/\/browse$/);
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('menuitem', { name: 'My actions', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'My actions', exact: true })).toBeVisible();
});
