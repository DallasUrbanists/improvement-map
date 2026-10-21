export function presentationLink(route, fragmentKey, code) {
  const base = new URL(import.meta.env.BASE_URL || '/', window.location.origin);
  const url = new URL(String(route).replace(/^\/+/, ''), base);
  url.hash = `${fragmentKey}=${encodeURIComponent(code)}`;
  return url.toString();
}

export function readBrowsePresentationSnapshot() {
  try {
    const value = JSON.parse(localStorage.getItem('presentation-browse-snapshot-v1') || 'null');
    if (!value || typeof value !== 'object') return null;
    const { latitude, longitude, zoom } = value.camera || {};
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(zoom)) return null;
    if (value.selectedIdeaId !== null && value.selectedIdeaId !== undefined && !/^\d+$/.test(String(value.selectedIdeaId))) return null;
    return { camera: { latitude, longitude, zoom }, selectedIdeaId: value.selectedIdeaId ? String(value.selectedIdeaId) : null };
  } catch { return null; }
}
