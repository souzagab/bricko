import numpy as np
AX = np.array([-136.901, 0.0])
def fit_circle(P):
    A = np.c_[2*P[:,0], 2*P[:,1], np.ones(len(P))]; bb = (P**2).sum(1)
    cx, cy, c = np.linalg.lstsq(A, bb, rcond=None)[0]; r = np.sqrt(max(c + cx*cx + cy*cy, 0))
    return cx, cy, r, np.abs(np.hypot(P[:,0]-cx, P[:,1]-cy) - r).max()
def line_res(P):
    a, b = P[0], P[-1]; d = b - a; L = np.hypot(*d)
    if L < 1e-9: return 1e9
    n = np.array([-d[1], d[0]]) / L; return np.abs((P - a) @ n).max()
def clean(P):
    P = P[:-1] if np.allclose(P[0], P[-1]) else P
    keep = [0]
    for i in range(1, len(P)):
        if np.hypot(*(P[i] - P[keep[-1]])) > 1e-4: keep.append(i)
    return P[keep]
def vectorize(P, tol=0.012):
    P = clean(np.asarray(P, float)); n = len(P)
    # rotate start to a sharp corner for stable output
    ang = []
    for i in range(n):
        a, b, c = P[i-1], P[i], P[(i+1) % n]; u, v = b - a, c - b
        ang.append(abs(np.arctan2(u[0]*v[1]-u[1]*v[0], u@v)))
    s = int(np.argmax(ang)); P = np.roll(P, -s, axis=0); P = np.vstack([P, P[:1]])
    out = []; i = 0
    while i < len(P) - 1:
        j = i + 1
        # try line
        while j + 1 < len(P) and line_res(P[i:j+2]) < tol: j += 1
        best = ('L', j)
        if j - i < 3:
            k = i + 2
            while k + 1 < len(P) and fit_circle(P[i:k+2])[3] < tol: k += 1
            if k - i >= 3 and fit_circle(P[i:k+1])[2] < 60: best = ('A', k)
        kind, j = best
        seg = P[i:j+1]
        if kind == 'L': out.append(('L', seg[0], seg[-1]))
        else:
            cx, cy, r, _ = fit_circle(seg); out.append(('A', seg[0], seg[-1], (cx, cy), r))
        i = j
    return out
def fmt(prims, ox=AX[0]):
    lines = []
    for p in prims:
        a, b = p[1] - [ox, 0], p[2] - [ox, 0]
        if p[0] == 'L':
            L = np.hypot(*(b - a)); ang = np.degrees(np.arctan2(*(b - a)[::-1]))
            lines.append(f'L ({a[0]:8.3f},{a[1]:7.3f}) -> ({b[0]:8.3f},{b[1]:7.3f})  len {L:6.3f} dir {ang:7.1f}°')
        else:
            c = np.array(p[3]) - [ox, 0]
            lines.append(f'A ({a[0]:8.3f},{a[1]:7.3f}) -> ({b[0]:8.3f},{b[1]:7.3f})  c=({c[0]:8.3f},{c[1]:7.3f}) r={p[4]:.3f}')
    return lines
