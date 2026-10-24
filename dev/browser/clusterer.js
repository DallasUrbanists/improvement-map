// A deterministic proximity model for the offline SDK, not Google's clustering algorithm.
export class SuperClusterAlgorithm {}
export class MarkerClusterer {
  constructor({ map, markers = [], renderer, onClusterClick }) { this.markers = [...markers]; this.renderer = renderer; this.onClusterClick = onClusterClick; this.clusters = []; this.setMap(map); }
  setMap(map) { this.listener?.remove(); this.map = map; if (map) this.listener = map.addListener('idle', () => this.render()); this.render(); }
  clearMarkers() { for (const marker of this.markers) marker.setMap(null); this.markers = []; this.render(); }
  addMarker(marker, noDraw = false) { if (!this.markers.includes(marker)) this.markers.push(marker); if (!noDraw) this.render(); }
  removeMarker(marker, noDraw = false) { this.markers = this.markers.filter(value => value !== marker); marker.setMap(null); if (!noDraw) this.render(); }
  render() {
    for (const cluster of this.clusters) cluster.marker?.setMap(null);
    this.clusters = [];
    if (!this.map) { for (const marker of this.markers) marker.setMap(null); return; }
    const pending = new Set(this.markers), maps = window.google.maps;
    while (pending.size) {
      const marker = pending.values().next().value; pending.delete(marker);
      const origin = this.map.project(marker.getPosition()), members = [marker];
      for (const candidate of pending) { const p = this.map.project(candidate.getPosition()); if (Math.hypot(p.x - origin.x, p.y - origin.y) < 50) { members.push(candidate); pending.delete(candidate); } }
      if (members.length === 1 || !this.renderer) { marker.setMap(this.map); continue; }
      const bounds = new maps.LatLngBounds(); for (const member of members) { bounds.extend(member.getPosition()); member.setMap(null); }
      const cluster = { markers: members, count: members.length, position: bounds.getCenter(), bounds };
      cluster.marker = this.renderer.render(cluster); cluster.marker.setMap(this.map); cluster.marker.addListener('click', () => this.onClusterClick?.({}, cluster, this.map)); this.clusters.push(cluster);
    }
  }
}
