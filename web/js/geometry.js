// Geometry core. Pure: no DOM, no three.js, no globals. Node imports this
// directly so the consistency test can compare these solids against the
// CadQuery ones without a browser.
//
// Frame: millimetres, z up, tooth tips at z = 0, axis = z. Blade k's rear
// face lies on the radial plane at angle k*2*pi/N from +x. The bit turns
// clockwise seen from above, so "forward" (the direction of travel) is -theta.
//
// Every part is a flat list of triangle vertices [[x,y,z], ...], three per
// triangle, wound counter-clockwise seen from outside. That is also exactly
// what the STL writer consumes.

/** Newell-style normal of the triangle a,b,c (not normalised). */
export function normal(a, b, c) {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  return [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
}

/**
 * Emit quad a,b,c,d into `tris`, flipped if its normal opposes `out`.
 * The orientation test uses the diagonals so that a quad with a degenerate
 * corner (one collapsed onto the axis) still gets a usable normal.
 */
export function quad(tris, a, b, c, d, out) {
  const n = normal(a, c, [a[0] + d[0] - b[0], a[1] + d[1] - b[1], a[2] + d[2] - b[2]]);
  const flip = (n[0] * out[0] + n[1] * out[1] + n[2] * out[2]) < 0;
  if (flip) { tris.push(a, c, b, a, d, c); } else { tris.push(a, b, c, a, c, d); }
}

/**
 * Closed shell bounded by r in [r0,r1], theta in [thA(r,z), thB(r,z)] and
 * z in [zb(theta,r), zt(theta,r)].
 *
 * The caps are the subtle part: a cap point's theta depends on z, and on a
 * helicoid z depends on theta. Two or three fixed-point passes settle it to
 * far below the tessellation error, which is what `cap` does.
 */
export function sectorSolid({ r0, r1, thA, thB, zb, zt, nu = 24, nr = 4, nz = 1, invert = false }) {
  const tris = [];
  const th = (u, r, z) => thA(r, z) + u * (thB(r, z) - thA(r, z));
  const pt = (t, r, z) => [r * Math.cos(t), r * Math.sin(t), z];
  const cap = (u, r, zf) => {
    let z = zf(th(u, r, 0), r);
    for (let k = 0; k < 3; k++) z = zf(th(u, r, z), r);
    return pt(th(u, r, z), r, z);
  };
  const rs = [], us = [];
  for (let j = 0; j <= nr; j++) rs.push(r0 + (r1 - r0) * j / nr);
  for (let i = 0; i <= nu; i++) us.push(i / nu);
  // top and bottom caps
  for (let i = 0; i < nu; i++) for (let j = 0; j < nr; j++) {
    const c = [[us[i], rs[j]], [us[i + 1], rs[j]], [us[i + 1], rs[j + 1]], [us[i], rs[j + 1]]];
    quad(tris, ...c.map(([u, r]) => cap(u, r, zt)), [0, 0, 1]);
    quad(tris, ...c.map(([u, r]) => cap(u, r, zb)), [0, 0, -1]);
  }
  // cylindrical walls at r0 and r1
  const wallPt = (u, r, f) => {
    const b = cap(u, r, zb), t = cap(u, r, zt);
    const z = b[2] + f * (t[2] - b[2]);
    return pt(th(u, r, z), r, z);
  };
  for (let i = 0; i < nu; i++) for (let k = 0; k < nz; k++) {
    const f0 = k / nz, f1 = (k + 1) / nz;
    for (const [r, sgn] of [[r1, 1], [r0, -1]]) {
      if (r <= 1e-6) continue;
      const tm = th((us[i] + us[i + 1]) / 2, r, 0);
      quad(tris, wallPt(us[i], r, f0), wallPt(us[i + 1], r, f0), wallPt(us[i + 1], r, f1), wallPt(us[i], r, f1),
           [sgn * Math.cos(tm), sgn * Math.sin(tm), 0]);
    }
  }
  // radial walls at thA and thB
  for (let j = 0; j < nr; j++) for (let k = 0; k < nz; k++) {
    const f0 = k / nz, f1 = (k + 1) / nz;
    for (const [u, sgn] of [[0, -1], [1, 1]]) {
      const r_a = rs[j], r_b = rs[j + 1], tm = th(u, (r_a + r_b) / 2, 0);
      quad(tris, wallPt(u, r_a, f0), wallPt(u, r_b, f0), wallPt(u, r_b, f1), wallPt(u, r_a, f1),
           [-sgn * Math.sin(tm), sgn * Math.cos(tm), 0]);
    }
  }
  if (invert) for (let k = 0; k < tris.length; k += 3) { const t = tris[k + 1]; tris[k + 1] = tris[k + 2]; tris[k + 2] = t; }
  return tris;
}

/**
 * Radial prism between the rear offset dR(z) and the front offset dF(z)
 * from the radial plane at angle `th`. Offsets are measured forward, toward
 * -theta, which is the direction of travel.
 */
export function prismSolid(r0, r1, th, z0, z1, dR, dF, nz = 10) {
  const tris = [];
  const ux = Math.cos(th), uy = Math.sin(th), tx = -Math.sin(th), ty = Math.cos(th);
  const p = (r, d, z) => [r * ux - d * tx, r * uy - d * ty, z];
  const zs = [];
  for (let k = 0; k <= nz; k++) zs.push(z0 + (z1 - z0) * k / nz);
  for (let k = 0; k < nz; k++) {
    const za = zs[k], zc = zs[k + 1];
    quad(tris, p(r0, dF(za), za), p(r1, dF(za), za), p(r1, dF(zc), zc), p(r0, dF(zc), zc), [-tx, -ty, 0]);
    quad(tris, p(r0, dR(za), za), p(r1, dR(za), za), p(r1, dR(zc), zc), p(r0, dR(zc), zc), [tx, ty, 0]);
    quad(tris, p(r1, dR(za), za), p(r1, dF(za), za), p(r1, dF(zc), zc), p(r1, dR(zc), zc), [ux, uy, 0]);
    quad(tris, p(r0, dR(za), za), p(r0, dF(za), za), p(r0, dF(zc), zc), p(r0, dR(zc), zc), [-ux, -uy, 0]);
  }
  quad(tris, p(r0, dR(z0), z0), p(r1, dR(z0), z0), p(r1, dF(z0), z0), p(r0, dF(z0), z0), [0, 0, -1]);
  quad(tris, p(r0, dR(z1), z1), p(r1, dR(z1), z1), p(r1, dF(z1), z1), p(r0, dF(z1), z1), [0, 0, 1]);
  return tris;
}

/** Signed volume of a closed triangle shell, mm^3. Negative if inverted. */
export function signedVolume(tris) {
  let v = 0;
  for (let k = 0; k < tris.length; k += 3) {
    const a = tris[k], b = tris[k + 1], c = tris[k + 2];
    v += (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
  }
  return v;
}

/** Axis-aligned bounds of a list of shells: {min:[x,y,z], max:[x,y,z]}. */
export function bounds(shells) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const tris of shells) for (const p of tris) for (let i = 0; i < 3; i++) {
    if (p[i] < min[i]) min[i] = p[i];
    if (p[i] > max[i]) max[i] = p[i];
  }
  return { min, max };
}

/**
 * Derived heights and the blade offset function, shared by the geometry,
 * the fit checks and the thermal model so they cannot disagree.
 *
 *   zTop  top of the blades = underside of the copper disk
 *   zRoot bottom of the root step under the disk
 *   zStub bottom of the copper centre stub (must clear the ramp top)
 *   off(z) blade thickness at height z, tapering from te at the edge to tb
 */
export function derived(P) {
  const zTop = P.H + P.B;
  const zt = P.Zt > 0 ? P.Zt : zTop;
  const off = z => P.te + (P.tb - P.te) * Math.min(1, Math.max(0, z / zt));
  return {
    dth: 2 * Math.PI / P.N,
    Rb: P.R - P.ring,
    zTop,
    zRoot: zTop - P.hr,
    zStub: Math.max(P.hh + P.hc, P.H + 1),
    off,
  };
}

/**
 * Build every shell of the assembly, grouped by part. Groups exist because
 * the viewer colours them separately and the STL export bundles them into
 * three printable/millable bodies:
 *
 *   copper body  = centre + blades + disk + hubg
 *   copper screw = screw
 *   printed body = plastic + ringg + collar, with cavities as inverted voids
 */
export function buildParts(P) {
  const { N, R, rc, H, tb, te, Zt, T, hub, f, hr, rs, hh, hc, c, B, skin, ring, cav } = P;
  const { dth, Rb, zTop, zRoot, zStub, off } = derived(P);
  const full = { thA: () => 0, thB: () => 2 * Math.PI };
  const parts = { centre: [], blades: [], disk: [], hubg: [], screw: [], collar: [], plastic: [], ringg: [], cavities: [] };

  // copper body: threaded centre stub (a tube), top disk, hub boss
  parts.centre.push(sectorSolid({ r0: rs, r1: rc, ...full, zb: () => zStub, zt: () => zTop, nu: 64, nr: 1 }));
  parts.disk.push(sectorSolid({ r0: 0, r1: Rb, ...full, zb: () => zTop, zt: () => zTop + T, nu: 96, nr: 1 }));
  parts.hubg.push(sectorSolid({ r0: 0, r1: hub, ...full, zb: () => zTop + T, zt: () => zTop + T + 10, nu: 48, nr: 1 }));

  // centre screw: the head is the flat melting base, the shank threads into the stub
  parts.screw.push(sectorSolid({ r0: 0, r1: rc, ...full, zb: () => 0, zt: () => hh, nu: 64, nr: 1 }));
  parts.screw.push(sectorSolid({ r0: 0, r1: rs, ...full, zb: () => hh, zt: () => zTop - 1, nu: 32, nr: 1 }));

  // printed collar between the screw head and the stub, bored for the shank
  parts.collar.push(sectorSolid({ r0: rs + c, r1: rc, ...full, zb: () => hh, zt: () => zStub, nu: 64, nr: 1 }));
  if (ring > 0) parts.ringg.push(sectorSolid({ r0: Rb, r1: R, ...full, zb: () => H, zt: () => zTop, nu: 96, nr: 1 }));

  for (let k = 0; k < N; k++) {
    const th = k * dth, thNext = th + dth;
    parts.blades.push(prismSolid(rc, Rb, th, 0, zRoot, () => 0, off));
    if (hr > 0 && f > 0) parts.blades.push(prismSolid(rc, Rb, th, zRoot, zTop, () => -f, z => off(z) + f));
    if (f > 0) parts.blades.push(prismSolid(rc, rc + f, th, zStub, zRoot, () => -f, z => off(z) + f));

    // printed wedge behind blade k; its pocket walls follow the blade faces plus clearance
    const thA = r => th + c / r;
    const thB = (r, z) => thNext - off(z) / r - c / r;
    const ramp = t => Math.max(0, H * (t - th) / dth);
    const notchA = r => thA(r) + f / r;
    const notchB = (r, z) => thB(r, z) - f / r;
    const common = { nu: 8, nr: 4, nz: 4 };
    parts.plastic.push(sectorSolid({ r0: rc + f, r1: Rb, thA: notchA, thB: notchB, zb: t => ramp(t), zt: () => zTop, nu: 40, nr: 6, nz: 4 }));
    if (f > 0 && hr > 0) {
      parts.plastic.push(sectorSolid({ r0: rc + f, r1: Rb, thA, thB: notchA, zb: t => ramp(t), zt: () => zRoot, ...common }));
      parts.plastic.push(sectorSolid({ r0: rc + f, r1: Rb, thA: notchB, thB, zb: t => ramp(t), zt: () => zRoot, ...common }));
    }
    if (f > 0) parts.plastic.push(sectorSolid({ r0: rc, r1: rc + f, thA, thB, zb: t => ramp(t), zt: () => zStub, nu: 40, nr: 1, nz: 4 }));
    if (cav > 0 && B > hr + 2 * skin + 1) {
      const cA = r => notchA(r) + skin / r;
      const cB = r => th + cav * dth - skin / r;
      if (cB(rc + f + skin) > cA(rc + f + skin) + 0.02) {
        parts.cavities.push(sectorSolid({ r0: rc + f + skin, r1: Rb - skin, thA: cA, thB: cB, zb: t => ramp(t) + skin, zt: () => zRoot - skin, nu: 24, nr: 4 }));
      }
    }
  }
  parts.meta = { zStub, zRoot, zTop, Rb, off, dth };
  return parts;
}

/** The three exported bodies, as lists of shells. Cavities stay separate. */
export const BODY_GROUPS = {
  copper_body: ['centre', 'blades', 'disk', 'hubg'],
  copper_screw: ['screw'],
  printed_body: ['plastic', 'ringg', 'collar'],
};

/** Total signed volume of the named groups, mm^3. */
export function groupVolume(parts, names) {
  let v = 0;
  for (const n of names) for (const tris of parts[n]) v += signedVolume(tris);
  return v;
}

/** Volumes of the three bodies in cm^3, cavities already subtracted. */
export function volumes(parts) {
  const cav = groupVolume(parts, ['cavities']);
  return {
    copper_body: groupVolume(parts, BODY_GROUPS.copper_body) / 1000,
    copper_screw: groupVolume(parts, BODY_GROUPS.copper_screw) / 1000,
    printed_body: (groupVolume(parts, BODY_GROUPS.printed_body) - cav) / 1000,
    cavities: cav / 1000,
  };
}
