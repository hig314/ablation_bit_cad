import numpy as np, matplotlib
matplotlib.use("Agg"); import matplotlib.pyplot as plt
from matplotlib.patches import Polygon, Rectangle, Circle
R=27.; rc=4.; N=6; H=5.; D=3.5; mu=0.10; t_skin=1.0; ring=3.0   # mm
slope=lambda r: N*H/(2*np.pi*r)
COP,PLA,ICE,ICEDK="#b87333","#3b5f9e","#cfe9f5","#9fd0e8"
fig=plt.figure(figsize=(15,9))
# ---- A: unrolled profile at two radii ----
for i,(r,box) in enumerate(((R,[0.04,0.56,0.55,0.40]),(rc*2,[0.62,0.56,0.35,0.40]))):
    ax=fig.add_axes(box); ax.set_aspect("equal"); ax.axis("off")
    p=2*np.pi*r/N; s=np.linspace(-0.2*p,2.2*p,600)
    zb=lambda s:-D+((-s)%p)*slope(r)
    ax.fill_between([-0.25*p,2.3*p],[0,0],[-D-6,-D-6],color=ICE,lw=0)
    ax.fill_between(s,np.minimum(0,zb(s)),-D-6,color=ICEDK,lw=0)
    ax.plot([-0.25*p,2.3*p],[0,0],color="#3a8fb7",lw=1.2)
    for k in range(3):
        s0=k*p
        # copper tooth: full triangle above the ramp, up into the body
        ax.add_patch(Polygon([[s0,-D],[s0-p,-D+H],[s0-p,D+2],[s0,D+2]],fc=COP,ec="k",lw=0.8))
        # insulating skin on the ramp only
        ax.add_patch(Polygon([[s0,-D],[s0-p,-D+H],[s0-p,-D+H+t_skin],[s0-t_skin*0.4,-D+t_skin*0.9]],fc=PLA,ec="k",lw=0.5))
    ax.add_patch(Rectangle((-0.25*p,-D+H),2.55*p,D+2-(-D+H),fc=COP,ec="k",lw=0.8))
    ax.text(-0.22*p,D-0.6,"copper body, continuous up to the fins",fontsize=9)
    ax.text(-0.22*p,0.5,"ambient ablation surface",fontsize=8,color="#3a8fb7")
    ax.annotate("",(p+0.15*p,-D),(p+0.15*p,-D+H),arrowprops=dict(arrowstyle="<->",lw=1)); ax.text(p+0.17*p,-D+H/2,"H",fontsize=9,va="center")
    ax.text(0.45*p,-D+H*0.22,"ramp %.1f°"%np.degrees(np.arctan(slope(r))),fontsize=9,ha="center",color="white",rotation=-np.degrees(np.arctan(slope(r)))*0.9)
    ax.set_xlim(-0.25*p,2.3*p); ax.set_ylim(-D-6,D+3)
    ax.set_title(("A. Unrolled at the rim, r = %.0f mm: pitch %.1f mm" if i==0 else "…and at r = %.0f mm: same H, pitch %.1f mm, steeper")%(r,p),fontsize=10,loc="left")
# ---- B: plan from below ----
axb=fig.add_axes([0.03,0.03,0.42,0.48]); axb.set_aspect("equal"); axb.axis("off")
th=np.linspace(0,2*np.pi,1441); rr=np.linspace(rc,R,40); TH,RR=np.meshgrid(th,rr)
Z=((-TH)%(2*np.pi/N))*N*H/(2*np.pi)
axb.pcolormesh(RR*np.cos(TH),RR*np.sin(TH),Z,cmap="Blues_r",shading="auto",vmin=-2,vmax=H+1)
for k in range(N):
    t0=2*np.pi*k/N; axb.plot([rc*np.cos(t0),R*np.cos(t0)],[rc*np.sin(t0),R*np.sin(t0)],color=COP,lw=5,solid_capstyle="butt")
axb.add_patch(Circle((0,0),rc,fc=COP,ec="k",lw=0.8)); axb.add_patch(Circle((0,0),R,fc="none",ec="k",lw=0.8))
axb.text(0,-R-4,"flat copper centre r = %.0f mm melts straight down; helicoid ramps (dark = tip) and radial copper risers"%rc,fontsize=8.5,ha="center")
axb.set_xlim(-R-4,R+4); axb.set_ylim(-R-7,R+4); axb.set_title("B. From below",fontsize=10,loc="left")
# ---- C: section through the axis ----
axc=fig.add_axes([0.5,0.03,0.48,0.48]); axc.set_aspect("equal"); axc.axis("off")
axc.fill_between([-45,45],[0,0],[-12,-12],color=ICE,lw=0); axc.plot([-45,45],[0,0],color="#3a8fb7",lw=1.2)
axc.add_patch(Polygon([[-R,-D-1.5],[R,-D-1.5],[R,0],[-R,0]],fc="white",ec="none"))
axc.add_patch(Polygon([[-R,-D-1.5],[R,-D-1.5],[R,-D],[-R,-D]],fc=ICEDK,ec="none"))
axc.add_patch(Polygon([[-R,-D],[R,-D],[R,ring],[-R,ring]],fc=COP,ec="k",lw=0.8))       # screw body (risers + ramps are in the other section)
axc.add_patch(Rectangle((-R,0),2*R,ring,fc=PLA,ec="k",lw=0.5))                          # insulating ring
axc.add_patch(Rectangle((-R+2,0),2*R-4,ring,fc=COP,ec="none"))                          # copper continues inside the ring
axc.add_patch(Rectangle((-R,ring),2*R,4,fc=COP,ec="k",lw=0.8))
for zf in (5.5,8,10.5,13): axc.add_patch(Rectangle((-R-6,zf),2*R+12,1.0,fc=COP,ec="k",lw=0.4))
axc.add_patch(Rectangle((-R,ring+4),2*R,10.5,fc=COP,ec="none"))
axc.add_patch(Rectangle((-3,14),6,20,fc="#bbb",ec="k",lw=0.8)); axc.add_patch(Rectangle((-8,22),16,6,fc="#ddd",ec="k",lw=0.8))
axc.text(10,25,"bearing + encoder",fontsize=8.5,va="center")
axc.text(-R-6,ring/2,"ring ",fontsize=8,ha="right",va="center",color=PLA); axc.text(R+7,ring/2,"thin insulating\nsleeve, height %.0f mm,\nat the water line"%ring,fontsize=8,va="center",color=PLA)
axc.text(R+7,9,"copper fins\n(heat collector)",fontsize=8,va="center")
axc.text(0,-D-3.5,"ice under the flat centre melts straight down",fontsize=8,ha="center",color="#2b6f8f")
axc.annotate("",(-R-3,-D),(-R-3,0),arrowprops=dict(arrowstyle="<->",lw=1)); axc.text(-R-4,-D/2,"D",fontsize=9,ha="right",va="center")
axc.set_xlim(-46,46); axc.set_ylim(-13,36); axc.set_title("C. Section: copper is continuous from fins to cutting edges; insulation only where it guides or protects",fontsize=10,loc="left")
fig.savefig("screw_bit.png",dpi=150); fig.savefig("screw_bit.svg")
print("rim ramp %.1f deg, inner-edge ramp %.1f deg, friction angle %.1f deg"%(np.degrees(np.arctan(slope(R))),np.degrees(np.arctan(slope(rc))),np.degrees(np.arctan(mu))))
