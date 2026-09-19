// Binary STL writer and the download bundle. Pure: returns file contents,
// leaves zipping and saving to the caller.

import { normal } from './geometry.js';
import { SAVED_KEYS } from './params.js';

/**
 * Binary STL from a list of triangle shells. Units are whatever the
 * geometry used, i.e. millimetres; STL itself carries no units, which is
 * why the README and the status line have to say so.
 */
export function stlBinary(shells) {
  const nTri = shells.reduce((s, t) => s + t.length / 3, 0);
  const buf = new ArrayBuffer(84 + nTri * 50), dv = new DataView(buf);
  dv.setUint32(80, nTri, true);
  let o = 84;
  for (const tris of shells) for (let k = 0; k < tris.length; k += 3) {
    const a = tris[k], b = tris[k + 1], c = tris[k + 2];
    let n = normal(a, b, c);
    const L = Math.hypot(...n) || 1;
    n = n.map(v => v / L);
    [n, a, b, c].forEach(p => { p.forEach((v, i) => { dv.setFloat32(o + 4 * i, v, true); }); o += 12; });
    dv.setUint16(o, 0, true); o += 2;
  }
  return buf;
}

/** Reverse a shell's winding, turning a solid into a closed void. */
export function inverted(tris) {
  const t = tris.slice();
  for (let k = 0; k < t.length; k += 3) { const x = t[k + 1]; t[k + 1] = t[k + 2]; t[k + 2] = x; }
  return t;
}

/** The parameter set as written to parameters.json, ready for make_cad.py. */
export function parametersJson(P) {
  const out = {};
  for (const k of SAVED_KEYS) out[k] = P[k];
  return JSON.stringify(out, null, 2);
}

/**
 * Files for the download bundle.
 *
 * The printed body carries each cavity as an inverted inner shell, which is
 * how a closed internal void is expressed in STL; slicers read that as
 * hollow, not as a second object.
 */
export function bundleFiles(parts, P) {
  return [
    { name: 'copper_body.stl', data: stlBinary([...parts.centre, ...parts.blades, ...parts.disk, ...parts.hubg]) },
    { name: 'copper_screw.stl', data: stlBinary(parts.screw) },
    { name: 'printed_body.stl', data: stlBinary([...parts.plastic, ...parts.ringg, ...parts.collar, ...parts.cavities.map(inverted)]) },
    { name: 'printed_wedge_single.stl', data: stlBinary([parts.plastic[0], ...(parts.cavities.length ? [inverted(parts.cavities[0])] : [])]) },
    { name: 'parameters.json', data: parametersJson(P) },
  ];
}
