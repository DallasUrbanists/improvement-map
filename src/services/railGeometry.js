function titleCase(value) {
  return value.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function buildRailGeometry(sources) {
  const lines = new Map();
  const edges = new Map();
  for (const [source, collection] of Object.entries(sources).sort(([a], [b]) => a.localeCompare(b))) {
    if (collection.type !== 'FeatureCollection') throw new Error(`Invalid rail FeatureCollection: ${source}`);
    for (const feature of collection.features || []) {
      const properties = feature.properties || {};
      const geometry = feature.geometry;
      if (!['LineString', 'MultiLineString'].includes(geometry?.type)) throw new Error(`Unsupported rail geometry: ${source}`);
      const agency = properties.agency?.agency_name || '';
      const ref = properties.route_short_name || properties.route_long_name || properties.route_id;
      if (!ref) throw new Error(`Missing rail route identity: ${source}`);
      const network = ref === 'TRE' ? 'TRE' : /DALLAS AREA RAPID TRANSIT/i.test(agency) ? 'DART'
        : /Denton County Transportation Authority/i.test(agency) ? 'DCTA' : agency || 'Rail';
      const id = `${network}:${ref}`;
      if (!lines.has(id)) {
        const rawColor = String(properties.route_color || '').replace(/^#/, '');
        lines.set(id, { id, name: titleCase((properties.route_long_name || ref).replace(/^DART LIGHT RAIL - /i, '')),
          network, color: /^[0-9a-f]{6}$/i.test(rawColor) ? `#${rawColor}` : '#64748b',
          source, sourceRouteId: properties.route_id, sourceAgency: agency,
          onestopId: properties.onestop_id, url: properties.route_url });
      }
      const parts = geometry.type === 'LineString' ? [geometry.coordinates] : geometry.coordinates;
      for (const part of parts) {
        const points = part.map((coordinate) => {
          const [lon, lat] = coordinate;
          if (!Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lon) > 180 || Math.abs(lat) > 90) {
            throw new Error(`Invalid rail coordinate: ${source}`);
          }
          return { lon, lat };
        });
        for (let i = 1; i < points.length; i++) {
          const ends = [points[i - 1], points[i]].map((point) => ({
            point, key: `${point.lon.toFixed(6)},${point.lat.toFixed(6)}`,
          })).sort((a, b) => a.key.localeCompare(b.key));
          if (ends[0].key === ends[1].key) continue;
          const key = `${ends[0].key}|${ends[1].key}`;
          const edge = edges.get(key) || { id: key, geometry: ends.map((end) => end.point), services: new Set() };
          edge.services.add(id);
          edges.set(key, edge);
        }
      }
    }
  }
  return { lines: [...lines.values()].sort((a, b) => a.id.localeCompare(b.id)),
    segments: [...edges.values()].sort((a, b) => a.id.localeCompare(b.id))
      .map((edge) => ({ id: edge.id, geometry: edge.geometry, keys: [...edge.services].sort() })) };
}

export function railSegmentsInBounds(catalog, { lat, lon }, halfExtentMeters) {
  const latitudeDelta = halfExtentMeters / 111195;
  const longitudeDelta = halfExtentMeters / (111195 * Math.max(0.000001, Math.cos(lat * Math.PI / 180)));
  return (catalog?.segments || []).filter(({ geometry }) => {
    const [a, b] = geometry;
    return Math.min(a.lat, b.lat) <= lat + latitudeDelta && Math.max(a.lat, b.lat) >= lat - latitudeDelta
      && Math.min(a.lon, b.lon) <= lon + longitudeDelta && Math.max(a.lon, b.lon) >= lon - longitudeDelta;
  });
}
