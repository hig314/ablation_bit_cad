"""
Steady 2-D conduction model of one screw tooth, unrolled at radius r_eval.
x: circumferential (0 = riser face, p = one pitch back), z: up from the tip.
Copper triangle above the ramp z = x*H/p, body above, collector at z_top.
BCs: riser face T=0 (ice, melting) | ramp: skin conductance k_s/t_s to 0 C
     water band (z in [D, D+b]): out-of-plane loss 2*h/W  (h = h_water, or skin) 
     top: fins, h_top*(T_air - T) with h_top = h_air * fin-area multiplier
     x periodic above the riser. Left/right of copper: no flux.
Outputs: riser heat flux vs what the cutting rate needs; ramp leak as phantom ablation.
"""
import numpy as np, scipy.sparse as sp, scipy.sparse.linalg as spl, matplotlib
matplotlib.use("Agg"); import matplotlib.pyplot as plt

def solve(N=6, H=5., D=3.5, r_eval=20., R=27., W=None, z_top=18., dx=0.25,
          k_cu=390., k_s=0.2, t_s=1.0, T_air=3.0, h_air=10., A_fin_cm2=200.,
          water_band=2.0, h_water=300., ring=True, k_ring=0.2, t_ring=1.0,
          v_mm_day=None, ddf=7.0, plot=None):
    p = 2*np.pi*r_eval/N; W = W or (R-4.)            # W: radial length of the riser (out-of-plane depth)
    v = (v_mm_day if v_mm_day else ddf*T_air)/86400/1e3  # m/s ablation; default from degree-day factor
    omega = 2*np.pi*v/(N*H*1e-3)                      # rad/s
    rhoL = 917*334e3
    nx, nz = int(round(p/dx)), int(round(z_top/dx))
    x = (np.arange(nx)+0.5)*dx; z = (np.arange(nz)+0.5)*dx
    X, Z = np.meshgrid(x, z, indexing="ij")
    mask = Z >= X*H/p                                 # copper cells
    idx = -np.ones((nx,nz),int); idx[mask] = np.arange(mask.sum()); n = mask.sum()
    A = sp.lil_matrix((n,n)); b = np.zeros(n)
    kdx = k_cu                                        # conductance per unit depth between cells: k*dz/dx = k
    for i in range(nx):
        for j in range(nz):
            if not mask[i,j]: continue
            m = idx[i,j]; diag = 0.0
            for (ii,jj) in ((i-1,j),(i+1,j),(i,j-1),(i,j+1)):
                if ii == -1 and j*dx < H:             # riser face: T=0 Dirichlet
                    diag += 2*kdx; continue
                if ii == -1: ii = nx-1                # periodic
                if ii == nx: ii = 0
                if jj < 0 or jj >= nz:
                    if jj >= nz:                      # top collector: Robin to air
                        g = (h_air*A_fin_cm2*1e-4/N)/(W*1e-3)/nx   # W/K per m depth, this tooth's share, per top cell
                        diag += g; b[m] += g*T_air
                    continue
                if mask[ii,jj]:
                    diag += kdx; A[m, idx[ii,jj]] -= kdx
                else:                                 # ramp face → skin → ice at 0 C
                    g = (k_s/t_s)*dx*1e-3*1e3         # W/K per unit depth: (k/t)[W/m2K]*dx[m]... units: k_s/(t_s mm)*dx mm = W/(m K)
                    diag += g
            zc = z[j]
            if D <= zc <= D+water_band:               # water-line loss, out of plane, both faces
                hw = (k_ring/t_ring*1e3) if ring else h_water   # W/m2K
                diag += 2*hw*dx*dx*1e-3/W             # both radial walls, per m depth: 2 h dx^2[mm^2->m^2] / (W[mm->m])
            A[m,m] = diag
    T = spl.spsolve(A.tocsr(), b)
    Tf = np.full((nx,nz), np.nan); Tf[mask] = T
    # riser flux (W per m depth) -> W over riser length W
    q_riser = sum(2*kdx*Tf[0,j] for j in range(nz) if j*dx < H and mask[0,j]) * (W*1e-3)
    q_ramp = 0.0
    for i in range(nx):
        for j in range(nz):
            if not mask[i,j]: continue
            for (ii,jj) in ((i,j-1),(i-1,j)):
                if 0 <= ii < nx and 0 <= jj < nz and not mask[ii,jj]:
                    q_ramp += (k_s/t_s)*dx*Tf[i,j]
    q_ramp *= (W*1e-3)
    # required riser power: melt the step ahead: rhoL * H * ∫ r*omega dr over the riser length
    r0, r1 = (R-W)*1e-3, R*1e-3
    q_req = rhoL*H*1e-3*omega*(r1**2-r0**2)/2
    ramp_area = np.hypot(p,H)*1e-3*(W*1e-3)
    phantom = q_ramp/(rhoL*ramp_area)*np.cos(np.arctan(H/p))*86400*1e3   # mm/day vertical erosion of the ice ramp
    out = dict(p=p, T=Tf, x=x, z=z, q_riser=q_riser, q_req=q_req, q_ramp=q_ramp,
               phantom_mm_day=phantom, v_mm_day=v*86400*1e3, Tmax=np.nanmax(Tf), T_edge=np.nanmean(Tf[1,:int(H/dx)]))
    if plot:
        fig, ax = plt.subplots(figsize=(9,5))
        im = ax.pcolormesh(X, Z, np.ma.masked_invalid(Tf), cmap="inferno", vmin=0, vmax=T_air, shading="auto")
        ax.set_aspect("equal"); ax.set_xlabel("circumference from riser face (mm)"); ax.set_ylabel("height above tip (mm)")
        ax.axhline(D, color="cyan", lw=1, ls="--"); ax.text(p*0.6, D+0.3, "water line", color="cyan", fontsize=8)
        plt.colorbar(im, label="T (°C)  — air is %.1f °C"%T_air, shrink=0.8)
        ax.set_title("One tooth at r = %.0f mm: riser capacity %.2f W vs %.2f W needed; ramp leak %.3f W = %.2f mm/day phantom (v = %.0f mm/day)"
                     % (r_eval, q_riser, q_req, q_ramp, phantom, out["v_mm_day"]), fontsize=8.5)
        fig.savefig(plot, dpi=150, bbox_inches="tight")
    return out

if __name__ == "__main__":
    base = solve(plot="tooth_thermal.png")
    print("baseline: riser %.2f W (need %.2f), ramp leak %.3f W -> %.2f mm/day phantom of %.0f mm/day, Tmax %.3f, T at edge %.3f"
          % (base["q_riser"], base["q_req"], base["q_ramp"], base["phantom_mm_day"], base["v_mm_day"], base["Tmax"], base["T_edge"]))
    for label, kw in [("no water-line ring, wet", dict(ring=False)),
                      ("thicker skin 2 mm", dict(t_s=2.0)),
                      ("aluminium body", dict(k_cu=200.)),
                      ("fins 60 cm2 only", dict(A_fin_cm2=60.)),
                      ("air +8 C", dict(T_air=8.)),
                      ("12 teeth", dict(N=12)),
                      ("inner radius r=8", dict(r_eval=8.))]:
        o = solve(**kw)
        print("%-24s riser %.2f W (need %.2f) ratio %.1f | leak %.3f W -> %.2f mm/day phantom (%.1f%% of v)"
              % (label, o["q_riser"], o["q_req"], o["q_riser"]/o["q_req"], o["q_ramp"], o["phantom_mm_day"], 100*o["phantom_mm_day"]/o["v_mm_day"]))
