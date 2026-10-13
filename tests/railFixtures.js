import fs from 'node:fs';
import { buildRailGeometry } from '../src/services/railGeometry.js';
import { generateLocationDiagram as renderDiagram } from '../src/services/locationDiagram.js';

const directory = new URL('../src/data/rails/', import.meta.url);
export const railSources = Object.fromEntries(fs.readdirSync(directory)
  .filter((name) => name.endsWith('.geojson'))
  .map((name) => [name, JSON.parse(fs.readFileSync(new URL(name, directory), 'utf8'))]));
export const railCatalog = buildRailGeometry(railSources);
export const generateLocationDiagram = (data, options) => renderDiagram(data, { railCatalog, ...options });
