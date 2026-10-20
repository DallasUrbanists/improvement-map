import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const load = (color) => JSON.parse(fs.readFileSync(new URL(
  `../src/data/rails/DALLAS AREA RAPID TRANSIT - ${color} DART LIGHT RAIL - ${color} LINE.geojson`,
  import.meta.url,
), 'utf8'));
const blue = load('BLUE');
const red = load('RED');
const corinth = [-96.79882, 32.74797];
const union = [-96.8084, 32.77687];
const indexOf = (part, point) => part.findIndex(([lon, lat]) => lon === point[0] && lat === point[1]);
const bounds = (part) => {
  const indices = [indexOf(part, corinth), indexOf(part, union)];
  expect(indices.every((index) => index >= 0)).toBe(true);
  return indices.sort((a, b) => a - b);
};

test('Blue follows the complete Red alignment between Union and 8th & Corinth in both directions', { tag: '@unit' }, () => {
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
