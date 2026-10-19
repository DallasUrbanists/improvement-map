import { test as base, expect } from '@playwright/test';
import { installWorkspaceMaps, clustererModule } from '../fixtures/workspaceMaps.js';

export const photo = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#315d45"/><path d="M0 220L400 80" stroke="white" stroke-width="35"/></svg>').toString('base64');
export const draftKey = 'improvement_map_wizard_draft_v1';
export const draft = { step: 1, details: 'Improve safety for people walking across this busy street.', photos: [], author: { name: 'Test Contributor', email: 'test@example.com' }, location: { latitude: 32.78, longitude: -96.8, address: 'Elm Street, Dallas, TX' } };
export const items = Array.from({ length: 20 }, (_, i) => ({
  id: String(i + 1), creationDate: '2026-10-01T12:00:00Z',
  content: { summary: `Suggestion ${i + 1}`, details: 'A safer crossing for everyone. '.repeat(12), photos: [1, 2].map(n => ({ id: `photo-${n}`, dataUrl: photo, caption: `Crossing photo ${n}` })) },
  author: { name: 'Test Contributor' }, location: { latitude: 32.78 + i * .001, longitude: -96.8, address: 'Elm Street, Dallas, TX' },
}));

export const test = base.extend({
  page: async ({ page, context, baseURL }, use) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.setFixedTime(new Date('2026-10-19T12:00:00Z'));
    // Context-level deny-by-default firewall also covers popups. Service workers
    // are disabled in the config so they cannot bypass request interception.
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin === new URL(baseURL).origin && ['GET', 'HEAD'].includes(route.request().method()) && !url.pathname.startsWith('/api/') && !url.pathname.startsWith('/__overpass')) return route.continue();
      return route.abort('blockedbyclient');
    });
    await page.addInitScript(installWorkspaceMaps);
    await page.addInitScript(({ key, value }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(value));
      window.__ux = { delay: 0, empty: false, fail: false, uploadFail: false, submits: 0 };
      Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
        getCurrentPosition: (_, reject) => reject?.({ code: 1, message: 'Permission denied' }),
        watchPosition: () => 0, clearWatch() {},
      } });
    }, { key: draftKey, value: draft });
    await page.route(/\/node_modules\/\.vite\/deps\/@googlemaps_markerclusterer\.js/, route => route.fulfill({ contentType: 'application/javascript', body: clustererModule }));
    await page.route(/\/src\/services\/api(?:\.js)?(?:\?|$)/, route => route.fulfill({ contentType: 'application/javascript', body: `
      const items=${JSON.stringify(items)};
      const wait=async()=>{while(window.__ux.hold)await new Promise(resolve=>setTimeout(resolve,20));await new Promise(resolve=>setTimeout(resolve,window.__ux.delay));};
      export const API_BASE_URL='https://api.test';
      export async function apiHeaders(headers={}) { return headers; }
      export async function getSuggestions(){await wait();if(window.__ux.listFail)throw Error('List unavailable');return window.__ux.empty?[]:(window.__ux.items || items);}
      export async function getSuggestionById(id){await wait();const item=items.find(x=>x.id===id);if(!item)throw Error('Suggestion not found');return {...item,...(window.__ux.author ? {author:window.__ux.author}:{}),content:{...item.content,...(window.__ux.photos ? {photos:window.__ux.photos}:{}),...(window.__ux.details !== undefined ? {details:window.__ux.details}:{})}};}
      export async function getSuggestionRepresentatives(){return [];}
      export async function getSuggestionBoundaries(){return [];}
      export async function getSuggestionRecommendedActions(){await wait();if(window.__ux.actionsFail)throw Error("Unable to load actions");return window.__ux.actions || [];}
      export async function matchSuggestionRecommendations(){window.__ux.matches=(window.__ux.matches||0)+1;await wait();if(window.__ux.matchFail)throw Error("Matching failed");return window.__ux.generated || [];}
      export async function requestPhotoUploadUrl(){return {uploadUrl:'https://uploads.test/photo',publicUrl:${JSON.stringify(photo)}};}
      export async function uploadPhotoBinary(){await wait();if(window.__ux.uploadFail)throw Error('Test upload failure');}
      export async function createSuggestion(payload){await wait();window.__ux.submits++;if(window.__ux.fail)throw Error('Test submission failure');window.__submittedPayload=payload;return items[0];}
      export async function fixGrammarAndSpelling(text){return text;}
      export async function improveClarityAndStructure(text){return text;}
      export async function generateSuggestionSummary(){return 'Improve the crossing';}
    ` }));
    await page.route(/\/src\/services\/liveLocationData(?:\.js)?(?:\?|$)/, route => route.fulfill({ contentType: 'application/javascript', body: 'export async function fetchLocationData(){return {data:{center:{lat:32.78,lon:-96.8}}};}' }));
    await page.route(/\/src\/services\/locationDiagramVersionTwo(?:\.js)?(?:\?|$)/, route => route.fulfill({ contentType: 'application/javascript', body: 'export function generateVersionTwoLocationDiagram(){return {svg:`<svg xmlns="http://www.w3.org/2000/svg"/>`};}' }));
    await use(page);
    expect(errors, 'Uncaught browser errors').toEqual([]);
  },
});
export { expect };
