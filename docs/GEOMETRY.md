# Geometry reference

## 1. Brick system dimensions

All values are in mm. Sources disagree in places, so the derivations below are what we rely on. They follow from the pitch and the stud diameter.

| Feature | Value | Source / derivation |
|---|---|---|
| Pitch P | 8.0 | Universal. Measured ≈ 7.985. |
| Stud Ø | 4.8 nominal | Measured 4.87–4.90 on real bricks. FDM fit varies, so it gets a fit-offset parameter. |
| Stud height | 1.7 | Sources range from 1.6 to 1.8 (LDraw: 1.6). Any value ≤ 1.8 still lets plates stack. |
| Plate height | 3.2 | LDraw: 8 LDU. |
| Brick height | 9.6 | 3 plates. |
| Part outer size | n·P − 0.2 | 0.1 play per side, so 2 studs = 15.8. |
| Underside wall | 1.5 | (P − 0.2 − Ø)/2 = (8 − 0.2 − 4.8)/2. The studs touch the inside of the wall. |
| Underside tube OD (≥2 studs wide) | 6.51 | P·√2 − Ø = 11.314 − 4.8. The tube touches 4 diagonal studs. One source says 6.31, which disagrees with this derivation. |
| Underside tube ID | 4.8 | Takes a stud. |
| Underside pin Ø (1 stud wide) | 3.2 | P − Ø. Fits between 2 studs. |
| Cavity depth | ≥ stud height + 0.2 | So studs seat fully. |

**FDM reality.** Prints make studs slightly fat and holes slightly small. Reported working stud diameters run from 4.6 to 5.0 mm depending on the printer, so a single generic default cannot be right for everyone. The plan:
- Nominal geometry plus a **fit-offset** parameter for studs and another for sockets.
- A **calibration test print** with a row of studs (−0.15 … +0.15) and a row of sockets, each labelled, and a solid and a hollow version of each.
- Hollow studs, which give a thin elastic wall, may clutch more evenly. The test print settles it.

## 2. FDM design rules

| Rule | Value | Note |
|---|---|---|
| Print-in-place radial clearance | 0.35 default (0.25–0.40) | Sources give 0.2–0.4 per side. Bowden printers need more than direct-drive. PETG needs more than PLA. |
| Gaps along build Z | multiple of the layer height, ≥ 2 layers | A gap smaller than one layer fuses. |
| Min wall | 2 × nozzle (0.8) | |
| Overhang | ≤ 45° from vertical | Otherwise a short bridge, a chamfer or a teardrop. |
| Bridge | ≤ 35 mm (warn) | In `flat` orientation the channel roofs are bridges. |
| Elephant foot | 0.4 × 45° chamfer on bed-contact edges | Plus a **first-layer relief**: widen gaps that reach the bed by 0.2. That is where print-in-place parts fuse first. |
| Snap lead-in | 20–30° chamfer | Fillet ≥ 0.5–1 mm at the root of anything that flexes. |
| Material | PETG or PLA+ recommended for snaps | Plain PLA is brittle and creeps when held flexed. Say this on the site. |

## 3. Print orientation

| | `flat` (default) | `side` (the original's) |
|---|---|---|
| Setup | Base bottom on the bed, clip closed, studs up | Hinge axis vertical, profile lying in XY |
| Studs | **Upright: best clutch** | Sideways: faceted and oval, weaker clutch |
| Bottom sockets | Open onto the bed with bridged roofs | Sideways |
| Hinge | Horizontal axis. Needs a **teardrop bore** (pointed top) against sag. Axial gaps are walls in XY. | **Vertical axis: best.** Gaps between knuckles are Z gaps, so use **45° cone** faces (BOSL2-style). |
| Snaps and latch | Profile lies in XZ, so the overhang rules apply to it. Bulbs become diamond or chamfered shapes. Z gaps are rounded to whole layers. | Profile lies in XY, so it is accurate everywhere |
| Channel roof | Bridge (≤ 35 mm) | Wall, no issue |
| Arm support | The arm's latch wall and knuckles must **reach the bed** so the arm is not floating | N/A |

**Strategy.** Build one profile that obeys both rule sets: 45° chamfers instead of undercut circles, and a latch whose wall reaches the bed. Then switch the hinge variant and the Z-gap rounding depending on the orientation.

## 4. Teardown of the original clip

Measured from STL cross-sections. All values are approximate.

- The clip is two bodies: a base (3.10 cm³) and an arm (3.61 cm³). Overall size is 60.9 × 17.25 × 15.7. It prints **closed, on its side**.
- **Width:** 15.7, which is about 2 studs (standard 15.8).
- **Base:** a plate about 3.0 thick with **2 dividers** about 2.0 thick. The divider tips are round bulbs (Ø ≈ 3) that snap into grooves in the arm. There is a hook at the far end.
- **Channels:** 2, each about 20 wide × 9 high.
- **Arm:** a plate about 3.0 thick with 2 × 8 studs (Ø ≈ 4.8, about 1.95 high, pitch 8). A catch lip at the end and a thumb tab overhang past the base.
- **Base bottom:** cross-pattern stud sockets.
- **Hinge:** barrel R ≈ 4.3, pin R ≈ 2.5, about 0.2–0.3 radial clearance. Knuckles alternate across the width.
- **Its print profile** (Bambu A1, PLA): 0.2 mm layers, 3 walls, 15% gyroid infill, elephant-foot compensation on.

What we change:
- Default to `flat` orientation so the studs fit real bricks.
- Clearances larger by default and adjustable.
- Every dimension is a parameter.
- Output already sits on the bed.
