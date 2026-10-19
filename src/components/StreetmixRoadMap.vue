<template>
  <div>
    <div v-show="!failed" ref="container" class="streetmix-road-map" role="region" aria-label="Street choices map"></div>
    <p v-if="failed" role="status">Map unavailable. Choose a street below.</p>
  </div>
</template>
<script setup>
import { onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { hasGoogleMapsKey, loadGoogleMaps, getMapStyles } from '../services/googleMaps';
import { isDark } from '../services/theme';
const props = defineProps({ candidates: Array, coordinate: Object, selected: [String, Number] });
const emit = defineEmits(['select']);
const container = ref(null), failed = ref(false);
let map, maps, objects = [], generation = 0;
const point = p => ({ lat: Number(p.latitude), lng: Number(p.longitude) });
function clear() {
  objects.forEach(object => { maps?.event?.clearInstanceListeners(object); object.setMap(null); }); objects = [];
}
function draw() {
  if (!map) return;
  clear();
  const selected = props.candidates.find(c => String(c.osmWayId) === String(props.selected));
  const bounds = new maps.LatLngBounds();
  const origin = point(props.coordinate);
  if (!selected) objects.push(new maps.Marker({ map, position: origin, title: 'Suggestion location', label: '•' }));
  bounds.extend(origin);
  props.candidates.forEach((candidate, index) => {
    const chosen = String(candidate.osmWayId) === String(props.selected);
    const opposing = String(candidate.osmWayId) === String(selected?.oppositeOsmWayId);
    const color = chosen ? '#c2410c' : opposing ? '#7e22ce' : '#1d4ed8';
    for (const line of candidate.geometry || []) {
      const path = line.map(point);
      path.forEach(p => bounds.extend(p));
      const road = new maps.Polyline({ map, path, strokeColor: color, strokeWeight: chosen ? 7 : 5, zIndex: chosen ? 3 : 1 });
      road.addListener('click', () => emit('select', candidate.osmWayId)); objects.push(road);
    }
    const position = candidate.snappedCoordinate || candidate.geometry?.[0]?.[0];
    if (position && (!selected || chosen)) {
      const marker = new maps.Marker({ map, position: point(position), label: String(index + 1), title: `${index + 1}. ${candidate.name || 'Unnamed street'}${chosen ? ' (selected)' : opposing ? ' (opposing carriageway)' : ''}` });
      marker.addListener('click', () => emit('select', candidate.osmWayId)); objects.push(marker);
    }
  });
  map.fitBounds(bounds, 24);
  map.setOptions({ styles: getMapStyles(isDark.value, 'roadmap', 16) });
}
onMounted(async () => {
  const current = ++generation;
  try {
    if (!hasGoogleMapsKey) throw Error('No map configuration');
    maps = await loadGoogleMaps();
    if (current !== generation) return;
    map = new maps.Map(container.value, { center: point(props.coordinate), zoom: 17, disableDefaultUI: true, zoomControl: true, gestureHandling: 'cooperative', clickableIcons: false });
    draw();
  } catch { if (current === generation) { failed.value = true; clear(); map = null; } }
});
watch(() => [props.selected, props.candidates, isDark.value], draw);
onBeforeUnmount(() => { generation++; clear(); if (map) maps.event?.clearInstanceListeners(map); map = null; });
</script>
