# Ablation screw bit — design package

A drill-bit-shaped component for an ice ablation monitor: a milled copper
cutter, a 3-D printed insulating wedge body, and a centre screw. This
repository holds the parametric web tool, the CAD generator that produces
the manufacturing files, and the thermal models behind the design.

```
web/         the parametric 3-D tool (browser, no build step)
cad/         make_cad.py — exact B-rep solids: STEP for the mill, STL for the printer
analysis/    thermal models: 2-D tooth conduction, lumped heat balance
diagrams/    matplotlib scripts for the concept figures
tests/       viewer-versus-CadQuery consistency test
ops/         build.sh, which produces the deployable bundle
```

Datum for everything: millimetres, z up, tooth tips at z = 0. The bit turns
clockwise seen from above, blades leading.

## The web tool (`web/`)

Open it with a static server, not by double-clicking, because it uses ES
modules:

```
cd web && python3 -m http.server 8000     # then visit localhost:8000
```

Controls on the left rebuild the geometry live. The Assembly section checks
fits and tooling against the milling cutter, and the Thermal section runs
the lumped model on the current geometry.

* **Save STL files (zip)** gives `copper_body.stl`, `copper_screw.stl`,
  `printed_body.stl`, `printed_wedge_single.stl` and `parameters.json`.
  The STLs are for the printer and for viewing; the mill needs the STEP
  files from `make_cad.py`.
* **Copy link** puts the current design in the URL. Only non-default values
  are encoded, so links stay short and stay readable.
* **Save parameters.json** / **Load parameters** move a design between the
  tool and the CAD script.

Everything is vendored, including the three IBM Plex faces, so the tool
makes no external requests and works offline.

Deployment on groundtruthalaska.org is described in `docs/PLAN.md`, and the
site-side framework it plugs into in the GTA repository's `TOOLS.md`.

## The CAD generator (`cad/`)

```
conda env create -f cad/environment.yml
conda activate ablation-cad
python cad/make_cad.py parameters.json out/ --check
```

Writes `copper_body.step`, `copper_screw.step`, `printed_body.step`,
`printed_body.stl`, `copper_body.stl`, `blade_profile.dxf` and a README with
the machining notes. Omit the parameter file to use the defaults.

`--check` verifies what the notes used to ask an operator to check by hand:
one solid per body, one internal void per wedge, no copper intersecting
plastic, and no large fragment left over.

CadQuery is pinned in `environment.yml`. This matters: on CadQuery 2.8 and
OpenCascade 7.9 the original script failed outright, and fixing it exposed
two real defects (see below).

## Consistency test (`tests/`)

The viewer builds triangle meshes in JavaScript; the CAD script builds exact
solids in Python. Both encode the same design rules, and nothing else checks
that they still agree.

```
node tests/test_geometry.mjs                                  # fast, no CadQuery
conda run -n ablation-cad python tests/test_consistency.py    # needs the CAD environment
```

`test_geometry.mjs` checks invariants the browser geometry must hold for any
setting the panel can reach: no shell wound inside out, no degenerate
triangles, no non-finite coordinates. It also measures how much of each
plastic piece lies inside a copper blade or inside another piece, which is
how three separate faults were caught that left every individual shell
perfectly well formed. About twenty seconds.

`test_consistency.py` compares volumes, extents and cavity counts against the
CadQuery solids, allows differences that have a known permanent cause, and
fails on anything else. Differences that are real but not yet resolved are
pinned to their measured value, so the test fails if one *moves*.

## What the test and the version pin found

Three things, all invisible before:

1. **The printed body came apart.** The blade-pocket cut ends exactly on the
   armature ring's inner face. Those coincident surfaces used to merge; on
   OpenCascade 7.9 they leave a 0.75 cm³ sliver as a separate solid, which
   would have sliced as loose debris beside the real part. It is now
   detected and dropped, which reproduces the original geometry exactly.

2. **The CAD script only worked near the default tooth count.** Unioning the
   wedges one at a time cleans after each step, and the merged faces that
   produces then fail to fuse with the wedge that closes the circle. It
   survived at N = 6 and failed at N = 4 and N = 9 — that is, for any
   collaborator who changed the tooth count. All the wedges are now fused in
   one operation.

3. **The viewer drew blades 0.2 mm too long**, running them to the ring
   instead of stopping one clearance short as the mill does. Fixed in the
   viewer.

4. **The viewer folded its own surfaces inside out** on designs with thick or
   numerous blades. A blade is a fixed thickness in millimetres while the
   pitch shrinks towards the axis, so inside some radius the blades pass
   through each other and there is no gap left for plastic. The wedge between
   them inverted, which drew as sheets cutting through the tops of the wedges
   and a spur of solid hanging off the ramp near the centre.

   Two things were needed. The angular span is clamped so a sector can never
   run backwards, and each piece of a wedge is now trimmed at the height its
   own gap shuts, so it tapers to an edge instead of collapsing into a folded
   ribbon. A face is also only drawn around a corner that has both width and
   height, which is what stopped the collapsed pieces leaving sheets behind.
   The panel names the radius where the blades meet.

   The printed body's mesh is closed at those parameters now, where it used
   to have hundreds of open edges. Found at 11 teeth with 4.5 mm blades;
   `tests/fixtures/thick_blades.json` keeps the case covered.

5. **Three more faults hid behind that one**, all of which put solid where
   another solid already was. They were found by measuring what share of one
   piece lies inside another, which `tests/test_geometry.mjs` now does for
   every fixture.

   * **The wedge was split the wrong way.** It was built as a middle region
     with a notch strip either side, the three tiling its width below the
     blade's root step. That only holds while the wedge is wider than the
     two notches taken out of it; narrower, and the three overlapped, by
     14.5 cm³ at the reported parameters. The wedge is now two pieces
     stacked instead, full width below the root step and narrowed above it,
     which cannot overlap whatever the width does.
   * **The bottom of the ramp was solved by an iteration that did not
     converge.** Where a wedge sits on the helicoid depends on its angle,
     and its angle depends back on the height; three passes of fixed-point
     iteration settled that only while the loop gain stayed under one. The
     gain is the ramp's climb per radian times how fast the blade thickens
     with height, over the radius: about 0.03 at the defaults, but past one
     inside r = 11.6 mm at 11 teeth with a 6 mm taper. The bottom came out
     up to 0.9 mm off. It bisects now, which converges whatever the gain.
   * **A blade's angular width was taken as `offset/r`.** A blade is a
     straight tangential offset, not an arc, so it subtends
     `asin(offset/r)`. At r = 9 with a 4.5 mm blade the difference is larger
     than the whole fit clearance, so the blade genuinely reached into the
     plastic. Angles are exact now, and the radius at which a wedge closes
     up follows from the same formula instead of being approximated.

Two smaller things came out of the same work: every disk drawn from the axis
was emitting a ring of degenerate triangles into the STL, now filtered; and
`--check` compared the printed body's voids against one per wedge rather than
against the number of cavities actually cut, so it reported a failure on any
design that legitimately skips one.

### The ramp, and a divergence it opened

The ramp climbs the full riser height at every radius. It used to climb H per
pitch of *angle*, so wherever a blade ate into the pitch, as it does towards
the middle, the ramp ran out of room and stopped short: about 1 mm shy of H at
r = 6.5 mm against 0.3 mm at the rim on the default bit. It now climbs H over
whatever arc the two blades leave it, which is the tooth's outer triangle
carried inwards at constant height, steepening from 14 degrees at the rim to
48 degrees inboard.

**`make_cad.py` has not been ported, so the STEP files no longer match the
tool.** It builds the ramp with `twistExtrude`, which is a uniform-pitch
helicoid by construction. A ramp whose pitch varies with radius needs a
variable-pitch surface in its place. The consistency test records the gap on
every fixture rather than letting it pass quietly.

One thing to weigh before that port. The bit descends H for every pitch of
rotation, so in the bit's own frame the ice between blades rises at exactly H
per pitch of angle, at every radius; that ratio is set by the screw, not by
the tooth. A ramp that climbs H over less than a full pitch is steeper than
the surface it runs on, so it meets the ice along its leading edge and lifts
away towards the trailing edge, and descending would ask the plastic to melt
ice it is pressing into.

If the aim is a ramp that reaches its full height without that, the lever is
the riser rather than the ramp: the shortfall is entirely the blade's front
face leaning back over the ramp as it thickens from the edge land to its full
width. Holding the riser at its edge thickness up to the top of the ramp, and
tapering above, would take the shortfall from 0.99 to 0.26 mm at r = 6.5 and
from 0.28 to 0.07 mm at the rim, with the ramp still matching the surface it
cuts.

### Open design question

The viewer and the CAD script build the wedge cavity differently, and the
difference is real rather than cosmetic:

* **Shape.** The CAD script fixes the cavity's angular limits once, at the
  mid radius, so the plastic skin is thinner than `skin` at the inner end
  and thicker at the outer. The viewer recomputes them at every radius,
  giving the uniform wall that "skin 1.5 mm" implies. The viewer matches the
  stated intent.
* **Validity gate.** The CAD script decides whether a cavity fits by
  measuring at the mid radius; the viewer measures at the inner radius,
  where it is narrowest. At N = 9 the CAD script builds nine cavities that
  are invalid at their inner end and the viewer correctly builds none.

At the default parameters this is worth about 1.5 % of the printed volume;
at N = 4 and N = 9 it is about 15 %. Making the two agree changes the
printed part, and fixing the shape would move the default output away from
the validated 2026-09-18 reference, so it is a design decision rather than a
refactor. Until it is made, both deviations are pinned in the test.

## Analysis (`analysis/`)

* `tooth_thermal.py` — steady 2-D conduction in one unrolled tooth. Result
  to remember: copper stays within about 0.02 K of 0 °C, so conduction is
  never the bottleneck.
* `lumped_thermal.py` — the four-term balance and the sweep of phantom
  descent against ramp-skin conductance and fin area. The tool's Thermal
  section is this model with the depth feedback added.

Both need numpy, scipy and matplotlib.

## Diagrams (`diagrams/`)

`python <script>.py` writes PNG and SVG next to it. `ablation_blade_v3.py`
(vertical-axis sawblade) and `crown_bit.py` (annular crown) are superseded;
`screw_bit.py` (full-disk helicoid) and `tooth_v2.py` are current.

## Key design conclusions

* Rotation per descent = 2π/(N·H); set by the helicoid pitch, independent of
  melt rate.
* Rim ramp angle must exceed the wet friction angle, about 6°; the centre is
  a flat copper screw head.
* Keep tip depth D < H so the body above the blades is always in air.
* Copper only where it cuts and conducts. The ramp must be a hollow or foam
  insulator, target skin conductance ≲ 5 W/m²K, because ramp leak reads as
  phantom ablation and scales with over-supply.
* Size the collector for about 1.3–1.5× the natural surface's energy at the
  same footprint, at ice-like albedo.
