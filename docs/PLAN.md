# Plan

## Goal

This is a public website where anyone can customize a print-in-place cable clip that works with standard construction bricks. Every dimension can be changed. The visitor downloads an STL and prints it on any FDM printer.

The first version covers one design family: the folding clip, with a base, an arm, cable channels, snap dividers, an end latch, studs on top and brick sockets on the bottom.

Out of scope for v1: accounts, a backend, MakerWorld or any printer-vendor integration, and slicer profiles.

## Decisions

| # | Decision | Why |
|---|---|---|
| D1 | **Static site with all geometry generated in the browser.** No backend. | Free hosting, zero running cost, nothing uploaded, instant feedback. |
| D2 | **The geometry engine is [manifold-3d](https://github.com/elalish/manifold)** (WebAssembly, Apache-2.0, v3.5.x). | Its output is always a closed, watertight solid, which is what slicers want. Booleans take milliseconds. Its 2D `CrossSection` with round-join `offset` gives cheap fillets. `minGap()` lets us verify clearances. The same code runs in Node, so tests and the CLI share it. |
| D3 | Not OpenSCAD compiled to WebAssembly. | GPL would spread to the site, a render takes seconds, and we would be generating code as strings. |
| D4 | Not OpenCascade (replicad, brepjs). | 10+ MB of WebAssembly and slower. We output STL, so we don't need the exact-surface (B-rep) features it adds. |
| D5 | **UI uses Svelte 5 + Vite 8 + TypeScript 6.x.** | Small bundle and reactive forms. TypeScript is pinned to 6.x because `svelte-check` supports TS ^5 or ^6 only (the TS 7 native compiler has no JS API yet). |
| D6 | **The viewer uses three.js.** | The standard choice. Needs orbit controls, an open/close animation, a section view and a print-bed overlay. |
| D7 | **One parameter schema** (zod 4) drives the UI controls, validation, defaults, URL sharing and presets. | Single source of truth, so adding a parameter means one edit. |
| D8 | **Geometry runs in a Web Worker.** | The UI never freezes while a model rebuilds. |
| D9 | **Output is one binary STL** holding both bodies (base and arm), already placed on the bed in print orientation. 3MF comes later via `fflate`. | Every slicer opens STL. The original STL was not on the bed (it was centred on Z=0). |
| D10 | **Print orientation is a parameter: `flat` (default) or `side`.** The geometry rules satisfy both. | Studs need to print **upright** to clutch real bricks well, so flat wins. `side` is the original's orientation and gives the best hinge and snaps, but prints the studs sideways. See GEOMETRY.md §3. |
| D11 | **Brick dimensions use nominal values plus one "fit offset" per feature, and the site offers a calibration test print.** | Stud fit on FDM printers varies a lot between machines (working stud diameters from 4.6 to 5.0 mm have been reported). Generic defaults plus a 10-minute test print beat guessing. |
| D12 | **Branding says "brick-compatible".** No LEGO in the name, domain or logo, and the footer carries a trademark disclaimer. | LEGO's Fair Play policy, and the NZ *Zuru* ruling against "LEGO BRICKS COMPATIBLE" packaging. |
| D13 | **The original model is inspiration only.** All geometry is written from scratch and the original is credited. | The original's license field is empty. |

## Architecture

```
src/
  params/       schema.ts   one zod schema: id, label, group, unit, min, max, step, default, advanced, help
                presets.ts  USB-C, power, HDMI, 1-stud, 2-stud, ...
                url.ts      versioned encode/decode for share links
  rules/        derive.ts   derived dimensions (width from stud count, tube OD, ...)
                validate.ts errors / warnings / clamps
  geometry/     pure code, no DOM, runs in the worker and in Node
    kernel.ts     loads manifold, handles freeing memory (WASM objects need .delete())
    profile.ts    2D CrossSections for the base and arm (plate, dividers, grooves, lip)
    hinge.ts      knuckles and pin; `vertical` variant (cone ends) / `horizontal` variant (teardrop bore)
    bricks.ts     studs (solid or hollow), bottom (cavity + tubes | stud holes | flat)
    latch.ts      end latch, snap bump, thumb tab
    clip.ts       assembles {base, arm} in the part frame (closed position)
    orient.ts     part frame -> bed frame for the chosen orientation; z min = 0
    coupon.ts     calibration test print (hinge gaps, stud/socket fit, snaps)
    checks.ts     minGap, base∩arm volume, overhang scan, min wall, bridge length
  export/       stl.ts      binary STL writer
  worker/       geometry.worker.ts   params -> {meshes, report}
  viewer/       scene.ts    three.js: bed, parts, open/close animation, clipping plane
  ui/           Svelte components generated from the schema
cli/            gen.ts      params.json -> .stl (batch runs, slicer checks)
tests/          vitest: unit tests, invariant tests and fast-check fuzzing
```

**Part frame.** The profile is drawn in XY, with X along the clip's length and Y through its thickness. It is extruded along Z, which is the clip's width. The clip is modelled closed. `orient.ts` rotates it onto the bed: `flat` puts the base bottom on the bed with the studs up, and `side` puts the hinge axis vertical.

## Parameters (v1)

These defaults are **provisional** until test prints confirm them. Ranges are clamped by the validation rules.

| Group | Parameters (default) |
|---|---|
| Channels | count (2, 1–6); width (20 mm, 3–60), the same for all or set per channel; height (9 mm) |
| Body | width mode: `studs` (2 studs = 15.8 mm) or `free` (mm); base thickness (3.2); arm thickness (3.0); divider thickness (2.0) |
| Snaps | bulb Ø (3.0); interference (0.3); groove clearance (0.3) |
| Latch | catch depth (1.0); lead-in angle (30°); thumb-tab length (4) and angle (20°) |
| Hinge | barrel Ø (8.6); pin Ø (5.0); radial clearance (0.35); axial clearance (0.4); knuckles (3, odd) |
| Top studs | on/off; pitch (8.0); Ø (4.8); height (1.7); hollow on/off plus inner Ø; fit offset (0) |
| Bottom | mode `cavity` / `holes` / `flat`; wall (1.5, derived); tube OD (6.51, derived); fit offset (0) |
| Printing | orientation `flat` / `side`; layer height (0.2); nozzle (0.4); first-layer relief (0.2); elephant-foot chamfer (0.4) |
| Finish | edge fillet (0.5); curve resolution (segments per mm) |

## Validation rules (starting set)

- Radial clearance is at least 0.15 mm. Warn below 0.25 mm.
- **Gaps along the build Z axis are rounded up to a whole number of layers.** Warn below 2 layers. Which gaps these are depends on the orientation.
- Minimum wall is at least 2 × nozzle width.
- Barrel Ø must be at least pin Ø + 2 × clearance + 2 × min wall.
- In `flat` orientation, the channel roof is a bridge, so warn when channel width exceeds 35 mm.
- When studs are on and width mode is `studs`, width = n·8 − 0.2. In `free` mode the studs are centred.
- Overhang scan: no downward-facing surface steeper than 45° from vertical unless it is a short bridge. Computed from mesh normals.
- Base and arm must not intersect (intersection volume = 0), and `minGap(base, arm)` must be at least the minimum clearance.
- The bodies must sit on the bed (z min = 0), and each body must be manifold (`status() == NoError`).

## Testing

1. **Invariant tests** (vitest in Node): for every preset, check that the status is OK, there are exactly 2 bodies after `decompose`, base ∩ arm = ∅, minGap is at least the clearance, the part sits on the bed, and the volume falls in the expected range.
2. **Fuzzing** (fast-check): random valid parameters must hold the same invariants, never throw, and build within the time budget.
3. **Slicer smoke test** (local, optional): slice the generated STLs with the OrcaSlicer CLI (generic profile) and expect exit code 0.
4. **Physical**: print the calibration test print and the presets in both orientations, check them against real bricks, and record the results in `docs/CALIBRATION.md`. Defaults only change based on these results.

## Milestones

| M | What | Done when |
|---|---|---|
| M0 | Repo and docs | This file |
| M1 | Geometry engine setup, base/arm profiles, STL export, CLI | `cli/gen.ts` writes a valid 2-body STL; invariant tests pass |
| M2 | Hinge, snaps, latch | First physical print folds, snaps and latches, in both orientations |
| M3 | Studs, bottom sockets, calibration print | A real brick clutches the top studs and the bottom sockets |
| M4 | Web UI | Panel generated from the schema, worker, viewer, presets, share URL, STL download |
| M5 | Polish and launch | Validation UI (warnings plus a checks overlay), mobile layout, name/domain, deploy |
| Later | 3MF export; bottom options for screws, magnets and adhesive; more clip families; i18n (EN / PT-BR) | |

## Decided later

| # | Decision | Why |
|---|---|---|
| D14 | **License: AGPL-3.0-only.** | A hosted fork has to publish its source. All dependencies are MIT or Apache-2.0, and both can be used in AGPLv3 code. |
| D15 | **Hosting: GitHub Pages**, deployed by a GitHub Actions workflow. | Free and static, and it serves `.wasm` correctly. Set Vite `base` to the repo path until there is a custom domain. |

## Open questions

- **Domain.** The name is **Bricko**. bricko.com, .app, .io and .dev are taken. brickoclip.com, brickoclips.com and bricko.xyz were free on 2026-11-10. Check trademark databases for "Bricko" before launch: it may be a historic UK construction-toy brand.

## Status (2026-11-10)

| M | State |
|---|---|
| M0 | ✅ done |
| M1 | ✅ done: engine, profiles, STL export, `cli/gen.ts`, tests |
| M2 | ✅ geometry done; **waiting on the first physical print** |
| M3 | 🟡 studs and bottom (cavity/holes/flat) done. Hollow studs and the calibration print still to do |
| M4–M5 | ⏳ |

### Design as built (changes from the plan above)

- **Hinge:** no separate pin. Between each pair of knuckles, the knuckle with the lower z has a 45° male cone that sits in a socket in the next one. The socket is the cone shifted by `c·√2` along the axis, which gives an offset of `c` perpendicular to the surface. Because 45° is printable both ways, this works flat or on its side. Every knuckle reaches the bed in flat orientation.
- **Dividers:** **keyed** (a 45° trapezoid that sits in a groove under the arm) instead of snapping. A round snap bulb would leave the arm's lips starting in mid-air when printed flat. The **end latch is what holds the clip shut.** Keys only go on dividers where the arm lifts more than it slides while opening (`x ≥ y − hy`). Start and end walls never get one, and neither does any divider whose groove would reach the latch arc (on tall clips the arc leans over the last dividers).
- **Latch:** the end wall's outer face and the arm's latch wall ("skirt") are **arcs centred on the hinge axis**. Opening slides them past each other at constant clearance, and only the 45°/`catchAngle` catch interferes. Fuzz testing found that straight walls jam on short, tall clips.
- **First layer:** the first layer of each body is replaced by its footprint (the intersection of slices at 5% and 99.9% of the layer) shrunk by `elephantFoot`. This is generic and works in both orientations.
- **Clamps (reported as info):**
  - Barrel: barrel top + clearance must stay below the arm.
  - Cone: must fit inside the barrel and the next knuckle.
  - Tab: must stay above the bed.
  - End wall: grows to cover the arc's dip at the catch height.
- **Errors (no geometry):**
  - Knuckles too short.
  - Clip too short for the catch.
  - **Clip too tall for its length.** The latch arc would lean more than 45° from vertical.
- **Clearance slack:** cuts get `c + 0.01` because the curves are polygons. Tests require gap ≥ `c − 0.001` everywhere.
- **Opening range:** clean to at least 135°. Around 145–150° the arm web meets the base plate corner, which is a physical stop, like the original's.

### Verification

- **Invariant tests on every preset:** each body is one manifold piece, base ∩ arm = ∅, minGap ≥ clearance, z min = 0, binary STL triangle count correct.
- **Kinematics:** the arm rotates 0→150° (presets) or 0→135° (random clips) about the hinge with no contact outside the latch. The latch must interfere at small angles and be clear by 35°.
- **Fuzzing:** fast-check, 60 runs per test by default. `FUZZ_RUNS=400 FUZZ_SEED=7 npm test` for a deeper run.
- **Mesh:** a final `simplify(1e-4)` removes sliver triangles, so trimesh also reports the STL watertight with exactly 2 bodies.
- **Slicer smoke test:** still open. The OrcaSlicer 2.3.1 CLI rejects flattened Creality profiles ("process not compatible with printer").
