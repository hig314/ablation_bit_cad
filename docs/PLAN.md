# Ablation screw bit — from design package to shared web tool

Status: plan, agreed 2026-09-19. The site-side framework this deploys into
is planned in `~/Claude_projects/GTA/site/TOOLS.md`; read that first. This
file covers only what happens in this repository.

## What exists

A design package exported from a claude.ai session on 2026-09-18:

| Path | What it is | State |
|---|---|---|
| `viewer/index.html` | self-contained three.js parametric viewer: 30 parameters, orbit view, explode, fit and tooling checks, lumped thermal model with depth-feedback chart, STL zip export | works, verified in a browser 2026-09-19, no console errors |
| `viewer/index_hosted.html` | same page as published on claude.ai; differs only in CDN script tags and the save hook | redundant once deployed elsewhere |
| `viewer/vendor/` | three.js r128, JSZip 3.10.1 | fine |
| `cad/make_cad.py` | CadQuery script producing exact B-rep STEP for the mill, STL, DXF blade profile, machining README | outputs verified clean (single manifold solids, watertight STL, voids as B-rep voids); not yet run on this Mac, CadQuery not installed |
| `analysis/` | 2-D tooth conduction model, lumped heat balance | works with numpy/scipy/matplotlib |
| `diagrams/` | matplotlib concept figures, two marked superseded | design record |
| `README.md` | layout, conventions, key design conclusions | good, keep |

Not a git repository. `requirements.txt` has no version pins.

The known weak point: the viewer (JavaScript triangle meshes) and the CAD
script (Python exact solids) each encode the same geometry rules, and
nothing checks they agree. A collaborator tuning parameters on the web and
a copper part milled from the STEP could silently diverge.

## Goal

A tool at `https://groundtruthalaska.org/tools/ablation-bit/` that
collaborators can use to explore the design, share a specific parameter set
by URL, download STL for the printer, and download a `parameters.json` that
drives the CAD script for the mill. The Python script stays the reference
implementation for machined parts.

## Target layout

```
ablation_bit_cad/
  README.md            updated for the new layout
  docs/PLAN.md         this file
  web/                 the tool bundle source
    index.html         markup and styles only
    tool.json          manifest (version stamped at build)
    js/
      params.js        parameter definitions: id, label, unit, min, max, step, default, help
      geometry.js      sectorSolid, prismSolid, buildParts, signedVolume   (pure, no DOM)
      stats.js         fit and tooling checks, derived numbers            (pure)
      thermal.js       lumped model with depth feedback                   (pure)
      export.js        binary STL writer, zip assembly                    (pure)
      state.js         URL hash encode/decode, parameters.json load/save
      viewer.js        three.js scene, camera, materials, visibility
      main.js          wires the DOM to the modules
    vendor/            three.min.js, jszip.min.js (unchanged)
  cad/
    make_cad.py
    environment.yml    conda env with pinned cadquery
  analysis/            unchanged
  diagrams/            unchanged
  tests/
    test_consistency.py   viewer geometry vs CadQuery geometry, same parameters
    fixtures/*.json       parameter sets used by the tests
  ops/
    build.sh           web/ -> dist/ with version stamped into tool.json
  dist/                git-ignored build output
  .gitignore
```

The split into modules is what makes the consistency test possible: Node
can import `geometry.js` and compute volumes without a browser. Modules
mean the page must be served over http rather than double-clicked from
disk; `python -m http.server` in `web/` is the local dev command, and the
README says so.

## Work items

### 1. Version control

- `git init`, `.gitignore` (`dist/`, `cad_out/`, `__pycache__/`, `*.pyc`,
  `.DS_Store`, generated PNG/SVG in `analysis/` and `diagrams/`), first
  commit of the package as received so the refactor is diffable.
- GitHub repository under the `hig314` account. Visibility is the owner's
  call; public is the natural choice for a tool built to share.

### 2. Python reference pipeline

- `cad/environment.yml` pinning `cadquery` and Python to versions known to
  work on macOS arm64; pin numpy, scipy, matplotlib in `requirements.txt`.
- Run `make_cad.py` locally and diff its outputs against the files from
  the original session (volumes, solid counts). This proves the local
  environment reproduces the reference before anything changes.
- Add `--check` to `make_cad.py`: assert one solid per body, the printed
  body has exactly N voids, and copper ∩ printed volume is zero, which is
  the check the README says to do by hand.

### 3. Viewer refactor (no behaviour change)

- Move the inline script into the modules above. `index.html` keeps the
  markup and CSS. Parameter inputs are generated from `params.js` rather
  than hand-written twice (once in HTML, once in the `ids` list), which
  removes the current risk of the two drifting.
- Delete `index_hosted.html`. The browser-download path becomes the only
  save path.
- Verify: same defaults produce the same stats table, the same fit
  warnings, and byte-identical STL output to the current page. A script
  under `tests/` runs the export headless in Node for that comparison.

### 4. Shareable state

- `state.js` encodes non-default parameters into the URL hash as
  `#N=8&R=30&D=4`, plus `v=1` for the schema. On load, parse the hash and
  apply it before the first build. On every parameter change, rewrite the
  hash with `history.replaceState`. The site's outer page mirrors this
  hash so the address bar holds the link.
- "Copy link" button next to the export button.
- "Load parameters.json" file input, so a set saved earlier (or one edited
  by hand for the CAD script) can be brought back into the viewer.
- Presets are out of scope for now; the hash covers them.

### 5. Bundle conformance

- `tool.json` with slug `ablation-bit`, name, version, `min_height` 640,
  repo URL. `ops/build.sh` copies `web/` to `dist/` and stamps version and
  build time from the latest git tag.
- Footer line in the viewer: version and a link to the repository.
- Check the layout inside an iframe at 640 px height and at phone width
  (the current page is a fixed two-column grid; below about 700 px the
  sidebar should stack above the canvas).
- Confirm no absolute URLs remain except the Google Fonts stylesheet.
  Vendor the two IBM Plex weights actually used, so the tool has no
  external requests at all.

### 6. Consistency test

`tests/test_consistency.py`, run by hand or in CI when CadQuery is
available:

1. For each fixture parameter set, run `make_cad.py` and record the copper
   body volume, printed body volume, bounding boxes, and the blade profile
   points.
2. Run `geometry.js` under Node with the same parameters and compute the
   same quantities from the mesh.
3. Assert agreement within a tolerance that reflects the mesh
   discretisation (a few tenths of a percent on volume, 0.05 mm on
   extents).

The first run will most likely show small real differences. Each one is
either a tessellation artefact, to be noted in the tolerance, or a genuine
rule mismatch, to be fixed on whichever side is wrong. Either way the test
then guards the rule forever.

### 7. Deploy

Once the site's `gtt.tools` app is on gta-dev:

```
ops/build.sh
~/Claude_projects/GTA/site/ops/deploy-tool ablation-bit dist/ dev
```

Create the `Tool` row in admin (title, slug, description, published).
Test the full page, a `{% tool "ablation-bit" %}` embed in a scratch page,
and hash sharing between two browsers. Then `prod`.

## Sequence

Items 1 and 2 first, in that order, since 2 is the reference the rest is
measured against. Item 3 next, verified against the unrefactored page.
Items 4 and 5 together, they touch the same files. Item 6 can start as soon
as 2 and 3 exist and runs in parallel with 4 and 5. Item 7 waits on the
site-side work.

Items 1 to 6 need nothing from the site and can be done without touching
the GTA repo at all.

## Future, deliberately not now

- **STEP export in the browser.** replicad (OpenCascade compiled to
  WebAssembly) could port `make_cad.py` to run client-side, giving the mill
  file straight from the tool. Roughly a 30 MB download and a full port of
  the geometry; worth it only if collaborators need STEP without a Python
  environment. The bundle contract already allows `.wasm` for when this
  happens.
- **Thermal model in Python on the server.** The lumped model is already
  in JavaScript; the 2-D conduction model is not needed interactively.
- **Saved designs with names.** Covered by the site plan's "not in this
  version".

## Decisions still open

- GitHub repository visibility (public or private).
- Whether `analysis/` and `diagrams/` stay in this repository. Recommended
  yes: they are the design record that explains the parameters, and they
  do not ship in the bundle.
