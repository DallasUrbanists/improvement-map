import { buildRailGeometry } from './railGeometry.js';
import { applyRailServiceOverrides } from './railServiceOverrides.js';

const sources = import.meta.glob('../data/rails/*.geojson', {
  eager: true,
  query: '?raw',
  import: 'default',
});

export const railCatalog = applyRailServiceOverrides(buildRailGeometry(Object.fromEntries(
  Object.entries(sources).map(([source, raw]) => [source, JSON.parse(raw)]),
)));
