import numpy as np, matplotlib
matplotlib.use("Agg"); import matplotlib.pyplot as plt
from matplotlib.patches import Polygon, Rectangle
# ---------------- parameters (mm) ----------------
r_in, r_out = 20., 27.   # crown annulus radii
N   = 6                  # teeth per revolution
H   = 5.                 # riser height (= ramp rise per pitch)
D   = 3.5                # tip depth below ambient ablation surface (must be < H)
mu  = 0.10               # wet plastic-on-ice friction (conservative)
v   = 0.05/86400         # ablation m/s (5 cm/day) for the numbers
r   = 0.5*(r_in+r_out); C = 2*np.pi*r; pitch=C/N
slope = H/pitch; ramp_deg = np.degrees(np.arctan(slope))
rot_per_mm = 360./(N*H)
A = np.pi*(r_out**2-r_in**2)*1e-6
P = A*v*917*334e3
print(f"pitch {pitch:.1f} mm, ramp {ramp_deg:.1f} deg (friction angle {np.degrees(np.arctan(mu)):.1f}), "
      f"{rot_per_mm:.1f} deg rotation per mm ablation, {N*H:.0f} mm per rev, melt power {P*1e3:.0f} mW at 5 cm/day")
COP, PLA, ICE, ICEDK = "#b87333", "#3b5f9e", "#cfe9f5", "#9fd0e8"

fig = plt.figure(figsize=(15, 9))
# ---------- A: unrolled profile ----------
ax = fig.add_axes([0.04, 0.55, 0.92, 0.40]); ax.set_aspect("equal"); ax.axis("off")
s = np.linspace(0, 2.2*pitch, 400)
def zbit(s): return -D + ((-s) % pitch)*slope        # bit bottom: tip just behind each riser at s=k*pitch, ramp rises behind
def ice_z(s): return np.minimum(0.0, zbit(s))         # ice thread = same profile, clipped by the ablation surface
ax.fill_between([-5, 2.2*pitch+5], [0]*2, [-D-8]*2, color=ICE, lw=0)
ax.fill_between(s, ice_z(s), -D-8, color=ICEDK, lw=0)
ax.plot([-5, 2.2*pitch+5], [0, 0], color="#3a8fb7", lw=1.2)
ax.text(-4, 0.6, "ambient ablation surface", color="#3a8fb7", fontsize=9)
for k_ in range(3):
    s0 = k_*pitch
    ax.add_patch(Polygon([[s0, -D], [s0-pitch, -D+H], [s0-pitch, 6], [s0, 6]], fc=PLA, ec="k", lw=0.8))
    ax.add_patch(Rectangle((s0, -D), 1.2, D+6, fc=COP, ec="k", lw=0.8))
ax.add_patch(Rectangle((-pitch, 6), 3.2*pitch, 4, fc=COP, ec="k", lw=0.8))
ax.text(-4, 7.2, "copper body / heat collector (fins in the air)", fontsize=9)
ax.text(pitch*0.5, -D+H*0.55+2.2, "insulated ramp, constant slope H/pitch\n(rests on the ice ramp along most of its length)", fontsize=8.5, color="white", ha="center")
ax.annotate("", (2*pitch+9, -D), (2*pitch+9, -D+H), arrowprops=dict(arrowstyle="<->", lw=1))
ax.text(2*pitch+10, -D+H/2, "H = %.0f" % H, fontsize=9, va="center")
ax.annotate("", (2*pitch+9, -D), (2*pitch+9, 0), arrowprops=dict(arrowstyle="<->", lw=1, color="#3a8fb7"))
ax.text(2*pitch+10, -D/2, "tip depth %.1f" % D, fontsize=8.5, va="center", color="#3a8fb7")
ax.annotate("", (pitch+12, -D-3), (pitch+4, -D-3), arrowprops=dict(arrowstyle="-|>", lw=1.5))
ax.text(pitch+4, -D-4.8, "bit rotates this way", fontsize=9)
ax.text(pitch+1.6, -D-0.2, "copper riser melts the\nice step ahead of it", fontsize=8.5, color=COP, va="top")
ax.annotate("", (0, 3.2), (pitch, 3.2), arrowprops=dict(arrowstyle="<->", lw=1, color="#333"))
ax.text(pitch/2, 3.9, "one pitch = 2πr/N = %.1f mm" % pitch, fontsize=9, ha="center")
ax.text(-4, -D-6.5, "ice thread laid down by the riser bottoms; above the surface line it is already ablated away", fontsize=9, color="#2b6f8f")
ax.annotate("", (2.2*pitch+2, -D-1.5), (2.2*pitch+2, -D-5), arrowprops=dict(arrowstyle="-|>", lw=1.5, color="#3a8fb7"))
ax.text(2.2*pitch+3.5, -D-3.2, "ice rises at\nablation rate v", fontsize=8.5, color="#3a8fb7", va="center")
ax.set_xlim(-6, 2.2*pitch+22); ax.set_ylim(-D-8, 11)
ax.set_title("A. Crown bit unrolled along its circumference (descends by H per pitch of rotation; only the risers melt)", fontsize=10, loc="left")

# ---------- B: plan view from below ----------
axb = fig.add_axes([0.03, 0.03, 0.46, 0.48]); axb.set_aspect("equal"); axb.axis("off")
th = np.linspace(0, 2*np.pi, 1441); rr = np.linspace(r_in, r_out, 30)
TH, RR = np.meshgrid(th, rr)
Z = ((-TH*r) % pitch)*slope           # 0 at the tip (just behind a riser) rising to H one pitch behind
axb.pcolormesh(RR*np.cos(TH), RR*np.sin(TH), Z, cmap="Blues_r", shading="auto", vmin=-2, vmax=H+1)
for k_ in range(N):
    t0 = 2*np.pi*k_/N
    axb.plot([r_in*np.cos(t0), r_out*np.cos(t0)], [r_in*np.sin(t0), r_out*np.sin(t0)], color=COP, lw=5, solid_capstyle="butt")
axb.add_patch(plt.Circle((0,0), r_in, fc="white", ec="k", lw=0.8)); axb.add_patch(plt.Circle((0,0), r_out, fc="none", ec="k", lw=0.8))
axb.annotate("", (r_out+6, 0), (r_out+6, 12), arrowprops=dict(arrowstyle="-|>", lw=1.5))
t=np.linspace(0.25,0.8,50); axb.plot((r_out+6)*np.cos(t),(r_out+6)*np.sin(t),"k",lw=1.5)
axb.text(r_out+7.5, 10, "rotation\n(seen from below)", fontsize=8.5)
axb.text(0, 0, "open\ncentre", ha="center", va="center", fontsize=9)
axb.text(-r_out-2, -r_out-5, "dark = tip (deepest), light = top of ramp, copper bars = risers", fontsize=8.5)
axb.set_xlim(-r_out-8, r_out+22); axb.set_ylim(-r_out-8, r_out+8)
axb.set_title("B. Crown bit from below: %d copper risers, %d helical insulated ramps" % (N,N), fontsize=10, loc="left")

# ---------- C: vertical section through the axis ----------
axc = fig.add_axes([0.55, 0.03, 0.43, 0.48]); axc.set_aspect("equal"); axc.axis("off")
axc.fill_between([-60,60],[0,0],[-30,-30],color=ICE,lw=0)
axc.plot([-60,60],[0,0],color="#3a8fb7",lw=1.2)
# ice core and track
for sgn in (-1,1):
    axc.add_patch(Polygon([[sgn*r_in,0],[sgn*r_out,0],[sgn*r_out,-D],[sgn*r_in,-D]], fc="white", ec="none"))
    axc.add_patch(Polygon([[sgn*r_in,-D*0.4],[sgn*r_out,-D*0.4],[sgn*r_out,-D],[sgn*r_in,-D]], fc=ICEDK, ec="none"))
    axc.add_patch(Polygon([[sgn*r_in,-D*0.4],[sgn*r_out,-D*0.4],[sgn*r_out,14],[sgn*r_in,14]], fc=PLA, ec="k", lw=0.8))
    axc.add_patch(Polygon([[sgn*r_in,10],[sgn*r_out,10],[sgn*r_out,14],[sgn*r_in,14]], fc=COP, ec="k", lw=0.8))
# fins
for zf in (16, 19, 22):
    axc.add_patch(Polygon([[-r_out-4,zf],[r_out+4,zf],[r_out+4,zf+1.2],[-r_out-4,zf+1.2]], fc=COP, ec="k", lw=0.5))
axc.add_patch(Polygon([[-r_out,14],[r_out,14],[r_out,16],[-r_out,16]], fc=COP, ec="k", lw=0.8))
# hollow axle + encoder + tripod
axc.add_patch(Polygon([[-4,16],[4,16],[4,52],[-4,52]], fc="#bbb", ec="k", lw=0.8))
axc.add_patch(Polygon([[-9,30],[9,30],[9,38],[-9,38]], fc="#ddd", ec="k", lw=0.8)); axc.text(11,34,"bearing +\nencoder",fontsize=8.5,va="center")
axc.plot([-4,-52],[52,0],"k",lw=2); axc.plot([4,52],[52,0],"k",lw=2)
axc.add_patch(Polygon([[-58,0],[-46,0],[-52,3]], fc="#666")); axc.add_patch(Polygon([[58,0],[46,0],[52,3]], fc="#666"))
axc.text(-60,-6,"tripod feet track\nthe ablating surface",fontsize=8.5,va="top")
axc.text(0,-D*0.7,"ice core\n(untouched)",fontsize=8.5,ha="center",va="center",color="#2b6f8f")
axc.annotate("",(r_out+6,-D),(r_out+6,0),arrowprops=dict(arrowstyle="<->",lw=1)); axc.text(r_out+8,-D/2-4,"tip depth %.1f mm < H"%D,fontsize=8,va="center")
axc.text(-60,55,"C. Section through the axis",fontsize=10)
txt=("%d teeth, H = %.0f mm, r = %.0f mm\nramp %.1f deg vs friction angle %.1f deg (mu %.2f)\n%.1f deg rotation per mm of ablation\n%.0f mm ablation per revolution\nmelt power %.0f mW at 5 cm/day"
     % (N,H,r,ramp_deg,np.degrees(np.arctan(mu)),mu,rot_per_mm,N*H,P*1e3))
axc.text(-60,50,txt,fontsize=8,va="top",family="monospace")
axc.set_xlim(-62,62); axc.set_ylim(-14,58)
fig.savefig("crown_bit.png",dpi=150); fig.savefig("crown_bit.svg")
