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
    assert.ok(svg.includes(`<text class="marker"`));
    assert.ok(svg.includes(`>${emoji}</text>`));
  }
});

test('emoji marker SVG escapes XML text before encoding its data URL', () => {
  const svg = decodeURIComponent(createEmojiMarkerSvg('<&>').split(',')[1]);
  assert.ok(svg.includes('&lt;&amp;&gt;'));
});
