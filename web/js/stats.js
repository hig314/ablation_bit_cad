// Derived numbers and the fit / tooling checks. Pure: returns rows of
// {label, value} and a list of warning strings; the caller renders them.

import { derived, groupVolume, BODY_GROUPS, closureRadius } from './geometry.js';

/** Latent heat of fusion per unit volume of ice, J/m^3. */
export const RHO_L = 917 * 334e3;
/** Degree-day factor, 7 mm per day per K, as m/s per K. */
export const DDF = 7e-3 / 86400;
export const DENSITY_COPPER = 8.96;   // g/cm^3
export const DENSITY_PETG = 1.27;     // g/cm^3

const deg = x => Math.atan(x) * 180 / Math.PI;

/**
 * Helicoid slope at radius r: the ramp climbs N*H per revolution, so the
 * tangent of the local ramp angle is N*H / (2*pi*r). It is steepest at the
 * centre, which is why the centre is a flat copper screw head instead.
 */
export function rampSlope(P, r) {
  return P.N * P.H / (2 * Math.PI * r);
}

export function computeStats(P, parts) {
  const { N, R, rc, H, D } = P;
  const rimAngle = deg(rampSlope(P, R));
  const inAngle = deg(rampSlope(P, rc));
  const meltPerK = RHO_L * Math.PI * (R * 1e-3) ** 2 * DDF;
  const vCu = groupVolume(parts, BODY_GROUPS.copper_body) + groupVolume(parts, BODY_GROUPS.copper_screw);
  const vPl = groupVolume(parts, BODY_GROUPS.printed_body) - groupVolume(parts, ['cavities']);

  const rows = [
    ['Pitch at rim', (2 * Math.PI * R / N).toFixed(1) + ' mm'],
    ['Ramp angle at rim / at centre', rimAngle.toFixed(1) + '° / ' + inAngle.toFixed(1) + '°'],
    ['Rotation per mm of ablation', (360 / (N * H)).toFixed(1) + '°'],
    ['Ablation per revolution', (N * H).toFixed(0) + ' mm'],
    ['Melt demand per °C of air', (meltPerK * 1e3).toFixed(0) + ' mW/K'],
    ['Copper (body + screw)', (vCu / 1000).toFixed(1) + ' cm³, ' + (vCu / 1000 * DENSITY_COPPER).toFixed(0) + ' g'],
    ['Printed body (less cavities)', (vPl / 1000).toFixed(1) + ' cm³, ' + (vPl / 1000 * DENSITY_PETG).toFixed(0) + ' g PETG'],
  ];

  const warnings = [];
  if (rimAngle < 6) warnings.push('rim ramp is below a 6° friction angle');
  if (D >= H) warnings.push('tip depth D must stay below H');
  if (inAngle > 60) warnings.push('centre ramp is very steep; enlarge the flat centre');

  // Blades are a fixed thickness in millimetres while the pitch shrinks
  // towards the axis, so thick or numerous blades run into each other
  // somewhere inside the disk. Inside that radius there is no gap to put
  // plastic in, and the copper figure above double-counts where the blades
  // pass through one another.
  const rClose = closureRadius(P);
  if (rClose > 0) {
    warnings.push('blades meet each other inside r = ' + rClose.toFixed(1)
      + ' mm: no plastic fits there and the copper figure double-counts the '
      + 'overlap. Reduce the blade thickness or the tooth count.');
  }

  return { rows, warnings, rimAngle, inAngle, vCu, vPl, closureRadius: rClose };
}

/**
 * Fit and tooling checks. A row is flagged when a gap is narrower than the
 * cutter that has to reach into it, or a clearance is zero, or the thread
 * engagement is under 1.5 diameters. These are the numbers that decide
 * whether the copper part can actually be milled.
 */
export function computeFits(P, parts) {
  const { rc, f, tb, tool, c, rs, hh, hc, R, ring } = P;
  const { dth, zTop, zStub, off } = derived(P);

  const gapRootInner = (rc + f) * dth - (tb + 2 * f);   // between root steps at the stub, under the disk
  const gapBladeInner = rc * dth - off(zStub);          // between plain blades at the stub
  const gapRim = (R - ring) * dth - (tb + 2 * f);       // between root steps at the outer end
  const threadLen = zTop - 1 - zStub;

  // A negative gap is not a tight gap: it means the two faces have passed
  // through each other. Say so, rather than printing a negative millimetre
  // reading that looks like a near miss.
  const gap = v => v.toFixed(1) + (v < 0 ? ' mm \u2014 they overlap' : ' mm');

  const rows = [
    ['Gap between blade roots at the stub', gap(gapRootInner), gapRootInner < tool],
    ['Gap between blades at the stub, below the roots', gap(gapBladeInner), gapBladeInner < tool],
    ['Gap between roots at the rim', gap(gapRim), gapRim < tool],
    ['Pocket clearance to each blade face', c.toFixed(2) + ' mm', c <= 0],
    ['Collar bore clearance to shank', c.toFixed(2) + ' mm', c <= 0],
    ['Thread engagement in the stub', threadLen.toFixed(1) + ' mm', threadLen < 1.5 * rs],
    ['Screw head + collar below the stub', (hh + hc).toFixed(1) + ' mm (stub bottom at z = ' + zStub.toFixed(1) + ')', false],
  ];
  const rClose = closureRadius(P);
  const note = `Warnings mark gaps narrower than the ${tool} mm tool or zero clearances.`
    + (rClose > 0
        ? ` Inside r = ${rClose.toFixed(1)} mm the blades pass through one another, so the printed body is drawn with nothing between them there.`
        : '');
  return { rows, note };
}
