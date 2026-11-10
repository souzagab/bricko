# Research log

Research done on 2026-11-10. The design decisions in PLAN.md cite this file.

## Existing generators

- Parametric cable clips exist on MakerWorld (pipe clips, rails, multi-cable clips, holders). **None combine** brick-compatible + print-in-place hinge + snap-shut channels.
- Open-source browser generators (Gridfinity tools, OwlCAD, Partwright, CADAM) mostly use **Manifold compiled to WebAssembly + three.js**. Some use OpenSCAD in WebAssembly or OpenCascade (brepjs) instead.
- MakerWorld's Parametric Model Maker runs OpenSCAD on Bambu's servers. We are not using it: the goal is a standalone website that works with any printer.

## Geometry engine (manifold-3d 3.5.4, Apache-2.0)

- Its typings include: `CrossSection.offset(delta, joinType, miterLimit, circularSegments)`, `extrude`, `revolve`, `hull`, `Manifold.cylinder`, `levelSet`, `splitByPlane`/`trimByPlane`, `decompose`, `genus`, `volume`, **`minGap`**, `status`, `getMesh`, `smoothOut`/`refine`.
- WASM objects must be freed by hand with `.delete()`, so we need a disposal helper.
- The package ships a worker bundle and runs in Node and in the browser.

## Toolchain versions (checked on npm, 2026-11-10)

manifold-3d 3.5.4 · three 0.187.0 · vite 8.3.7 · svelte 5.57.3 · @sveltejs/vite-plugin-svelte 7.3.1 (needs vite ^8) · svelte-check 4.7.8 (**needs typescript ^5 || ^6**, so we pin TypeScript 6.x even though 7.0.2 is the latest) · vitest 5.1.0 · zod 4.6.7 · fast-check 4.10.2 · fflate 0.8.3. All are MIT or Apache-2.0.

## Brick compatibility

- Pitch 8.0, stud 4.8 nominal (4.87–4.90 measured), plate 3.2, brick 9.6. Stud height is quoted anywhere from 1.6 to 1.8.
- FDM: one guide suggests −0.10 to −0.15 stud offset, another 4.6–4.7, while one user needed 5.0 for grip. **The right value depends on the printer, so we ship a calibration test print.**
- Orientation: sources agree studs should print **upright**. Printed on its side, a stud loses its round shape. (This is reasoning, not a measured test.)
- Hollow studs are more elastic, which is a design argument with no FDM test data. The calibration print will compare them.

## Print-in-place hinges

- Clearance guidance runs from 0.2 to 0.4 mm per side for PLA. Per-side and per-diameter values are often confused.
- A **vertical** pin axis gives the roundest holes with no sag. A **horizontal** axis needs a teardrop bore. Gaps along Z should be whole multiples of the layer height.
- BOSL2 `knuckle_hinge(in_place=true)` uses 45° interlocking cones instead of a separate pin. We borrow that idea for the `side` orientation.

## Snap fits

- Use a lead-in of 20–30° and fillets at the root of anything that flexes.
- Plain PLA is brittle and creeps when held flexed, so recommend PETG or PLA+ for clips.
- Published interference values vary. Expose them as parameters and tune with test prints.

## Trademark

- LEGO's Fair Play policy: don't put the trademark in domains or product names.
- A NZ court (Lego v Zuru) found that "LEGO BRICKS COMPATIBLE" on packaging infringed. Zuru switched to "compatible with major brands".
- So we use "brick-compatible" with a footer disclaimer, and never put LEGO in the name, domain or logo.

## Sources

- Brick dimensions: [brickfact](https://brickfact.com/blog/guidebooks/lego-brick-dimensions), [Orion Robots](https://orionrobots.co.uk/Lego+Specifications), [Eurobricks](https://www.eurobricks.com/forum/forums/topic/30835-dimensions-of-lego-elements/), [LDraw](https://en.wikipedia.org/wiki/LDraw), [affordablebricks](https://affordablebricks.us/blogs/blog-posts/compatible-brick-sizes)
- FDM brick fit: [Meshy tolerances](https://www.meshy.ai/blog/lego-compatible-3d-print-tolerances), [PrintPal](https://blog.printpal.io/design-and-3d-print-your-own-lego-compatible-bricks/), [Kapy CAD](https://kapycad.com/en/academy/standards/lego-system), [MakerWorld stud test](https://makerworld.com/en/models/1007391-leg0-brick-stud-size-test), [Brick Architect](https://brickarchitect.com/2023/enhancing-your-lego-hobby-with-3d-plastic-printing/), [LDraw forum](https://forums.ldraw.org/thread-28663-post-56493.html)
- Hinges: [Sovol](https://www.sovol3d.com/blogs/news/print-in-place-3d-printing-how-to-design-hinges-joints-and-moving-parts-that-actually-work), [hex-3d-gon](https://hex-3d-gon.pages.dev/lessons/tolerance-005), [Qidi](https://qidi3d.com/en-br/blogs/news/how-to-3d-print-interlocking-parts-and-assemblies), [Snapmaker](https://www.snapmaker.com/blog/3d-printed-hinges/), [Shapr3D forum](https://discourse.shapr3d.com/t/horizontally-printed-in-place-hinge-design/41433), [BOSL2 hinges](https://github.com/BelfrySCAD/BOSL2/wiki/hinges.scad)
- Snap fits: [Wevolver](https://www.wevolver.com/article/how-to-3d-print-snap-fit-joints), [Sovol snap-fit](https://www.sovol3d.com/blogs/news/3d-printed-snap-fit-joints-how-to-design-clips-that-work), [Core77](https://www.core77.com/posts/65318/How-to-Design-Snap-Fit-Components)
- Engine and web tools: [manifold](https://github.com/elalish/manifold), [ManifoldCAD docs](https://manifoldcad.org/docs/jsuser/), [manifold.d.ts 3.5.4](https://unpkg.com/manifold-3d@3.5.4/manifold.d.ts), [OwlCAD](https://peerlist.io/dmiller/project/owlcad), [Partwright](https://partwright.pages.dev/help), [CADAM](https://themenonlab.blog/blog/cadam-text-to-cad-browser-claude-webassembly), [Gridfinity Builder](https://www.mintlify.com/tunelko/gridfinity-BambuLab-3D), [gridfinity-layout-tool](https://awesome.ecosyste.ms/projects/github.com%2Fandymai%2Fgridfinity-layout-tool)
- Existing clips: [Ultimate Parametric Pipe & Cable Clip](https://makerworld.com/en/models/3063346-ultimate-parametric-pipe-cable-clip), [Parametric Cable Management Rail](https://makerworld.com/en/models/3228719-parametric-cable-management-rail-custom-sizes), [Parametric Cable Holder](https://makerworld.com/en/models/3035682-parametric-cable-holder)
- Trademark: [LEGO Fair Play](https://www.lego.com/en-us/legal/notices-and-policies/fair-play/), [3D Printing Industry](https://3dprintingindustry.com/news/lego-3d-printing-takedowns-a-lawyer-responds-and-lego-replies-163104/), [NZ Law Association](https://www.thelawassociation.nz/lego-blocks-kiwi-toymaker-from-using-its-trademark-in-advertising/)
