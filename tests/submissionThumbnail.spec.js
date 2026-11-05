import { test, expect } from '@playwright/test';
import { createOptionalLocationThumbnail } from '../src/services/submissionThumbnail.js';

test('working OSM acquisition renders and uploads the real thumbnail', { tag: '@unit' }, async () => {
  const data = { streets: ['live street'] };
  const order = [];
  const result = await createOptionalLocationThumbnail({
    acquire: async () => { order.push('acquire'); return data; },
    render: value => { expect(value).toBe(data); order.push('render'); return '<svg/>'; },
    upload: async svg => { expect(svg).toBe('<svg/>'); order.push('upload'); return { url: 'https://staging.example.invalid/diagram.svg' }; },
    onUnavailable: () => { throw Error('Must not report an outage on success'); },
  });
  expect(order).toEqual(['acquire', 'render', 'upload']);
  expect(result.url).toMatch(/\/diagram\.svg$/);
});

for (const error of [new TypeError('Network/CORS unavailable'), new DOMException('OSM deadline', 'TimeoutError'), new Error('Unable to acquire live map data')]) {
  test(`OSM ${error.name} skips only the optional diagram`, { tag: '@unit' }, async () => {
    const warnings = [];
    const result = await createOptionalLocationThumbnail({
      acquire: async () => { throw error; },
      render: () => { throw Error('No fabricated geometry should be rendered'); },
      upload: () => { throw Error('No placeholder thumbnail should be uploaded'); },
      onUnavailable: value => warnings.push(value),
    });
    expect(result).toBeNull();
    expect(warnings).toEqual([error]);
  });
}

for (const [stage, error] of [
  ['render', new Error('Invalid renderer result')],
  ['upload', Object.assign(new Error('App Check rejected'), { status: 401 })],
  ['upload', Object.assign(new Error('Signed upload failed'), { status: 403 })],
]) {
  test(`${error.message} still rejects submission`, { tag: '@unit' }, async () => {
    await expect(createOptionalLocationThumbnail({
      acquire: async () => ({}),
      render: () => { if (stage === 'render') throw error; return '<svg/>'; },
      upload: async () => { throw error; },
      onUnavailable: () => { throw Error('Must not hide renderer or protected-upload errors'); },
    })).rejects.toBe(error);
  });
}

test('cancellation never continues into a saved submission', { tag: '@unit' }, async () => {
  const error = new DOMException('Canceled', 'AbortError');
  await expect(createOptionalLocationThumbnail({
    acquire: async () => { throw error; },
    render: () => { throw Error('Must not render after cancellation'); },
    upload: () => { throw Error('Must not upload after cancellation'); },
    onUnavailable: () => { throw Error('Cancellation is not an outage'); },
  })).rejects.toBe(error);
});
