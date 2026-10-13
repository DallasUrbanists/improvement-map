import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { createHash } from 'node:crypto';

const load = (color) => JSON.parse(fs.readFileSync(new URL(
  `../src/data/rails/DALLAS AREA RAPID TRANSIT - ${color} DART LIGHT RAIL - ${color} LINE.geojson`,
  import.meta.url,
), 'utf8'));
const blue = load('BLUE');
const red = load('RED');
const corinth = [-96.79882, 32.74797];
const union = [-96.8084, 32.77687];
const fingerprint = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const indexOf = (part, point) => part.findIndex(([lon, lat]) => lon === point[0] && lat === point[1]);
const bounds = (part) => {
  const indices = [indexOf(part, corinth), indexOf(part, union)];
  expect(indices.every((index) => index >= 0)).toBe(true);
  return indices.sort((a, b) => a - b);
};

// Fingerprints from the supplied Blue data before the corridor correction.
const originalExterior = [
  ['7986a2cce7b8b35c0f76bc61492407a57b456d6768ebaef072822273315e3ec6',
    '1e755a522fc1dbaa3252ee0b3c77099924d3c9e635ed71235e6774c2b555fe63'],
  ['becbe079876de7b5721869a8b0d57567420249dc4177c96553a5260b853d2445',
    '54983e78511dc2deeca67e49d3e6d7eac1b530a865729e3d7cf7fe67b9bac02a'],
];

test('Blue follows the complete Red alignment between Union and 8th & Corinth in both directions', () => {
  expect(blue.features[0].geometry.coordinates).toHaveLength(2);
  for (const [direction, part] of blue.features[0].geometry.coordinates.entries()) {
    const source = red.features[0].geometry.coordinates[direction];
    const [start, end] = bounds(part);
    const [redStart, redEnd] = bounds(source);
    expect(part.slice(start, end + 1)).toEqual(source.slice(redStart, redEnd + 1));
    expect(part.filter((point) => indexOf([point], corinth) >= 0)).toHaveLength(1);
    expect(part.filter((point) => indexOf([point], union) >= 0)).toHaveLength(1);
    expect(part).not.toContainEqual([-96.787149, 32.763639]);
  }
});

test('splice anchors are the nearest existing vertices to the actual station coordinates', () => {
  for (const data of [blue, red]) {
    for (const [name, anchor, position] of [
      ['8TH & CORINTH STATION', corinth, [-96.798474, 32.748082]],
      ['EBJ UNION STATION', union, [-96.808201, 32.776208]],
    ]) {
      const station = data.features[0].properties.route_stops.find(({ stop }) => stop.stop_name === name).stop;
      expect(station.geometry.coordinates).toEqual(position);
      const distance = ([lon, lat]) => Math.hypot(
        (lon - position[0]) * Math.cos(position[1] * Math.PI / 180), lat - position[1],
      );
      for (const part of data.features[0].geometry.coordinates) {
        const nearest = part.reduce((best, point) => distance(point) < distance(best) ? point : best);
        expect(nearest).toEqual(anchor);
      }
    }
  }
});

test('all Blue geometry outside the station bounds and all metadata remain unchanged', () => {
  for (const [direction, part] of blue.features[0].geometry.coordinates.entries()) {
    const [start, end] = bounds(part);
    expect([fingerprint(part.slice(0, start)), fingerprint(part.slice(end + 1))])
      .toEqual(originalExterior[direction]);
  }
  const metadata = structuredClone(blue);
  metadata.features[0].geometry.coordinates = null;
  expect(fingerprint(metadata)).toBe('ee5960ce5469dafbfdc17b7078870472442818931b4b66e19203d85138de40e0');
});
