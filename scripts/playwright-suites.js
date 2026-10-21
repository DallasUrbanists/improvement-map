import { createRequire } from 'node:module';
import { readdirSync, readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const lock = require('../package-lock.json');
const playwrightVersions = Object.entries(lock.packages)
  .filter(([name]) => name === 'node_modules/@playwright/test' || name === 'node_modules/playwright' || name === 'node_modules/playwright-core')
  .map(([, entry]) => entry.version);
if (!playwrightVersions.length || new Set(playwrightVersions).size !== 1) {
  throw new Error(`Playwright package versions must match in package-lock.json: ${playwrightVersions.join(', ') || 'none found'}`);
}

const ux = (id, files, roots, states = []) => ({ id, kind: 'ux', files: files.map(file => `tests/ux/${file}`), roots, profiles: ['android', 'iphone'], states });
const browseStates = ['browse-map', 'browse-list', 'details', 'photo-preview', 'photo-second', 'search-results', 'settings-menu', 'marker-settings', 'marker-settings-rotated', 'rail-settings', 'theme-switched'];
const submitStates = ['submit-locate', 'submit-photos-empty', 'submit-photo-added', 'description-invalid', 'description-long', 'submit-review', 'draft-restored', 'submit-reopened-at-locate', 'review-invalid', 'submission-loading', 'submission-error', 'submission-success'];
const recoveryStates = ['browse-empty', 'location-denied', 'enlarged-text', 'detail-error'];
const presentationStates = ['presentation-tv-setup', 'presentation-remote-pairing', 'presentation-audience-join', 'presentation-audience-landscape', 'presentation-audience-narrow'];
const unitRoots = readdirSync(new URL('../tests/', import.meta.url), { withFileTypes: true })
  .filter(entry => entry.isFile() && entry.name.endsWith('.spec.js'))
  .map(entry => `tests/${entry.name}`)
  .filter(file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').includes('@unit'));

export const suites = [
  ux('ux-browse', ['browse-journey.spec.js', 'recovery-journey.spec.js', 'announcements.spec.js', 'visual.spec.js', 'guardrails.spec.js'], ['src/views/BrowseView.vue', 'src/components/MapToolbar.vue', 'src/components/MapSearchOverlay.vue', 'src/services/theme.js', 'src/services/announcements.js'], [...browseStates, ...recoveryStates]),
  ux('ux-submit', ['submit-journey.spec.js'], ['src/views/SubmitView.vue'], submitStates),
  ux('ux-saved', ['bookmarks.spec.js', 'mobile-panels.spec.js'], ['src/views/BookmarksView.vue', 'src/views/MyActionsView.vue', 'src/components/BookmarkButton.vue', 'src/services/bookmarks.js', 'src/services/localActions.js'], ['idea-list-360', 'idea-list-412', 'idea-list-880', 'idea-detail-bookmark-320']),
  ux('ux-navigation', ['idea-navigation.spec.js', 'detail-navigation.spec.js'], ['src/router/index.js', 'src/views/BrowseView.vue', 'src/views/SubmissionDetailView.vue']),
  ux('ux-motion', ['detail-close.spec.js', 'detail-map-settling.spec.js', 'detail-typewriter.spec.js'], ['src/views/SubmissionDetailView.vue', 'src/components/MapTray.vue', 'src/components/DetailSheet.vue']),
  ux('ux-content', ['detail-reading.spec.js', 'detail-tray.spec.js', 'detail-photos.spec.js'], ['src/views/SubmissionDetailView.vue', 'src/components/DetailSheet.vue', 'src/components/PhotoGrid.vue', 'src/components/PhotoSlider.vue']),
  ux('ux-actions', ['recommended-actions.spec.js', 'recommendation-state.spec.js'], ['src/components/RecommendedActions.vue', 'src/components/ActionCard.vue', 'src/services/localActions.js', 'src/services/api.js']),
  ux('ux-streetmix', ['streetmix.spec.js'], ['src/components/StreetmixPanel.vue', 'src/components/StreetmixRoadMap.vue', 'src/services/streetmix.js', 'src/services/useStreetmix.js']),
  ux('ux-presentation', ['presentation.spec.js'], ['src/App.vue', 'src/router/index.js', 'src/presentation.css', 'src/services/presentationSession.js', 'src/services/presentationApi.js', 'src/views/PresentationTVView.vue', 'src/views/PresentationRemoteShell.vue', 'src/views/PresentationRemoteController.vue', 'src/views/PresentationRemoteIdeas.vue', 'src/views/PresentationRemoteStyles.vue', 'src/views/PresentationRemoteAudience.vue', 'src/views/PresentationAudienceView.vue'], presentationStates),
  { id: 'regression-app', kind: 'regression', files: ['tests/announcements.spec.js', 'tests/api-startup.spec.js', 'tests/e2e.spec.js', 'tests/mapWorkspace.spec.js', 'tests/workspaceNavigation.spec.js', 'tests/photoViews.spec.js', 'tests/speechRecognition.spec.js', 'tests/suggestionDensity.spec.js', 'tests/presentation.spec.js'], roots: ['src/views/SubmitView.vue', 'src/views/BrowseView.vue', 'src/views/BookmarksView.vue', 'src/views/MyActionsView.vue', 'src/views/SubmissionDetailView.vue', 'src/services/speechRecognition.js', 'src/services/presentationSession.js', 'src/services/presentationApi.js', 'tests/fixtures/presentationServer.js'], profiles: ['regression'], states: [] },
  { id: 'regression-diagrams', kind: 'regression', files: ['tests/customDiagram.spec.js', 'tests/locationDiagram.spec.js', 'tests/streetLabels.spec.js', 'tests/transitStops.spec.js'], roots: ['src/views/TestDiagramView.vue', 'src/services/locationDiagram.js', 'src/services/locationDiagramVersionTwo.js', 'src/services/streetLabels.js', 'src/services/transitStops.js'], profiles: ['regression'], states: [] },
  { id: 'unit', kind: 'unit', files: [], roots: unitRoots, profiles: ['unit'], states: [] },
];

export const routineProfiles = {
  android: ['android-light', 'android-dark'],
  iphone: ['iphone-light', 'iphone-dark'],
};
export const fullProfiles = {
  ...routineProfiles,
  narrow: ['narrow-light', 'narrow-dark'],
  landscape: ['landscape-light', 'landscape-dark'],
  desktop: ['desktop-light', 'desktop-dark'],
};
export const playwrightVersion = playwrightVersions[0];
export const playwrightImage = `mcr.microsoft.com/playwright:v${playwrightVersion}-noble`;
export const allSuiteIds = suites.map(({ id }) => id);
export const uxSuiteIds = suites.filter(({ kind }) => kind === 'ux').map(({ id }) => id);
export const browserSuiteIds = suites.filter(({ kind }) => kind !== 'unit').map(({ id }) => id);
export const suiteById = Object.fromEntries(suites.map(suite => [suite.id, suite]));

export function filesForSuite(id) {
  const suite = suiteById[id];
  if (!suite) throw new Error(`Unknown Playwright suite "${id}". Choose: ${allSuiteIds.join(', ')}`);
  return suite.files;
}
