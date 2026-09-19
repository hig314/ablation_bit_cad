// Lumped steady heat balance with depth feedback. Pure.
//
// The 2-D conduction model in analysis/tooth_thermal.py showed the copper
// stays within about 0.02 K of uniform, so copper is treated as isothermal
// at T_cu and the whole bit is four conductances:
//
//   in    air-side convection on exposed copper, plus an optional collector
//         plate with shortwave gain and longwave loss
//   out   cutting faces in contact with ice (h_ice * A_ice)
//   out   leakage through the ramp skins (U_ramp * A_ramp)
//
// The bit cuts at whatever rate the ice-contact heat allows. As the tip
// depth D grows, the copper exposed above the ice shrinks, which cuts the
// heat in: that is the feedback, and its sign decides whether the bit finds
// an equilibrium depth or rides against a stop.
//
// Ramp leak matters because it erodes the ice ramp under the bit, which the
// instrument cannot distinguish from real ablation. It is reported as
// "phantom descent".

import { RHO_L, rampSlope } from './stats.js';

/** Air-side film conductance from wind speed, W/m^2K. */
export const hFromWind = wind => 4 + 3 * wind;
/** Net longwave to a clear sky, W/m^2 (negative = loss). */
export const lwFromCloud = cloud => -60 * (1 - cloud);

/**
 * Balance at one tip depth D. Areas are in m^2, heats in W, T in K above
 * the melting point.
 */
export function thermalAt(P, D, sail) {
  const { N, R, rc, H, B, T, hub, ring, tb, Tair, SW, alb, hice, Uramp } = P;
  const h = hFromWind(P.wind);
  const LW = lwFromCloud(P.cloud);
  const Aplate = P.plate * 1e-4;
  const Rb = R - ring;
  const Afp = Math.PI * R * R * 1e-6;                 // footprint

  // Copper exposed to air: disk top and rim, hub, and the blade faces that
  // stand above the ice. With `sail` off, only the part below the ramp top
  // counts as a collector.
  const faceTop = sail ? H + B : H;
  const Aair = (Math.PI * Rb * Rb + 2 * Math.PI * Rb * T + 2 * Math.PI * hub * 10) * 1e-6
             + N * Math.max(0, faceTop - D) * (Rb - rc) * 1e-6;
  // Copper in contact with ice: the buried part of each blade, the flat
  // centre, and the leading edges.
  const Aice = (N * Math.max(0, Math.min(D, H)) * (Rb - rc) + Math.PI * rc * rc + N * Math.max(0, D) * tb) * 1e-6;
  // Ramp skin area, the helicoid surface between the centre and the rim.
  const Aramp = Math.PI * (Rb * Rb - rc * rc) * 1e-6 / Math.cos(Math.atan(rampSlope(P, R)));

  const a = Aplate * (SW * (1 - alb) + h * Tair + LW) + h * Tair * Aair;
  const b = h * (Aplate + Aair);
  const Gice = hice * Aice, Gramp = Uramp * Aramp;
  const Tcu = Math.max(0, a / (b + Gice + Gramp));
  const Qcut = Gice * Tcu, Qleak = Gramp * Tcu, Qin = a - b * Tcu;
  return {
    Tcu, Qcut, Qleak, Qin, Aair, Aice, Aramp,
    vcap: Qcut / (RHO_L * Afp) * 86400 * 1e3,          // mm/day the bit can cut
    phantom: Qleak / (RHO_L * Aramp) * 86400 * 1e3,    // mm/day of false descent
  };
}

/**
 * Full thermal report: the nominal balance, the capacity curve over depth,
 * the equilibrium depth where capacity meets the natural surface rate, and
 * the feedback gain there.
 */
export function computeThermal(P, sail) {
  const { Tair, SW, D, H, R } = P;
  const h = hFromWind(P.wind);
  const LW = lwFromCloud(P.cloud);
  const Afp = Math.PI * R * R * 1e-6;

  // What the undisturbed ice surface does with the same footprint, at an
  // ice-like albedo of 0.35. This is the rate the bit must match.
  const Qnat = Math.max(0, Afp * (SW * (1 - 0.35) + h * Tair + LW));
  const vs = Qnat / (RHO_L * Afp) * 86400 * 1e3;

  const at = d => thermalAt(P, d, sail);
  const nom = at(D);

  const Ds = [], vc = [];
  for (let i = 0; i <= 60; i++) { const d = H * i / 60; Ds.push(d); vc.push(at(d).vcap); }

  let Deq = null;
  for (let i = 0; i < 60; i++) {
    if ((vc[i] - vs) * (vc[i + 1] - vs) <= 0 && vc[i] !== vc[i + 1]) {
      Deq = Ds[i] + (vs - vc[i]) / (vc[i + 1] - vc[i]) * (Ds[i + 1] - Ds[i]);
      break;
    }
  }
  const dv = at(Math.min(H, D + 0.5)).vcap - at(Math.max(0, D - 0.5)).vcap;
  const gain = vs > 0 ? 100 * dv / vs : 0;
  const tau = dv < 0 ? -1 / dv : null;

  const rows = [
    ['Natural ice surface, same footprint', (Qnat * 1e3).toFixed(0) + ' mW → ' + vs.toFixed(1) + ' mm/day'],
    ['Heat into the bit at D = ' + D + ' mm', (nom.Qin * 1e3).toFixed(0) + ' mW (copper at ' + nom.Tcu.toFixed(2) + ' °C)'],
    ['Cutting capacity', nom.vcap.toFixed(1) + ' mm/day  (×' + (vs > 0 ? (nom.vcap / vs).toFixed(2) : '–') + ' of surface)'],
    ['Ramp leak → phantom descent', (nom.Qleak * 1e3).toFixed(1) + ' mW → ' + nom.phantom.toFixed(2) + ' mm/day'],
    ['Exposed copper in air / in ice', (nom.Aair * 1e4).toFixed(0) + ' / ' + (nom.Aice * 1e4).toFixed(0) + ' cm²'],
    ['Depth feedback at D', (gain <= 0 ? 'stabilising, ' : 'destabilising, ') + Math.abs(gain).toFixed(1) + ' % per mm' + (tau ? ', τ ≈ ' + tau.toFixed(1) + ' days' : '')],
    ['Equilibrium depth', Deq === null
      ? (vc[0] > vs ? 'none: bit always ahead, rides at the stop' : 'none: bit always behind')
      : Deq.toFixed(1) + ' mm' + (Deq > H * 0.85 ? ' (near the ramp top)' : '')],
  ];

  const warnings = [];
  if (vs > 0 && nom.vcap < vs) warnings.push('under-supplied at the nominal depth');
  if (vs > 0 && nom.vcap > 2 * vs) warnings.push('more than 2× over-supplied; expect ramp leak and a wide hole');

  return { rows, warnings, nom, vs, Ds, vc, Deq, gain, tau };
}
