# 260223_BuildingBlocks

260223_BuildingBlocks is a Three.js block-building sandbox focused on fast voxel layout, block type painting, and clean export. The app runs on a fixed 15x15 build area with layered visual borders, animated placement/removal feedback, undo/redo history, and a draggable control panel designed for quick iteration.

## Features
- Fixed 15x15 build zone with custom ground shading, non-buildable border rings, and grid/edge overlays for clear spatial feedback.
- Instanced block rendering for better performance while preserving per-block colors, paint updates, and placement/removal animation.
- Add Stack workflow for vertical or horizontal multi-block placement from a single action.
- Block Types panel with selectable type buttons and color swatches; new blocks and paint actions use the currently selected type.
- Animated add/remove/paint transitions with undo/redo history and reset behavior.
- Export to OBJ with vertex color data so painted types are preserved in downstream tools.
- Draggable UI panel with controls for block size, gap, add speed, add stack, and visibility toggles.
- Scene atmosphere effects including animated rain overlay with a dedicated Show Rain toggle.

## Getting Started
1. Clone the repository: `git clone https://github.com/ekimroyrp/260223_BuildingBlocks.git`
2. Navigate into the project: `cd 260223_BuildingBlocks`
3. Install dependencies: `npm install`
4. Start development server: `npm run dev`
5. Build production bundle: `npm run build`

## Controls
- LMB: Add Block Vertical
- Shift + LMB: Add Block Horizontal
- Ctrl + LMB: Remove Block
- Alt + LMB: Change Block Type
- RMB: Orbit Scene
- MMB: Pan Scene
- Scroll: Zoom Scene

## Deployment
- **Local production preview:** `npm install`, then `npm run build -- --base=./` followed by `npm run preview` to inspect the compiled bundle with relative paths.
- **Publish to GitHub Pages:** From a clean `main`, run `npm run build -- --base=./`. Checkout (or create) the `gh-pages` branch in a separate worktree, copy everything inside `dist/` plus a `.nojekyll` marker to its root, commit with a descriptive message, `git push origin gh-pages`, then switch back to `main`.
- **Live demo:** https://ekimroyrp.github.io/260223_BuildingBlocks/
