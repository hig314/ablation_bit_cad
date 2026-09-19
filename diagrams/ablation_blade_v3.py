"""
Ablation blade v3: copper cutting face on the LEADING side of each tooth
(continuous with the copper body), plastic back-curve = rear envelope of the
swept region over the tooth's whole submerged sweep.  Only one constraint left.
Tripod frame: origin at axle, y up, blade CCW at omega=k*v, ice rises at v.
Rear boundary of swept region behind tooth at angle psi, descent u since cut:
    S(u) = Rot(psi - k u)(0,-R) + (0,u),  0<=u<=(psi+gamma)/k, keep y<=-h
"""
import numpy as np, matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Circle, Polygon, FancyArrowPatch

R=60.; N=12; kR=0.5; k=kR/R; d=8.; h=R-d; skin=1.0; rake=8.0   # rake: forward offset of face top (mm)
gam=np.arccos(h/R); rho=1/k
def rot(a,p): c,s=np.cos(a),np.sin(a); return np.array([c*p[0]-s*p[1], s*p[0]+c*p[1]])
def rear_wall(psi,n=300):
    u=np.linspace(0,(psi+gam)/k,n)
    pts=np.array([rot(psi-k*ui,(0,-R))+np.array([0,ui]) for ui in u])
    pts=pts[pts[:,1]<=-h+1e-9]
    return np.array([rot(-psi,q) for q in pts])
ys=np.linspace(-R,-h,60); env=np.full(60,-np.inf)
for psi in np.linspace(-gam,gam,241):
    pb=rear_wall(psi)
    if len(pb)<2: continue
    pb=pb[np.argsort(pb[:,1])]
    xi=np.interp(ys,pb[:,1],pb[:,0],left=np.nan,right=np.nan); ok=~np.isnan(xi)
    env[ok]=np.maximum(env[ok],xi[ok])
env[0]=0.0
# tooth outline: back = envelope (extended 3mm into body), front = straight cutting face
yy=np.r_[ys,-h+3]; back=np.c_[np.r_[env,env[-1]],yy]
front_top=np.array([rake,-h+3]); front=np.c_[np.linspace(0,front_top[0],40),np.linspace(-R,front_top[1],40)]
tooth=np.vstack([back, front[::-1]])
copper=np.vstack([np.c_[np.r_[env,env[-1]]+skin,yy], front[::-1]])   # copper = tooth minus plastic skin
copper[0]=[0,-R]
# swept (melted) region in blade frame at psi=0
rw=rear_wall(0.0); swept=np.vstack([rw, [[rw[-1,0],-h],[front_top[0]*(d/(d+3)),-h]], front[::-1][front[::-1][:,1]<=-h]])
print("back-curve x at surface %.2f mm, tip tangent %.1f deg from vertical"%(env[-1],np.degrees(np.arctan(kR))))

COPPER,PLASTIC,ICE,SLOT="#b87333","#3b5f9e","#cfe9f5","#f7fbfe"
def T(theta,P): a=theta+np.pi/2; return np.array([rot(a,q) for q in P])
fig=plt.figure(figsize=(15,8.5))
ax=fig.add_axes([0.02,0.05,0.56,0.9]); ax.set_aspect("equal"); ax.axis("off")
axz=fig.add_axes([0.62,0.08,0.36,0.84]); axz.set_aspect("equal"); axz.axis("off")

ax.add_patch(Polygon([[-90,-h],[150,-h],[150,-95],[-90,-95]],color=ICE,lw=0))
ax.plot([-90,150],[-h,-h],color="#3a8fb7",lw=1.2); ax.text(-88,-h+2,"ice surface",color="#3a8fb7",fontsize=9)
ax.add_patch(Circle((0,0),h,fc=COPPER,ec="k",lw=1.2,zorder=3,alpha=0.85))
ax.add_patch(Circle((0,0),5,fc="white",ec="k",lw=1.2,zorder=4))
for i in range(N):
    th=-np.pi/2+2*np.pi*i/N
    ax.add_patch(Polygon(T(th,tooth),fc=PLASTIC,ec="k",lw=0.5,zorder=3))
    ax.add_patch(Polygon(T(th,copper),fc=COPPER,ec="none",zorder=4,alpha=0.85))
for sgn in (-1,1):
    a=-np.pi/2+sgn*gam; ax.plot([0,R*np.cos(a)],[0,R*np.sin(a)],color="#888",lw=0.7,ls=":")
ax.text(R*np.cos(-np.pi/2-gam)-26,-h+8,"tooth enters\nψ = −%.0f°"%np.degrees(gam),fontsize=8,color="#555")
ax.text(R*np.cos(-np.pi/2+gam)+2,-h+8,"tooth exits\nψ = +%.0f°"%np.degrees(gam),fontsize=8,color="#555")
ax.plot([0,rho],[0,0],color="#666",lw=0.8,ls="--"); ax.plot(rho,0,"kx",ms=8,mew=2)
ax.text(rho+3,3,"instantaneous centre of\nice motion rel. blade\nρ = 1/k = %.0f mm"%rho,fontsize=9,va="bottom")
ax.add_patch(FancyArrowPatch((-42,0),(0,-46),connectionstyle="arc3,rad=0.45",arrowstyle="-|>",mutation_scale=18,color="k",lw=1.5,zorder=5))
ax.text(-40,-30,"ω = k·v",fontsize=10)
ax.annotate("",(0,-h-6),(0,-h-28),arrowprops=dict(arrowstyle="-|>",lw=1.5,color="#3a8fb7"))
ax.text(4,-h-18,"ice rises at\nablation rate v",fontsize=9,color="#3a8fb7")
ax.annotate("",(-78,-R),(-78,-h),arrowprops=dict(arrowstyle="<->",lw=1)); ax.text(-77,-(R+h)/2,"d = %.0f"%d,fontsize=9,va="center")
ax.text(-90,88,"Ablation blade v3  —  N=%d, R=%.0f mm, k·R=%.2f, d=%.0f mm"%(N,R,kR,d),fontsize=11,weight="bold")
ax.text(-90,80,"Copper cutting face on the leading side of each tooth, continuous with the copper body (heat collector).\n"
        "Blue: plastic back-curve = rear envelope of the swept region over the tooth's ±%.0f° sweep."%np.degrees(gam),fontsize=9)
ax.set_xlim(-92,152); ax.set_ylim(-97,95)

axz.add_patch(Polygon([[-14,-h],[16,-h],[16,-R-8],[-14,-R-8]],color=ICE,lw=0))
axz.add_patch(Polygon(swept,fc=SLOT,ec="none",zorder=2))
for psi in np.radians([-25,-12,0,12,25]):
    rb=rear_wall(psi)
    if len(rb)<2: continue
    axz.plot(rb[:,0],rb[:,1],color="#3a8fb7",lw=0.7,ls="--",zorder=3)
    axz.text(rb[-1,0]-0.3,rb[-1,1]+0.3,"%+.0f°"%np.degrees(psi),fontsize=7,color="#3a8fb7",ha="right")
axz.add_patch(Circle((0,0),h,fc=COPPER,ec="k",lw=1.2,zorder=3,alpha=0.85))
axz.plot([-14,16],[-h,-h],color="#3a8fb7",lw=1.2,zorder=4)
axz.add_patch(Polygon(tooth,fc=PLASTIC,ec="k",lw=0.8,zorder=5))
axz.add_patch(Polygon(copper,fc=COPPER,ec="none",zorder=6,alpha=0.85))
v=np.array([kR,-1.0]); v/=np.linalg.norm(v)
axz.annotate("",(7,-R+1)+ 5*v,(7,-R+1),arrowprops=dict(arrowstyle="-|>",lw=1.3,color="k"))
axz.text(7.3,-R-3.5,"tooth motion rel. ice (ωR, −v)\n%.0f° from vertical"%np.degrees(np.arctan(kR)),fontsize=8,va="top")
axz.text(-13.5,-R-1,"Pale region: already melted by the cutting face.\nDashed: rear boundary of that region as the tooth\n"
         "swings −25°…+25°. The plastic back is its envelope,\nso it never sits in uncut ice; when it touches the\n"
         "boundary the ice pushes it forward → rotation.",fontsize=8.3,va="top")
axz.text(5.5,-R+3.6,"copper cutting face\n(melts down-and-forward)",fontsize=8.5,color=COPPER)
axz.text(-13,-h-4.5,"plastic back-curve\n(cam, sets k)",fontsize=8.5,color=PLASTIC)
axz.text(-13,-h+1.2,"copper body (above ice)",fontsize=8.5)
axz.set_xlim(-14,16); axz.set_ylim(-R-9,-h+5); axz.set_title("Bottom tooth, zoomed",fontsize=10)
fig.savefig("ablation_blade_v3.svg"); fig.savefig("ablation_blade_v3.png",dpi=150)
