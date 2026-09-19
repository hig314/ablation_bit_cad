// three.js scene: materials, groups, orbit control, explode, visibility.
// Everything DOM- and render-specific lives here; the geometry it draws
// comes in already built. THREE is a global, loaded by a classic script tag
// before this module.

import { sectorSolid } from './geometry.js';

/** Part group -> material name. Cavities are drawn as a translucent shell. */
const GROUP_NAMES = ['centre', 'blades', 'disk', 'hubg', 'screw', 'collar', 'plastic', 'ringg', 'cavities', 'ice'];
const COPPER_GROUPS = ['centre', 'blades', 'disk', 'hubg'];

/**
 * Triangle list (z up, mm) to a three.js BufferGeometry (y up).
 * three's default camera and lighting assume y up, so the frame is rotated
 * here rather than in the geometry, which stays in the CAD frame.
 */
function toGeometry(tris) {
  const arr = new Float32Array(tris.length * 3);
  tris.forEach((p, i) => { arr[3 * i] = p[0]; arr[3 * i + 1] = p[2]; arr[3 * i + 2] = -p[1]; });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  g.computeVertexNormals();
  return g;
}

export function createViewer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 1, 2000);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 0.85));
  const sun = new THREE.DirectionalLight(0xffffff, 0.75); sun.position.set(60, 120, 80); scene.add(sun);
  const sun2 = new THREE.DirectionalLight(0xffffff, 0.3); sun2.position.set(-80, -40, -60); scene.add(sun2);

  const matCopper = new THREE.MeshStandardMaterial({ color: 0xb87333, metalness: 0.55, roughness: 0.45, flatShading: true });
  const matPlastic = new THREE.MeshStandardMaterial({ color: 0x3b5f9e, metalness: 0.0, roughness: 0.7, flatShading: true, transparent: true, opacity: 1 });
  const matScrew = new THREE.MeshStandardMaterial({ color: 0xd08a4a, metalness: 0.6, roughness: 0.35, flatShading: true });
  const matCavity = new THREE.MeshStandardMaterial({ color: 0xdfe7f5, roughness: 0.9, flatShading: true, side: THREE.DoubleSide });
  const matIce = new THREE.MeshStandardMaterial({ color: 0x8fc6e2, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
  const materials = {
    centre: matCopper, blades: matCopper, disk: matCopper, hubg: matCopper,
    screw: matScrew, collar: matPlastic, plastic: matPlastic, ringg: matPlastic, cavities: matCavity,
  };

  const root = new THREE.Group(); scene.add(root);
  const groups = {};
  GROUP_NAMES.forEach(n => { groups[n] = new THREE.Group(); root.add(groups[n]); });
  const axes = new THREE.AxesHelper(20); root.add(axes);

  const HOME = { theta: 0.9, phi: 1.05, dist: 150, target: [0, 8, 0] };
  const view = { theta: HOME.theta, phi: HOME.phi, dist: HOME.dist, target: new THREE.Vector3(...HOME.target) };

  function applyCamera() {
    const { theta, phi, dist, target } = view;
    camera.position.set(
      target.x + dist * Math.sin(phi) * Math.cos(theta),
      target.y + dist * Math.cos(phi),
      target.z + dist * Math.sin(phi) * Math.sin(theta));
    camera.lookAt(target);
  }
  function render() { renderer.render(scene, camera); }

  // Orbit, pan and zoom. Kept hand-rolled rather than pulling in
  // OrbitControls: it is thirty lines and avoids a second vendored file.
  let drag = null;
  canvas.addEventListener('pointerdown', e => {
    drag = { x: e.clientX, y: e.clientY, b: e.button };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY;
    if (drag.b === 2 || e.shiftKey) {
      const right = new THREE.Vector3().crossVectors(camera.getWorldDirection(new THREE.Vector3()), camera.up).normalize();
      view.target.addScaledVector(right, -dx * view.dist / 900).addScaledVector(camera.up, dy * view.dist / 900);
    } else {
      view.theta += dx * 0.008;
      view.phi = Math.min(3.05, Math.max(0.08, view.phi - dy * 0.008));
    }
    applyCamera(); render();
  });
  const endDrag = () => { drag = null; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    view.dist = Math.min(800, Math.max(30, view.dist * Math.exp(e.deltaY * 0.0015)));
    applyCamera(); render();
  }, { passive: false });

  let toggles = {};

  function clear() {
    Object.values(groups).forEach(g => {
      while (g.children.length) { const m = g.children.pop(); m.geometry.dispose(); }
    });
  }

  /** Draw a freshly built parts object at the current parameters. */
  function show(parts, P, currentToggles) {
    toggles = currentToggles;
    clear();
    for (const n of Object.keys(materials)) {
      parts[n].forEach(tris => groups[n].add(new THREE.Mesh(toGeometry(tris), materials[n])));
    }
    // A translucent disc at the ice surface, so the tip depth D is visible.
    const ice = sectorSolid({
      r0: P.R + 0.5, r1: P.R * 2.4, thA: () => 0, thB: () => 2 * Math.PI,
      zb: () => P.D - 0.01, zt: () => P.D, nu: 64, nr: 1,
    });
    groups.ice.add(new THREE.Mesh(toGeometry(ice), matIce));
    // Explode: copper body lifts, screw drops, printed body holds still,
    // which is the order the parts assemble in.
    const e = P.ex, up = 28 * e, down = 18 * e;
    COPPER_GROUPS.forEach(n => groups[n].position.set(0, up, 0));
    groups.screw.position.set(0, -down, 0);
    applyVisibility(toggles);
  }

  function applyVisibility(currentToggles) {
    if (currentToggles) toggles = currentToggles;
    for (const [key, on] of Object.entries(toggles)) {
      if (key === 'axes') axes.visible = on;
      else if (groups[key]) groups[key].visible = on;
    }
    const cav = !!toggles.showCavity;
    groups.cavities.visible = cav && groups.plastic.visible;
    matPlastic.opacity = cav ? 0.35 : 1;
    matPlastic.needsUpdate = true;
    const one = !!toggles.oneWedge;
    groups.plastic.children.forEach((m, i) => { m.visible = !one || i === 0; });
    groups.cavities.children.forEach((m, i) => { m.visible = !one || i === 0; });
    render();
  }

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    render();
  }

  function resetView() {
    view.theta = HOME.theta; view.phi = HOME.phi; view.dist = HOME.dist;
    view.target.set(...HOME.target);
    applyCamera(); render();
  }

  applyCamera();
  return { show, applyVisibility, resize, resetView, render };
}
