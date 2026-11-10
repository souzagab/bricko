# Teardown of the original "Cable Organizer Clip (Brick ver)"

These are measurements taken from the original STL/3MF on 2026-11-10 (MakerWorld designer id 5962389; the license field is empty). We are reverse engineering the **mechanism and the numbers**. Bricko geometry is written from scratch, and no mesh data from the original is stored in this repo. The analysis scripts are in `tools/teardown/`. Rendered sections are kept locally in `reference/` (gitignored).

## Frame used below

- **X:** along the clip. X = 0 is the **hinge axis**.
- **Y:** thickness. Y = 0 is the base's brick-socket face, and Y = 7.688 is the hinge axis.
- **Z:** width, centred on 0, running −7.85 … +7.85.
- **Printing:** the original prints **on its side**. Z is the vertical print axis, so the whole profile lies in the printer's XY plane, the hinge axis is vertical, and the studs point sideways.

## Files and print setup

- The 3MF and STL hold the same mesh: 14,686 triangles, one part, no modifiers.
- Two bodies: **base** (3.10 cm³) and **arm** (3.61 cm³).
- Overall size: X −4.31 … 56.60 (60.9 long), Y 0 … 17.25, Z 15.70 wide.
- **Profile:** Bambu A1 with 0.4 nozzle, PLA Matte, 0.20 mm layers (0.2 first layer), 3 walls, 15% gyroid infill, 5 top and 3 bottom layers, no supports, auto brim.
- **Custom overrides:**
  - Elephant-foot compensation 0.2.
  - **Bridge flow 1.5 at 10 mm/s.** Fat, slow bridges for the many short overhangs a side print creates.
  - Gyroid infill.
  - 3 walls.

## Overall layout

| Item | Value |
|---|---|
| Width | 15.70 = 2 × 8 − **0.30** (0.15 play per side, not LEGO's 0.1) |
| Base plate length | X 0.90 … 56.60 = 55.70 = 7 × 8 − 0.30 |
| Brick grid along X | stud/pocket centres at **X = 4.75 + 8k**, k = 0…6 (7 positions); Z = ±4 |
| Base plate | Y 0 … 3.05 |
| Channel floor fillets | r ≈ 1.85 at every wall root |
| Arm plate | Y 12.20 … 15.25 (3.05 thick) |
| Studs | Y 15.25 … 17.25 (**2.0 tall**) |

## Hinge

The axis sits at (X 0, Y 7.688). It is a **three-knuckle hinge: the base owns the middle knuckle and the arm owns both outer knuckles**.

**Base:**
- The middle knuckle has r = 4.314 for |Z| ≤ 2.35.
- A **45° cone** narrows it to r = 3.236 at |Z| = 3.35.
- A small step then drops to the **pin**, r = 2.538, which runs out to both faces (|Z| = 7.85).
- So the pin goes through both arm knuckles.

**Arm:**
- The outer knuckles have **outer r = 4.436** and **bore r = 2.798** for |Z| ≥ 3.9.
- Their inner ends have a conical socket parallel to the base cone, about 0.15–0.2 off it.

**Clearances:**
- Pin to bore: **0.26 radial**.
- Cone faces: about 0.15–0.2.
- Axial step: **0.15**. This is the smallest gap in the whole model, and it is less than one layer.

**How it fits around the plates:**
- Base knuckle to base plate: there is a fillet neck at the lower right (fillet r 2.23 and 1.09). The barrel bottom sits at Y 3.37, and the plate starts at X 0.90.
- In the middle zone (the base knuckle), **the arm's underside near the hinge is an arc of r = 4.662 about the axis**, 0.35 outside the barrel. So the arm can swing around it.

**Opening:** the arm swings **0 → 170° with no contact** anywhere outside the latch.

## Dividers ("mushroom" keys, NOT snaps)

- **Stem:** 2.03 wide, centred on a **stud mid-point** (X 24.75 = between studs 20.75 and 28.75).
- **Ball:** Ø ≈ 2.96, centred at Y 9.72.
- **Neck and dome:** a neck of ≈ 2.04 wide at Y ≈ 10.9, then a dome cap r ≈ 1.0 up to Y 12.09.
- **Arm side:** the arm has a groove over the dome, with two pointed lips that reach down to Y 10.78. That is above the ball's widest point, so there is **no undercut**. Clearance is about 0.2.

**The opening simulation shows zero contact at the divider.** It only aligns the arm. The ball also narrows each channel mouth a little, which helps keep cables in while the clip is open.

## Latch (the only thing holding the clip shut)

The last wall is a **hook post**.

**Hook post (base):**
- **Body:** X 45.20 … 47.37 (2.17 thick). It has a half-ball on the channel side and a dome top like a divider.
- **Head:** it overhangs to X 49.15. Its **underside is a flat ledge at Y 8.50**, about 1.8 mm of overhang.
- **Ramp:** the top-right is a **45° ramp** from (47.16, 11.45) down to (49.07, 9.53).

**Tongue (arm):**
- A **J-shaped tongue** hangs from the arm at X 49.5 … 51.6 (2.1 thick), from Y 12.2 down to a **U bottom at Y 5.45**. It is a cantilever about 6.8 long.
- **Finger:** pointing left at Y ≈ 8.15–8.25, tip at X 48.25. It sits under the ledge with a 0.25–0.35 gap and **about 0.8 mm of horizontal overlap**.
- **Faces:** the faces that hold are flat and horizontal, so it **locks hard**. The finger's underside is a slope that rides the 45° ramp when closing.

**Opening:** the simulation shows 1.3 mm³ of overlap at 0.5°, 13.3 mm³ at 2° and 6.1 mm³ at 3°, and clear by 4–5°. **The tongue must flex outward by about 0.8 mm.**

**Thumb tab:** the arm top continues to X 56.6, a 5 mm tab with a slanted underside from (51.7, 13.0) to (56.6, 14.3). The base plate continues underneath it to X 56.6.

## Studs (arm top, built for side printing)

- **Layout:** 7 × 2 studs at X 4.75 + 8k, Z ±4. They are **2.0 tall**.
- **Flared:** Ø ≈ 4.56 at the root, Ø ≈ 4.99 near the tip (Y 17.0), then a top chamfer to about 4.8 at Y 17.25. A wedge fit that makes up for side-printed layer lines.
- **Underside cut:** the side that faces down when printing is cut by an **inclined flat**, rising from 2.25 below the centre at the root to 1.52 below at the tip. It's a teardrop-style cut so the sideways cylinder prints without support.

## Bottom (brick sockets)

- **Pockets:** 7 × 2, **2.30 deep** (Y 0 … 2.30). That leaves 0.75 of skin under the channel floor.
- **Pocket size:** X 5.457 long, at [2.301, 7.758], [9.744, 15.201], [18.301, 23.758], … and Z [−6.45, −0.943] / [+0.943, +6.55].
- **Outer wall:** 1.40 / 1.30 thick. It is asymmetric by 0.1, probably to suit the print direction.
- **Centre spine:** along X, 1.886 wide.
- **Between stud pairs along X, alternating:**
  - a **tube** at X 8.75 + 16k (OD ≈ 6.51, LEGO geometry: 8√2 − 4.8)
  - a **3.1 wide rib** at X 16.75 + 16k
- **Grip:** each stud touches the outer wall (about 0.05 gap), a rib or pocket end (about 0.05 / −0.05), and a tube. That's a 3-point grip.
- **Rounding:** pocket outer corners are rounded r ≈ 1.

## Clearance map (smallest arm-to-base gaps)

| Zone | Min | Typical |
|---|---|---|
| Hinge (axial step) | 0.150 | 0.17 |
| Hinge radial (pin/bore) | 0.26 | |
| Arm arc ↔ barrel | 0.35 | |
| Divider groove | 0.200 | 0.22 |
| Latch (dome/groove) | 0.150 | 0.19 |

These are tight, tuned for a Bambu printer. A generic default should be about 0.25–0.30, adjustable.

## Bricko (first build) compared with the original

| Feature | Original | Bricko (first build) |
|---|---|---|
| Print orientation | side (hinge vertical) | flat (default) and side |
| Hinge | base middle knuckle, cones and full-width pin, arm outer knuckles | arm middle knuckle, cone pins only |
| Arm near hinge | arc r 4.662 around the barrel; opens to 170° | web hull; opens to about 145° |
| Dividers | mushroom key (no lock) | fork snap (locks) or 45° key |
| Latch | hook post, horizontal ledge, J-tongue, 0.8 overlap | arc wall, 0.8 catch at 30° |
| Studs | flared 4.56 → 4.99, 2.0 tall, inclined underside cut | straight 4.8, 1.7 tall |
| Bottom | pockets plus alternating tubes/ribs, centre spine, 2.3 deep | open cavity with tubes, 1.9 deep |
| Play | n·8 − 0.3 | n·8 − 0.2 |
| Clearances | 0.15–0.27 | 0.35–0.4 |
