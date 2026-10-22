import { test, expect } from '@playwright/test';
import {
  DEFAULT_PHOTO_FRAME, applyControllerChanges, clampPhotoFrame, createAudienceView,
  createDefaultPresentationState, createEnrollmentIdentity, effectiveCaptionVisible,
  formatPresentationCode, isStreetmixItem, normalizePresentationCode,
  reduceAudienceView, shouldFollowPresenter, toWritablePresentationState,
  validatePresentationIdea, validatePresentationState,
} from '../src/services/presentationState.js';
import { presentationQrSvg } from '../src/services/presentationQr.js';

const idea = {
  id: '202', contentVersion: 'v1', creationDate: '2026-10-21T12:00:00Z', status: 'open',
  summary: 'Protected bike lane', details: 'Connect the path.', descriptionPages: ['First page', '🚲 Second page'],
  location: { latitude: 32.78, longitude: -96.8, address: 'Main Street, Dallas' },
  album: [
    { id: 'photo-1', kind: 'photo', url: 'https://images.example/photo.png', caption: 'A photo' },
    { id: 'streetmix-1', kind: 'streetmix', url: 'https://streetmix.net/-/24680', streetmixId: '24680', thumbnailPath: '/api/public-improvements/presentation/sessions/1/ideas/202/streetmix-thumbnail', stale: false },
  ],
};

test('canonical state validates protocol bounds and excludes server fields from writes @unit', () => {
  const state = createDefaultPresentationState();
  expect(validatePresentationState(state)).toBe(true);
  expect(validatePresentationState({ ...state, camera: { ...state.camera, latitude: 90 } })).toBe(false);
  expect(validatePresentationState({ ...state, photoFrame: { scale: 5, centerX: 0.5, centerY: 0.5 } })).toBe(false);
  expect(validatePresentationState({ ...state, mode: 'video' })).toBe(false);
  expect(validatePresentationState({ ...state, mode: 'photo' })).toBe(false);
  expect(toWritablePresentationState(state)).not.toHaveProperty('revision');
  expect(toWritablePresentationState(state)).not.toHaveProperty('ideaEpoch');
});

test('admission codes normalize separately and enrollment credentials use secure random bytes @unit', () => {
  expect(normalizePresentationCode('01234')).toBe('01234');
  expect(formatPresentationCode('01234')).toBe('01234');
  expect(normalizePresentationCode('1234')).toBe('');
  expect(normalizePresentationCode('012345')).toBe('');
  expect(normalizePresentationCode('ABCD2345')).toBe('');
  expect(normalizePresentationCode('012-34')).toBe('');
  expect(normalizePresentationCode(12345)).toBe('');
  const identity = createEnrollmentIdentity();
  expect(identity.participantId).toMatch(/^[0-9a-f-]{36}$/i);
  expect(identity.participantToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(identity.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/i);
});

test('idea and album validators require a final canonical Streetmix item @unit', () => {
  expect(validatePresentationIdea(idea)).toBe(true);
  expect(validatePresentationIdea({ ...idea, album: [idea.album[1], idea.album[0]] })).toBe(false);
  expect(validatePresentationIdea({ ...idea, album: [{ ...idea.album[1], url: 'https://streetmix.net/-/24680?token=x' }] })).toBe(false);
  expect(isStreetmixItem(idea.album[1])).toBe(true);
  expect(effectiveCaptionVisible({ captionVisible: true }, idea.album[1])).toBe(false);
  expect(clampPhotoFrame({ scale: 12, centerX: -1, centerY: 2 })).toEqual({ scale: 4, centerX: 0, centerY: 1 });
  expect(DEFAULT_PHOTO_FRAME).toEqual({ scale: 1, centerX: 0.5, centerY: 0.5 });
});

test('audience reducers keep independent tabs, pages, and framing while following remains semantic @unit', () => {
  const shared = createDefaultPresentationState({ selectedIdeaId: '202', ideaEpoch: 3, mode: 'photo', albumItemId: 'photo-1' });
  const a = createAudienceView(shared, idea);
  const b = createAudienceView(shared, idea);
  const aPhoto = reduceAudienceView(a, { type: 'photoFrame', frame: { scale: 2, centerX: 0.7, centerY: 0.4 } }, shared, idea);
  const bDescription = reduceAudienceView(b, { type: 'tab', mode: 'description' }, shared, idea);
  const bPage = reduceAudienceView(bDescription, { type: 'descriptionPage', page: 1 }, shared, idea);
  expect(aPhoto.photoDetached).toBe(true);
  expect(bPage.mode).toBe('description');
  expect(bPage.descriptionPage).toBe(1);
  expect(a.photoDetached).toBe(false);
  expect(b.descriptionPage).toBe(0);
  expect(shouldFollowPresenter({ ...aPhoto, photoDetached: false }, { ...shared, mode: 'photo' }, true)).toBe(true);
  expect(shouldFollowPresenter({ ...aPhoto, photoDetached: true }, { ...shared, mode: 'photo' }, true)).toBe(false);
  const nextIdea = reduceAudienceView(bPage, { type: 'newIdea' }, { ...shared, ideaEpoch: 4, selectedIdeaId: '101', camera: { latitude: 33, longitude: -97, zoom: 16 } }, { ...idea, id: '101', album: [] });
  expect(nextIdea.mode).toBe('description');
  expect(nextIdea.descriptionPage).toBe(0);
  expect(nextIdea.photoFrame).toEqual(DEFAULT_PHOTO_FRAME);
  expect(nextIdea.ideaEpoch).toBe(4);
});

test('idea changes reset canonical media state and QR output is locally rendered SVG @unit', () => {
  const previous = createDefaultPresentationState({ selectedIdeaId: '101', albumItemId: 'old', mode: 'photo', descriptionPage: 1, photoFrame: { scale: 2, centerX: 0.8, centerY: 0.5 } });
  const changed = applyControllerChanges(previous, { selectedIdeaId: '202' }, idea);
  expect(changed.albumItemId).toBe('photo-1');
  expect(changed.photoFrame).toEqual(DEFAULT_PHOTO_FRAME);
  expect(changed.descriptionPage).toBe(0);
  expect(changed.camera).toEqual({ latitude: 32.78, longitude: -96.8, zoom: 16 });
  const svg = presentationQrSvg('https://example.test/audience#view=01234');
  expect(svg).toContain('<svg');
  expect(svg).toContain('<path');
  expect(svg).not.toContain('<image');
});
