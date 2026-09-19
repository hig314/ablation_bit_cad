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

import { buildParts, signedVolume, groupVolume, BODY_GROUPS, closureRadius, derived, AREA_EPS } from '../web/js/geometry.js';
import { clamp, defaults, PARAMS } from '../web/js/params.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, 'fixtures');

let failures = 0;
function check(ok, label) {
  if (!ok) { failures++; console.log('  FAIL ' + label); }
  return ok;
}


// ---------------------------------------------------------------------------
// Solids that should not share space
//
// Two faults found from a real design (11 teeth, 4.5 mm blades) that none of
// the checks above would catch, because each shell was perfectly well formed
// on its own:
//
//   - the pieces tiling one wedge overlapped each other once the wedge grew
//     narrower than the notches taken out of it
//   - plastic sat inside the copper blade ahead of it, because the bottom of
//     the wedge was solved by an iteration that did not converge, and because
//     a blade's angular width was taken as offset/r rather than asin(offset/r)
//
// Both show up as solids occupying the same space, so that is what is
// measured here: points drawn inside one solid and tested against the other.
// Sampling is deterministic, so the number does not wobble between runs.
// ---------------------------------------------------------------------------

/** Deterministic uniform generator, so a run is reproducible. */
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/** Ray parity along +x: is p enclosed by this closed shell? */
function inShell(tris, p) {
  let hits = 0;
  for (let i = 0; i < tris.length; i += 3) {
    const a = tris[i], b = tris[i + 1], c = tris[i + 2];
    const e1y = b[1] - a[1], e1z = b[2] - a[2], e2y = c[1] - a[1], e2z = c[2] - a[2];
    const det = e1y * e2z - e1z * e2y;
    if (Math.abs(det) < 1e-14) continue;
    const ty = p[1] - a[1], tz = p[2] - a[2];
    const u = (ty * e2z - tz * e2y) / det, v = (e1y * tz - e1z * ty) / det;
    if (u < 0 || v < 0 || u + v > 1) continue;
    if (a[0] + u * (b[0] - a[0]) + v * (c[0] - a[0]) > p[0]) hits++;
  }
  return (hits & 1) === 1;
}

/**
 * Is the point inside a copper blade? Tested in the blade's own frame of
 * radius along its rear face and straight offset forward, which is exactly
 * how prismSolid builds it, so this is exact rather than a mesh estimate.
 */
function makeInBlade(P) {
  const { dth, Rb, zTop, zRoot, zStub, off } = derived(P);
  const { rc, f, c, N } = P, rBlade = Rb - c;
  return (x, y, z) => {
    for (let k = 0; k < N; k++) {
      const th = k * dth, cs = Math.cos(th), sn = Math.sin(th);
      const u = x * cs + y * sn, d = x * sn - y * cs;
      if (z > 0 && z < zRoot && u > rc && u < rBlade && d > 0 && d < off(z)) return true;
      if (P.hr > 0 && f > 0 && z > zRoot && z < zTop && u > rc && u < rBlade && d > -f && d < off(z) + f) return true;
      if (f > 0 && z > zStub && z < zRoot && u > rc && u < rc + f && d > -f && d < off(z) + f) return true;
    }
    return false;
  };
}

/** Volume of `shell` that lies inside `test`, by Monte Carlo, in mm^3. */
function sharedVolume(shell, test, seed, samples = 30000) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const p of shell) for (let j = 0; j < 3; j++) { if (p[j] < lo[j]) lo[j] = p[j]; if (p[j] > hi[j]) hi[j] = p[j]; }
  const box = (hi[0] - lo[0]) * (hi[1] - lo[1]) * (hi[2] - lo[2]);
  if (!(box > 0)) return { own: 0, shared: 0 };
  const rand = rng(seed);
  let own = 0, shared = 0;
  for (let i = 0; i < samples; i++) {
    const p = [lo[0] + rand() * (hi[0] - lo[0]), lo[1] + rand() * (hi[1] - lo[1]), lo[2] + rand() * (hi[2] - lo[2])];
    if (!inShell(shell, p)) continue;
    own++;
    if (test(p)) shared++;
  }
  return { own: own / samples * box, shared: shared / samples * box };
}

// A flat facet cannot follow a curved clearance surface exactly, so a little
// of each piece is always going to poke across. Anything past this is a rule
// being wrong rather than the mesh being coarse.
const SHARE_LIMIT_PCT = 1.0;

function checkNoSharedSpace(label, P) {
  const parts = buildParts(P);
  const wedge = parts.plastic.slice(0, parts.plastic.length / P.N);   // one wedge's pieces
  const inBlade = makeInBlade(P);

  let worstCopper = 0, worstPair = 0;
  for (let i = 0; i < wedge.length; i++) {
    const r = sharedVolume(wedge[i], p => inBlade(p[0], p[1], p[2]), 12345 + i);
    if (r.own > 1) worstCopper = Math.max(worstCopper, 100 * r.shared / r.own);
    for (let j = i + 1; j < wedge.length; j++) {
      const q = sharedVolume(wedge[i], p => inShell(wedge[j], p), 777 + i * 10 + j);
      if (q.own > 1) worstPair = Math.max(worstPair, 100 * q.shared / q.own);
    }
  }
  console.log('   plastic inside copper %s%%, pieces inside each other %s%%',
    worstCopper.toFixed(2), worstPair.toFixed(2));
  check(worstCopper <= SHARE_LIMIT_PCT,
        label + ': ' + worstCopper.toFixed(2) + '% of a plastic piece is inside a copper blade');
  check(worstPair <= SHARE_LIMIT_PCT,
        label + ': ' + worstPair.toFixed(2) + '% of one wedge piece is inside another');
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
  const P = clamp({ ...defaults(), ...raw });
  inspect(f.replace('.json', ''), P);
  checkNoSharedSpace(f.replace('.json', ''), P);
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
