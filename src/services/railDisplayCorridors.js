// Display generalization only. These anchors do not change service or track data.
// TRE follows a continuous west-side display spine through the West End fork.
// Joining the two DART approaches before their eastward curves avoids a tiny
// out-and-back detour across Orange/Green when the two bundles meet.
const treSpine = { sections: [
  { reference: 'DART:GREEN', start: [-96.8335, 32.8084], end: [-96.80972, 32.78092] },
  { reference: 'DART:RED', start: [-96.80969, 32.77994], end: [-96.80796, 32.77536] },
] };

export const RAIL_DISPLAY_CORRIDORS = Object.freeze([
  { id: 'tre-victory', reference: 'DART:GREEN', start: [-96.8335, 32.8084], end: [-96.80869, 32.780369],
    order: ['TRE:TRE', 'DART:ORANGE', 'DART:GREEN'], sign: -1, zoom: 15, maxGapMeters: 120,
    laneReferences: { 'TRE:TRE': treSpine }, laneOffsets: { 'TRE:TRE': 8.25 },
    fixedServices: ['DART:GREEN', 'DART:ORANGE'], smoothEntry: true, entrySmoothingZoom: 12, parallelEnds: { 'TRE:TRE': ['end'] } },
  { id: 'tre-union', reference: 'DART:RED', start: [-96.80869, 32.780369], end: [-96.80796, 32.77536],
    order: ['TRE:TRE', 'DART:RED', 'DART:BLUE'], sign: -1, zoom: 16, maxGapMeters: 100,
    laneReferences: { 'TRE:TRE': treSpine }, laneOffsets: { 'TRE:TRE': 8.25 },
    fixedServices: ['DART:RED', 'DART:BLUE'], parallelEnds: { 'TRE:TRE': ['start', 'end'] } },
  { id: 'm-line-st-paul', reference: 'DART:RED', start: [-96.79831, 32.783209], end: [-96.79517, 32.785899],
    order: ['DART:425', 'DART:GREEN', 'DART:ORANGE', 'DART:RED', 'DART:BLUE'], sign: 1, zoom: 14, maxGapMeters: 190 },
  { id: 'dfw-terminal', reference: 'DART:SILVER', start: [-97.04289, 32.91982], end: [-97.04121, 32.90583],
    order: ['Trinity Metro:TEXRail', 'DART:SILVER', 'DART:ORANGE'], sign: -1, zoom: 12, maxGapMeters: 450 },
  { id: 'a-train-trinity', reference: 'DART:GREEN', start: [-96.93867, 32.99357], end: [-96.926476, 32.980877],
    order: ['DCTA:A-train', 'DART:GREEN'], sign: -1, zoom: 14, maxGapMeters: 90,
    parallelEnds: { 'DART:GREEN': ['start'], 'DCTA:A-train': ['end'] } },
  { id: 'dallas-streetcar-union', reference: 'DART:RED', start: [-96.80796, 32.77536], end: [-96.80622, 32.77296],
    order: ['DART:RED', 'DART:BLUE', 'DART:620'], sign: -1, zoom: 14, maxGapMeters: 170,
    fixedServices: ['DART:RED', 'DART:BLUE'], laneOffsets: { 'DART:620': -8.25 },
    parallelEnds: { 'DART:620': ['start'] } },
]);
