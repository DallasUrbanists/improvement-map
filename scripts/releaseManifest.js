import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { compareVersions, versionParts, validateManifest } from '../src/services/releaseVersions.js';

export async function collectReleases({ request, isAncestor, appVersion, buildCommit }) {
  const releases = [];
  for (let page = 1; ; page++) {
    const batch = await request(page);
    if (!Array.isArray(batch)) throw new Error('GitHub returned an invalid releases response');
    for (const r of batch) {
      if (r.draft || r.prerelease || !versionParts(r.tag_name) || compareVersions(r.tag_name, appVersion) > 0) continue;
      if (!await isAncestor(r.tag_name)) continue;
      releases.push({ id: r.id, version: r.tag_name.replace(/^v/, ''), title: r.name || r.tag_name, publishedAt: r.published_at, body: r.body || '', url: r.html_url });
    }
    if (batch.length < 100) break;
  }
  return validateManifest({ schemaVersion: 1, appVersion, buildCommit, releases });
}
async function main() {
  const appVersion = JSON.parse(readFileSync('package.json', 'utf8')).version;
  const buildCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const manifest = await collectReleases({ appVersion, buildCommit,
    request: async page => {
      const response = await fetch(`https://api.github.com/repos/DallasUrbanists/improvement-map/releases?per_page=100&page=${page}`, { headers: { Accept: 'application/vnd.github+json', ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) }, signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`GitHub release sync failed: HTTP ${response.status}`);
      return response.json();
    },
    isAncestor: tag => {
      // Stable-version validation above prevents arbitrary git revision syntax.
      const result = spawnSync('git', ['merge-base', '--is-ancestor', `refs/tags/${tag}^{commit}`, buildCommit]);
      if (result.status === 0) return true;
      if (result.status === 1) return false;
      throw new Error(`Cannot resolve release tag ${tag}; fetch complete history and tags`);
    },
  });
  const output = resolve('node_modules/.cache/improvement-map-releases.json');
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify(manifest));
  console.log(`Bundled ${manifest.releases.length} eligible releases for ${appVersion}`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => { console.error(error.message); process.exitCode = 1; });
