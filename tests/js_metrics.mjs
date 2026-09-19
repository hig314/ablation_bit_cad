// Metrics for one parameter set, computed from the browser geometry under
// Node. Reads parameters.json on argv[2], writes JSON to stdout.
//
//   node tests/js_metrics.mjs tests/fixtures/default.json
//
// Volumes are mesh volumes, so they sit slightly under the exact B-rep
// value: a tessellated cylinder is an inscribed prism. test_consistency.py
// knows that and allows for it.

import { readFileSync } from 'node:fs';
import { buildParts, groupVolume, BODY_GROUPS, derived } from '../web/js/geometry.js';
import { clamp, defaults } from '../web/js/params.js';

const raw = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const P = clamp({ ...defaults(), ...raw });

const parts = buildParts(P);

function extent(shells) {
  let zmin = Infinity, zmax = -Infinity, rmax = 0;
  for (const tris of shells) for (const p of tris) {
    if (p[2] < zmin) zmin = p[2];
    if (p[2] > zmax) zmax = p[2];
    const r = Math.hypot(p[0], p[1]);
    if (r > rmax) rmax = r;
  }
  return { zmin, zmax, rmax };
}

const bodies = {};
for (const [name, groups] of Object.entries(BODY_GROUPS)) {
  const shells = groups.flatMap(g => parts[g]);
  let vol = groupVolume(parts, groups);
  if (name === 'printed_body') vol -= groupVolume(parts, ['cavities']);
  bodies[name] = { volume_cm3: vol / 1000, ...extent(shells) };
}

const d = derived(P);
console.log(JSON.stringify({
  params: P,
  derived: { zTop: d.zTop, zRoot: d.zRoot, zStub: d.zStub, Rb: d.Rb, dth: d.dth },
  cavity_count: parts.cavities.length,
  bodies,
}, null, 2));
