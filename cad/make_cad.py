"""
Ablation screw bit — CAD generator.

  python make_cad.py [parameters.json] [out_dir] [--check]

Reads the parameter set saved by the viewer (parameters.json inside its zip) or uses the viewer defaults,
builds exact B-rep solids with CadQuery/OpenCascade and writes:

  copper_body.step        one milled part: disk, hub, blades with stepped roots, threaded centre stub
  copper_screw.step       the centre screw: flat head (melting base) + shank, hex socket in the base
  printed_body.step       the printed part as B-rep (for reference / CAM of a mould)
  printed_body.stl        the printed part tessellated for the slicer (cavities are closed internal voids)
  copper_body.stl         copper tessellated, only for viewing
  blade_profile.dxf       the blade cross-section (forward offset vs height) for a drawing
  README.txt              units, datum, machining notes

Units mm. Datum: z = 0 at the blade tips (bottom of the screw head), axis = z, blade k rear face on the
radial plane at angle k*360/N measured from +x. The bit turns clockwise seen from above.
"""
import json, math, sys, os
import cadquery as cq

DEFAULTS = dict(N=6, R=27, rc=5, H=6, tb=2.5, te=0.3, Zt=0, T=5, hub=8, f=1.5, hr=3, tool=3,
                rs=3, hh=3, hc=5, c=0.2, B=12, skin=1.5, ring=2.5, cav=0.6, D=3.5)

def load_params(path):
    P = dict(DEFAULTS)
    if path and os.path.exists(path):
        with open(path) as fh:
            P.update({k: v for k, v in json.load(fh).items() if k in DEFAULTS})
    P["N"] = int(round(P["N"]))
    return P

def sector(r0, r1, a0, a1, z0=0.0):
    """closed annular-sector wire on a plane at height z0"""
    am = (a0 + a1) / 2
    wp = cq.Workplane("XY").workplane(offset=z0)
    return (wp.moveTo(r0 * math.cos(a0), r0 * math.sin(a0))
              .lineTo(r1 * math.cos(a0), r1 * math.sin(a0))
              .threePointArc((r1 * math.cos(am), r1 * math.sin(am)), (r1 * math.cos(a1), r1 * math.sin(a1)))
              .lineTo(r0 * math.cos(a1), r0 * math.sin(a1))
              .threePointArc((r0 * math.cos(am), r0 * math.sin(am)), (r0 * math.cos(a0), r0 * math.sin(a0)))
              .close())

def cyl(r, z0, z1, r_in=0.0):
    s = cq.Workplane("XY").workplane(offset=z0).circle(r).extrude(z1 - z0)
    if r_in > 0:
        s = s.cut(cq.Workplane("XY").workplane(offset=z0 - 1).circle(r_in).extrude(z1 - z0 + 2))
    return s

def radial_plane(th, r0):
    """plane through the axis at angle th, placed at radius r0; x = forward tangential offset, y = +z,
    normal points inward (so extrusions run from r0 toward the axis)"""
    origin = (r0 * math.cos(th), r0 * math.sin(th), 0)
    xdir = (math.sin(th), -math.cos(th), 0)          # forward = -theta (direction of travel)
    normal = (-math.cos(th), -math.sin(th), 0)       # inward: normal x xdir = +z
    return cq.Plane(origin=origin, xDir=xdir, normal=normal)

def blade_profile(P, grow=0.0, root=True):
    """(d, z) polygon of the blade cross-section; grow > 0 adds clearance for the pocket cut"""
    H, B, tb, te, Zt, f, hr = P["H"], P["B"], P["tb"], P["te"], P["Zt"], P["f"], P["hr"]
    zTop = H + B; zt = Zt if Zt > 0 else zTop; zRoot = zTop - hr
    off = lambda z: te + (tb - te) * min(1.0, max(0.0, z / zt))
    g = grow
    zlo = -g if g > 0 else 0.0
    zhi = zTop + (g if g > 0 else 0.5)          # overlap 0.5 into the disk so the union fuses
    pts = [(-g, zlo), (off(0) + g, zlo)]
    # front face: straight up to the taper end, then vertical
    if zt < zRoot:
        pts.append((tb + g, zt))
    pts.append((off(zRoot) + g, zRoot))
    if root and hr > 0 and f > 0:
        pts += [(off(zRoot) + f + g, zRoot), (tb + f + g, zhi), (-f - g, zhi), (-f - g, zRoot)]
    else:
        pts += [(off(zTop) + g, zhi), (-g, zhi)]
    pts.append((-g, zRoot))
    return pts

def blade_solid(P, th, grow=0.0):
    R, rc, ring, c = P["R"], P["rc"], P["ring"], P["c"]
    Rb = R - ring
    r_in = rc - (grow if grow > 0 else 0.0)
    r_out = Rb - c + (grow if grow > 0 else 0.0)      # blades stop c short of the ring
    pl = radial_plane(th, r_out)
    body = cq.Workplane(pl).polyline(blade_profile(P, grow)).close().extrude(r_out - r_in)
    # inner root step against the stub
    f, hr, H, B, hh, hc = P["f"], P["hr"], P["H"], P["B"], P["hh"], P["hc"]
    zTop = H + B; zRoot = zTop - hr; zStub = max(hh + hc, H + 1)
    if f > 0:
        tb, te, Zt = P["tb"], P["te"], P["Zt"]; zt = Zt if Zt > 0 else zTop
        off = lambda z: te + (tb - te) * min(1.0, max(0.0, z / zt))
        g = grow
        pts = [(-f - g, zStub - g), (off(zStub) + f + g, zStub - g), (off(zRoot) + f + g, zRoot + 0.01), (-f - g, zRoot + 0.01)]
        pl_in = radial_plane(th, r_in + f + g)          # extrude inward, 0.5 into the stub so the union fuses
        step = cq.Workplane(pl_in).polyline(pts).close().extrude(f + g + 0.5)
        body = body.union(step)
    return body

def copper_body(P):
    N, R, rc, H, T, hub, B, rs, hh, hc, ring = (P[k] for k in ("N", "R", "rc", "H", "T", "hub", "B", "rs", "hh", "hc", "ring"))
    Rb = R - ring; zTop = H + B; zStub = max(hh + hc, H + 1)
    tap_drill = 2 * rs * 0.83 / 2                       # ~ M6 -> 5.0 mm tap drill
    body = cyl(Rb, zTop, zTop + T).union(cyl(hub, zTop + T, zTop + T + 10))
    body = body.union(cyl(rc, zStub, zTop))
    for k in range(N):
        body = body.union(blade_solid(P, 2 * math.pi * k / N))
    # tapped hole: tap-drill diameter through the stub and 2 mm into the disk
    body = body.cut(cyl(tap_drill, zStub - 1, zTop + 2))
    return body

def copper_screw(P):
    rc, rs, hh, H, B = P["rc"], P["rs"], P["hh"], P["H"], P["B"]
    zTop = H + B
    s = cyl(rc, 0, hh).union(cyl(rs, hh - 0.01, zTop - 1))
    socket = cq.Workplane("XY").workplane(offset=-0.5).polygon(6, 4.0 / math.cos(math.pi / 6)).extrude(2.5)  # 4 mm A/F hex, 2 mm deep
    return s.cut(socket)

def printed_body(P, report=None):
    N, R, rc, H, B, f, hr, hh, hc, c, skin, ring, cav, rs = (P[k] for k in ("N", "R", "rc", "H", "B", "f", "hr", "hh", "hc", "c", "skin", "ring", "cav", "rs"))
    dth = 2 * math.pi / N; Rb = R - ring; zTop = H + B; zRoot = zTop - hr; zStub = max(hh + hc, H + 1)
    wedges = []
    for k in range(N):
        th = k * dth
        twisted = sector(rc, Rb, th - dth, th).twistExtrude(H, math.degrees(dth))            # region above the helicoid
        lower = twisted.intersect(sector(rc, Rb, th, th + dth).extrude(H))
        upper = sector(rc, Rb, th, th + dth, H).extrude(zTop - H)
        wedge = lower.union(upper)
        if cav > 0 and B > hr + 2 * skin + 1:
            rm = (rc + Rb) / 2
            cA = th + (c + f + skin) / rm; cB = th + cav * dth - skin / rm
            if cB > cA + 0.02:
                cav_tw = sector(rc + f + skin, Rb - skin, cA - dth, cA, skin).twistExtrude(H, math.degrees(dth))
                cav_lo = cav_tw.intersect(sector(rc + f + skin, Rb - skin, cA, cB, skin).extrude(H))
                cav_hi = sector(rc + f + skin, Rb - skin, cA, cB, H + skin).extrude(zRoot - skin - H - skin)
                wedge = wedge.cut(cav_lo.union(cav_hi))
        wedges.append(wedge.val())

    # Fuse every wedge in one boolean rather than N-1 sequential unions.
    #
    # Sequential union cleans after each step, and the merged helicoid faces
    # that cleaning produces then fail to fuse with the wedge that closes the
    # circle: OpenCascade returns a null shape. It happened to survive at
    # N = 6 and failed at N = 4 and N = 9, which would have met any
    # collaborator who changed the tooth count. One fuse of all N wedges,
    # cleaned once at the end, is both robust and faster.
    body = cq.Workplane("XY").newObject([wedges[0].fuse(*wedges[1:])]).clean()

    if ring > 0:
        body = body.union(cyl(R, H, zTop, r_in=Rb - 0.01))
    # centre: collar below the stub, clearance bore above it
    body = body.union(cyl(rc + 0.01, hh, zStub, r_in=rs + c))
    body = body.cut(cyl(rc + c, zStub - c, zTop + 1))
    # Pockets for the blades, with clearance on every face.
    #
    # clean=False is deliberate. OpenCascade 7.9 (CadQuery 2.8) raises
    # "Courbes non jointives" while trying to unify the faces these cuts
    # leave behind. The boolean result itself is sound; only the cosmetic
    # face merging fails. Skipping it and checking the result afterwards is
    # safer than pinning to whichever older kernel happened to merge them.
    for k in range(N):
        body = body.cut(blade_solid(P, 2 * math.pi * k / N, grow=c), clean=False)
    return keep_main_solid(body, report)


def keep_main_solid(wp, report=None):
    """
    Keep the largest solid, recording anything else that fell off.

    The pocket cut reaches to r = Rb, exactly the armature ring's inner
    face, so those two surfaces are coincident. Whether the kernel merges
    them or leaves a sliver behind is version-dependent: OCC 7.9 leaves one
    of about 0.75 cm3 spanning the full height. The printed part is meant to
    be a single piece, so any extra solid is dropped and reported instead of
    being exported into the STL, where it would slice as loose debris beside
    the real part.

    If a fragment is ever a large fraction of the part, that is a design
    problem rather than a kernel artefact, and --check will fail on it.
    """
    solids = wp.solids().vals()
    if len(solids) <= 1:
        return wp
    solids = sorted(solids, key=lambda s: s.Volume(), reverse=True)
    if report is not None:
        report["fragments"] = [s.Volume() / 1000 for s in solids[1:]]
    return cq.Workplane("XY").newObject([solids[0]])


FRAGMENT_LIMIT_PCT = 5.0


def run_checks(P, cu, sc, pl, report):
    """
    Assertions the README used to ask the operator to run by hand. Returns a
    list of problem strings; empty means the build is sound.
    """
    problems = []

    for name, wp, want in (("copper body", cu, 1), ("screw", sc, 1), ("printed body", pl, 1)):
        n = len(wp.solids().vals())
        if n != want:
            problems.append("%s is %d solids, expected %d" % (name, n, want))

    # A solid with V internal voids has V + 1 shells. One cavity per wedge is
    # the design; fewer means cavities failed to form, more means a boolean
    # left a bubble in the plastic.
    if P["cav"] > 0 and P["B"] > P["hr"] + 2 * P["skin"] + 1:
        voids = len(pl.val().Shells()) - 1
        if voids != P["N"]:
            problems.append("printed body has %d internal voids, expected %d" % (voids, P["N"]))

    # The copper must not occupy the same space as the plastic, or the parts
    # cannot be assembled. This is the check the original README described.
    try:
        overlap = cu.intersect(pl, clean=False).val().Volume()
    except Exception as exc:                       # an empty intersection can raise
        overlap = 0.0
        if "empty" not in str(exc).lower():
            problems.append("could not intersect copper with plastic: %s" % exc)
    if overlap > 1.0:                              # mm3; below this is boolean noise
        problems.append("copper and plastic overlap by %.1f mm3" % overlap)

    # A small sliver here is the known coincident-face artefact described in
    # keep_main_solid, harmless once dropped. A large one means the part has
    # genuinely come apart and the parameters need looking at.
    for frag in report.get("fragments", []):
        pct = 100 * frag / (pl.val().Volume() / 1000)
        if pct > FRAGMENT_LIMIT_PCT:
            problems.append("a %.2f cm3 fragment (%.1f%% of the part) broke off the printed body"
                            % (frag, pct))

    return problems


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    flags = {a for a in sys.argv[1:] if a.startswith("--")}
    check = "--check" in flags
    pjson = args[0] if len(args) > 0 and args[0] else None
    out = args[1] if len(args) > 1 else "cad_out"
    os.makedirs(out, exist_ok=True)
    P = load_params(pjson)
    report = {}
    cu = copper_body(P); sc = copper_screw(P); pl = printed_body(P, report)
    cq.exporters.export(cu, f"{out}/copper_body.step")
    cq.exporters.export(sc, f"{out}/copper_screw.step")
    cq.exporters.export(pl, f"{out}/printed_body.step")
    cq.exporters.export(pl, f"{out}/printed_body.stl", tolerance=0.02, angularTolerance=0.05)
    cq.exporters.export(cu, f"{out}/copper_body.stl", tolerance=0.02, angularTolerance=0.05)
    prof = cq.Workplane("XY").polyline(blade_profile(P)).close()
    cq.exporters.export(prof, f"{out}/blade_profile.dxf")
    with open(f"{out}/parameters_used.json", "w") as fh:
        json.dump(P, fh, indent=2)
    vol = lambda s: s.val().Volume()
    zStub = max(P["hh"] + P["hc"], P["H"] + 1)
    readme = f"""Ablation screw bit — CAD output (mm, z up)
Datum: z = 0 at the blade tips and the bottom of the screw head. Axis = z. Blade k rear face lies on the radial
plane at angle k*{360/P['N']:.1f} deg from +x. The bit turns clockwise seen from above (blades lead).

copper_body.step   {vol(cu)/1000:.1f} cm3, {vol(cu)/1000*8.96:.0f} g in copper. One part. Stub bore is the tap drill
                   ({2*P['rs']*0.83:.1f} mm) from z = {zStub - 1:.1f} up to {P['H']+P['B']+2:.1f}; tap M{2*P['rs']:.0f} after machining.
                   Blade roots are stepped {P['f']} mm wide, {P['hr']} mm tall under the disk and along the stub; a
                   fillet of radius <= {P['f']} mm may replace the step. Grind the cutting bevel on the blade bottoms last.
                   Tightest gap for the cutter: between blade roots at the stub, see the viewer's assembly table.
copper_screw.step  head r = {P['rc']} mm x {P['hh']} mm (flat base), shank r = {P['rs']} mm (thread M{2*P['rs']:.0f}, not modelled),
                   4 mm A/F hex socket 2 mm deep in the base. Thread engagement in the stub about {P['H']+P['B']-1-zStub:.1f} mm.
printed_body.stl   {vol(pl)/1000:.1f} cm3, ~{vol(pl)/1000*1.27:.0f} g PETG. One part: {P['N']} wedges, outer ring, centre collar.
                   Internal cavities are closed voids (skin {P['skin']} mm). Print with the flat top (z = {P['H']+P['B']}) on
                   the bed, ramps facing up; supports needed only under the ring. Pocket clearance {P['c']} mm per face.
printed_body.step  same part as B-rep.
blade_profile.dxf  blade cross-section: x = forward offset from the rear face, y = height above the tip.
Assembly: slide the printed body up over the blades from below, then fit the screw up through the collar.
"""
    with open(f"{out}/README.txt", "w") as fh:
        fh.write(readme)
    print(readme)
    print("copper solids:", len(cu.solids().vals()),
          " screw solids:", len(sc.solids().vals()),
          " printed solids:", len(pl.solids().vals()))
    for frag in report.get("fragments", []):
        print("NOTE: dropped a %.2f cm3 fragment that detached from the printed body" % frag)

    if check:
        problems = run_checks(P, cu, sc, pl, report)
        if problems:
            print("\nCHECKS FAILED:")
            for p in problems:
                print("  -", p)
            sys.exit(1)
        print("\nchecks passed: one solid per body, %d internal voids, no copper/plastic overlap" % P["N"])

if __name__ == "__main__":
    main()
