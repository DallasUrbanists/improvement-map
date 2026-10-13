<template>
  <section class="overflow-y-auto bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
    <div class="max-w-5xl mx-auto p-5 sm:p-8 space-y-6">
      <header class="space-y-2">
        <p class="text-xs uppercase tracking-widest text-zinc-500">Temporary proof of concept</p>
        <h1 class="text-2xl font-bold">Location diagram</h1>
        <p class="text-sm text-zinc-500" data-testid="active-diagram-coordinates">{{ activeLocationData.center.lat }}, {{ activeLocationData.center.lon }} · North up</p>
        <p class="text-sm max-w-2xl">A procedural SVG showing streets and protected bike routes in view, labeling up to the four nearest non-service streets. Rail shapes and colors come from the supplied local GeoJSON catalog. Agency logos mark bus stops and rail stations. Generate a custom preview from live OpenStreetMap data or browse the eighteen saved examples below. No live rail geometry requests are needed.</p>
      </header>

      <form class="rounded-xl border border-zinc-300 dark:border-zinc-700 p-4 space-y-3" @submit.prevent="generateFromCoordinates" :aria-busy="isGenerating">
        <label for="diagram-coordinates" class="block text-sm font-bold">Coordinates (latitude, longitude)</label>
        <div class="flex flex-wrap gap-3">
          <input id="diagram-coordinates" v-model="coordinateInput" type="text" autocomplete="off" :spellcheck="false"
            placeholder="32.78145881782909, -96.7994967769097" :aria-invalid="Boolean(generationError)"
            aria-describedby="diagram-coordinate-help diagram-coordinate-error"
            class="min-w-0 w-full sm:flex-1 rounded-lg border border-zinc-400 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-sm" />
          <button type="submit" :disabled="isGenerating" class="rounded-lg bg-blue-700 text-white px-4 py-2 text-sm font-bold disabled:opacity-50">{{ isGenerating ? 'Generating…' : 'Generate diagram' }}</button>
          <button v-if="isGenerating" type="button" @click="cancelGeneration" class="text-sm underline">Cancel</button>
          <button type="button" @click="resetExample" class="text-sm underline">Reset example</button>
        </div>
        <p id="diagram-coordinate-help" class="text-xs text-zinc-500">Enter latitude, longitude. Generating sends these coordinates to public OSM/Overpass services to fetch nearby streets, buildings, stops, and administrative areas. Rail shapes remain local. Results are not saved.</p>
        <p v-if="generationStatus" class="text-sm" role="status" aria-live="polite">{{ generationStatus }}</p>
        <p v-if="generationError" id="diagram-coordinate-error" class="text-sm text-red-700 dark:text-red-400" role="alert">{{ generationError }}</p>
      </form>

      <div class="flex flex-wrap items-center gap-4">
        <label class="flex items-center gap-2 text-sm"><input v-model="showBuildings" type="checkbox" /> Show buildings</label>
        <a :href="imageUrl" download="location-diagram.svg" class="rounded-lg bg-blue-700 text-white px-4 py-2 text-sm font-bold">Download SVG</a>
        <a :href="osmUrl" target="_blank" rel="noopener noreferrer" class="text-sm underline">Compare with OpenStreetMap</a>
      </div>

      <div class="grid md:grid-cols-2 gap-8 items-start">
        <figure class="space-y-2">
          <img :src="imageUrl" alt="Schematic of the pinned location, nearby streets, and colored rail transit lines" width="480" height="480" class="w-full max-w-[480px] aspect-square rounded-2xl border border-zinc-300" data-testid="diagram-preview" />
          <figcaption class="text-xs text-zinc-500">Approximately {{ diagram.coverageMeters }} × {{ diagram.coverageMeters }} meters. Crosshair = submitted pin.</figcaption>
        </figure>

        <div class="space-y-5">
          <h2 class="font-bold">Thumbnail-size previews</h2>
          <div class="flex gap-5 items-start">
            <figure class="space-y-2">
              <img :src="imageUrl" alt="96 pixel diagram preview" width="96" height="96" class="rounded-lg border border-zinc-300" />
              <figcaption class="text-xs text-zinc-500">96 × 96</figcaption>
            </figure>
            <figure class="space-y-2">
              <img :src="imageUrl" alt="160 pixel diagram preview" width="160" height="160" class="rounded-lg border border-zinc-300" />
              <figcaption class="text-xs text-zinc-500">160 × 160</figcaption>
            </figure>
          </div>
          <p class="text-xs text-zinc-500">Map data © <a href="https://www.openstreetmap.org/copyright" class="underline" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors · ODbL</a>. Attribution is repeated here so it remains readable beside small previews.</p>
          <div class="rounded-xl border border-zinc-300 dark:border-zinc-700 p-4 space-y-3">
            <h2 class="font-bold">Closest streets</h2>
            <ul class="text-sm space-y-2">
              <li v-for="street in diagram.streets" :key="street.name" class="flex justify-between gap-4">
                <span>{{ street.name }}</span><span class="text-zinc-500">{{ Math.round(street.distance) }} m</span>
              </li>
            </ul>
          </div>
          <div v-if="diagram.transitLines.length" class="rounded-xl border border-zinc-300 dark:border-zinc-700 p-4 space-y-3">
            <h2 class="font-bold">Rail transit in view</h2>
            <ul class="text-sm space-y-2">
              <li v-for="line in diagram.transitLines" :key="line.id" class="flex items-center gap-3">
                <span class="w-8 h-1.5 rounded-full" :style="{ backgroundColor: line.color }" aria-hidden="true"></span>
                <span>{{ line.network }} {{ line.name }}</span>
              </li>
            </ul>
          </div>
          <div class="rounded-xl border border-zinc-300 dark:border-zinc-700 p-4 space-y-3">
            <h2 class="font-bold">Transit stops in view</h2>
            <p class="text-xs text-zinc-500">B = bus stop · R = rail station · B+R = shared bus/rail station. A leader line connects displaced badges to their actual location.</p>
            <ul class="text-sm space-y-2">
              <li v-for="stop in diagram.transitStops" :key="stop.id">{{ stop.agencyNames.join(' / ') || 'No matching agency logo' }} · {{ stop.mode === 'bus+rail' ? 'Bus + Rail' : stop.mode === 'rail' ? 'Rail' : 'Bus' }} · {{ stop.name }}</li>
            </ul>
          </div>
          <p class="text-sm text-zinc-500">All streets in view are drawn; up to the four closest named non-service streets receive labels. Distances are measured to street segments, not map nodes. Service/access roads remain visible but do not receive closest-street labels.</p>
          <p class="text-sm text-zinc-500">The local catalog contains {{ railCatalog.lines.length }} rail services and is loaded once. Only rail segments intersecting each viewport are processed. Direction/trip variants share offset lanes with rounded bends and aligned branch endpoints. Stop metadata remains independent of the rail shape source.</p>
          <p class="text-sm text-zinc-500">The footer combines nearby intersection/stop context and containing administrative areas. OSM may classify improvement or historic districts as administrative areas. Saved examples retain documented polygon checks; custom previews use the live Overpass containing-area index, not independent polygon verification. Provider coverage and metadata may be incomplete.</p>
          <p class="text-sm text-zinc-500">This route does not change submission or Browse behavior, upload files, or persist generated images. Downloads include embedded logo artwork and work offline. Agency identity comes from OSM network/operator tags or route memberships; unknown agencies use neutral stop badges rather than guessed logos.</p>
        </div>
      </div>

      <section class="space-y-4" aria-labelledby="additional-locations">
        <h2 id="additional-locations" class="text-xl font-bold">Additional test locations</h2>
        <p class="text-sm text-zinc-500">The same renderer, colors, stop matching, and building toggle apply to every thumbnail. Coverage adapts to the nearest streets.</p>
        <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <article v-for="(location, index) in additionalDiagrams" :key="location.data.id" class="rounded-xl border border-zinc-300 dark:border-zinc-700 p-4 space-y-3 min-w-0" :data-testid="`location-${location.data.id}`">
            <h3 class="font-bold">Location {{ index + 2 }}</h3>
            <p class="text-xs text-zinc-500 break-words">{{ location.data.center.lat }}, {{ location.data.center.lon }}</p>
            <img :src="location.imageUrl" :alt="`Location ${index + 2} street diagram with transit stops`" width="480" height="480" class="w-full max-w-[240px] aspect-square rounded-lg mx-auto" data-testid="additional-diagram-preview" />
            <p class="text-xs text-zinc-500">{{ location.diagram.coverageMeters }} × {{ location.diagram.coverageMeters }} m · North up</p>
            <p class="text-xs">Administrative area: {{ location.diagram.administrativeBoundary?.name || 'Unavailable' }}</p>
            <p class="text-xs">Closest streets: {{ location.diagram.streets.map(street => street.name).join(', ') }}</p>
            <p class="text-xs">Rail routes: {{ location.diagram.transitLines.map(line => line.name).join(', ') || 'None in view' }}</p>
            <p class="text-xs">Stop agencies: {{ [...new Set(location.diagram.transitStops.flatMap(stop => stop.agencyNames))].join(', ') || 'None identified' }}</p>
            <p v-if="location.unmatchedStops.length" class="text-xs text-zinc-500">No supplied logo for: {{ location.unmatchedStops.map(stop => stop.name).join(', ') }}. Neutral badges are intentional.</p>
            <div class="flex flex-wrap gap-3 text-xs">
              <a :href="location.imageUrl" :download="`location-diagram-${index + 2}.svg`" :aria-label="`Download SVG for location ${index + 2}`" class="underline">Download SVG</a>
              <a :href="mapUrl(location.data.center)" target="_blank" rel="noopener noreferrer" :aria-label="`Compare location ${index + 2} with OpenStreetMap`" class="underline">Compare map</a>
            </div>
          </article>
        </div>
        <p class="text-xs text-zinc-500">Map data © <a href="https://www.openstreetmap.org/copyright" class="underline">OpenStreetMap contributors · ODbL</a>. Agency logos identify service providers, not sponsorship. Stop metadata may be incomplete or out of date.</p>
      </section>
    </div>
  </section>
</template>

<script setup>
import { computed, ref, onBeforeUnmount } from 'vue';
import locationData from '../data/test-location-osm.json';
import existingAdditionalLocations from '../data/additional-test-locations-osm.json';
import extraLocations from '../data/extra-test-locations-osm.json';
import existingAdministrativeBoundaries from '../data/test-location-boundaries.json';
import extraAdministrativeBoundaries from '../data/extra-test-location-boundaries.json';
import { generateLocationDiagram } from '../services/locationDiagram';
import { railCatalog } from '../services/railCatalog';
import { parseCoordinateString, fetchLocationData } from '../services/liveLocationData';

const additionalLocations = [...existingAdditionalLocations, ...extraLocations];
const administrativeBoundaries = { ...existingAdministrativeBoundaries, ...extraAdministrativeBoundaries };
const showBuildings = ref(true);
const activeLocationData = ref(locationData);
const activeBoundary = ref(administrativeBoundaries[locationData.id]);
const coordinateInput = ref(`${locationData.center.lat}, ${locationData.center.lon}`);
const isGenerating = ref(false);
const generationError = ref('');
const generationStatus = ref('');
let generationId = 0;
let generationController = null;

function cancelGeneration() {
  generationId++;
  generationController?.abort();
  generationController = null;
  isGenerating.value = false;
  generationStatus.value = 'Generation canceled. Previous preview retained.';
}

function resetExample() {
  cancelGeneration();
  activeLocationData.value = locationData;
  activeBoundary.value = administrativeBoundaries[locationData.id];
  coordinateInput.value = `${locationData.center.lat}, ${locationData.center.lon}`;
  generationError.value = '';
  generationStatus.value = '';
}

async function generateFromCoordinates() {
  if (isGenerating.value) return;
  generationError.value = '';
  let center;
  try {
    center = parseCoordinateString(coordinateInput.value);
  } catch (error) {
    generationStatus.value = '';
    generationError.value = error.message;
    return;
  }
  const requestId = ++generationId;
  generationController = new AbortController();
  isGenerating.value = true;
  generationStatus.value = 'Fetching OpenStreetMap data…';
  try {
    const result = await fetchLocationData(center, {
      signal: generationController.signal,
      onProgress: (message) => { if (requestId === generationId) generationStatus.value = message; },
    });
    if (requestId !== generationId) return;
    generateLocationDiagram(result.data, { ...center, buildings: showBuildings.value,
      administrativeBoundary: result.administrativeBoundary, railCatalog });
    activeLocationData.value = result.data;
    activeBoundary.value = result.administrativeBoundary;
    generationStatus.value = `Generated diagram for ${center.lat}, ${center.lon}.`;
  } catch (error) {
    if (requestId !== generationId) return;
    generationStatus.value = '';
    generationError.value = `${error.message || 'Unable to load map data.'} Previous preview retained.`;
  } finally {
    if (requestId === generationId) {
      isGenerating.value = false;
      generationController = null;
    }
  }
}

onBeforeUnmount(() => {
  generationId++;
  generationController?.abort();
});

const diagram = computed(() => generateLocationDiagram(activeLocationData.value, {
  ...activeLocationData.value.center,
  buildings: showBuildings.value,
  administrativeBoundary: activeBoundary.value,
  railCatalog,
}));
const svgUrl = (svg) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
const mapUrl = ({ lat, lon }) => `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=19/${lat}/${lon}`;
const imageUrl = computed(() => svgUrl(diagram.value.svg));
const osmUrl = computed(() => mapUrl(activeLocationData.value.center));
const additionalDiagrams = computed(() => additionalLocations.map((data) => {
  const diagram = generateLocationDiagram(data, { ...data.center, buildings: showBuildings.value,
    administrativeBoundary: administrativeBoundaries[data.id], railCatalog });
  return { data, diagram, imageUrl: svgUrl(diagram.svg),
    unmatchedStops: diagram.transitStops.filter(stop => !stop.agencies.length) };
}));
</script>
