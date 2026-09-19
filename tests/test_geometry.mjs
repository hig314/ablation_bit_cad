// Invariants the browser geometry must hold for any parameter set the panel
// can produce. Pure JavaScript, no CadQuery, so it runs in a second:
//
//   node tests/test_geometry.mjs
//
// The case that prompted this file: 11 teeth with 4.5 mm blades. Inside
// r = 8.6 mm the blades pass through each other, the wedge between them
// inverted, and the surface folded through itself. On screen that was
// sheets cutting through the tops of the wedges and a spur of solid hanging
// off the ramp near the centre. Numerically it is a closed shell with
// negative volume, which is what this checks for.

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildParts, signedVolume, groupVolume, BODY_GROUPS, closureRadius, AREA_EPS } from '../web/js/geometry.js';
import { clamp, defaults, PARAMS } from '../web/js/params.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, 'fixtures');

let failures = 0;
function check(ok, label) {
  if (!ok) { failures++; console.log('  FAIL ' + label); }
  return ok;
}

function inspect(label, P) {
  const parts = buildParts(P);
  let worst = Infinity, degenerate = 0, nonFinite = 0, shells = 0;

  for (const [group, list] of Object.entries(parts)) {
    if (group === 'meta') continue;
    for (const tris of list) {
      shells++;
      const v = signedVolume(tris) / 1000;
      if (v < worst) worst = v;
      for (let k = 0; k < tris.length; k += 3) {
        const [a, b, c] = [tris[k], tris[k + 1], tris[k + 2]];
        for (const p of [a, b, c]) if (!p.every(Number.isFinite)) nonFinite++;
        const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
        const w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
        const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
        if (n[0] * n[0] + n[1] * n[1] + n[2] * n[2] < AREA_EPS) degenerate++;
      }
    }
  }

  const rClose = closureRadius(P);
  console.log('%s  (N=%d tb=%s H=%s)%s', label.padEnd(20), P.N, P.tb, P.H,
    rClose > 0 ? '  blades close inside r=' + rClose.toFixed(1) + ' mm' : '');
  console.log('   %d shells, smallest volume %s cm3, %d degenerate triangles, %d non-finite points',
    shells, worst.toFixed(4), degenerate, nonFinite);

  // A closed shell wound outwards has positive volume. Negative means it
  // folded through itself; that is the bug this file exists for. The
  // tolerance is for shells that collapse to nothing at an extreme setting
  // and land a few ulps either side of zero; a genuinely inverted shell was
  // -0.005 cm3, thousands of times larger.
  check(worst >= -1e-6,
        label + ': a shell has negative volume (' + worst.toExponential(2) + ' cm3), so it is inverted');
  check(degenerate === 0, label + ': ' + degenerate + ' degenerate triangles would reach the STL');
  check(nonFinite === 0, label + ': ' + nonFinite + ' non-finite coordinates');
  for (const [name, groups] of Object.entries(BODY_GROUPS)) {
    check(groupVolume(parts, groups) > 0, label + ': ' + name + ' has no volume');
  }
}

console.log('Fixtures\n');
for (const f of readdirSync(FIXTURES).filter(f => f.endsWith('.json')).sort()) {
  const raw = JSON.parse(readFileSync(join(FIXTURES, f), 'utf8'));
  inspect(f.replace('.json', ''), clamp({ ...defaults(), ...raw }));
}

// Sweep the corners of the parameter space the sliders allow. Every one of
// these is a design a collaborator can reach by dragging, so every one has
// to produce drawable geometry even when it is not a buildable part.
console.log('\nExtremes reachable from the panel\n');
for (const p of PARAMS) {
  if (p.view) continue;
  for (const [end, value] of [['min', p.min], ['max', p.max]]) {
    const P = clamp({ ...defaults(), [p.key]: value });
    inspect(p.key + '=' + end, P);
  }
}

console.log();
if (failures) {
  console.log(failures + ' check(s) failed');
  process.exit(1);
}
console.log('all geometry invariants hold');
