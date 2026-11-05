// Pure checks shared by the build and API helper. Keep independent of Auth.
export function stagingOrigin(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('Staging requires an explicit HTTPS API origin.'); }
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (url.protocol !== 'https:' || url.username || url.password
      || url.pathname !== '/' || url.search || url.hash
      || !/^https:\/\/[^/?#]+\/?$/.test(value)
      || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')
      || host.startsWith('[') || /^\d+(?:\.\d+){3}$/.test(host)
      || /^urbanists-cloud-api-server(?:-|\.)/.test(host)
      || host === 'dallasurbanists.org' || host.endsWith('.dallasurbanists.org')) {
    throw new Error('Staging API must be an HTTPS origin without production aliases, local hosts, credentials, paths, queries, or fragments.');
  }
  return url.origin;
}

export function resolveApiBaseUrl(env = {}) {
  if (env.VITE_DEPLOY_ENV === 'staging') return stagingOrigin(env.VITE_API_BASE_URL);
  return env.VITE_API_BASE_URL || 'https://api.dallasurbanists.org';
}
