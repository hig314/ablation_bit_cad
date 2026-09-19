import numpy as np, matplotlib
matplotlib.use("Agg"); import matplotlib.pyplot as plt
from matplotlib.patches import Polygon, Rectangle, Circle, FancyArrowPatch, Arc
COP,PLA,ICE,ICEDK,VOID="#b87333","#3b5f9e","#cfe9f5","#9fd0e8","#dfe7f5"
r=20.; N=6; H=6.; D=3.5; p=2*np.pi*r/N
fig=plt.figure(figsize=(15,7))
# ---- A: one tooth, unrolled at r=20, with copper blade+spine, printed body with voids, rear support pad ----
ax=fig.add_axes([0.03,0.06,0.55,0.9]); ax.set_aspect("equal"); ax.axis("off")
ax.fill_between([-3,p+8],[0,0],[-D-4,-D-4],color=ICE,lw=0)
s=np.linspace(-3,p+8,500); zb=-D+((-s)%p)*H/p; ax.fill_between(s,np.minimum(0,zb),-D-4,color=ICEDK,lw=0)
ax.plot([-3,p+8],[0,0],color="#3a8fb7",lw=1.2); ax.text(-2.5,0.5,"ambient ablation surface",fontsize=8,color="#3a8fb7")
# printed body outline (triangle + block above), ramp face
body=[[0,-D],[p,-D+H],[p,16],[0,16]]
ax.add_patch(Polygon(body,fc=PLA,ec="k",lw=0.8))
# voids: a big cavity under the rear support pad, small cells toward the tip
ax.add_patch(Polygon([[p*0.45,-D+H*0.55+1.6],[p*0.98,-D+H+1.6],[p*0.98,14],[p*0.45,14]],fc=VOID,ec="k",lw=0.4))
for i in range(4):
    x0=p*(0.12+0.08*i); ax.add_patch(Polygon([[x0,-D+x0*H/p+1.0],[x0+p*0.06,-D+(x0+p*0.06)*H/p+1.0],[x0+p*0.06,-D+(x0+p*0.06)*H/p+2.2+i*1.4],[x0,-D+x0*H/p+2.2+i*1.4]],fc=VOID,ec="k",lw=0.3))
# copper: blade (riser) + spine up to hub, inside corner filleted
blade=[[0,-D],[1.8,-D+0.6],[1.8,10],[0,10]]
ax.add_patch(Polygon(blade,fc=COP,ec="k",lw=0.8))
ax.add_patch(Rectangle((-3,10),p+11,6,fc=COP,ec="k",lw=0.8))
th=np.linspace(np.pi,1.5*np.pi,30); ax.add_patch(Polygon(np.c_[4.3+2.5*np.cos(th),12.5+2.5*np.sin(th)].tolist()+[[1.8,10]],fc=COP,ec="k",lw=0.6))
# support pad label etc
ax.text(p*0.72,-D+H*0.75+0.2,"support pad",fontsize=8,color="white",ha="center",rotation=-np.degrees(np.arctan(H/p)))
ax.text(p*0.72,8,"large printed void\n(air ≈ 0.026 W/mK)",fontsize=8,ha="center",color="#333")
ax.text(p*0.2,-D+H*0.2+2.6,"thin skin near the tip:\nerodes faster, but carries\nno load — only the pad does",fontsize=7.5,color="white")
ax.text(3,4,"copper blade\n(riser)",fontsize=8,color=COP)
ax.text(p*0.15,13,"copper hub / spine → fins",fontsize=8.5)
ax.text(5.2,10.6,"milled fillet at the inside corner:\nabove the ice, never cuts",fontsize=7.5,color="#333")
ax.annotate("",(p+3,-D),(p+3,-D+H),arrowprops=dict(arrowstyle="<->",lw=1)); ax.text(p+3.8,-D+H/2,"H",fontsize=9,va="center")
ax.annotate("",(p+6,-D),(p+6,0),arrowprops=dict(arrowstyle="<->",lw=1,color="#3a8fb7")); ax.text(p+6.8,-D/2,"D",fontsize=9,va="center",color="#3a8fb7")
ax.annotate("",(0.9,-D-1.5),(-2.5,-D-1.5),arrowprops=dict(arrowstyle="<-",lw=1.2)); ax.text(-2.5,-D-3,"cutting direction",fontsize=8)
ax.text(-2.5,-D-4+0.4,"blade bottom edge ground at an angle; it only has to cut as it goes, not be vertical or planar",fontsize=7.5,color="#444")
ax.set_xlim(-3.5,p+9); ax.set_ylim(-D-4.5,17)
ax.set_title("A. Tooth cross-section at r = %.0f mm: copper only where it cuts and conducts; load-bearing pad insulated by a void"%r,fontsize=10,loc="left")
# ---- B: surrogate-surface collector ----
bx=fig.add_axes([0.6,0.06,0.39,0.9]); bx.set_aspect("equal"); bx.axis("off")
bx.fill_between([-30,30],[0,0],[-10,-10],color=ICE,lw=0); bx.plot([-30,30],[0,0],color="#3a8fb7",lw=1.2)
bx.add_patch(Rectangle((-12,-D),24,D+3,fc=COP,ec="k",lw=0.8))   # bit
bx.add_patch(Rectangle((-1.5,3),3,14,fc="#bbb",ec="k",lw=0.8))   # spine
bx.add_patch(Rectangle((-12,17),24,1.2,fc="#e8e8e8",ec="k",lw=0.8))  # plate
bx.text(0,19.5,"collector plate: same footprint as the bit,\nice-like albedo, dark underside toward the bit,\nclose to 0 °C when the sink is good",fontsize=8,ha="center")
for x in (-9,-3,3,9):
    bx.annotate("",(x,18.3),(x+4,26),arrowprops=dict(arrowstyle="-|>",lw=1,color="#e6a800"))
bx.text(-27,25,"SW (1−α)",fontsize=8,color="#c58f00")
bx.annotate("",(-14,17.8),(-22,17.8),arrowprops=dict(arrowstyle="-|>",lw=1,color="#666")); bx.text(-28,15.5,"Q_H = h(T_air − T)",fontsize=8,color="#666")
bx.annotate("",(0,3.5),(0,16.5),arrowprops=dict(arrowstyle="-|>",lw=2,color=COP)); bx.text(2,10,"conduction\nto the risers",fontsize=8,color=COP)
bx.text(0,-D-2.2,"the plate intercepts the energy that would have\nmelted this footprint of ice, and delivers it to the risers",fontsize=8,ha="center",color="#2b6f8f")
bx.text(-29,-10.5,"Surrogate-surface idea: match the collector's energy balance to the ice it replaces,\nso the bit needs the same heat the surface would have used — under sun or cloud.",fontsize=8,va="bottom")
bx.set_xlim(-30,30); bx.set_ylim(-12,28); bx.set_title("B. Driving the bit like the ice surface is driven",fontsize=10,loc="left")
fig.savefig("tooth_v2.png",dpi=150); fig.savefig("tooth_v2.svg")
