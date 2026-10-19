import { test, expect } from '@playwright/test';
import { installWorkspaceMaps, clustererModule } from './fixtures/workspaceMaps.js';

const items = Array.from({ length: 35 }, (_, index) => ({
  id: String(index + 1), creationDate: new Date(2026, 9, 18, 0, 0, 35 - index).toISOString(),
  content: { summary: `Suggestion ${index + 1}`, details: 'A safer crossing for people walking through the neighborhood.', photos: [] },
  author: { name: 'Test Contributor' },
  location: { latitude: 32.79 + index * .0001, longitude: -96.78, address: 'Test Street, Dallas, TX' },
}));

test.beforeEach(async ({ page }) => {
  await page.addInitScript(installWorkspaceMaps);
  await page.addInitScript(() => {
    if (!localStorage.getItem('improvement_map_wizard_draft_v1')) localStorage.setItem('improvement_map_wizard_draft_v1', JSON.stringify({ step: 1, details: 'Improve safety for people walking across the busy street.', photos: [], author: { name: 'Tester', email: 'test@example.com' }, location: { latitude: 32.78, longitude: -96.8, address: 'Draft address' } }));
  });
  await page.route(/\/node_modules\/\.vite\/deps\/@googlemaps_markerclusterer\.js/, route => route.fulfill({ contentType: 'application/javascript', body: clustererModule }));
  await page.route(/\/src\/services\/api\.js/, route => route.fulfill({ contentType: 'application/javascript', body: `
    const items=${JSON.stringify(items)};
    export const API_BASE_URL='https://api.test';
    export async function getSuggestions(){return items;}
    export async function getSuggestionById(id){const item=items.find(item=>item.id===id);if(!item)throw new Error('Suggestion not found');return item;}
    export async function getSuggestionRepresentatives(){return [];}
    export async function getSuggestionBoundaries(){return [];}
    export async function getSuggestionRecommendedActions(){return [];}
    export async function matchSuggestionRecommendations(){return [];}
    export async function requestPhotoUploadUrl(){return {uploadUrl:'https://uploads.test/file',publicUrl:'https://cdn.test/file'};}
    export async function uploadPhotoBinary(){}
    export async function createSuggestion(payload){window.__submittedPayload=payload;if(window.__submissionSucceeds)return items[0];throw new Error('Test submission failure');}
    export async function fixGrammarAndSpelling(text){return text;}
    export async function improveClarityAndStructure(text){return text;}
    export async function generateSuggestionSummary(){return 'Crossing improvement';}
  ` }));
  await page.route(/overpass|__overpass/, route => route.fulfill({ headers: { 'access-control-allow-origin': '*' }, json: { elements: [] } }));
});

const mapDocuments = new WeakMap();
async function mapState(page) {
  let state;
  await expect.poll(async () => {
    state = await page.evaluate(async () => {
      const { sharedBrowseMap } = await import('/src/services/sharedBrowseMap.js');
      if (!sharedBrowseMap.value) return null;
      const map = sharedBrowseMap.value.map;
      window.__observedMap ||= map;
      window.__mapDocument ||= crypto.randomUUID();
      return { document: window.__mapDocument, sameMap: window.__observedMap === map, count: window.__mapConstructions, center: map.getCenter().toJSON(), zoom: map.getZoom(), type: map.getMapTypeId(), gestures: map.get('gestureHandling') };
    });
    return state !== null;
  }).toBe(true);
  expect(state.sameMap).toBe(true);
  if (mapDocuments.has(page)) expect(state.document).toBe(mapDocuments.get(page));
  else mapDocuments.set(page, state.document);
  return state;
}

test('one map stays mounted across list, details, and every Submit step', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?view=map');
  await page.locator('.map-zoom-ui').waitFor();
  await page.evaluate(() => { window.__mapNode = document.querySelector('[data-testid="persistent-map"]'); });
  const before = await mapState(page);
  await page.getByRole('button', { name: 'Browse', exact: true }).click();
  const list = page.getByRole('region', { name: 'Browse ideas' });
  await expect(list).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Submissions', exact: true })).toHaveCount(0);
  await expect(page.locator('.map-zoom-ui')).toBeHidden();
  await page.getByText('Suggestion 1', { exact: true }).click();
  await expect(page.getByRole('region', { name: 'Suggestion 1', exact: true })).toBeVisible();
  expect((await mapState(page)).center).toEqual({ lat: 32.79, lng: -96.78 });
  await page.getByRole('button', { name: 'Close Suggestion 1', exact: true }).click();
  await expect(list).toBeVisible();
  expect((await mapState(page)).center).toEqual(before.center);
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  await page.getByTestId('pin-and-continue').click();
  await expect(page.getByRole('region', { name: 'Attach photos', exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Search address or neighborhood' })).toHaveAttribute('readonly', '');
  await expect(page.locator('.map-search-panel .fa-location-dot')).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Describe your idea', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Review submission', exact: true })).toBeVisible();
  expect((await mapState(page)).count).toBe(1);
  expect(await page.evaluate(() => window.__mapNode === document.querySelector('[data-testid="persistent-map"]'))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/view=map/);
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Review submission', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('tray bounds, scrolling, search, sorting and map mode preserve Browse context', async ({ page }) => {
  await page.goto('/?view=list');
  const tray = page.getByRole('region', { name: 'Browse ideas' });
  await expect(tray).toBeVisible();
  await page.waitForTimeout(400);
  const box = await tray.boundingBox();
  const viewport = page.viewportSize();
  expect(box.x).toBe(12); expect(box.y).toBe(72);
  expect(box.width).toBe(viewport.width - 24); expect(box.height).toBe(viewport.height - 160);
  await tray.locator('.map-tray-content').evaluate(element => { element.scrollTop = 180; });
  await page.getByRole('button', { name: 'Search address or neighborhood', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search address or neighborhood' }).fill('Main');
  await page.getByRole('button', { name: 'Searched address, Dallas, TX' }).click();
  await expect(tray).toBeVisible();
  expect((await mapState(page)).center).toEqual({ lat: 32.81, lng: -96.76 });
  expect((await mapState(page)).gestures).toBe('none');
  expect(await tray.locator('.map-tray-content').evaluate(element => element.scrollTop)).toBe(180);
  const type = (await mapState(page)).type;
  await page.getByRole('button', { name: /Show .* map/ }).click();
  await expect(page).toHaveURL(/view=map/);
  await expect(tray).toBeHidden();
  expect((await mapState(page)).type).toBe(type);
  expect((await mapState(page)).gestures).toBe('greedy');
  await page.getByRole('button', { name: /Switch to .* view/ }).click();
  expect((await mapState(page)).type).not.toBe(type);
  await page.goBack();
  await expect(tray).toBeVisible();
});

test('direct details, errors, menu and read-only drafts work without another map', async ({ page }) => {
  await page.goto('/suggestion/2');
  await expect(page.getByRole('region', { name: 'Suggestion 2', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Show on map', exact: true }).click();
  await expect(page).toHaveURL(/view=map/);
  expect((await mapState(page)).center).toEqual({ lat: 32.7901, lng: -96.78 });
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'Light theme', exact: true }).click();
  await expect(page.locator('html')).toHaveClass(/light/);
  await page.evaluate(() => document.querySelector('#app').__vue_app__.config.globalProperties.$router.push('/suggestion/missing'));
  await expect(page.getByRole('heading', { name: 'Idea unavailable' })).toBeVisible();
  await page.getByRole('button', { name: 'Close Idea details' }).click();
  expect((await mapState(page)).count).toBe(1);
});

test('direct Locate initializes on map readiness and later steps lock the draft address', async ({ page }) => {
  await page.goto('/submit');
  await page.locator('.map-zoom-ui').waitFor();
  await page.evaluate(async () => {
    const { sharedBrowseMap } = await import('/src/services/sharedBrowseMap.js');
    sharedBrowseMap.value.map.setCenter({ lat: 32.82, lng: -96.74 });
  });
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('improvement_map_wizard_draft_v1')).location.latitude)).toBe(32.82);
  await page.getByTestId('pin-and-continue').click();
  await expect(page.getByRole('region', { name: 'Attach photos', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Center on my location' })).toBeDisabled();
  const location = await page.evaluate(() => JSON.parse(localStorage.getItem('improvement_map_wizard_draft_v1')).location);
  await page.evaluate(async () => {
    const { sharedBrowseMap } = await import('/src/services/sharedBrowseMap.js');
    sharedBrowseMap.value.map.setCenter({ lat: 33, lng: -97 });
  });
  await page.waitForTimeout(50);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('improvement_map_wizard_draft_v1')).location)).toEqual(location);
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Menu', exact: true })).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('region', { name: 'Attach photos', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('region', { name: 'Attach photos', exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Search address or neighborhood' })).toHaveValue(location.address);
  expect((await mapState(page)).count).toBe(1);
});

test('tray dismissal, browser history and saved list scrolling remain consistent', async ({ page }) => {
  await page.goto('/?view=map');
  await page.getByRole('button', { name: 'Browse', exact: true }).click();
  const tray = page.getByRole('region', { name: 'Browse ideas' });
  await expect(tray).toBeVisible();
  await tray.locator('.map-tray-content').evaluate(element => { element.scrollTop = 180; });
  await page.getByText('Suggestion 8', { exact: true }).click();
  await expect(page.getByRole('region', { name: 'Suggestion 8', exact: true })).toBeVisible();
  const saved = await page.evaluate(() => Number(localStorage.getItem('improvement_map_browse_list_scroll')));
  await page.goBack();
  await expect(tray).toBeVisible();
  await expect.poll(() => tray.locator('.map-tray-content').evaluate(element => element.scrollTop)).toBe(saved);
  await page.getByRole('button', { name: 'Browse', exact: true }).click();
  await expect(tray).toBeHidden();
  await page.goBack(); await expect(tray).toBeVisible();
  await page.keyboard.press('Escape'); await expect(tray).toBeHidden();
  await page.getByRole('button', { name: 'Browse', exact: true }).click();
  await page.getByRole('button', { name: 'Close Browse ideas' }).click();
  await expect(tray).toBeHidden();
});

test('map failure and denied GPS leave the list and sort controls usable', async ({ page }) => {
  await page.addInitScript(() => { window.google.maps.Map = class { constructor() { throw new Error('Maps unavailable'); } }; });
  await page.goto('/?view=list');
  await expect(page.getByRole('region', { name: 'Browse ideas' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('map could not be loaded');
  await page.getByRole('button', { name: 'Nearest to me' }).click();
  await expect(page.getByRole('button', { name: 'Nearest to me' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Suggestion 1', { exact: true })).toBeVisible();
});

test('submission failure can retry successfully without replacing the shared map', async ({ page }) => {
  await page.route(/\/src\/services\/liveLocationData(?:\.js)?(?:\?|$)/, route => route.fulfill({ contentType: 'application/javascript', body: 'export async function fetchLocationData(){return {data:{center:{lat:32.78,lon:-96.8}}};}' }));
  await page.route(/\/src\/services\/locationDiagramVersionTwo(?:\.js)?(?:\?|$)/, route => route.fulfill({ contentType: 'application/javascript', body: 'export function generateVersionTwoLocationDiagram(){return {svg:`<svg xmlns="http://www.w3.org/2000/svg"/>`};}' }));
  await page.route(/\/src\/services\/railCatalog(?:\.js)?(?:\?|$)/, route => route.fulfill({ contentType: 'application/javascript', body: 'export const railCatalog={};' }));
  await page.goto('/submit');
  await page.getByTestId('pin-and-continue').click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByTestId('step-four-navigation').getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Submission Failed' })).toBeVisible();
  await page.evaluate(() => { window.__submissionSucceeds = true; });
  await page.getByRole('button', { name: 'Retry submission', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Submission complete!' })).toBeVisible();
  await page.getByRole('button', { name: 'View suggestion', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Suggestion 1', exact: true })).toBeVisible();
  expect((await mapState(page)).count).toBe(1);
});

test('keyboard focus returns to the opening card and reduced motion disables tray animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?view=map');
  await page.getByRole('button', { name: 'Browse', exact: true }).click();
  const tray = page.getByRole('region', { name: 'Browse ideas' });
  await expect(tray).toBeVisible();
  const card = page.locator('[data-suggestion-id="1"]');
  await card.focus();
  await card.press('Enter');
  await expect(page.getByRole('region', { name: 'Suggestion 1', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(card).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(tray).toBeHidden();
  await expect(page.getByRole('button', { name: 'Browse', exact: true })).toBeFocused();
});

test('a fresh submission pins the current Browse location without requiring a map drag', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('improvement_map_wizard_draft_v1', JSON.stringify({ step: 1, location: { latitude: null, longitude: null, address: '' }, photos: [] })));
  await page.goto('/?view=map');
  await page.locator('.map-zoom-ui').waitFor();
  await page.evaluate(async () => {
    const { sharedBrowseMap } = await import('/src/services/sharedBrowseMap.js');
    sharedBrowseMap.value.map.setCenter({ lat: 32.85, lng: -96.7 });
  });
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('improvement_map_wizard_draft_v1')).location.latitude)).toBe(32.85);
  await page.getByTestId('pin-and-continue').click();
  await expect(page.getByRole('textbox', { name: 'Search address or neighborhood' })).toHaveValue('Selected address, Dallas, TX');
});

test('the diagram proof of concept stays outside the map workspace', async ({ page }) => {
  await page.goto('/test');
  await expect(page).toHaveTitle('Location Diagram Test | Improvement Map');
  await expect(page.locator('.map-workspace')).toHaveCount(0);
  expect(await page.evaluate(() => window.__mapConstructions)).toBe(0);
});
