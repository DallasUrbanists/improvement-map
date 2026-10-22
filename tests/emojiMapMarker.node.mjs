import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEmojiMarkerSvg, submissionEmoji } from '../src/services/emojiMapMarker.js';

test('missing or blank submission emoji falls back to the light bulb', () => {
  assert.equal(submissionEmoji(undefined), '💡');
  assert.equal(submissionEmoji(''), '💡');
  assert.equal(submissionEmoji('  '), '💡');
  assert.equal(submissionEmoji(' 🚲 '), '🚲');
});

test('emoji marker SVG keeps joined and variation-selector sequences intact', () => {
  for (const emoji of ['❤️', '👩‍👩‍👧‍👦', '🏳️‍🌈']) {
    const svg = decodeURIComponent(createEmojiMarkerSvg(emoji).split(',')[1]);
    assert.equal(svg.match(/<text\b[^>]*>([^<]*)<\/text>/)?.[1], emoji);
  }
});

test('emoji marker SVG escapes XML text before encoding its data URL', () => {
  const svg = decodeURIComponent(createEmojiMarkerSvg('<&>').split(',')[1]);
  assert.ok(svg.includes('&lt;&amp;&gt;'));
});

test('emoji marker SVG supports one-second bounce grow entrance and inverse exit', () => {
  const entrance = decodeURIComponent(createEmojiMarkerSvg('🚲', { animateAppearance: true, appearanceDuration: 1000 }).split(',')[1]);
  const exit = decodeURIComponent(createEmojiMarkerSvg('🚲', { animateAppearance: true, appearanceExit: true, appearanceDuration: 1000 }).split(',')[1]);
  assert.match(entrance, /animation:appear 1000ms ease-out both/);
  assert.match(exit, /animation:disappear 1000ms ease-out both/);
  assert.match(exit, /@keyframes disappear\{0%\{transform:scale\(1\)\}10%\{transform:scale\(1\.12\)\}22%\{transform:scale\(\.78\)\}45%\{transform:scale\(1\.55\)\}100%\{transform:scale\(\.06\)\}\}/);
});
