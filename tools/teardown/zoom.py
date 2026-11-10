import sys, trimesh, numpy as np, matplotlib
matplotlib.use("Agg"); import matplotlib.pyplot as plt
m = trimesh.load(sys.argv[1]); out = sys.argv[2]
base, arm = sorted(m.split(only_watertight=False), key=lambda b: b.bounds[0][1])
AX = np.array([-136.901, 7.688])
def loops(b, z=-1.0):
    s = b.section(plane_origin=[0,0,z], plane_normal=[0,0,1]); return [e[:, :2] - [AX[0], 0] for e in s.discrete]
def rot(P, deg):
    t = np.radians(deg); c, s = np.cos(t), np.sin(t); Q = P - [0, AX[1]]
    return np.c_[Q[:,0]*c - Q[:,1]*s, Q[:,0]*s + Q[:,1]*c] + [0, AX[1]]
fig, axs = plt.subplots(2, 2, figsize=(20, 16))
views = [((38, 58, 2, 16), 'latch closed', [0]), ((38, 58, 2, 16), 'latch at 2° and 4°', [2, 4]),
         ((18, 30, 6, 13.5), 'divider key closed + 3°', [0, 3]), ((-6, 8, -1, 16), 'hinge z=-1 (base knuckle) & z=-5', [0])]
for ax, ((x0, x1, y0, y1), title, angs) in zip(axs.flat, views):
    for e in loops(base): ax.plot(e[:,0], e[:,1], c='#c8961e', lw=1.2)
    for a, ls in zip(angs, ['-', '--', ':']):
        for e in loops(arm): ax.plot(*rot(e, a).T, c='#2f6fd6', lw=1.0, ls=ls)
    if 'hinge' in title:
        for e in loops(base, -5.0): ax.plot(e[:,0], e[:,1], c='#c8961e', lw=0.8, ls='--')
        for e in loops(arm, -5.0): ax.plot(e[:,0], e[:,1], c='#2f6fd6', lw=0.8, ls='--')
    ax.set_xlim(x0, x1); ax.set_ylim(y0, y1); ax.set_aspect('equal'); ax.set_title(title)
    ax.set_xticks(np.arange(x0, x1 + 0.01, 0.5)); ax.set_yticks(np.arange(y0, y1 + 0.01, 0.5)); ax.grid(lw=.3); ax.tick_params(labelsize=6)
plt.tight_layout(); plt.savefig(out, dpi=75)
