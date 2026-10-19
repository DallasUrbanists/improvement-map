export function versionParts(value) {
  const match = /^(?:v)?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(value);
  const parts = match?.slice(1).map(Number);
  return parts?.every(Number.isSafeInteger) ? parts : null;
}
export function compareVersions(a, b) {
  const left = versionParts(a), right = versionParts(b);
  if (!left || !right) throw new Error('Invalid stable release version');
  for (let i = 0; i < 3; i++) if (left[i] !== right[i]) return left[i] > right[i] ? 1 : -1;
  return 0;
}
export function validateManifest(manifest) {
  if (manifest?.schemaVersion !== 1 || !versionParts(manifest.appVersion) || typeof manifest.buildCommit !== 'string' || !Array.isArray(manifest.releases)) throw new Error('Invalid release manifest');
  const seen = new Set();
  for (const r of manifest.releases) {
    if (!Number.isSafeInteger(r.id) || !versionParts(r.version) || typeof r.title !== 'string' || typeof r.body !== 'string' || !Number.isFinite(Date.parse(r.publishedAt)) || !/^https:\/\/github\.com\/DallasUrbanists\/improvement-map\/releases\//i.test(r.url) || compareVersions(r.version, manifest.appVersion) > 0 || seen.has(r.version)) throw new Error('Invalid release entry');
    seen.add(r.version);
  }
  return { ...manifest, releases: [...manifest.releases].sort((a, b) => compareVersions(b.version, a.version)) };
}
