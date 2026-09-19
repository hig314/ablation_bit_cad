# Ablation screw bit — design package

Everything from the design conversation, arranged so it runs on your own machine.

```
viewer/      parametric 3-D viewer (open index.html in a browser; no build step, no server needed)
cad/         make_cad.py — exact B-rep solids: STEP for the mill, STL for the printer
analysis/    thermal models: 2-D tooth conduction (tooth_thermal.py), lumped heat balance (lumped_thermal.py)
diagrams/    matplotlib scripts for the concept figures (blade kinematics, crown bit, screw bit, tooth section)
```

## Viewer (`viewer/index.html`)
Self-contained page: three.js r128 and JSZip are in `viewer/vendor/`, so it works offline.
Double-click `index.html` or serve the folder (`python -m http.server`). Controls on the left regenerate
the geometry live; the Thermal section evaluates the current geometry; "Save STL files (zip)" downloads
`copper_body.stl`, `copper_screw.stl`, `printed_body.stl` and `parameters.json`.
`index_hosted.html` is the same page as published on claude.ai (it saves through the artifact runtime instead
of a browser download).

Datum: mm, z up, tooth tips at z = 0. The bit turns clockwise seen from above, blades leading.
All geometry is built by `sectorSolid` (annular sector between two z-functions, with optional z-dependent
angular limits) and `prismSolid` (radial prism between two tangential offsets); every part is a list of
closed triangle shells, which is also what the STL export writes.

## CAD (`cad/make_cad.py`)
```
pip install cadquery
python make_cad.py parameters.json out/
```
`parameters.json` is the file the viewer puts in its zip; omit it to use the viewer defaults.
Writes copper_body.step, copper_screw.step, printed_body.step, printed_body.stl, copper_body.stl,
blade_profile.dxf and a README with the machining notes. The helicoid ramps are exact ruled surfaces
(twist-extruded sectors); blades are extruded profiles on radial planes; the union/cut sequence is the
assembly order (printed body slides up over the blades, screw enters from below through the collar).
The script checks nothing itself; to verify a run, intersect the bodies as in the conversation
(`copper.intersect(printed).val().Volume()` should be 0).

## Analysis (`analysis/`)
* `tooth_thermal.py` — steady 2-D conduction in one unrolled tooth (copper wedge, plastic skin on the ramp,
  0 °C at the riser face, convective collector on top). Result to remember: copper is within ~0.02 K of 0 °C;
  conduction is never the bottleneck.
* `lumped_thermal.py` — the four-term balance (collector, cutting demand, ramp leak, ice contact) and the
  sweep of phantom descent vs ramp-skin conductance and fin area. The viewer's Thermal section is this model
  with the depth feedback added.

Both need numpy, scipy, matplotlib.

## Diagrams (`diagrams/`)
`python <script>.py` writes PNG + SVG next to it. `ablation_blade_v3.py` (vertical-axis sawblade, superseded),
`crown_bit.py` (annular crown, superseded), `screw_bit.py` (full-disk helicoid), `tooth_v2.py` (tooth section
and surrogate-surface collector).

## Key design conclusions (for the record)
* Ratio: rotation per descent = 2π/(N·H); set by the helicoid pitch, independent of melt rate.
* Rim ramp angle must exceed the wet friction angle (~6°); the centre is a flat copper screw head.
* Keep tip depth D < H so the body above the blades is always in air.
* Copper only where it cuts and conducts; the ramp must be a hollow or foam insulator (target skin
  conductance ≲ 5 W/m²K), because ramp leak reads as phantom ablation and scales with over-supply.
* Size the collector for ~1.3–1.5× the natural surface's energy at the same footprint, ice-like albedo.
