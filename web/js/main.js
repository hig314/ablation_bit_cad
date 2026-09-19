// Wiring: builds the control panel from the parameter definitions, keeps
// the URL hash in step with the controls, and renders the tables, the
// chart and the 3-D view.

import { GROUPS, PARAMS, TOGGLES, clamp } from './params.js';
import { buildParts, closureRadius } from './geometry.js';
import { computeStats, computeFits } from './stats.js';
import { computeThermal } from './thermal.js';
import { bundleFiles, parametersJson } from './export.js';
import { encode, decode, fromJson } from './state.js';
import { createViewer } from './viewer.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- state ----------
const initial = decode(window.location.hash);
let P = initial.P;
let toggles = initial.toggles;
let parts = null;

// ---------- control panel ----------
function paramRow(p) {
  return `<div class="row">
    <label for="${p.key}">${esc(p.label)} <small>${esc(p.help)}</small></label>
    <input id="${p.key}" type="number" min="${p.min}" max="${p.max}" step="${p.step}" value="${P[p.key]}">
    <input type="range" data-for="${p.key}" min="${p.min}" max="${p.max}" step="${p.step}" value="${P[p.key]}">
  </div>`;
}
function toggleRow(t) {
  return `<label><input type="checkbox" data-toggle="${t.key}"${toggles[t.key] ? ' checked' : ''}> ${esc(t.label)}</label>`;
}
function buildPanel() {
  $('controls').innerHTML = GROUPS.map(g => {
    let inner = '';
    // The View group lists its toggles above its one parameter; the Thermal
    // group lists its toggle below. Ordering follows the original panel.
    if (g.legend === 'View' && g.toggles) inner += `<div class="toggles">${g.toggles.map(toggleRow).join('')}</div>`;
    inner += (g.params || []).map(paramRow).join('');
    if (g.legend !== 'View' && g.toggles) inner += `<div class="toggles">${g.toggles.map(toggleRow).join('')}</div>`;
    if (g.table) inner += `<table class="stats" id="${g.table}"></table>`;
    if (g.chart) inner += `<svg id="chart" viewBox="0 0 300 150" width="100%" style="margin-top:8px"></svg>`;
    return `<fieldset><legend>${esc(g.legend)}</legend>${inner}</fieldset>`;
  }).join('');

  for (const p of PARAMS) {
    const n = $(p.key), r = document.querySelector(`input[type=range][data-for="${p.key}"]`);
    n.addEventListener('input', () => { r.value = n.value; onInput(); });
    r.addEventListener('input', () => { n.value = r.value; onInput(); });
  }
  document.querySelectorAll('input[data-toggle]').forEach(c => {
    c.addEventListener('change', () => {
      toggles[c.dataset.toggle] = c.checked;
      // `sail` changes the exposed-copper area, so it changes the thermal
      // answer, not just what is drawn.
      if (c.dataset.toggle === 'sail') renderThermal();
      viewer.applyVisibility(toggles);
      syncHash();
    });
  });
}

/** Push the controls back to the values actually in use after clamping. */
function refreshControls() {
  for (const p of PARAMS) {
    const n = $(p.key), r = document.querySelector(`input[type=range][data-for="${p.key}"]`);
    if (n && Number(n.value) !== P[p.key]) n.value = P[p.key];
    if (r && Number(r.value) !== P[p.key]) r.value = P[p.key];
  }
  document.querySelectorAll('input[data-toggle]').forEach(c => { c.checked = !!toggles[c.dataset.toggle]; });
}

function readControls() {
  const next = {};
  for (const p of PARAMS) next[p.key] = parseFloat($(p.key).value);
  P = clamp(next);
}

function onInput() { readControls(); rebuild(); syncHash(); }

// ---------- tables and chart ----------
function renderStats() {
  const { rows, warnings } = computeStats(P, parts);
  $('stats').innerHTML = rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')
    + (warnings.length ? `<tr><td colspan="2" class="warn">${esc(warnings.join('; '))}</td></tr>` : '');
}
function renderFits() {
  const { rows, note } = computeFits(P, parts);
  $('fits').innerHTML = rows.map(([k, v, bad]) => `<tr><td>${esc(k)}</td><td class="${bad ? 'warn' : ''}">${esc(v)}</td></tr>`).join('')
    + `<tr><td colspan="2" style="color:var(--muted)">${esc(note)}</td></tr>`;
}
function renderThermal() {
  const t = computeThermal(P, !!toggles.sail);
  $('thermal').innerHTML = t.rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')
    + (t.warnings.length ? `<tr><td colspan="2" class="warn">${esc(t.warnings.join('; '))}</td></tr>` : '');
  renderChart(t);
}
/** Cutting capacity against tip depth, with the natural surface rate. */
function renderChart(t) {
  const W = 300, Hh = 150, L = 34, Bm = 24, Tm = 10, Rm = 8;
  const { Ds, vc, vs, Deq } = t;
  const ymax = Math.max(1.05 * Math.max(...vc, vs), 0.1);
  const X = d => L + (W - L - Rm) * d / P.H;
  const Y = v => Hh - Bm - (Hh - Bm - Tm) * v / ymax;
  const path = Ds.map((d, i) => (i ? 'L' : 'M') + X(d).toFixed(1) + ' ' + Y(vc[i]).toFixed(1)).join(' ');
  $('chart').innerHTML = `
    <rect x="${L}" y="${Tm}" width="${W - L - Rm}" height="${Hh - Bm - Tm}" fill="none" stroke="var(--line)"/>
    <line x1="${L}" x2="${W - Rm}" y1="${Y(vs)}" y2="${Y(vs)}" stroke="var(--accent)" stroke-dasharray="4 3"/>
    <path d="${path}" fill="none" stroke="var(--copper)" stroke-width="2"/>
    <line x1="${X(P.D)}" x2="${X(P.D)}" y1="${Tm}" y2="${Hh - Bm}" stroke="var(--muted)" stroke-dasharray="2 3"/>
    ${Deq !== null ? `<circle cx="${X(Deq)}" cy="${Y(vs)}" r="3.5" fill="var(--focus)"/>` : ''}
    <text x="${L}" y="${Hh - 6}" font-size="9" fill="var(--muted)">tip depth D: 0</text>
    <text x="${W - Rm}" y="${Hh - 6}" font-size="9" fill="var(--muted)" text-anchor="end">${P.H} mm</text>
    <text x="${L - 3}" y="${Y(ymax) + 4}" font-size="9" fill="var(--muted)" text-anchor="end">${ymax.toFixed(0)}</text>
    <text x="${L - 3}" y="${Y(0)}" font-size="9" fill="var(--muted)" text-anchor="end">0</text>
    <text x="${L + 4}" y="${Tm + 10}" font-size="9" fill="var(--copper)">capacity, mm/day</text>
    <text x="${W - Rm - 3}" y="${Y(vs) - 3}" font-size="9" fill="var(--accent)" text-anchor="end">surface rate</text>`;
}

// ---------- rebuild ----------
function rebuild() {
  refreshControls();
  parts = buildParts(P);
  renderStats(); renderFits(); renderThermal();
  viewer.show(parts, P, toggles);
}

// ---------- URL state ----------
let hashOurs = '';
function syncHash() {
  const h = encode(P, toggles);
  hashOurs = h ? '#' + h : '#';
  history.replaceState(null, '', hashOurs);
  notifyHost(hashOurs);
}

/**
 * Tell the page embedding us that the design changed, so it can put the
 * link in its own address bar.
 *
 * replaceState fires no event, so a host cannot observe our hash without
 * polling, and a 2 Hz poll is enough to stop a page ever going idle. This
 * says it explicitly instead. Addressed to our own origin, so a host on a
 * different origin simply never receives it.
 */
function notifyHost(hash) {
  if (window.parent === window) return;
  try {
    window.parent.postMessage({ type: 'tool-state', slug: 'ablation-bit', hash }, window.location.origin);
  } catch (e) { /* nothing listening; not an error */ }
}
// A link pasted into the address bar, or the parent page pushing state in.
window.addEventListener('hashchange', () => {
  if (window.location.hash === hashOurs) return;
  const s = decode(window.location.hash);
  P = s.P; toggles = s.toggles;
  rebuild();
});

// ---------- export ----------
function saveBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function wireButtons() {
  const status = $('status');

  $('exportBtn').addEventListener('click', async () => {
    status.textContent = 'Building STL files…';
    try {
      const zip = new JSZip();
      for (const f of bundleFiles(parts, P)) zip.file(f.name, f.data);
      const blob = await zip.generateAsync({ type: 'blob' });
      saveBlob('ablation_bit_stl.zip', blob);
      // The mesh is sound even where the blades crowd together, because each
      // wedge is trimmed at the height its gap shuts. What is not sound is
      // the design: the copper cannot be cut with blades that pass through
      // each other, and the plastic left between them is a sliver.
      const rClose = closureRadius(P);
      status.textContent = 'Saved. Units are millimetres; tips at z = 0, z up.'
        + (rClose > 0
            ? ' Warning: the blades pass through each other inside r = ' + rClose.toFixed(1)
              + ' mm. The copper cannot be made as drawn, and the plastic there is a sliver'
              + ' too thin to print.'
            : '');
    } catch (e) {
      status.textContent = 'Could not save: ' + (e && e.message ? e.message : e);
    }
  });

  $('jsonBtn').addEventListener('click', () => {
    saveBlob('parameters.json', new Blob([parametersJson(P)], { type: 'application/json' }));
    status.textContent = 'Saved parameters.json. Feed it to cad/make_cad.py for the STEP files.';
  });

  $('copyBtn').addEventListener('click', async () => {
    // Inside an iframe the useful link is the parent page's, which the host
    // keeps in step with this hash.
    const inFrame = window.parent !== window;
    let url;
    try {
      url = inFrame ? window.parent.location.href : window.location.href;
    } catch (e) {
      url = window.location.href;   // cross-origin parent; fall back to our own
    }
    try {
      await navigator.clipboard.writeText(url);
      status.textContent = 'Link copied. It carries the current parameters.';
    } catch (e) {
      status.textContent = 'Copy this link: ' + url;
    }
  });

  $('loadBtn').addEventListener('click', () => $('loadFile').click());
  $('loadFile').addEventListener('change', async e => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const { P: next, used } = fromJson(await file.text(), P);
      P = next;
      rebuild(); syncHash();
      status.textContent = `Loaded ${used} parameters from ${file.name}.`;
    } catch (err) {
      status.textContent = 'Could not read that file: ' + (err && err.message ? err.message : err);
    }
    e.target.value = '';
  });

  $('resetView').addEventListener('click', () => viewer.resetView());
}

/** Version and repository link, from the bundle manifest. */
async function showVersion() {
  try {
    const m = await (await fetch('tool.json', { cache: 'no-cache' })).json();
    const repo = m.repo ? ` · <a href="${esc(m.repo)}" target="_blank" rel="noopener">source</a>` : '';
    $('version').innerHTML = `${esc(m.name || 'tool')} v${esc(m.version || '?')}${repo}`;
  } catch (e) {
    $('version').textContent = '';
  }
}

// ---------- start ----------
const viewer = createViewer($('view3d'));
buildPanel();
wireButtons();
rebuild();
viewer.resize();
if (!initial.empty) syncHash();
notifyHost(window.location.hash || '#');
showVersion();
window.addEventListener('resize', () => viewer.resize());
