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
    export async function apiHeaders(headers={}){return headers;}
    export async function getSuggestions(){return items;}
    export async function getSuggestionById(id){const item=items.find(item=>item.id===id);if(!item)throw new Error('Suggestion not found');return item;}
    export async function getSuggestionRepresentatives(id){
      (window.__representativeRequests ||= []).push(id);
      if(window.__representativesFail)throw Error('Representatives unavailable');
      return window.__representativesById?.[id] || [];
    }
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

test('Representatives selection loads contacts and follows idea navigation', async ({ page }) => {
  await page.addInitScript(() => {
    window.__representativesById = {
      1: [{ id: 'city-1', name: 'Avery Morgan (synthetic)', title: 'Council member', boundary: { entityName: 'Synthetic City', districtName: 'District A' }, emails: ['office@example.invalid'], phones: ['+12145550100'], webpage_url: 'https://example.invalid/office' }],
      2: [{ id: 'city-2', name: 'Jordan Ellis (synthetic)', title: 'County commissioner' }],
    };
  });
  await page.goto('/suggestion/1');
  const representatives = page.getByRole('button', { name: 'Representatives', exact: true });
  await representatives.focus();
  await page.keyboard.press('Enter');
  await expect(representatives).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('heading', { name: 'Avery Morgan (synthetic)' })).toBeVisible();
  await expect(page.getByText('Synthetic City')).toBeVisible();
  const ideaBookmark = page.locator('#bookmark');
  await expect(ideaBookmark.locator('i')).toHaveClass(/fa-regular/);
  await ideaBookmark.click();
  await expect(ideaBookmark.locator('i')).toHaveClass(/fa-solid/);
  const activeBackground = await ideaBookmark.evaluate(button => getComputedStyle(button).backgroundColor);
  await ideaBookmark.hover();
  await expect(ideaBookmark).toHaveCSS('background-color', activeBackground);
  await expect(ideaBookmark).toHaveCSS('background-image', 'none');
  await page.getByRole('button', { name: 'Save representative: Avery Morgan (synthetic)', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Unsave representative: Avery Morgan (synthetic)', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.representative-contact-menu summary').click();
  for (const theme of ['light', 'dark']) {
    await page.evaluate(async theme => { (await import('/src/services/theme.js')).applyTheme(theme); }, theme);
    const appearance = await page.locator('.representative-contact-options').evaluate(menu => ({
      background: getComputedStyle(menu).backgroundColor,
      muted: getComputedStyle(document.querySelector('.representative-jurisdiction')).color,
      title: getComputedStyle(document.querySelector('.representative-row-copy h3')).color,
    }));
    expect(appearance.background).not.toBe('rgba(0, 0, 0, 0)');
    expect(appearance.muted).not.toBe(appearance.title);
  }
  await expect(page.getByRole('link', { name: 'Email: office@example.invalid' })).toHaveAttribute('href', 'mailto:office@example.invalid');
  await expect(page.getByRole('link', { name: 'Call: +12145550100' })).toHaveAttribute('href', 'tel:+12145550100');
  await expect(page.getByRole('link', { name: 'Email: office@example.invalid' })).toHaveText('office@example.invalid');
  await expect(page.getByRole('link', { name: 'Call: +12145550100' })).toHaveText('+12145550100');
  await expect(page.getByRole('link', { name: 'Website: https://example.invalid/office' })).toHaveAttribute('href', 'https://example.invalid/office');
  await expect(page.getByRole('link', { name: 'Website: https://example.invalid/office' })).toHaveText('https://example.invalid/office');
  await page.getByRole('button', { name: 'Photos', exact: true }).click();
  await representatives.click();
  expect(await page.evaluate(() => window.__representativeRequests)).toEqual(['1']);
  await page.getByRole('button', { name: 'Previous idea', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Jordan Ellis (synthetic)' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Avery Morgan (synthetic)' })).toHaveCount(0);
  await expect(page.getByText('Contact information unavailable')).toBeVisible();
  expect(await page.evaluate(() => window.__representativeRequests)).toEqual(['1', '2']);
  await page.goto('/suggestion/1');
  await representatives.click();
  const saved = page.getByRole('button', { name: 'Unsave representative: Avery Morgan (synthetic)', exact: true });
  await expect(saved).toHaveAttribute('aria-pressed', 'true');
  await saved.click();
  await expect(page.getByRole('button', { name: 'Save representative: Avery Morgan (synthetic)', exact: true })).toHaveAttribute('aria-pressed', 'false');
});

test('Representatives selection supports retry and an empty result', async ({ page }) => {
  await page.goto('/suggestion/1');
  await page.evaluate(() => { window.__representativesFail = true; });
  await page.getByRole('button', { name: 'Representatives', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Representatives unavailable');
  await page.evaluate(() => { window.__representativesFail = false; });
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByText('No representatives found.')).toBeVisible();
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

test('one map stays mounted across list, details, and every Submit step', { tag: '@critical' }, async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?view=map');
  await page.evaluate(() => { window.__mapNode = document.querySelector('[data-testid="persistent-map"]'); });
  await mapState(page);
  await page.getByRole('button', { name: 'List', exact: true }).click();
  const list = page.getByRole('region', { name: 'Browse ideas' });
  await expect(list).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Submissions', exact: true })).toHaveCount(0);
  await page.getByText('Suggestion 1', { exact: true }).click();
  await expect(page.getByRole('region', { name: 'Idea details', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close Idea details', exact: true }).click();
  await expect(list).toBeVisible();
  await mapState(page);
  await page.getByRole('button', { name: 'Close Browse ideas', exact: true }).click();
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.getByTestId('pin-and-continue').click();
  await expect(page.getByRole('region', { name: 'Attach photos', exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Search address or neighborhood' })).toHaveAttribute('readonly', '');
  await expect(page.locator('.map-search-icon .fa-location-dot')).toBeVisible();
  await page.getByRole('button', { name: 'Skip photos', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Describe your idea', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Review submission', exact: true })).toBeVisible();
  expect((await mapState(page)).count).toBe(1);
  expect(await page.evaluate(() => window.__mapNode === document.querySelector('[data-testid="persistent-map"]'))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/view=map/);
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await expect(page.getByTestId('pin-and-continue')).toBeVisible();
  expect(errors).toEqual([]);
});





test('direct Locate initializes on map readiness and later steps lock the draft address', async ({ page }) => {
  await page.goto('/submit');
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



test('map failure and denied GPS leave the list and sort controls usable', async ({ page }) => {
  await page.addInitScript(() => { window.google.maps.Map = class { constructor() { throw new Error('Maps unavailable'); } }; });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
      getCurrentPosition: (_, reject) => reject({ code: 1, message: 'Permission denied' }),
    } });
  });
  await page.goto('/?view=list');
  await expect(page.getByRole('region', { name: 'Browse ideas' })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'map could not be loaded' })).toBeVisible();
  await page.getByRole('button', { name: 'Nearest to me' }).click();
  await expect(page.getByRole('button', { name: 'Newest', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Retry location' })).toBeVisible();
  await expect(page.getByText('Suggestion 1', { exact: true })).toBeVisible();
});

test('submission failure can retry successfully without replacing the shared map', { tag: '@critical' }, async ({ page }) => {
  await page.route(/\/src\/services\/liveLocationData(?:\.js)?(?:\?|$)/, route => route.fulfill({ contentType: 'application/javascript', body: 'export async function fetchLocationData(){return {data:{center:{lat:32.78,lon:-96.8}}};}' }));
  await page.route(/\/src\/services\/locationDiagramVersionTwo(?:\.js)?(?:\?|$)/, route => route.fulfill({ contentType: 'application/javascript', body: 'export function generateVersionTwoLocationDiagram(){return {svg:`<svg xmlns="http://www.w3.org/2000/svg"/>`};}' }));
  await page.route(/\/src\/services\/railCatalog(?:\.js)?(?:\?|$)/, route => route.fulfill({ contentType: 'application/javascript', body: 'export const railCatalog={};' }));
  await page.goto('/submit');
  await page.getByTestId('pin-and-continue').click();
  await page.getByRole('button', { name: 'Skip photos', exact: true }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByTestId('step-four-navigation').getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Submission Failed' })).toBeVisible();
  await page.evaluate(() => { window.__submissionSucceeds = true; });
  await page.getByRole('button', { name: 'Retry submission', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Submission complete!' })).toBeVisible();
  await page.getByRole('button', { name: 'View suggestion', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Idea details', exact: true })).toBeVisible();
  expect((await mapState(page)).count).toBe(1);
});



test('a fresh submission pins the current Browse location without requiring a map drag', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('improvement_map_wizard_draft_v1', JSON.stringify({ step: 1, location: { latitude: null, longitude: null, address: '' }, photos: [] })));
  await page.goto('/?view=map');
  await page.evaluate(async () => {
    const { sharedBrowseMap } = await import('/src/services/sharedBrowseMap.js');
    sharedBrowseMap.value.map.setCenter({ lat: 32.85, lng: -96.7 });
  });
  await page.getByRole('button', { name: 'New', exact: true }).click();
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
