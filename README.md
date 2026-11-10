# Bricko

A browser tool for making **print-in-place, brick-compatible cable clips** to your own measurements. You set the sizes, see a live 3D preview and download an STL that prints on any FDM printer. It is a static site with no server, no account and no slicer lock-in.

> Status: **geometry engine working** (CLI + tests). No web UI yet. See [docs/PLAN.md § Status](docs/PLAN.md#status-2026-11-10).

## Quick start

```bash
npm install
npm test                                   # invariants, kinematics, fuzzing
node cli/gen.ts -o clip.stl                # default clip
node cli/gen.ts --preset usbc -o usbc.stl  # presets: default usbc power hdmi bundle slim mixed side
node cli/gen.ts --set channelCount=3 --set channelWidth=7 --set radialClearance=0.4 -o mine.stl
node cli/gen.ts --all-presets -o out/
```

Requires Node ≥ 23.6, which runs TypeScript directly.

| Doc | What's in it |
|---|---|
| [docs/PLAN.md](docs/PLAN.md) | Decisions, architecture, parameter set, validation rules, tests and milestones |
| [docs/GEOMETRY.md](docs/GEOMETRY.md) | Brick dimensions (with derivations), FDM design rules, print orientation and a teardown of the original clip |
| [docs/RESEARCH.md](docs/RESEARCH.md) | Research findings, with sources |

## License

[AGPL-3.0-only](LICENSE). If you host a modified version, you must publish its source.

## Notes

- "Brick-compatible" means it works with standard 8 mm-pitch construction bricks. LEGO® is a trademark of the LEGO Group, which does not sponsor, authorize or endorse this project.
- The idea came from a community "Cable Organizer Clip (Brick ver)" model. All geometry here is written from scratch.
