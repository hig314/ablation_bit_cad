"""
Lumped steady heat balance for the screw bit (copper is isothermal per the 2-D model).
  collector:  q_in   = UA * (T_air - T_cu),  UA = h_air * A_fin
  cutting:    q_req  = rho*L * A_disk * v,    v = ddf * T_air   (riser flux is pinned by the rigid ratio;
                                             any excess just widens the gap ahead of the riser)
  ramp leak:  q_leak = U_ramp * A_ramp * T_cu  -> erodes the ice ramp: phantom descent = U_ramp*T_cu/(rho*L)
  T_cu solves q_in = q_req + q_leak (T_cu >= 0; if UA*T_air < q_req the bit is cut-limited)
Key ratio:  phantom/v = U_ramp * T_cu / (rho*L*ddf*T_air)   -- independent of contact area.
"""
import numpy as np, matplotlib
matplotlib.use("Agg"); import matplotlib.pyplot as plt
rhoL=917*334e3; ddf=7e-3/86400   # m/s per K
R=0.027
def balance(T_air, A_fin_cm2, U_ramp, h_air=10., ramp_area=np.pi*R**2/np.cos(np.radians(10))):
    UA=h_air*A_fin_cm2*1e-4; q_req=rhoL*np.pi*R**2*ddf*T_air; G=U_ramp*ramp_area
    if UA*T_air < q_req: return dict(cut_limited=True, T_cu=0, phantom=0, alpha=UA*T_air/q_req)
    T_cu=(UA*T_air-q_req)/(UA+G); return dict(cut_limited=False, T_cu=T_cu, phantom=U_ramp*T_cu/(rhoL*ddf*T_air), alpha=UA*T_air/q_req)
print("required collector conductance for margin 1: %.3f W/K  (= %.0f cm2 of fin at h=10)"%(rhoL*np.pi*R**2*ddf, rhoL*np.pi*R**2*ddf/10*1e4))
print("ramp-skin conductance scale rho*L*ddf = %.1f W/m2K"%(rhoL*ddf))
for lab,U in [("1 mm PETG",200),("5 mm PETG",40),("hollow ramp, 6 mm air",4.3),("hollow ramp, 15 mm air",1.7),("20 mm foam",1.5)]:
    row=[]
    for A in (80,120,200,400):
        b=balance(3.,A,U); row.append("cut-limited" if b["cut_limited"] else "%4.0f%% (Tcu %.1f K)"%(100*b["phantom"],b["T_cu"]))
    print("%-24s"%lab, " | ".join("%d cm2: %s"%(A,r) for A,r in zip((80,120,200,400),row)))
fig,ax=plt.subplots(figsize=(8,4.5))
U=np.logspace(-0.3,2.5,200)
for A,c in ((80,"#1b9e77"),(120,"#d95f02"),(200,"#7570b3"),(400,"#e7298a")):
    ph=[balance(3.,A,u)["phantom"]*100 for u in U]; ax.plot(U,ph,color=c,lw=2,label="fins %d cm² (margin ×%.1f)"%(A,balance(3.,A,1)["alpha"]))
ax.axhline(2,color="k",ls=":",lw=1); ax.text(0.55,2.3,"2 % target",fontsize=8)
for x,lab in ((200,"1 mm solid plastic"),(40,"5 mm solid plastic"),(4.3,"6 mm air cavity"),(1.7,"15 mm air cavity")):
    ax.axvline(x,color="#999",lw=0.8,ls="--"); ax.text(x*1.05,60,lab,rotation=90,fontsize=7.5,color="#555",va="top")
ax.set_xscale("log"); ax.set_ylim(0,100); ax.set_xlabel("ramp skin conductance U (W/m²K)"); ax.set_ylabel("phantom descent, % of true ablation")
ax.set_title("Ramp-leak error vs insulation and collector size (air +3 °C, h = 10 W/m²K, R = 27 mm)\nindependent of air temperature to first order, since melt demand and collection both scale with it",fontsize=9)
ax.legend(fontsize=8); fig.savefig("lumped_thermal.png",dpi=150,bbox_inches="tight")
