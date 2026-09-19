"""
Consistency test: the browser geometry against the CadQuery geometry.

The viewer builds triangle meshes in JavaScript; make_cad.py builds exact
B-rep solids in Python. Both encode the same design rules, and nothing
otherwise checks that they still agree. A collaborator tuning parameters in
the web tool and a copper part milled from the STEP could drift apart
silently. This test is the guard.

Run it with the CadQuery environment and Node on PATH:

    conda run -n ablation-cad python tests/test_consistency.py

It prints every deviation, so a change that moves one shows up even when it
stays inside tolerance. Exits non-zero on a failure. Works under pytest too.

Known, accepted differences are declared in TOLERANCES below, each with the
reason it exists. A deviation that is NOT explained there is a bug on one
side or the other.
"""
import json
import math
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
FIXTURES = os.path.join(HERE, "fixtures")

sys.path.insert(0, os.path.join(ROOT, "cad"))

# ---------------------------------------------------------------------------
# Differences with a known, permanent cause. Each side models something the
# other deliberately does not, so these will never reach zero.
# ---------------------------------------------------------------------------
EXPLAINED = {
    "copper_body": (1.0,
        "the viewer draws the centre stub as a plain tube bored to the shank "
        "radius, while the CAD script bores the real tap drill through the "
        "stub and 2 mm into the disk; mesh volumes also run slightly under "
        "exact ones"),
    "copper_screw": (8.0,
        "the viewer omits the hex socket that the CAD script cuts in the "
        "screw head"),
    "printed_body": (2.5,
        "the two sides build the blade pockets differently: the viewer "
        "offsets the wedge walls by a constant angle c/r, the CAD script "
        "subtracts the real blade solid including its root steps"),
}

# ---------------------------------------------------------------------------
# Real disagreements, recorded rather than tolerated.
#
# Both come from the same place: the cavity inside each printed wedge.
#
#   shape  the CAD script fixes the cavity's angular limits once, at the mid
#          radius, so the plastic skin around it is thinner than `skin` at
#          the inner end and thicker at the outer. The viewer recomputes the
#          limits at every radius, giving the uniform wall the README's
#          "skin 1.5 mm" describes. The viewer matches the stated intent.
#
#   gate   the CAD script decides whether a cavity fits by measuring at the
#          mid radius; the viewer measures at the inner radius, where the
#          cavity is narrowest. At N = 9 the CAD script therefore builds nine
#          cavities that are invalid at their inner end, and the viewer
#          correctly builds none.
#
# Making the two agree changes the printed part, so it is a design decision,
# not a refactor: fixing the shape would move the validated default output
# away from the 2026-09-18 reference. Until that decision is made the
# deviations are pinned here, and the test fails if any of them MOVES, which
# is what protects the rules in the meantime.
# ---------------------------------------------------------------------------
UNRESOLVED = {
    # The ramp is ported, so the two sides now build the same surface and the
    # printed body agrees to about a percent on any design that fits. What is
    # left is the cavity, and designs that do not fit.
    ("default.json", "printed_body"): (-1.09, "cavity shape, and how each side "
        "handles the corner where a blade's root step ends"),
    ("few_teeth.json", "printed_body"): (-0.98, "same"),
    ("many_teeth.json", "printed_body"): (+25.87, "the CAD script cuts nine cavities "
        "that the viewer correctly refuses to make: see the gate-radius disagreement "
        "below. They vent to the outside instead of sealing, which --check now catches"),
    ("thick_blades.json", "printed_body"): (+32.86, "this design is not buildable. Its "
        "blades pass through each other inside r = 8.6 mm, and the CAD script's printed "
        "body comes apart into the main piece plus 8 cm3 of loose wedges, which it "
        "reports and drops. The comparison is not meaningful, only the fact that both "
        "sides agree the design fails"),
    ("thick_blades.json", "copper_body"): (+4.95, "the blades pass through each other "
        "inside r = 8.6 mm; the viewer adds each blade's volume separately while the "
        "CAD script unions them, so the viewer counts the overlap twice. The tool says "
        "so in its warnings"),
}
UNRESOLVED_CAVITIES = {"many_teeth.json": (0, 9)}

# Extents that differ for a recorded reason. Empty: the two sides agree on
# every extent of every fixture to within EXTENT_TOL_MM. thick_blades used to
# need an entry here, because the viewer solved the bottom of its ramp by an
# iteration that did not converge at those parameters and landed 0.136 mm
# out. It bisects now and the two agree exactly.
UNRESOLVED_EXTENTS = {}
DRIFT_MM = 0.02
DRIFT_PCT = 0.5

# Extents are geometry both sides should agree on closely: a tessellated
# surface still touches the exact one at its vertices. The exception is the
# bottom of a ramp, which is a knife edge that sampled angles only approach
# from above, by more the steeper the ramp. 0.10 mm covers the fixtures here
# while still catching a real rule difference, which is how the 0.2 mm blade
# overhang was found.
EXTENT_TOL_MM = 0.10


def js_metrics(fixture):
    out = subprocess.run(
        ["node", os.path.join(HERE, "js_metrics.mjs"), fixture],
        capture_output=True, text=True, cwd=ROOT,
    )
    if out.returncode != 0:
        raise RuntimeError("node failed on %s:\n%s" % (fixture, out.stderr))
    return json.loads(out.stdout)


def cq_metrics(params):
    import cadquery as cq  # noqa: F401  (imported for its side effects on OCP)
    import make_cad as mk

    P = dict(mk.DEFAULTS)
    P.update({k: v for k, v in params.items() if k in mk.DEFAULTS})
    P["N"] = int(round(P["N"]))

    report = {}
    bodies = {
        "copper_body": mk.copper_body(P),
        "copper_screw": mk.copper_screw(P),
        "printed_body": mk.printed_body(P, report),
    }
    result = {"fragments": report.get("fragments", []), "bodies": {}}
    for name, wp in bodies.items():
        solid = wp.val()
        bb = solid.BoundingBox()
        rmax = max(math.hypot(v.X, v.Y) for v in solid.Vertices())
        result["bodies"][name] = dict(
            volume_cm3=solid.Volume() / 1000,
            zmin=bb.zmin, zmax=bb.zmax, rmax=rmax,
            solids=len(wp.solids().vals()),
            shells=len(solid.Shells()),
        )
    return result


def compare(fixture_name, verbose=True):
    fixture = os.path.join(FIXTURES, fixture_name)
    js = js_metrics(fixture)
    cq = cq_metrics(js["params"])
    problems, tracked = [], []

    if verbose:
        print("\n%s  (N=%d R=%g H=%g)"
              % (fixture_name, js["params"]["N"], js["params"]["R"], js["params"]["H"]))
        print("  %-13s %10s %10s %8s   %s"
              % ("body", "CadQuery", "viewer", "dev", "extents (CadQuery vs viewer)"))

    for name, (tol, reason) in EXPLAINED.items():
        a, b = cq["bodies"][name], js["bodies"][name]
        dev = 100 * (b["volume_cm3"] - a["volume_cm3"]) / a["volume_cm3"]
        entry = UNRESOLVED.get((fixture_name, name))
        known = None if entry is None else entry[0]
        mark = "" if entry is None else "  <- tracked"
        if verbose:
            print("  %-13s %9.3f\u00b3 %9.3f\u00b3 %+7.2f%%   z %.2f..%.2f vs %.2f..%.2f, r %.2f vs %.2f%s"
                  % (name, a["volume_cm3"], b["volume_cm3"], dev,
                     a["zmin"], a["zmax"], b["zmin"], b["zmax"], a["rmax"], b["rmax"], mark))
        if known is None:
            if abs(dev) > tol:
                problems.append("%s: %s volume differs by %+.2f%%, over the %.1f%% allowed (%s)"
                                % (fixture_name, name, dev, tol, reason))
        else:
            drift = dev - known
            if abs(drift) > DRIFT_PCT:
                problems.append("%s: %s deviation moved from the recorded %+.2f%% to %+.2f%% "
                                "(drift %+.2f%%); a rule changed on one side"
                                % (fixture_name, name, known, dev, drift))
            else:
                tracked.append("%s %s: %+.2f%% \u2014 %s"
                               % (fixture_name, name, dev, entry[1]))
        for key in ("zmin", "zmax", "rmax"):
            d = abs(a[key] - b[key])
            rec = UNRESOLVED_EXTENTS.get((fixture_name, name, key))
            if rec is not None:
                if abs(d - rec) > DRIFT_MM:
                    problems.append("%s: %s %s gap moved from the recorded %.3f mm to %.3f mm"
                                    % (fixture_name, name, key, rec, d))
                else:
                    tracked.append("%s %s %s: %.3f mm apart (recorded)"
                                   % (fixture_name, name, key, d))
            elif d > EXTENT_TOL_MM:
                problems.append("%s: %s %s differs by %.3f mm (CadQuery %.3f, viewer %.3f)"
                                % (fixture_name, name, key, d, a[key], b[key]))

    # Structural agreement, which must be exact unless recorded above.
    want_voids = js["cavity_count"]
    got_voids = cq["bodies"]["printed_body"]["shells"] - 1
    known_cav = UNRESOLVED_CAVITIES.get(fixture_name)
    if want_voids != got_voids:
        if known_cav == (want_voids, got_voids):
            tracked.append("%s cavities: viewer %d, CAD script %d (unresolved gate-radius "
                           "disagreement)" % (fixture_name, want_voids, got_voids))
        else:
            problems.append("%s: viewer makes %d cavities, CAD script leaves %d voids"
                            % (fixture_name, want_voids, got_voids))
    elif known_cav is not None:
        problems.append("%s: cavity counts now agree (%d); remove the UNRESOLVED_CAVITIES entry"
                        % (fixture_name, want_voids))

    for name in EXPLAINED:
        if cq["bodies"][name]["solids"] != 1:
            problems.append("%s: %s is %d solids, expected 1"
                            % (fixture_name, name, cq["bodies"][name]["solids"]))

    if verbose:
        print("  cavities: viewer %d, CAD voids %d%s"
              % (want_voids, got_voids,
                 "" if not cq["fragments"] else "   (dropped fragments: %s cm\u00b3)"
                 % ", ".join("%.2f" % f for f in cq["fragments"])))
    return problems, tracked


# default is the validated design point. many_teeth and few_teeth push the
# tooth count either way. thick_blades is a real parameter set a collaborator
# arrived at, whose blades are thicker than the pitch near the axis; it is
# here because it used to make the viewer fold its own surfaces inside out.
FIXTURE_FILES = ["default.json", "many_teeth.json", "few_teeth.json", "thick_blades.json"]


def test_consistency():
    """pytest entry point."""
    problems = []
    for f in FIXTURE_FILES:
        problems += compare(f)[0]
    assert not problems, "\n".join(problems)


def main():
    problems, tracked = [], []
    for f in FIXTURE_FILES:
        p, t = compare(f)
        problems += p
        tracked += t
    print()
    if tracked:
        print("Tracked divergences (real disagreements, pinned so drift is caught):")
        for t in tracked:
            print("  -", t)
        print()
    if problems:
        print("FAILED:")
        for p in problems:
            print("  -", p)
        return 1
    print("consistent: no unexplained difference between the viewer and the CAD script")
    return 0


if __name__ == "__main__":
    sys.exit(main())
