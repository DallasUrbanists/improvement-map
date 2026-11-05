import { test, expect } from '@playwright/test';
import { restoreSubmissionPhotoBlob } from '../src/services/submissionPhoto.js';

test('fresh processed image keeps its actual Blob', { tag: '@unit' }, async () => {
  const blob = new Blob(['processed bytes'], { type: 'image/webp' });
  expect(await restoreSubmissionPhotoBlob({ blob }, () => { throw Error('No fetch needed'); })).toBe(blob);
});

test('JSON-restored draft recovers image bytes instead of uploading the serialized Blob object', { tag: '@unit' }, async () => {
  const photo = JSON.parse(JSON.stringify({ blob: new Blob(['original']), dataUrl: 'data:image/webp;base64,cHJvY2Vzc2Vk' }));
  const restored = await restoreSubmissionPhotoBlob(photo);
  expect(restored).toBeInstanceOf(Blob);
  expect(restored.type).toBe('image/webp');
  expect(await restored.text()).toBe('processed');
});

for (const [name, photo] of [
  ['serialized Blob without recovery bytes', { blob: {} }],
  ['remote URL', { dataUrl: 'https://example.invalid/photo.webp' }],
  ['empty image', { dataUrl: 'data:image/webp;base64,' }],
  ['wrong MIME type', { blob: new Blob(['wrong type'], { type: 'text/plain' }) }],
]) {
  test(`unrecoverable ${name} rejects before a signed upload is requested`, { tag: '@unit' }, async () => {
    await expect(restoreSubmissionPhotoBlob(photo)).rejects.toThrow('Please remove it and add it again');
  });
}

test('data URL retrieval failure propagates instead of claiming a saved image', { tag: '@unit' }, async () => {
  await expect(restoreSubmissionPhotoBlob({ dataUrl: 'data:image/webp;base64,eA==' }, async () => { throw Error('Image bytes unavailable'); })).rejects.toThrow('Image bytes unavailable');
});
