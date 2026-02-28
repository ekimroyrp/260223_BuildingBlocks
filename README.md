# 260223_BuildingBlocks

260223_BuildingBlocks is a Three.js block-building sandbox for fast voxel layout with manual building, semi-automatic loop building, and full-automatic procedural layout/build workflows. The app runs on a fixed 15x15 build area with layered visual borders, animated placement/removal feedback, undo/redo history, rain atmosphere, and a draggable control panel designed for quick iteration.

## Features
- Fixed 15x15 build zone with custom ground shading, non-buildable border rings, and grid/edge overlays for clear spatial feedback.
- Instanced block rendering for better performance while preserving per-block colors, paint updates, and placement/removal animation.
- Manual Add Stack workflow for vertical or horizontal multi-block placement from a single action.
- Block Types panel with selectable type buttons and color swatches; new blocks and paint actions use the currently selected type.
- Animated add/remove/paint transitions with undo/redo history and reset behavior.
- Semi-Auto mode with ground painting, closed-loop detection, loop-following build, per-layer stack control, and automatic top-cap fill when a loop is finished.
- Full-Auto mode with Manhattan Voronoi-based orthogonal shape generation driven by Max Buildings + Location Seed, one-cell spacing constraints between generated shapes, and shape cleanup rules for exposed-edge artifacts.
- Full-Auto Start Build sequencing: each generated shape builds one-by-one, outline-first per layer, random per-shape stack height from Min/Max Stack using Stack Seed, then top-cap fill on completion.
- Real-time Full-Auto shape repaint updates while changing Max Buildings / Location Seed, with generated paint clearing when Full-Auto mode is exited.
- Occupancy-safe placement: no duplicate blocks can exist in the same grid cell (`x|y|z`) even when builds overlap.
- Export to OBJ with vertex color data so painted types are preserved in downstream tools.
- Draggable UI panel with controls for block size, gap, manual build settings, Semi-Auto settings, Full-Auto settings, and visibility toggles.
- Scene atmosphere effects including animated rain overlay with a dedicated Show Rain toggle.

## Getting Started
1. Clone the repository: `git clone https://github.com/ekimroyrp/260223_BuildingBlocks.git`
2. Navigate into the project: `cd 260223_BuildingBlocks`
3. Install dependencies: `npm install`
4. Start development server: `npm run dev`
5. Build production bundle: `npm run build`

## Controls
- Manual Mode
  - LMB: Add Block Vertical
  - Shift + LMB: Add Block Horizontal
  - Ctrl + LMB: Remove Block
  - Alt + LMB: Change Block Type
- Semi-Auto Mode
  - LMB: Paint ground cells
  - Ctrl + LMB: Erase ground cells
  - Closed painted loops auto-build using Semi-Auto Build Speed / Build Stack
- Full-Auto Mode
  - Max Buildings + Location Seed: Regenerate procedural painted shapes in real time
  - Start Build: Build all generated shapes sequentially using Full-Auto Build Speed and Min/Max Stack + Stack Seed
- Camera / Navigation
  - RMB: Orbit Scene
  - MMB: Pan Scene
  - Scroll: Zoom Scene
- Global
  - Ctrl + Z: Undo
  - Ctrl + Y: Redo
  - Escape: Exit Semi-Auto or Full-Auto mode

## Deployment
- **Local production preview:** `npm install`, then `npm run build -- --base=./` followed by `npm run preview` to inspect the compiled bundle with relative paths.
- **Publish to GitHub Pages:** From a clean `main`, run `npm run build -- --base=./`. Checkout (or create) the `gh-pages` branch in a separate worktree, copy everything inside `dist/` plus a `.nojekyll` marker to its root, commit with a descriptive message, `git push origin gh-pages`, then switch back to `main`.
- **Live demo:** https://ekimroyrp.github.io/260223_BuildingBlocks/
