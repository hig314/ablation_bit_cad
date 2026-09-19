// Parameter definitions. The control panel, the URL hash, the saved
// parameters.json and the defaults all read from this one list, so a
// parameter cannot exist in the form but be missing from the model (or the
// reverse), which is what the hand-written duplicate list used to allow.
//
// Units are millimetres unless the help text says otherwise. `key` matches
// the names used by cad/make_cad.py; do not rename one without the other.

export const GROUPS = [
  {
    legend: 'Screw',
    params: [
      { key: 'N',   label: 'Teeth',                     help: 'risers per revolution',                     min: 3,    max: 16,  step: 1,    def: 6 },
      { key: 'R',   label: 'Outer radius R',            help: 'mm',                                        min: 10,   max: 60,  step: 0.5,  def: 27 },
      { key: 'rc',  label: 'Flat centre radius',        help: 'mm, copper, melts straight down',           min: 1,    max: 20,  step: 0.5,  def: 5 },
      { key: 'H',   label: 'Riser height H',            help: 'mm, descent per tooth pitch',               min: 2,    max: 15,  step: 0.5,  def: 6 },
    ],
  },
  {
    legend: 'Copper part',
    params: [
      { key: 'tb',   label: 'Blade thickness at top',   help: 'mm',                                        min: 1,    max: 6,   step: 0.25, def: 2.5 },
      { key: 'te',   label: 'Edge land',                help: 'mm, thickness at the cutting edge',         min: 0,    max: 2,   step: 0.1,  def: 0.3 },
      { key: 'Zt',   label: 'Taper height',             help: 'mm from the edge; 0 = whole blade',         min: 0,    max: 40,  step: 0.5,  def: 0 },
      { key: 'T',    label: 'Top disk thickness',       help: 'mm',                                        min: 2,    max: 12,  step: 0.5,  def: 5 },
      { key: 'hub',  label: 'Hub boss radius',          help: 'mm',                                        min: 3,    max: 20,  step: 0.5,  def: 8 },
      { key: 'f',    label: 'Root step width',          help: 'mm, blade widens at the disk and the stub', min: 0,    max: 4,   step: 0.25, def: 1.5 },
      { key: 'hr',   label: 'Root step height',         help: 'mm, below the disk',                        min: 0,    max: 10,  step: 0.5,  def: 3 },
      { key: 'tool', label: 'Milling tool diameter',    help: 'mm, checked against the gaps',              min: 1,    max: 10,  step: 0.5,  def: 3 },
    ],
  },
  {
    legend: 'Centre screw and collar',
    params: [
      { key: 'rs', label: 'Screw shank radius',  help: 'mm (M6 = 3)',                              min: 1.5, max: 6,  step: 0.25, def: 3 },
      { key: 'hh', label: 'Screw head thickness', help: 'mm, the flat melting base',               min: 1,   max: 8,  step: 0.5,  def: 3 },
      { key: 'hc', label: 'Collar height',        help: 'mm, plastic between head and stub',       min: 1,   max: 15, step: 0.5,  def: 5 },
      { key: 'c',  label: 'Fit clearance',        help: 'mm per face, plastic pocket to blade',    min: 0,   max: 1,  step: 0.05, def: 0.2 },
    ],
  },
  {
    legend: 'Assembly',
    table: 'fits',
    params: [
      { key: 'ex', label: 'Explode', help: '0 = assembled', min: 0, max: 1, step: 0.05, def: 0, view: true },
    ],
  },
  {
    legend: 'Printed wedge',
    params: [
      { key: 'B',    label: 'Body height above ramp top', help: 'mm, room for the cavity',                         min: 0,   max: 30, step: 0.5, def: 12 },
      { key: 'skin', label: 'Wall thickness',             help: 'mm, around the cavity',                           min: 0.8, max: 4,  step: 0.1, def: 1.5 },
      { key: 'ring', label: 'Armature ring width',        help: 'mm, plastic, joins the wedges above the ice',     min: 0,   max: 8,  step: 0.5, def: 2.5 },
      { key: 'cav',  label: 'Cavity share of pitch',      help: 'fraction, from the pad end',                      min: 0,   max: 0.9, step: 0.05, def: 0.6 },
    ],
  },
  {
    legend: 'View',
    toggles: [
      { key: 'centre',     label: 'Copper centre stub (threaded)',        group: 'centre',  def: true },
      { key: 'screw',      label: 'Copper screw (head is the base)',      group: 'screw',   def: true },
      { key: 'collar',     label: 'Printed collar',                       group: 'collar',  def: true },
      { key: 'blades',     label: 'Copper blades',                        group: 'blades',  def: true },
      { key: 'disk',       label: 'Copper top disk',                      group: 'disk',    def: true },
      { key: 'hubg',       label: 'Copper hub boss',                      group: 'hubg',    def: true },
      { key: 'plastic',    label: 'Printed wedges',                       group: 'plastic', def: true },
      { key: 'ringg',      label: 'Printed armature ring',                group: 'ringg',   def: true },
      { key: 'showCavity', label: 'Show cavities (plastic translucent)',                    def: false },
      { key: 'ice',        label: 'Ice surface at tip depth',             group: 'ice',     def: false },
      { key: 'axes',       label: 'Axes',                                 group: 'axes',    def: true },
      { key: 'oneWedge',   label: 'Only one wedge',                                         def: false },
    ],
    params: [
      { key: 'D', label: 'Tip depth D', help: 'mm below ice surface (must stay below H)', min: 0, max: 15, step: 0.5, def: 3.5 },
    ],
  },
  {
    legend: 'Thermal (uses the geometry above)',
    table: 'thermal',
    chart: true,
    params: [
      { key: 'Tair',  label: 'Air temperature',         help: '°C',                                              min: 0,   max: 15,   step: 0.1, def: 3 },
      { key: 'wind',  label: 'Wind',                    help: 'm/s → h = 4 + 3·U W/m²K',               min: 0,   max: 10,   step: 0.5, def: 2 },
      { key: 'SW',    label: 'Shortwave',               help: 'W/m², incoming',                                  min: 0,   max: 900,  step: 10,  def: 0 },
      { key: 'cloud', label: 'Cloud fraction',          help: '0 clear (longwave loss) … 1 overcast',            min: 0,   max: 1,    step: 0.1, def: 1 },
      { key: 'plate', label: 'Collector plate area',    help: 'cm², 0 = none',                                   min: 0,   max: 200,  step: 5,   def: 0 },
      { key: 'alb',   label: 'Plate albedo',            help: 'ice ≈ 0.35',                                      min: 0,   max: 0.95, step: 0.05, def: 0.35 },
      { key: 'hice',  label: 'Ice-contact conductance', help: 'W/m²K, water film at the cutting faces',          min: 100, max: 8000, step: 100, def: 3000 },
      { key: 'Uramp', label: 'Ramp skin conductance',   help: 'W/m²K (solid 1 mm ≈ 200, hollow ≈ 4)',  min: 0.5, max: 200,  step: 0.5, def: 4 },
    ],
    toggles: [
      { key: 'sail', label: 'Blade front faces exposed to air above the ramp (up to the disk)', def: true },
    ],
  },
];

export const PARAMS = GROUPS.flatMap(g => g.params || []);
export const TOGGLES = GROUPS.flatMap(g => g.toggles || []);

/** Parameter keys in panel order. */
export const KEYS = PARAMS.map(p => p.key);

/** Keys written to parameters.json: every parameter except the view-only ones. */
export const SAVED_KEYS = PARAMS.filter(p => !p.view).map(p => p.key);

export const BY_KEY = Object.fromEntries(PARAMS.map(p => [p.key, p]));
export const TOGGLE_BY_KEY = Object.fromEntries(TOGGLES.map(t => [t.key, t]));

export function defaults() {
  const P = {};
  for (const p of PARAMS) P[p.key] = p.def;
  return P;
}

export function toggleDefaults() {
  const t = {};
  for (const x of TOGGLES) t[x.key] = x.def;
  return t;
}

/**
 * Clamp a parameter set to the ranges the panel allows and to the two
 * relations the geometry needs (the centre must leave room for a blade, and
 * the shank must fit inside the centre). Applied to hand-edited JSON and to
 * URL state as well as to the sliders, so no input path can reach the
 * geometry with a set it cannot build.
 */
export function clamp(P) {
  for (const p of PARAMS) {
    let v = Number(P[p.key]);
    if (!Number.isFinite(v)) v = p.def;
    P[p.key] = Math.min(p.max, Math.max(p.min, v));
  }
  P.N = Math.round(P.N);
  if (P.rc > P.R - 6) P.rc = P.R - 6;
  if (P.rs > P.rc - 1) P.rs = P.rc - 1;
  return P;
}
