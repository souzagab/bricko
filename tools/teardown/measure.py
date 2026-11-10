import sys, trimesh, numpy as np
from shapely.geometry import Polygon
m = trimesh.load(sys.argv[1])
base, arm = sorted(m.split(only_watertight=False), key=lambda b: b.bounds[0][1])
AX = np.array([-136.901, 7.688])
def simp(e, tol=0.01):
    P = Polygon(e).simplify(tol).exterior.coords; return np.array(P)
print('== HINGE: plane through axis (x = axis). cols: z, y  (r = y - 7.688)')
for name, b in [('base', base), ('arm', arm)]:
    s = b.section(plane_origin=[AX[0], 0, 0], plane_normal=[1, 0, 0])
    for e in s.discrete:
        P = simp(e[:, [2, 1]], 0.005)
        P = P[(P[:, 1] > AX[1] - 0.01)]  # upper half only (symmetric)
        print(name, ' '.join(f'({z:+.3f},r{y - AX[1]:.3f})' for z, y in P[np.argsort(P[:, 0])]))
print('== CLEARANCE MAP: arm surface samples -> distance to base (only < 0.6 mm)')
pts, fi = trimesh.sample.sample_surface_even(arm, 120000, seed=1)
pq = trimesh.proximity.ProximityQuery(base)
_, d, _ = pq.on_surface(pts)
close = d < 0.6
X = pts[close, 0] - AX[0]; Y = pts[close, 1]; Z = pts[close, 2]; D = d[close]
bins = [(-6, 6, 'hinge'), (6, 21, 'ch1 roof'), (21, 29, 'divider key'), (29, 44, 'ch2 roof'), (44, 52, 'latch'), (52, 60, 'end/tab')]
for x0, x1, nm in bins:
    k = (X >= x0) & (X < x1)
    if k.any():
        i = np.argmin(np.where(k, D, 9)); print(f'  {nm:12s} min {D[k].min():.3f} at X{X[i]:+.2f} Y{Y[i]:.2f} Z{Z[i]:+.2f};  p10 {np.percentile(D[k],10):.3f}  n={k.sum()}')
print('== STUDS (arm top)')
for y in [15.3, 15.6, 16.0, 16.5, 17.0, 17.2]:
    s = arm.section(plane_origin=[0, y, 0], plane_normal=[0, 1, 0])
    rs = []
    for e in s.discrete:
        P = e[:, [0, 2]]; c = P.mean(0); 
        if np.ptp(P[:,0]) < 6: rs.append((c[0]-AX[0], c[1], np.ptp(P[:,0]), P[:,1].min(), P[:,1].max()))
    rs.sort()
    print(f'  y={y}: n={len(rs)} first: X{rs[0][0]:.2f} Z{rs[0][1]:+.2f} dx {rs[0][2]:.3f} z[{rs[0][3]:+.3f},{rs[0][4]:+.3f}]  2nd: X{rs[1][0]:.2f} Z{rs[1][1]:+.2f} z[{rs[1][3]:+.3f},{rs[1][4]:+.3f}]')
xs = sorted({round(r[0], 2) for r in rs}); print('  stud X centres', xs, 'pitch', np.diff(xs).round(3))
print('== BOTTOM POCKETS at y=1.0 (X,Z bounds)')
s = base.section(plane_origin=[0, 1.0, 0], plane_normal=[0, 1, 0])
outer = max(s.discrete, key=lambda e: np.ptp(e[:,0]))
print('  outer X', (outer[:,0].min()-AX[0]).round(3), (outer[:,0].max()-AX[0]).round(3), 'Z', outer[:,2].min().round(3), outer[:,2].max().round(3))
for e in sorted([e for e in s.discrete if np.ptp(e[:,0]) < 10], key=lambda e: (e[:,0].min(), e[:,2].min())):
    print(f'  pocket X[{e[:,0].min()-AX[0]:7.3f},{e[:,0].max()-AX[0]:7.3f}] Z[{e[:,2].min():+.3f},{e[:,2].max():+.3f}] area {Polygon(e[:,[0,2]]).area:.2f}')
for y in [0.05, 0.3, 2.2, 2.29, 2.31]:
    s = base.section(plane_origin=[0, y, 0], plane_normal=[0, 1, 0]); print(f'  y={y}: loops {len(s.discrete)}')
