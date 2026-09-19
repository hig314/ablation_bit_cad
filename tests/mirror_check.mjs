// Is the plastic the complement of the copper?
//
//   node tests/mirror_check.mjs tests/fixtures/default.json
//
// The printed body should be exactly the space the copper leaves, less the
// fit clearance. This builds that from first principles and compares it
// against what the viewer draws, reporting what is missing and what is
// drawn where it should not be, with the reason for each.
//
// It is a measurement rather than a pass/fail test: the viewer describes
// the plastic as a handful of annular sectors, which cannot follow the
// corner where a blade's root step ends, so a little disagreement is
// expected there and is reported as "inner step".
//
// "Should be plastic" is built from first principles the way make_cad.py
// does it: the whole annular wedge from the ramp up to the disk, less every
// blade grown by the fit clearance, less the bore above the collar. Then
// that is compared with what the viewer actually draws.
import { readFileSync } from 'node:fs';
import { buildParts, derived, rampSpan, offsetAngle } from '../web/js/geometry.js';
import { clamp, defaults } from '../web/js/params.js';

const P = clamp({ ...defaults(), ...JSON.parse(readFileSync(process.argv[2], 'utf8')) });
const { dth, Rb, zTop, zRoot, zStub, off } = derived(P);
const { rc, f, c, N, H } = P, rBlade = Rb - c;

/** Inside a blade grown by the fit clearance on every face. */
function inPocket(x, y, z, detail) {
  for (let k = 0; k < N; k++) {
    const th = k * dth, cs = Math.cos(th), sn = Math.sin(th);
    const u = x * cs + y * sn, d = x * sn - y * cs;
    if (z >= -c && z <= zRoot + c && u >= rc - c && u <= rBlade + c && d >= -c && d <= off(z) + c) { if (detail) detail.push(k + ' ' + 'main' + (d < off(z)/2 ? ' rear side' : ' front side')); return true; }
    if (P.hr > 0 && f > 0 && z >= zRoot - c && z <= zTop + c && u >= rc - c && u <= rBlade + c && d >= -f - c && d <= off(z) + f + c) { if (detail) detail.push(k + ' ' + 'root step' + (d < off(z)/2 ? ' rear side' : ' front side')); return true; }
    if (f > 0 && z >= zStub - c && z <= zRoot + c && u >= rc - c && u <= rc + f + c && d >= -f - c && d <= off(z) + f + c) { if (detail) detail.push(k + ' ' + 'inner step' + (d < off(z)/2 ? ' rear side' : ' front side')); return true; }
  }
  return false;
}

function shouldBePlastic(x, y, z) {
  const r = Math.hypot(x, y);
  if (r < rc || r > Rb) return false;
  let t = Math.atan2(y, x); if (t < 0) t += 2 * Math.PI;
  const k = Math.floor(t / dth);
  // the same ramp the tool builds: the full climb over whatever arc the
  // blades leave, so it steepens towards the middle
  const span = rampSpan(P, r);
  const lead = k * dth + offsetAngle(c, r);
  const ramp = span > 0 ? Math.min(H, Math.max(0, H * (t - lead) / span)) : 0;
  if (z < ramp || z > zTop) return false;
  if (r < rc + c && z > zStub - c) return false;       // the bore above the collar
  return !inPocket(x, y, z);
}

function inShell(tris, p) {
  let hits = 0;
  for (let i = 0; i < tris.length; i += 3) {
    const a = tris[i], b = tris[i+1], cc = tris[i+2];
    const e1y=b[1]-a[1], e1z=b[2]-a[2], e2y=cc[1]-a[1], e2z=cc[2]-a[2];
    const det=e1y*e2z-e1z*e2y; if (Math.abs(det)<1e-14) continue;
    const ty=p[1]-a[1], tz=p[2]-a[2];
    const u=(ty*e2z-tz*e2y)/det, v=(e1y*tz-e1z*ty)/det;
    if (u<0||v<0||u+v>1) continue;
    if (a[0]+u*(b[0]-a[0])+v*(cc[0]-a[0]) > p[0]) hits++;
  }
  return (hits & 1) === 1;
}

const parts = buildParts(P);
const per = parts.plastic.length / N;
const wedge = parts.plastic.slice(0, per);        // wedge 0 only
const inDrawn = p => wedge.some(s => inShell(s, p));

const STEP = 0.2, cell = STEP ** 3;
let missing = 0, extra = 0, both = 0;
const mBox = { r: [Infinity, -Infinity], z: [Infinity, -Infinity], t: [Infinity, -Infinity] };
const xBox = { r: [Infinity, -Infinity], z: [Infinity, -Infinity], t: [Infinity, -Infinity] };
const xWhy = {};
for (let x = -Rb; x < Rb; x += STEP)
  for (let y = -Rb; y < Rb; y += STEP) {
    const r = Math.hypot(x, y); if (r < rc - 1 || r > Rb + 1) continue;
    let t = Math.atan2(y, x); if (t < 0) t += 2 * Math.PI;
    if (t > dth) continue;                         // wedge 0's angular slot
    for (let z = 0; z < zTop; z += STEP) {
      const want = shouldBePlastic(x, y, z), got = inDrawn([x, y, z]);
      if (want && got) both++;
      else if (want && !got) {
        missing++;
        mBox.r[0]=Math.min(mBox.r[0],r); mBox.r[1]=Math.max(mBox.r[1],r);
        mBox.z[0]=Math.min(mBox.z[0],z); mBox.z[1]=Math.max(mBox.z[1],z);
        mBox.t[0]=Math.min(mBox.t[0],t); mBox.t[1]=Math.max(mBox.t[1],t);
      } else if (!want && got) {
        extra++;
        xBox.r[0]=Math.min(xBox.r[0],r); xBox.r[1]=Math.max(xBox.r[1],r);
        xBox.z[0]=Math.min(xBox.z[0],z); xBox.z[1]=Math.max(xBox.z[1],z);
        xBox.t[0]=Math.min(xBox.t[0],t); xBox.t[1]=Math.max(xBox.t[1],t);
        // which rule says it should not be there?
        let why = 'outside the wedge';
        const kk = Math.floor(t / dth), rampz = H * (t - kk * dth) / dth;
        if (r < rc) why = 'inside rc';
        else if (r > Rb) why = 'outside Rb';
        else if (z < rampz) why = 'below the ramp';
        else if (z > zTop) why = 'above the disk';
        else if (r < rc + c && z > zStub - c) why = 'in the centre bore';
        else { const det = []; if (inPocket(x, y, z, det)) why = 'pocket: ' + det[0]; }
        xWhy[why] = (xWhy[why] || 0) + 1;
      }
    }
  }
const deg = x => (x * 180 / Math.PI).toFixed(1);
console.log('Wedge 0, %s mm grid:', STEP);
console.log('  drawn and wanted : %s mm3', (both*cell).toFixed(1));
console.log('  wanted, missing  : %s mm3%s', (missing*cell).toFixed(1),
  missing ? '   r ' + mBox.r[0].toFixed(1) + '..' + mBox.r[1].toFixed(1) +
            '  z ' + mBox.z[0].toFixed(1) + '..' + mBox.z[1].toFixed(1) +
            '  theta ' + deg(mBox.t[0]) + '..' + deg(mBox.t[1]) + ' deg' : '');
console.log('  drawn, unwanted  : %s mm3%s', (extra*cell).toFixed(1),
  extra ? '   r ' + xBox.r[0].toFixed(1) + '..' + xBox.r[1].toFixed(1) +
          '  z ' + xBox.z[0].toFixed(1) + '..' + xBox.z[1].toFixed(1) +
          '  theta ' + deg(xBox.t[0]) + '..' + deg(xBox.t[1]) + ' deg' : '');
for (const [k, v] of Object.entries(xWhy).sort((a,b)=>b[1]-a[1]))
  console.log('        %s mm3  %s', (v*cell).toFixed(1).padStart(6), k);
