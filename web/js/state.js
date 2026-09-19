// Shareable state in the URL hash, plus parameters.json load and save.
//
// Only values that differ from the defaults are written, so a link stays
// short and a future change of default does not silently freeze the old
// one into every existing link. `v` is the schema version: bump it if the
// meaning of a key ever changes, and handle the old value here.

import { PARAMS, TOGGLES, BY_KEY, TOGGLE_BY_KEY, defaults, toggleDefaults, clamp } from './params.js';

export const SCHEMA = 1;

/** Compact number: no trailing zeros, no exponent for the ranges we use. */
function num(v) {
  return String(Math.round(v * 1e6) / 1e6);
}

/** Encode the non-default parameters and toggles as a URL hash fragment. */
export function encode(P, toggles) {
  const bits = [];
  for (const p of PARAMS) {
    if (P[p.key] !== p.def) bits.push(`${p.key}=${num(P[p.key])}`);
  }
  for (const t of TOGGLES) {
    if (toggles[t.key] !== t.def) bits.push(`${t.key}=${toggles[t.key] ? 1 : 0}`);
  }
  if (!bits.length) return '';
  return `v=${SCHEMA}&` + bits.join('&');
}

/**
 * Decode a hash fragment onto the defaults. Unknown keys are ignored rather
 * than rejected, so a link made by a newer version still opens, just
 * without whatever it added.
 */
export function decode(hash) {
  const P = defaults(), toggles = toggleDefaults();
  const text = String(hash || '').replace(/^#/, '');
  if (!text) return { P: clamp(P), toggles, empty: true };
  for (const bit of text.split('&')) {
    const i = bit.indexOf('=');
    if (i < 0) continue;
    const key = decodeURIComponent(bit.slice(0, i));
    const raw = decodeURIComponent(bit.slice(i + 1));
    if (key === 'v') continue;
    if (BY_KEY[key]) {
      const v = Number(raw);
      if (Number.isFinite(v)) P[key] = v;
    } else if (TOGGLE_BY_KEY[key]) {
      toggles[key] = raw === '1' || raw === 'true';
    }
  }
  return { P: clamp(P), toggles, empty: false };
}

/**
 * Apply a parsed parameters.json. Keys the file does not mention keep their
 * current value, so a file written by make_cad.py (which carries only the
 * CAD parameters) does not reset the thermal panel.
 */
export function fromJson(text, current) {
  const data = JSON.parse(text);
  if (!data || typeof data !== 'object') throw new Error('not a parameter object');
  const P = { ...current };
  let used = 0;
  for (const [k, v] of Object.entries(data)) {
    if (BY_KEY[k] && Number.isFinite(Number(v))) { P[k] = Number(v); used++; }
  }
  if (!used) throw new Error('no recognised parameters in that file');
  return { P: clamp(P), used };
}
