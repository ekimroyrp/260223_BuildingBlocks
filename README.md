# 260223_BuildingBlocks

260223_BuildingBlocks is a blueprint-styled Three.js sandbox for building, painting, undoing/redoing, and exporting voxel blocks on a fixed 15x15 grid. It ships with a draggable translucent UI, animated add/remove/paint workflows, history controls, instructions popover, OBJ export with vertex colors, sharpened shadows, and hover-animated controls.

## Features
- Fixed 15x15 build grid with tan cell fill, plus a 1-cell grey border, a lowered 3-cell dark-grey outer border (offset by 0.25x block size), and crisp white lines
- Draggable, blurred UI panel with sliders for block size, gap, add speed, and add stack
- Hover ghost preview plus animated add/remove/paint actions; undo/redo diffs snapshots and replays the same scale-up/scale-down transitions
- Reset button that smoothly shrinks all blocks out; Export button that saves an OBJ with per-vertex colors
- Block Types list with one-click paint type selection; instructions popover for quick control reference
- Toggles for edges and grid visibility
- Sharpened shadow filtering with taller-range sun setup for high stacks
- Orbit (RMB), pan (MMB), scroll zoom; UI buttons animated on hover

## Getting Started
1. Clone the repository: `git clone https://github.com/ekimroyrp/260223_BuildingBlocks.git`
2. Navigate into the project: `cd 260223_BuildingBlocks`
3. Install dependencies: `npm install`
4. Run the dev server: `npm run dev`
5. Build for production: `npm run build`

## Controls
- LMB + drag: add blocks on ground and on top/bottom faces only
- Shift + LMB + drag: add blocks on side faces only
- Add Stack slider: sets how many blocks each add action places in a stack
- Alt + LMB + drag: paint blocks to the current color
- New blocks are always added as white; Block Types only affect paint color
- Ctrl + LMB + drag: remove blocks under cursor
- RMB: orbit camera
- MMB: pan camera
- Scroll: zoom

## Deployment
- **Local production preview:** `npm install`, then `npm run build -- --base=./` followed by `npm run preview` to inspect the compiled bundle with relative paths.
- **Publish to GitHub Pages:** From a clean `main`, run `npm run build -- --base=./`. Checkout (or create) the `gh-pages` branch in a separate worktree, copy everything inside `dist/` plus a `.nojekyll` marker to its root, commit with a descriptive message, `git push origin gh-pages`, then switch back to `main`.
- **Live demo:** https://ekimroyrp.github.io/260223_BuildingBlocks/
