# Teardown tools

Scripts that measured the original clip (see `docs/ORIGINAL-TEARDOWN.md`). They work on any two-body clip STL, ours included.

```bash
STL=path/to/clip.stl
uv run --no-project --with trimesh --with shapely --with networkx --with scipy --with matplotlib --with rtree \
  python -I tools/teardown/sections.py "$STL" out/sec      # area vs width + X/Y/Z sections (PNGs)
uv run ... python -I tools/teardown/measure.py "$STL"       # hinge profile, clearance map, studs, pockets
node tools/teardown/kinematics.mjs "$STL"                   # rotate arm about the hinge, collisions per zone
```

The hinge axis (`AX`) and zone X ranges are hard-coded for the original. Change them before running on another model.
