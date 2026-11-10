import sys, trimesh, numpy as np, matplotlib
matplotlib.use("Agg"); import matplotlib.pyplot as plt
from shapely.geometry import Polygon
m = trimesh.load(sys.argv[1]); out = sys.argv[2]
bodies = sorted(m.split(only_watertight=False), key=lambda b: b.bounds[0][1])
cols = ['#d9a520', '#2f6fd6']
def sec(b, o, n):
    s = b.section(plane_origin=o, plane_normal=n)
    return [] if s is None else [e for e in s.discrete if len(e) > 2]
def area(b, z):
    g = Polygon()
    for e in sec(b, [0,0,z], [0,0,1]): g = g.symmetric_difference(Polygon(e[:, :2]).buffer(0))
    return g.area
zs = np.arange(-7.84, 7.85, 0.04)
fig = plt.figure(figsize=(18, 30))
ax = fig.add_subplot(8, 1, 1)
for b, c, n in zip(bodies, cols, ['base', 'arm']): ax.plot(zs, [area(b, z) for z in zs], c=c, label=n)
ax.set_xticks(np.arange(-8, 8.1, 0.5)); ax.grid(lw=.3); ax.legend(); ax.set_title('section area vs z (width)')
zcuts = [-7.5, -5.0, -3.0, -1.0, 1.0, 3.0, 5.0]
for k, z in enumerate(zcuts):
    ax = fig.add_subplot(8, 1, k + 2)
    for b, c in zip(bodies, cols):
        for e in sec(b, [0,0,z], [0,0,1]): ax.plot(e[:,0], e[:,1], c=c, lw=.8)
    ax.set_aspect('equal'); ax.grid(lw=.3); ax.set_title(f'z={z}'); ax.set_xticks(np.arange(-142, -79, 1)); ax.tick_params(labelsize=5)
plt.tight_layout(); plt.savefig(out + '_z.png', dpi=80)
# X cuts (side view of width structure) and Y cuts (top view)
fig = plt.figure(figsize=(18, 26))
xcuts = [-138.5, -136.9, -135.5, -131.0, -127.0, -112.0, -91.0, -86.0, -82.0]
for k, x in enumerate(xcuts):
    ax = fig.add_subplot(5, 2, k + 1)
    for b, c in zip(bodies, cols):
        for e in sec(b, [x,0,0], [1,0,0]): ax.plot(e[:,2], e[:,1], c=c, lw=.8)
    ax.set_aspect('equal'); ax.grid(lw=.3); ax.set_title(f'x={x}  (horiz=z width, vert=y)'); ax.set_xticks(np.arange(-8, 8.1, 1))
plt.tight_layout(); plt.savefig(out + '_x.png', dpi=80)
fig = plt.figure(figsize=(18, 22))
ycuts = [0.5, 1.5, 2.5, 4.0, 7.7, 11.5, 13.5, 15.8, 16.8]
for k, y in enumerate(ycuts):
    ax = fig.add_subplot(9, 1, k + 1)
    for b, c in zip(bodies, cols):
        for e in sec(b, [0,y,0], [0,1,0]): ax.plot(e[:,0], e[:,2], c=c, lw=.8)
    ax.set_aspect('equal'); ax.grid(lw=.3); ax.set_title(f'y={y} (top view)'); ax.set_xticks(np.arange(-142, -79, 1)); ax.tick_params(labelsize=5)
plt.tight_layout(); plt.savefig(out + '_y.png', dpi=80)
