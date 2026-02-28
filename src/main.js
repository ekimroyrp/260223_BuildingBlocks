import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import './style.css';

const container = document.getElementById('app');
const rainOverlay = document.getElementById('rain-overlay');
const blueprintColor = new THREE.Color('#000000');

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.domElement.style.touchAction = 'none';
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.35;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
container.appendChild(renderer.domElement);

const rainDrops = [];
const rainViewport = {
  width: window.innerWidth,
  height: window.innerHeight
};
const rainAngleDeg = -10;
const rainAngleRad = (Math.abs(rainAngleDeg) * Math.PI) / 180;
const rainAngleSign = Math.sign(rainAngleDeg) || -1;
let rainVisible = true;

function randomInRange(min, max) {
  return min + Math.random() * (max - min);
}

function getRainDropTargetCount() {
  const area = rainViewport.width * rainViewport.height;
  return Math.max(90, Math.min(260, Math.round(area / 9000)));
}

function resetRainDrop(drop, randomY = false) {
  const spawnPadX = rainViewport.width * 0.25;
  const spawnPadY = rainViewport.height * 0.35;
  drop.x = randomInRange(-spawnPadX, rainViewport.width + spawnPadX);
  drop.y = randomY ? randomInRange(-spawnPadY, rainViewport.height + spawnPadY) : randomInRange(-spawnPadY, -12);
  const fallSpeed = randomInRange(500, 940);
  drop.speedY = fallSpeed;
  drop.speedX = Math.tan(rainAngleRad) * fallSpeed * rainAngleSign;
  drop.angleDeg = (-Math.atan2(drop.speedX, drop.speedY) * 180) / Math.PI;
  drop.length = randomInRange(30, 100);
  drop.width = randomInRange(0.8, 1.45);
  drop.opacity = randomInRange(0.18, 0.78);
  drop.flickerSpeed = randomInRange(3.2, 8.6);
  drop.flickerPhase = randomInRange(0, Math.PI * 2);
  drop.el.style.setProperty('--rain-length', `${drop.length.toFixed(1)}px`);
  drop.el.style.setProperty('--rain-width', `${drop.width.toFixed(2)}px`);
}

function syncRainDrops() {
  if (!rainOverlay) return;
  const targetCount = getRainDropTargetCount();
  while (rainDrops.length < targetCount) {
    const el = document.createElement('span');
    el.className = 'rain-drop';
    rainOverlay.appendChild(el);
    const drop = {
      el,
      x: 0,
      y: 0,
      speedX: 0,
      speedY: 0,
      angleDeg: 0,
      length: 0,
      width: 0,
      opacity: 0,
      flickerSpeed: 0,
      flickerPhase: 0
    };
    resetRainDrop(drop, true);
    rainDrops.push(drop);
  }
  while (rainDrops.length > targetCount) {
    const drop = rainDrops.pop();
    if (drop && drop.el && drop.el.parentElement === rainOverlay) {
      rainOverlay.removeChild(drop.el);
    }
  }
}

function updateRainOverlay(delta, elapsedTime) {
  if (!rainVisible || !rainOverlay || rainDrops.length === 0) return;
  const maxY = rainViewport.height + 120;
  const minX = -220;
  rainDrops.forEach((drop) => {
    drop.x += drop.speedX * delta;
    drop.y += drop.speedY * delta;
    if (drop.y > maxY || drop.x < minX) {
      resetRainDrop(drop);
    }
    const flicker = 0.82 + Math.sin(elapsedTime * drop.flickerSpeed + drop.flickerPhase) * 0.18;
    drop.el.style.opacity = `${Math.max(0.08, Math.min(1, drop.opacity * flicker)).toFixed(3)}`;
    drop.el.style.left = `${drop.x.toFixed(2)}px`;
    drop.el.style.top = `${drop.y.toFixed(2)}px`;
    drop.el.style.transform = `rotate(${drop.angleDeg.toFixed(2)}deg)`;
  });
}

function resizeRainOverlay() {
  rainViewport.width = window.innerWidth;
  rainViewport.height = window.innerHeight;
  syncRainDrops();
}

syncRainDrops();

// Scene setup
const scene = new THREE.Scene();
scene.background = blueprintColor;
scene.fog = new THREE.Fog(blueprintColor, 20, 140);

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  500
);
camera.position.set(12, 10, 12);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = true;
controls.enableRotate = true;
controls.enableZoom = true;
controls.mouseButtons.LEFT = null;
controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
controls.mouseButtons.MIDDLE = THREE.MOUSE.PAN;
controls.target.set(0, 0.5, 0);
controls.update();

// Lights
const hemiLight = new THREE.HemisphereLight('#cfe8ff', '#0f1f33', 1.2);
scene.add(hemiLight);
const dirLight = new THREE.DirectionalLight('#ffc78a', 1.8);
dirLight.position.set(39, 140, 94); // ~22.5 deg azimuth relative to +Z
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(4096, 4096);
dirLight.shadow.bias = -0.0005;
dirLight.shadow.normalBias = 0.0025;
scene.add(dirLight);
const ambient = new THREE.AmbientLight(0xffffff, 0.14);
scene.add(ambient);

// Shadow receiver plane
const shadowPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(4000, 4000),
  new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.22 })
);
shadowPlane.rotation.x = -Math.PI / 2;
shadowPlane.position.y = -0.05;
shadowPlane.receiveShadow = true;
shadowPlane.material.depthWrite = false;
scene.add(shadowPlane);

// Finite build grid (15x15) with visual borders and separate invisible raycast plane
const gridCellCount = 15;
const gridInnerBorderCellCount = 1;
const gridOuterBorderCellCount = 3;
const gridVisualCellCount =
  gridCellCount + (gridInnerBorderCellCount + gridOuterBorderCellCount) * 2;
const gridMinIndex = -Math.floor(gridCellCount / 2);
const gridMaxIndex = gridMinIndex + gridCellCount - 1;
const gridFillColor = new THREE.Color('#6e6e6e');
const gridInnerBorderColor = new THREE.Color('#8d8d8d');
const gridOuterBorderColor = new THREE.Color('#4f4f4f');
const semiAutoGroundPaintColor = new THREE.Color('#ff8f1f');
let gridSize = 1.0;
let gridLines = null;
let gridFillMesh = null;
let groundCellGroup = null;
let gridBorderGroup = null;
let gridMesh = null;
const groundCellStates = new Map();
const groundNeighborOffsets = [
  { x: 1, z: 0 },
  { x: -1, z: 0 },
  { x: 0, z: 1 },
  { x: 0, z: -1 }
];
const semiAutoBuildState = {
  active: false,
  signature: '',
  completedSignatures: new Set(),
  completedLoopKeys: new Map(),
  path: [],
  pathIndex: 0,
  layerIndex: 0,
  lastStepTime: null,
  changedBlocks: false
};

function groundCellKey(index) {
  return `${index.x}|${index.z}`;
}

function parseGroundCellKey(key) {
  const [xRaw, zRaw] = key.split('|');
  return {
    x: Number(xRaw),
    z: Number(zRaw)
  };
}

function groundCellSort(a, b) {
  if (a.z !== b.z) return a.z - b.z;
  return a.x - b.x;
}

function getGroundNeighborKeys(key, membershipSet) {
  const { x, z } = parseGroundCellKey(key);
  const neighbors = [];
  for (let i = 0; i < groundNeighborOffsets.length; i += 1) {
    const offset = groundNeighborOffsets[i];
    const nextKey = `${x + offset.x}|${z + offset.z}`;
    if (membershipSet.has(nextKey)) {
      neighbors.push(nextKey);
    }
  }
  return neighbors;
}

function traceClosedGroundLoop(startKey, firstNeighborKey, componentSet, expectedLength) {
  if (!startKey || !firstNeighborKey || !componentSet.has(startKey) || !componentSet.has(firstNeighborKey)) {
    return null;
  }
  const path = [startKey];
  let prev = startKey;
  let current = firstNeighborKey;

  while (path.length <= expectedLength) {
    if (current === startKey) {
      break;
    }
    path.push(current);
    const neighbors = getGroundNeighborKeys(current, componentSet);
    if (neighbors.length !== 2) {
      return null;
    }
    const next = neighbors[0] === prev ? neighbors[1] : neighbors[0];
    if (!next) {
      return null;
    }
    prev = current;
    current = next;
  }

  if (current !== startKey) {
    return null;
  }
  if (path.length !== expectedLength) {
    return null;
  }
  return path;
}

function findClosedGroundLoop(excludedSignatures = null) {
  const paintedKeys = [];
  groundCellStates.forEach((cellState, key) => {
    if (cellState && cellState.painted) {
      paintedKeys.push(key);
    }
  });
  if (paintedKeys.length < 4) {
    return null;
  }
  const paintedSet = new Set(paintedKeys);
  const visited = new Set();
  let bestLoop = null;

  for (let i = 0; i < paintedKeys.length; i += 1) {
    const rootKey = paintedKeys[i];
    if (visited.has(rootKey)) continue;

    const queue = [rootKey];
    visited.add(rootKey);
    const component = [];
    const componentSet = new Set();

    while (queue.length > 0) {
      const current = queue.shift();
      component.push(current);
      componentSet.add(current);
      const neighbors = getGroundNeighborKeys(current, paintedSet);
      for (let n = 0; n < neighbors.length; n += 1) {
        const next = neighbors[n];
        if (visited.has(next)) continue;
        visited.add(next);
        queue.push(next);
      }
    }

    if (component.length < 4) continue;

    let isCycle = true;
    for (let c = 0; c < component.length; c += 1) {
      const degree = getGroundNeighborKeys(component[c], componentSet).length;
      if (degree !== 2) {
        isCycle = false;
        break;
      }
    }
    if (!isCycle) continue;

    const sortedComponent = component
      .map((key) => parseGroundCellKey(key))
      .sort(groundCellSort)
      .map((index) => groundCellKey(index));
    const startKey = sortedComponent[0];
    const startNeighbors = getGroundNeighborKeys(startKey, componentSet).sort();
    if (startNeighbors.length !== 2) continue;

    let pathKeys = traceClosedGroundLoop(startKey, startNeighbors[0], componentSet, component.length);
    if (!pathKeys) {
      pathKeys = traceClosedGroundLoop(startKey, startNeighbors[1], componentSet, component.length);
    }
    if (!pathKeys) continue;

    const signature = sortedComponent.join(',');
    if (excludedSignatures && excludedSignatures.has(signature)) {
      continue;
    }
    const path = pathKeys.map((key) => parseGroundCellKey(key));
    if (!bestLoop || path.length > bestLoop.path.length) {
      bestLoop = { signature, path };
    }
  }

  return bestLoop;
}

function clearCompletedSemiAutoLoops() {
  semiAutoBuildState.completedSignatures.clear();
  semiAutoBuildState.completedLoopKeys.clear();
}

function registerCompletedSemiAutoLoop(signature, path) {
  if (!signature || !Array.isArray(path) || path.length === 0) return;
  semiAutoBuildState.completedSignatures.add(signature);
  const keySet = new Set(path.map((index) => groundCellKey(index)));
  semiAutoBuildState.completedLoopKeys.set(signature, keySet);
}

function invalidateCompletedLoopsForCell(cellKey) {
  if (!cellKey) return;
  const signaturesToRemove = [];
  semiAutoBuildState.completedLoopKeys.forEach((keySet, signature) => {
    if (keySet.has(cellKey)) {
      signaturesToRemove.push(signature);
    }
  });
  for (let i = 0; i < signaturesToRemove.length; i += 1) {
    const signature = signaturesToRemove[i];
    semiAutoBuildState.completedLoopKeys.delete(signature);
    semiAutoBuildState.completedSignatures.delete(signature);
  }
}

function stopSemiAutomaticBuild(options = {}) {
  const { clearCompleted = false } = options;
  if (semiAutoBuildState.changedBlocks) {
    pushHistoryState(snapshotState(), true);
  }
  semiAutoBuildState.active = false;
  semiAutoBuildState.signature = '';
  semiAutoBuildState.path = [];
  semiAutoBuildState.pathIndex = 0;
  semiAutoBuildState.layerIndex = 0;
  semiAutoBuildState.lastStepTime = null;
  semiAutoBuildState.changedBlocks = false;
  if (clearCompleted) {
    clearCompletedSemiAutoLoops();
  }
}

function startSemiAutomaticBuild(loop) {
  if (!loop || !Array.isArray(loop.path) || loop.path.length < 4) return;
  semiAutoBuildState.active = true;
  semiAutoBuildState.signature = loop.signature;
  semiAutoBuildState.path = loop.path.map((index) => ({ x: index.x, z: index.z }));
  semiAutoBuildState.pathIndex = 0;
  semiAutoBuildState.layerIndex = 0;
  semiAutoBuildState.lastStepTime = null;
  semiAutoBuildState.changedBlocks = false;
  pointerState.down = false;
  pointerState.mode = null;
  hoverDirty = true;
}

function refreshSemiAutomaticBuildPlan(changedCellKey = '') {
  if (!semiAutomaticMode) {
    stopSemiAutomaticBuild({ clearCompleted: true });
    return;
  }
  if (changedCellKey) {
    invalidateCompletedLoopsForCell(changedCellKey);
  }
  const closedLoop = findClosedGroundLoop(semiAutoBuildState.completedSignatures);
  if (!closedLoop) {
    stopSemiAutomaticBuild();
    return;
  }

  if (semiAutoBuildState.active) {
    if (semiAutoBuildState.signature === closedLoop.signature) {
      return;
    }
    stopSemiAutomaticBuild();
  }
  startSemiAutomaticBuild(closedLoop);
}

function setGroundCellPaintState(cellState, painted) {
  if (!cellState) return false;
  const nextPainted = Boolean(painted);
  const changed = Boolean(cellState.painted) !== nextPainted;
  cellState.painted = nextPainted;
  const targetColor = nextPainted ? semiAutoGroundPaintColor : gridFillColor;
  const activeTarget = cellState.colorAnim ? cellState.colorAnim.to : cellState.color;
  if (!activeTarget.equals(targetColor)) {
    scheduleGroundCellColorLerp(cellState, targetColor);
  }
  return changed;
}

function createSeededRng(seed) {
  let state = (Math.floor(seed) >>> 0) || 1;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function getGridCellList() {
  const cells = [];
  for (let x = gridMinIndex; x <= gridMaxIndex; x += 1) {
    for (let z = gridMinIndex; z <= gridMaxIndex; z += 1) {
      cells.push({ x, z, key: groundCellKey({ x, z }) });
    }
  }
  return cells;
}

function pickFullAutoSeeds(seedCount, rng) {
  const cells = getGridCellList();
  for (let i = cells.length - 1; i > 0; i -= 1) {
    const swapIndex = Math.floor(rng() * (i + 1));
    const tmp = cells[i];
    cells[i] = cells[swapIndex];
    cells[swapIndex] = tmp;
  }
  const clampedCount = Math.max(1, Math.min(seedCount, cells.length));
  const seeds = [];
  for (let i = 0; i < clampedCount; i += 1) {
    const cell = cells[i];
    seeds.push({ id: i, x: cell.x, z: cell.z, key: cell.key });
  }
  return seeds;
}

function assignManhattanVoronoiRegions(seeds) {
  const regions = new Map();
  for (let i = 0; i < seeds.length; i += 1) {
    regions.set(seeds[i].id, new Set());
  }
  const cells = getGridCellList();
  for (let i = 0; i < cells.length; i += 1) {
    const cell = cells[i];
    let bestSeed = null;
    let bestDistance = Infinity;
    for (let s = 0; s < seeds.length; s += 1) {
      const seed = seeds[s];
      const distance = Math.abs(cell.x - seed.x) + Math.abs(cell.z - seed.z);
      if (!bestSeed || distance < bestDistance || (distance === bestDistance && seed.id < bestSeed.id)) {
        bestSeed = seed;
        bestDistance = distance;
      }
    }
    if (bestSeed) {
      regions.get(bestSeed.id).add(cell.key);
    }
  }
  return regions;
}

function erodeCellRegion(regionSet) {
  const eroded = new Set();
  regionSet.forEach((key) => {
    const { x, z } = parseGroundCellKey(key);
    let isInterior = true;
    for (let i = 0; i < groundNeighborOffsets.length; i += 1) {
      const offset = groundNeighborOffsets[i];
      const neighborKey = `${x + offset.x}|${z + offset.z}`;
      if (!regionSet.has(neighborKey)) {
        isInterior = false;
        break;
      }
    }
    if (isInterior) {
      eroded.add(key);
    }
  });
  return eroded;
}

function getLargestCellComponent(cellSet) {
  if (!cellSet || cellSet.size === 0) return new Set();
  const visited = new Set();
  let largest = new Set();
  cellSet.forEach((startKey) => {
    if (visited.has(startKey)) return;
    const queue = [startKey];
    visited.add(startKey);
    const component = new Set();
    while (queue.length > 0) {
      const key = queue.shift();
      component.add(key);
      const neighbors = getGroundNeighborKeys(key, cellSet);
      for (let i = 0; i < neighbors.length; i += 1) {
        const next = neighbors[i];
        if (visited.has(next)) continue;
        visited.add(next);
        queue.push(next);
      }
    }
    if (component.size > largest.size) {
      largest = component;
    }
  });
  return largest;
}

function getBoundaryCellsFromRegion(regionSet) {
  const boundary = new Set();
  regionSet.forEach((key) => {
    const { x, z } = parseGroundCellKey(key);
    let isBoundary = false;
    for (let i = 0; i < groundNeighborOffsets.length; i += 1) {
      const offset = groundNeighborOffsets[i];
      const neighborKey = `${x + offset.x}|${z + offset.z}`;
      if (!regionSet.has(neighborKey)) {
        isBoundary = true;
        break;
      }
    }
    if (isBoundary) {
      boundary.add(key);
    }
  });
  return boundary;
}

function isClosedOrthogonalLoop(cellSet) {
  if (!cellSet || cellSet.size < 4) return false;
  const firstEntry = cellSet.values().next();
  if (firstEntry.done) return false;
  const start = firstEntry.value;
  const queue = [start];
  const visited = new Set([start]);
  while (queue.length > 0) {
    const key = queue.shift();
    const neighbors = getGroundNeighborKeys(key, cellSet);
    if (neighbors.length !== 2) {
      return false;
    }
    for (let i = 0; i < neighbors.length; i += 1) {
      const next = neighbors[i];
      if (visited.has(next)) continue;
      visited.add(next);
      queue.push(next);
    }
  }
  return visited.size === cellSet.size;
}

function addCellAndNeighborsToBlockedSet(key, blockedSet) {
  blockedSet.add(key);
  const { x, z } = parseGroundCellKey(key);
  for (let i = 0; i < groundNeighborOffsets.length; i += 1) {
    const offset = groundNeighborOffsets[i];
    const nx = x + offset.x;
    const nz = z + offset.z;
    if (nx < gridMinIndex || nx > gridMaxIndex || nz < gridMinIndex || nz > gridMaxIndex) {
      continue;
    }
    blockedSet.add(`${nx}|${nz}`);
  }
}

function getConnectedCellComponents(cellSet) {
  const components = [];
  if (!cellSet || cellSet.size === 0) {
    return components;
  }
  const visited = new Set();
  cellSet.forEach((startKey) => {
    if (visited.has(startKey)) return;
    const queue = [startKey];
    visited.add(startKey);
    const component = new Set();
    while (queue.length > 0) {
      const key = queue.shift();
      component.add(key);
      const neighbors = getGroundNeighborKeys(key, cellSet);
      for (let i = 0; i < neighbors.length; i += 1) {
        const next = neighbors[i];
        if (visited.has(next)) continue;
        visited.add(next);
        queue.push(next);
      }
    }
    components.push(component);
  });
  return components;
}

function countExposedCellEdges(key, cellSet) {
  const { x, z } = parseGroundCellKey(key);
  let exposed = 0;
  for (let i = 0; i < groundNeighborOffsets.length; i += 1) {
    const offset = groundNeighborOffsets[i];
    const neighborKey = `${x + offset.x}|${z + offset.z}`;
    if (!cellSet.has(neighborKey)) {
      exposed += 1;
    }
  }
  return exposed;
}

function pruneCellsWithThreeExposedEdges(cellSet) {
  let working = new Set(cellSet);
  let changed = true;
  while (changed) {
    changed = false;
    const removeKeys = [];
    working.forEach((key) => {
      if (countExposedCellEdges(key, working) >= 3) {
        removeKeys.push(key);
      }
    });
    if (removeKeys.length > 0) {
      changed = true;
      for (let i = 0; i < removeKeys.length; i += 1) {
        working.delete(removeKeys[i]);
      }
    }
  }
  return working;
}

function getRegionOutlineCandidates(regionSet) {
  const candidates = [];
  if (!regionSet || regionSet.size < 9) {
    return candidates;
  }
  const eroded = erodeCellRegion(regionSet);
  if (!eroded || eroded.size < 8) {
    return candidates;
  }
  const components = getConnectedCellComponents(eroded);
  for (let i = 0; i < components.length; i += 1) {
    const component = components[i];
    if (component.size < 8) continue;
    const pruned = pruneCellsWithThreeExposedEdges(component);
    if (!pruned || pruned.size < 8) continue;
    const prunedComponents = getConnectedCellComponents(pruned);
    for (let p = 0; p < prunedComponents.length; p += 1) {
      const prunedComponent = prunedComponents[p];
      if (!prunedComponent || prunedComponent.size < 8) continue;
      const outline = getBoundaryCellsFromRegion(prunedComponent);
      if (!outline || outline.size < 8) continue;
      candidates.push({ outline, cells: prunedComponent });
    }
  }
  candidates.sort((a, b) => b.cells.size - a.cells.size);
  return candidates;
}

function canAcceptShapeWithGap(shapeCells, blockedSet) {
  if (!shapeCells || shapeCells.size < 8) return false;
  const iter = shapeCells.values();
  for (let next = iter.next(); !next.done; next = iter.next()) {
    if (blockedSet.has(next.value)) {
      return false;
    }
  }
  return true;
}

function buildFullAutoOutlinePattern() {
  const seedCount = Math.max(1, Math.min(6, Math.round(fullOutlineCount)));
  const rng = createSeededRng(Math.max(1, Math.round(fullOutlineSeed)));
  const seeds = pickFullAutoSeeds(seedCount, rng);
  if (seeds.length === 0) return new Set();

  const regions = assignManhattanVoronoiRegions(seeds);
  const entries = seeds.map((seed) => ({ seed, region: regions.get(seed.id) || new Set() }));
  entries.sort((a, b) => a.seed.id - b.seed.id);

  const acceptedPaintKeys = new Set();
  const blockedKeys = new Set();

  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    const candidateOutlines = getRegionOutlineCandidates(entry.region);
    if (candidateOutlines.length === 0) continue;
    let selected = null;
    for (let c = 0; c < candidateOutlines.length; c += 1) {
      const candidate = candidateOutlines[c];
      if (!canAcceptShapeWithGap(candidate.cells, blockedKeys)) continue;
      selected = candidate;
      break;
    }
    if (!selected) continue;
    selected.cells.forEach((key) => {
      acceptedPaintKeys.add(key);
      addCellAndNeighborsToBlockedSet(key, blockedKeys);
    });
  }

  return acceptedPaintKeys;
}

function applyGroundPaintPattern(paintedKeys) {
  const paintedSet = paintedKeys instanceof Set ? paintedKeys : new Set();
  groundCellStates.forEach((cellState, key) => {
    setGroundCellPaintState(cellState, paintedSet.has(key));
  });
}

function runFullAutoGeneration() {
  if (!fullAutomaticMode) return;
  const outlineKeys = buildFullAutoOutlinePattern();
  stopSemiAutomaticBuild({ clearCompleted: true });
  applyGroundPaintPattern(outlineKeys);
}

function getClosedLoopInteriorCells(path) {
  if (!Array.isArray(path) || path.length < 4) return [];
  const boundarySet = new Set(path.map((index) => groundCellKey(index)));
  const outsideVisited = new Set();
  const minX = gridMinIndex - 1;
  const maxX = gridMaxIndex + 1;
  const minZ = gridMinIndex - 1;
  const maxZ = gridMaxIndex + 1;
  const queue = [{ x: minX, z: minZ }];
  outsideVisited.add(`${minX}|${minZ}`);

  while (queue.length > 0) {
    const current = queue.shift();
    for (let i = 0; i < groundNeighborOffsets.length; i += 1) {
      const offset = groundNeighborOffsets[i];
      const nextX = current.x + offset.x;
      const nextZ = current.z + offset.z;
      if (nextX < minX || nextX > maxX || nextZ < minZ || nextZ > maxZ) {
        continue;
      }
      const nextKey = `${nextX}|${nextZ}`;
      if (outsideVisited.has(nextKey) || boundarySet.has(nextKey)) {
        continue;
      }
      outsideVisited.add(nextKey);
      queue.push({ x: nextX, z: nextZ });
    }
  }

  const interior = [];
  for (let x = gridMinIndex; x <= gridMaxIndex; x += 1) {
    for (let z = gridMinIndex; z <= gridMaxIndex; z += 1) {
      const key = `${x}|${z}`;
      if (boundarySet.has(key) || outsideVisited.has(key)) {
        continue;
      }
      interior.push({ x, z });
    }
  }
  return interior;
}

function updateSemiAutomaticBuild(now) {
  if (!semiAutoBuildState.active || semiAutoBuildState.path.length === 0) return;

  const interval = Math.max(1, 1000 / Math.max(0.1, semiBuildRate));
  if (semiAutoBuildState.lastStepTime === null) {
    semiAutoBuildState.lastStepTime = now - interval;
  }
  if (now - semiAutoBuildState.lastStepTime < interval) return;

  const targetStack = Math.max(1, Math.min(20, Math.round(semiBuildStack)));
  const maxStepsPerFrame = 16;
  let steps = 0;

  while (steps < maxStepsPerFrame && now - semiAutoBuildState.lastStepTime >= interval) {
    const targetCell = semiAutoBuildState.path[semiAutoBuildState.pathIndex];
    if (!targetCell) break;
    const targetIndex = {
      x: targetCell.x,
      y: semiAutoBuildState.layerIndex,
      z: targetCell.z
    };
    const didAdd = addBlockAt(targetIndex, currentColor, false);
    if (didAdd) {
      semiAutoBuildState.changedBlocks = true;
    }

    semiAutoBuildState.pathIndex += 1;
    if (semiAutoBuildState.pathIndex >= semiAutoBuildState.path.length) {
      semiAutoBuildState.pathIndex = 0;
      semiAutoBuildState.layerIndex += 1;
      if (semiAutoBuildState.layerIndex >= targetStack) {
        const topLayerY = Math.max(0, targetStack - 1);
        const topFillCells = getClosedLoopInteriorCells(semiAutoBuildState.path);
        for (let i = 0; i < topFillCells.length; i += 1) {
          const cell = topFillCells[i];
          const didFillAdd = addBlockAt({ x: cell.x, y: topLayerY, z: cell.z }, currentColor, false);
          if (didFillAdd) {
            semiAutoBuildState.changedBlocks = true;
          }
        }
        registerCompletedSemiAutoLoop(semiAutoBuildState.signature, semiAutoBuildState.path);
        stopSemiAutomaticBuild();
        break;
      }
    }
    semiAutoBuildState.lastStepTime += interval;
    steps += 1;
  }
}

function disposeMaterial(material) {
  if (Array.isArray(material)) {
    material.forEach((mat) => mat.dispose());
    return;
  }
  material.dispose();
}

function rebuildGridMeshes() {
  const buildSize = gridCellCount * gridSize;
  const outerBorderDrop = gridSize * 0.25;
  const innerBorderTopY = 0.003;
  const innerBorderBottomY = -outerBorderDrop;
  const innerBorderHeight = Math.max(0.0001, innerBorderTopY - innerBorderBottomY);
  const innerBorderCenterY = innerBorderBottomY + innerBorderHeight * 0.5;
  const innerBorderMinIndex = gridMinIndex - gridInnerBorderCellCount;
  const innerBorderMaxIndex = gridMaxIndex + gridInnerBorderCellCount;
  const outerBorderMinIndex = innerBorderMinIndex - gridOuterBorderCellCount;
  const outerBorderMaxIndex = innerBorderMaxIndex + gridOuterBorderCellCount;
  const centerOffset = gridSize * 0.5;
  const previousVisibility = gridLines ? gridLines.visible : true;

  if (gridLines) {
    scene.remove(gridLines);
    gridLines.geometry.dispose();
    disposeMaterial(gridLines.material);
  }
  if (gridFillMesh) {
    scene.remove(gridFillMesh);
    gridFillMesh.geometry.dispose();
    disposeMaterial(gridFillMesh.material);
  }
  if (groundCellGroup) {
    scene.remove(groundCellGroup);
    const geometries = new Set();
    const materials = new Set();
    groundCellGroup.traverse((obj) => {
      if (!obj.isMesh) return;
      geometries.add(obj.geometry);
      if (Array.isArray(obj.material)) {
        obj.material.forEach((mat) => materials.add(mat));
      } else {
        materials.add(obj.material);
      }
    });
    geometries.forEach((geom) => geom.dispose());
    materials.forEach((mat) => mat.dispose());
  }
  if (gridBorderGroup) {
    scene.remove(gridBorderGroup);
    const disposables = gridBorderGroup.userData.disposables;
    if (Array.isArray(disposables)) {
      disposables.forEach((resource) => resource.dispose());
    } else {
      const geometries = new Set();
      const materials = new Set();
      gridBorderGroup.traverse((obj) => {
        if (!obj.isMesh) return;
        geometries.add(obj.geometry);
        if (Array.isArray(obj.material)) {
          obj.material.forEach((mat) => materials.add(mat));
        } else {
          materials.add(obj.material);
        }
      });
      geometries.forEach((geom) => geom.dispose());
      materials.forEach((mat) => mat.dispose());
    }
  }
  if (gridMesh) {
    scene.remove(gridMesh);
    gridMesh.geometry.dispose();
    gridMesh.material.dispose();
  }

  gridFillMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(buildSize, buildSize, 1, 1),
    new THREE.MeshStandardMaterial({
      color: gridFillColor,
      roughness: 0.35,
      metalness: 0.05,
      side: THREE.DoubleSide
    })
  );
  gridFillMesh.rotation.x = -Math.PI / 2;
  gridFillMesh.position.set(centerOffset, 0.004, centerOffset);
  gridFillMesh.castShadow = true;
  gridFillMesh.receiveShadow = true;
  gridFillMesh.visible = previousVisibility;
  scene.add(gridFillMesh);

  groundCellGroup = new THREE.Group();
  const groundCellGeometry = new THREE.PlaneGeometry(gridSize, gridSize, 1, 1);
  for (let x = gridMinIndex; x <= gridMaxIndex; x += 1) {
    for (let z = gridMinIndex; z <= gridMaxIndex; z += 1) {
      const key = groundCellKey({ x, z });
      let cellState = groundCellStates.get(key);
      if (!cellState) {
        cellState = {
          index: { x, z },
          color: gridFillColor.clone(),
          painted: false,
          colorAnim: null,
          mesh: null,
          material: null
        };
        groundCellStates.set(key, cellState);
      } else if (typeof cellState.painted !== 'boolean') {
        cellState.painted = false;
      }
      const cellMaterial = new THREE.MeshStandardMaterial({
        color: cellState.color.clone(),
        roughness: 0.35,
        metalness: 0.05,
        side: THREE.DoubleSide
      });
      const cellMesh = new THREE.Mesh(groundCellGeometry, cellMaterial);
      cellMesh.rotation.x = -Math.PI / 2;
      cellMesh.position.set((x + 0.5) * gridSize, 0.0045, (z + 0.5) * gridSize);
      cellMesh.receiveShadow = true;
      cellState.mesh = cellMesh;
      cellState.material = cellMaterial;
      groundCellGroup.add(cellMesh);
    }
  }
  groundCellGroup.visible = previousVisibility;
  scene.add(groundCellGroup);

  gridBorderGroup = new THREE.Group();
  const innerCellGeometry = new THREE.BoxGeometry(gridSize, innerBorderHeight, gridSize, 1, 1, 1);
  const innerCellMaterial = new THREE.MeshStandardMaterial({
    color: gridInnerBorderColor,
    roughness: 0.35,
    metalness: 0.05
  });
  const innerEdgeGeometry = new THREE.EdgesGeometry(innerCellGeometry);
  const innerEdgeMaterial = new THREE.LineBasicMaterial({
    color: '#2b2b2b',
    transparent: true,
    opacity: 0.45,
    depthWrite: false
  });

  const outerCellGeometry = new THREE.PlaneGeometry(gridSize, gridSize, 1, 1);
  const outerCellMaterial = new THREE.MeshStandardMaterial({
    color: gridOuterBorderColor,
    roughness: 0.35,
    metalness: 0.05,
    side: THREE.DoubleSide
  });
  const outerEdgeGeometry = new THREE.EdgesGeometry(outerCellGeometry);
  const outerEdgeMaterial = new THREE.LineBasicMaterial({
    color: '#2b2b2b',
    transparent: true,
    opacity: 0.45,
    depthWrite: false
  });

  const addBorderCell = ({ x, z, y, geometry, material, edgeGeometry, edgeMaterial, isPlane }) => {
    const cell = new THREE.Mesh(geometry, material);
    if (isPlane) {
      cell.rotation.x = -Math.PI / 2;
    }
    cell.position.set((x + 0.5) * gridSize, y, (z + 0.5) * gridSize);
    cell.castShadow = true;
    cell.receiveShadow = true;
    const edgeLines = new THREE.LineSegments(edgeGeometry, edgeMaterial);
    edgeLines.name = 'border-edge';
    edgeLines.renderOrder = 4;
    cell.add(edgeLines);
    gridBorderGroup.add(cell);
  };

  // Inner border cells: 1-cell ring around the buildable area.
  for (let x = innerBorderMinIndex; x <= innerBorderMaxIndex; x += 1) {
    for (let z = innerBorderMinIndex; z <= innerBorderMaxIndex; z += 1) {
      const inBuildArea = x >= gridMinIndex && x <= gridMaxIndex && z >= gridMinIndex && z <= gridMaxIndex;
      if (inBuildArea) continue;
      addBorderCell({
        x,
        z,
        y: innerBorderCenterY,
        geometry: innerCellGeometry,
        material: innerCellMaterial,
        edgeGeometry: innerEdgeGeometry,
        edgeMaterial: innerEdgeMaterial,
        isPlane: false
      });
    }
  }

  // Outer border cells: 3-cell ring outside the inner border.
  for (let x = outerBorderMinIndex; x <= outerBorderMaxIndex; x += 1) {
    for (let z = outerBorderMinIndex; z <= outerBorderMaxIndex; z += 1) {
      const inInnerBand =
        x >= innerBorderMinIndex &&
        x <= innerBorderMaxIndex &&
        z >= innerBorderMinIndex &&
        z <= innerBorderMaxIndex;
      if (inInnerBand) continue;
      addBorderCell({
        x,
        z,
        y: -outerBorderDrop,
        geometry: outerCellGeometry,
        material: outerCellMaterial,
        edgeGeometry: outerEdgeGeometry,
        edgeMaterial: outerEdgeMaterial,
        isPlane: true
      });
    }
  }

  gridBorderGroup.userData.disposables = [
    innerCellGeometry,
    innerCellMaterial,
    innerEdgeGeometry,
    innerEdgeMaterial,
    outerCellGeometry,
    outerCellMaterial,
    outerEdgeGeometry,
    outerEdgeMaterial
  ];
  gridBorderGroup.visible = previousVisibility;
  scene.add(gridBorderGroup);

  gridLines = new THREE.GridHelper(buildSize, gridCellCount, '#ffffff', '#ffffff');
  gridLines.position.set(centerOffset, 0.01, centerOffset);
  const lineMaterials = Array.isArray(gridLines.material) ? gridLines.material : [gridLines.material];
  lineMaterials.forEach((mat) => {
    mat.transparent = true;
    mat.opacity = 0.95;
    mat.depthWrite = false;
  });
  gridLines.visible = previousVisibility;
  scene.add(gridLines);

  gridMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(buildSize, buildSize, 1, 1),
    new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide
    })
  );
  gridMesh.rotation.x = -Math.PI / 2;
  gridMesh.position.set(centerOffset, 0.011, centerOffset);
  scene.add(gridMesh);
}

rebuildGridMeshes();

// Blocks
const blocks = new Map();
const blockStates = [];
const blockWireGroup = new THREE.Group();
scene.add(blockWireGroup);
const blockPickGroup = new THREE.Group();
scene.add(blockPickGroup);
const blockGeometry = new THREE.BoxGeometry(1, 1, 1);
const blockEdgesGeometry = new THREE.EdgesGeometry(blockGeometry);
const wireframeMaterial = new THREE.LineBasicMaterial({
  color: '#2b2b2b',
  transparent: true,
  opacity: 0.35,
  depthWrite: false
});
const pickMaterial = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  depthWrite: false
});
pickMaterial.colorWrite = false;
const baseBlockMaterialParams = {
  roughness: 0.35,
  metalness: 0.05
};
const blockMaterial = new THREE.MeshStandardMaterial({
  color: '#ffffff',
  ...baseBlockMaterialParams
});
const blockBaseQuaternion = new THREE.Quaternion();
const tempBlockScale = new THREE.Vector3(1, 1, 1);
let blockMeshCapacity = 512;

function createInstancedBlockMesh(capacity) {
  const mesh = new THREE.InstancedMesh(blockGeometry, blockMaterial, capacity);
  mesh.count = 0;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3).fill(1), 3);
  mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

let blockMesh = createInstancedBlockMesh(blockMeshCapacity);
scene.add(blockMesh);

const previewMaterial = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#7ce8ff'),
  roughness: 0.4,
  metalness: 0,
  transparent: true,
  opacity: 0.35,
  depthWrite: false
});
const previewMesh = new THREE.Mesh(blockGeometry, previewMaterial);
previewMesh.visible = false;
scene.add(previewMesh);

let blockGap = 0.0;
const minScaleRatio = 0.05; // prevent degenerate cubes
let buildRate = 10; // blocks per second
let buildInterval = 1000 / buildRate;
let addStack = 1;
const historyLimit = 50;
const history = [];
const redoStack = [];
let strokeActive = false;
let actionDirty = false;
function updateSunShadowFrustum() {
  const cam = dirLight.shadow.camera;
  const extent = Math.max(120, gridVisualCellCount * gridSize * 1.5);
  cam.left = -extent;
  cam.right = extent;
  cam.top = extent;
  cam.bottom = -extent;
  cam.near = 0.5;
  const lightDistance = dirLight.position.length();
  cam.far = Math.max(lightDistance + extent, extent * 2.5);
  cam.updateProjectionMatrix();
}
function markHistoryChange() {
  if (strokeActive) actionDirty = true;
}
function ensureBlockCapacity(required) {
  if (required <= blockMeshCapacity) return;
  let nextCapacity = blockMeshCapacity;
  while (nextCapacity < required) {
    nextCapacity *= 2;
  }
  const previousMesh = blockMesh;
  const nextMesh = createInstancedBlockMesh(nextCapacity);
  for (let i = 0; i < blockStates.length; i += 1) {
    previousMesh.getMatrixAt(i, tempMatrix);
    nextMesh.setMatrixAt(i, tempMatrix);
    if (previousMesh.instanceColor) {
      previousMesh.getColorAt(i, tempColorA);
    } else {
      tempColorA.set('#ffffff');
    }
    nextMesh.setColorAt(i, tempColorA);
  }
  nextMesh.count = blockStates.length;
  nextMesh.instanceMatrix.needsUpdate = true;
  if (nextMesh.instanceColor) {
    nextMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    nextMesh.instanceColor.needsUpdate = true;
  }
  scene.remove(previousMesh);
  blockMesh = nextMesh;
  blockMeshCapacity = nextCapacity;
  scene.add(blockMesh);
}
function composeBlockMatrix(index, scale) {
  setPositionFromIndex(tempVec3, index);
  tempBlockScale.setScalar(scale);
  tempMatrix.compose(tempVec3, blockBaseQuaternion, tempBlockScale);
}
function writeBlockStateTransform(state) {
  composeBlockMatrix(state.index, state.scale);
  blockMesh.setMatrixAt(state.slot, tempMatrix);
  if (state.wire) {
    state.wire.position.copy(tempVec3);
    state.wire.scale.setScalar(state.scale);
  }
  if (state.pick) {
    state.pick.position.copy(tempVec3);
    state.pick.scale.setScalar(state.scale);
  }
}
function writeBlockStateColor(state) {
  blockMesh.setColorAt(state.slot, state.color);
  if (blockMesh.instanceColor) {
    blockMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
  }
}
function removeBlockStateBySlot(slot) {
  const state = blockStates[slot];
  if (!state) return;
  blocks.delete(state.key);
  if (state.wire) {
    blockWireGroup.remove(state.wire);
  }
  if (state.pick) {
    blockPickGroup.remove(state.pick);
  }
  const lastIndex = blockStates.length - 1;
  if (slot !== lastIndex) {
    const moved = blockStates[lastIndex];
    moved.slot = slot;
    blockStates[slot] = moved;
    writeBlockStateTransform(moved);
    writeBlockStateColor(moved);
  }
  blockStates.pop();
  blockMesh.count = blockStates.length;
  blockMesh.instanceMatrix.needsUpdate = true;
  if (blockMesh.instanceColor) {
    blockMesh.instanceColor.needsUpdate = true;
  }
}
function createBlockState(index, color) {
  const wire = new THREE.LineSegments(blockEdgesGeometry, wireframeMaterial);
  wire.visible = wireframeVisible;
  const pick = new THREE.Mesh(blockGeometry, pickMaterial);
  const state = {
    key: indexKey(index),
    index: { ...index },
    slot: blockStates.length,
    scale: minScaleValue,
    desiredScale: getBlockScale(),
    removing: false,
    color: color.clone(),
    colorAnim: null,
    wire,
    pick
  };
  pick.userData.state = state;
  blockWireGroup.add(wire);
  blockPickGroup.add(pick);
  return state;
}
function snapshotState() {
  const entries = [];
  blocks.forEach((state) => {
    if (state.removing) return;
    entries.push({
      index: { ...state.index },
      color: state.color.getHex()
    });
  });
  return { blocks: entries };
}
function applySnapshot(state) {
  if (!state) {
    blocks.forEach((blockState) => {
      blockState.removing = true;
    });
    return;
  }
  const target = new Map();
  state.blocks.forEach((entry) => {
    target.set(indexKey(entry.index), entry);
  });

  // Remove or update existing blocks.
  blocks.forEach((blockState, key) => {
    const targetEntry = target.get(key);
    if (!targetEntry) {
      blockState.removing = true;
      return;
    }
    blockState.removing = false;
    blockState.desiredScale = getBlockScale();
    const targetColor = new THREE.Color(targetEntry.color);
    if (!blockState.color.equals(targetColor)) {
      scheduleColorLerp(blockState, targetColor);
    }
    target.delete(key);
  });

  // Add new blocks that are in target but not currently present.
  target.forEach((entry) => {
    addBlockAt(entry.index, new THREE.Color(entry.color), false);
  });
  resnapBlocks();
  hoverDirty = true;
}
function updateHistoryButtons() {
  if (undoButton) undoButton.disabled = false;
  if (redoButton) redoButton.disabled = false;
}
function pushHistoryState(state, clearRedo = false) {
  if (!state) return;
  if (clearRedo) redoStack.length = 0;
  if (history.length >= historyLimit) history.shift();
  history.push(state);
  updateHistoryButtons();
}
function undoLast() {
  stopSemiAutomaticBuild({ clearCompleted: true });
  if (history.length <= 1) return;
  const current = history.pop();
  if (current) {
    if (redoStack.length >= historyLimit) redoStack.shift();
    redoStack.push(current);
  }
  applySnapshot(history[history.length - 1]);
  updateHistoryButtons();
}
function redoLast() {
  stopSemiAutomaticBuild({ clearCompleted: true });
  if (!redoStack.length) return;
  const snapshot = redoStack.pop();
  if (!snapshot) return;
  pushHistoryState(snapshot, false);
  applySnapshot(snapshot);
}
function finalizeStrokeHistory() {
  if (!strokeActive) return;
  if (actionDirty) {
    pushHistoryState(snapshotState(), true);
  }
  strokeActive = false;
  actionDirty = false;
}
function resetBlocks() {
  stopSemiAutomaticBuild({ clearCompleted: true });
  if (!blocks.size) return;
  strokeActive = true;
  actionDirty = true;
  resetPending = true;
  blocks.forEach((state) => {
    state.removing = true;
  });
}
function exportBlocksToOBJ() {
  const basePos = blockGeometry.attributes.position?.array;
  const baseNorm = blockGeometry.attributes.normal?.array;
  const baseIndex = blockGeometry.index ? blockGeometry.index.array : null;
  if (!basePos || !baseNorm) return;
  const lines = ['# 260223_BuildingBlocks export'];
  let vertexOffset = 0;
  blocks.forEach((state) => {
    if (state.removing) return;
    composeBlockMatrix(state.index, state.scale);
    tempNormalMatrix.getNormalMatrix(tempMatrix);
    const { r, g, b } = state.color;
    const r255 = Math.round(r * 255);
    const g255 = Math.round(g * 255);
    const b255 = Math.round(b * 255);
    for (let i = 0; i < basePos.length; i += 3) {
      tempVec3.set(basePos[i], basePos[i + 1], basePos[i + 2]).applyMatrix4(tempMatrix);
      lines.push(
        `v ${tempVec3.x.toFixed(5)} ${tempVec3.y.toFixed(5)} ${tempVec3.z.toFixed(5)} ${r255} ${g255} ${b255}`
      );
    }
    for (let i = 0; i < baseNorm.length; i += 3) {
      tempVec3
        .set(baseNorm[i], baseNorm[i + 1], baseNorm[i + 2])
        .applyMatrix3(tempNormalMatrix)
        .normalize();
      lines.push(`vn ${tempVec3.x.toFixed(5)} ${tempVec3.y.toFixed(5)} ${tempVec3.z.toFixed(5)}`);
    }
    const vertCount = basePos.length / 3;
    if (baseIndex) {
      for (let i = 0; i < baseIndex.length; i += 3) {
        const a = vertexOffset + baseIndex[i] + 1;
        const bIdx = vertexOffset + baseIndex[i + 1] + 1;
        const c = vertexOffset + baseIndex[i + 2] + 1;
        lines.push(`f ${a}//${a} ${bIdx}//${bIdx} ${c}//${c}`);
      }
    } else {
      for (let i = 0; i < vertCount; i += 3) {
        const a = vertexOffset + i + 1;
        const bIdx = vertexOffset + i + 2;
        const c = vertexOffset + i + 3;
        lines.push(`f ${a}//${a} ${bIdx}//${bIdx} ${c}//${c}`);
      }
    }
    vertexOffset += vertCount;
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  link.download = `blockbrush-${stamp}.obj`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
const lastActionTime = { add: -Infinity, remove: -Infinity, paint: -Infinity };
const minScaleValue = 0.0001;
const minAnimDamping = 2;
const currentColor = new THREE.Color('#ffffff');
const tempColorA = new THREE.Color();
const tempColorB = new THREE.Color();

const hitBlocks = [];
const hitPlane = [];
const tempIndex = { x: 0, y: 0, z: 0 };
const tempNormal = new THREE.Vector3(0, 1, 0);
let resetPending = false;
const tempMatrix = new THREE.Matrix4();
const tempNormalMatrix = new THREE.Matrix3();
const tempVec3 = new THREE.Vector3();

function indexKey(index) {
  return `${index.x}|${index.y}|${index.z}`;
}

function setPositionFromIndex(target, index) {
  target.set(
    (index.x + 0.5) * gridSize,
    (index.y + 0.5) * gridSize,
    (index.z + 0.5) * gridSize
  );
  return target;
}

function getBlockScale() {
  const maxGap = gridSize * 0.49;
  const clampedGap = Math.min(blockGap, maxGap);
  const size = gridSize - clampedGap * 2;
  return Math.max(size, gridSize * minScaleRatio);
}

function isWithinGridBounds(index) {
  return (
    index.x >= gridMinIndex &&
    index.x <= gridMaxIndex &&
    index.z >= gridMinIndex &&
    index.z <= gridMaxIndex
  );
}

function getAnimDamping() {
  return Math.max(minAnimDamping, buildRate);
}

function scheduleColorLerp(state, targetColor) {
  if (!state) return;
  if (!state.colorAnim) {
    state.colorAnim = {
      from: state.color.clone(),
      to: targetColor.clone(),
      t: 0
    };
  } else {
    state.colorAnim.from.copy(state.color);
    state.colorAnim.to.copy(targetColor);
    state.colorAnim.t = 0;
  }
}

function scheduleGroundCellColorLerp(cellState, targetColor) {
  if (!cellState) return;
  if (!cellState.colorAnim) {
    cellState.colorAnim = {
      from: cellState.color.clone(),
      to: targetColor.clone(),
      t: 0
    };
  } else {
    cellState.colorAnim.from.copy(cellState.color);
    cellState.colorAnim.to.copy(targetColor);
    cellState.colorAnim.t = 0;
  }
}

function resetSemiAutomaticGroundPaint() {
  groundCellStates.forEach((cellState) => {
    if (!cellState) return;
    setGroundCellPaintState(cellState, false);
  });
  stopSemiAutomaticBuild({ clearCompleted: true });
}

function addBlockAt(index, color = currentColor, markDirty = true) {
  const key = indexKey(index);
  if (blocks.has(key)) return false;
  ensureBlockCapacity(blockStates.length + 1);
  const state = createBlockState(index, color);
  blocks.set(key, state);
  blockStates.push(state);
  writeBlockStateTransform(state);
  writeBlockStateColor(state);
  blockMesh.count = blockStates.length;
  blockMesh.instanceMatrix.needsUpdate = true;
  if (blockMesh.instanceColor) {
    blockMesh.instanceColor.needsUpdate = true;
  }
  if (markDirty) {
    markHistoryChange();
  }
  return true;
}

function removeBlockAt(key) {
  const state = blocks.get(key);
  if (!state) return;
  state.removing = true;
  markHistoryChange();
}

function getStateFromIntersection(hit) {
  if (!hit) return null;
  const stateFromObject = hit.object?.userData?.state;
  if (stateFromObject) return stateFromObject;
  if (typeof hit.instanceId !== 'number') return null;
  if (hit.instanceId < 0 || hit.instanceId >= blockStates.length) return null;
  return blockStates[hit.instanceId];
}

function resnapBlocks() {
  let matrixDirty = false;
  blocks.forEach((state) => {
    state.desiredScale = getBlockScale();
    if (state.wire) {
      state.wire.visible = wireframeVisible;
    }
    writeBlockStateTransform(state);
    matrixDirty = true;
  });
  if (matrixDirty) {
    blockMesh.instanceMatrix.needsUpdate = true;
  }
  if (previewMesh.visible && hoverState.index) {
    previewMesh.scale.setScalar(getBlockScale());
    setPositionFromIndex(previewMesh.position, hoverState.index);
  }
}

// Interaction
const pointer = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const pointerState = { down: false, mode: null };
const hoverState = { type: null, index: null, key: null, addDirection: null };
let hoverDirty = true;
let semiAutomaticMode = false;
let isAltDown = false;
let isShiftDown = false;

let uiActive = false;
const uiPanel = document.getElementById('ui-panel');
uiPanel.addEventListener('pointerdown', () => {
  uiActive = true;
});
uiPanel.addEventListener('pointerup', () => {
  uiActive = false;
});
uiPanel.addEventListener('pointerleave', () => {
  uiActive = false;
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'Alt' && !isAltDown) {
    isAltDown = true;
    setPreview(null, null);
  }
  if (event.key === 'Shift' && !isShiftDown) {
    isShiftDown = true;
    hoverDirty = true;
  }
});
window.addEventListener('keyup', (event) => {
  if (event.key === 'Alt') {
    isAltDown = false;
    hoverDirty = true;
  }
  if (event.key === 'Shift') {
    isShiftDown = false;
    hoverDirty = true;
  }
});

function updatePointer(event) {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
  isShiftDown = Boolean(event.shiftKey);
  hoverDirty = true;
}

function setPreview(type, targetIndex, targetKey, addDirection) {
  if (!targetIndex) {
    previewMesh.visible = false;
    hoverState.type = null;
    hoverState.index = null;
    hoverState.key = null;
    hoverState.addDirection = null;
    return;
  }
  hoverState.type = type;
  hoverState.index = targetIndex;
  hoverState.key = targetKey || null;
  hoverState.addDirection = addDirection ? { ...addDirection } : null;
  previewMesh.visible = true;
  previewMesh.scale.setScalar(getBlockScale());
  setPositionFromIndex(previewMesh.position, targetIndex);
  previewMaterial.color.set(type === 'remove' ? '#ff7f7f' : '#7ce8ff');
}

function updateHoverTarget() {
  if (uiActive) {
    setPreview(null, null);
    hoverDirty = false;
    return;
  }

  if (semiAutomaticMode) {
    if (semiAutoBuildState.active) {
      setPreview(null, null);
      hoverDirty = false;
      return;
    }
    raycaster.setFromCamera(pointer, camera);
    hitPlane.length = 0;
    raycaster.intersectObject(gridMesh, false, hitPlane);
    if (hitPlane.length > 0) {
      const point = hitPlane[0].point;
      tempIndex.x = Math.floor(point.x / gridSize);
      tempIndex.y = 0;
      tempIndex.z = Math.floor(point.z / gridSize);
      if (isWithinGridBounds(tempIndex)) {
        const semiModeType = pointerState.mode === 'groundErase' ? 'groundErase' : 'groundPaint';
        hoverState.type = semiModeType;
        hoverState.index = { x: tempIndex.x, y: 0, z: tempIndex.z };
        hoverState.key = groundCellKey({ x: tempIndex.x, z: tempIndex.z });
        hoverState.addDirection = null;
        previewMesh.visible = false;
      } else {
        setPreview(null, null);
      }
    } else {
      setPreview(null, null);
    }
    hoverDirty = false;
    return;
  }

  if (isAltDown && pointerState.mode !== 'remove' && pointerState.mode !== 'paint') {
    setPreview(null, null);
    hoverDirty = false;
    return;
  }

  raycaster.setFromCamera(pointer, camera);
  hitBlocks.length = 0;
  hitPlane.length = 0;
  raycaster.intersectObjects(blockPickGroup.children, false, hitBlocks);
  raycaster.intersectObject(gridMesh, false, hitPlane);

  if (pointerState.mode === 'remove') {
    if (hitBlocks.length > 0) {
      const hit = hitBlocks[0];
      const state = getStateFromIntersection(hit);
      if (state) {
        setPreview('remove', { ...state.index }, state.key);
      } else {
        setPreview(null, null);
      }
    } else {
      setPreview(null, null);
    }
    hoverDirty = false;
    return;
  }

  if (pointerState.mode === 'paint') {
    if (hitBlocks.length > 0) {
      const hit = hitBlocks[0];
      const state = getStateFromIntersection(hit);
      if (state) {
        hoverState.type = 'paint';
        hoverState.index = { ...state.index };
        hoverState.key = state.key;
        hoverState.addDirection = null;
        previewMesh.visible = false;
      } else {
        setPreview(null, null);
      }
    } else {
      setPreview(null, null);
    }
    hoverDirty = false;
    return;
  }

  const sideAddOnly = isShiftDown;

  if (hitBlocks.length > 0) {
    const hit = hitBlocks[0];
    const state = getStateFromIntersection(hit);
    if (!state) {
      setPreview(null, null);
      hoverDirty = false;
      return;
    }
    const baseIndex = state.index;
    if (hit.face && hit.face.normal) {
      tempNormal.copy(hit.face.normal);
    } else {
      tempNormal.set(0, 1, 0);
    }
    tempIndex.x = baseIndex.x + Math.round(tempNormal.x);
    tempIndex.y = baseIndex.y + Math.round(tempNormal.y);
    tempIndex.z = baseIndex.z + Math.round(tempNormal.z);
    const normalYAbs = Math.abs(tempNormal.y);
    const hitTopOrBottom = normalYAbs >= 0.5;
    const hitSide = normalYAbs < 0.5;
    const canAddOnFace = sideAddOnly ? hitSide : hitTopOrBottom;
    const addDirection = sideAddOnly
      ? {
          x: Math.round(tempNormal.x),
          y: Math.round(tempNormal.y),
          z: Math.round(tempNormal.z)
        }
      : { x: 0, y: 1, z: 0 };
    if (canAddOnFace && isWithinGridBounds(tempIndex)) {
      setPreview('add', { ...tempIndex }, null, addDirection);
    } else {
      setPreview(null, null);
    }
    hoverDirty = false;
    return;
  }

  if (hitPlane.length > 0) {
    const point = hitPlane[0].point;
    tempIndex.x = Math.floor(point.x / gridSize);
    tempIndex.y = 0;
    tempIndex.z = Math.floor(point.z / gridSize);
    if (!sideAddOnly && isWithinGridBounds(tempIndex)) {
      setPreview('add', { ...tempIndex }, null, { x: 0, y: 1, z: 0 });
    } else {
      setPreview(null, null);
    }
    hoverDirty = false;
    return;
  }

  setPreview(null, null);
  hoverDirty = false;
}

function handlePaint() {
  if (!pointerState.down || uiActive) return;
  if (semiAutomaticMode && semiAutoBuildState.active) return;
  const now = performance.now();
  if (hoverState.type === 'add' && hoverState.index) {
    if (isWithinGridBounds(hoverState.index) && now - lastActionTime.add >= buildInterval) {
      const direction = hoverState.addDirection || { x: 0, y: 1, z: 0 };
      const dirX = Math.sign(direction.x || 0);
      const dirY = Math.sign(direction.y || 0);
      const dirZ = Math.sign(direction.z || 0);
      const hasDirection = dirX !== 0 || dirY !== 0 || dirZ !== 0;
      for (let i = 0; i < addStack; i += 1) {
        const step = hasDirection ? i : 0;
        const target = {
          x: hoverState.index.x + dirX * step,
          y: hoverState.index.y + dirY * step,
          z: hoverState.index.z + dirZ * step
        };
        if (!isWithinGridBounds(target)) break;
        addBlockAt(target);
      }
      lastActionTime.add = now;
    }
  } else if (hoverState.type === 'remove' && hoverState.key) {
    if (now - lastActionTime.remove >= buildInterval) {
      removeBlockAt(hoverState.key);
      lastActionTime.remove = now;
    }
  } else if (hoverState.type === 'paint' && hoverState.key) {
    if (now - lastActionTime.paint >= buildInterval) {
      const state = blocks.get(hoverState.key);
      if (state) {
        scheduleColorLerp(state, currentColor);
        markHistoryChange();
      }
      lastActionTime.paint = now;
    }
  } else if (hoverState.type === 'groundPaint' && hoverState.key) {
    const cellState = groundCellStates.get(hoverState.key);
    if (cellState) {
      const changed = setGroundCellPaintState(cellState, true);
      if (changed) {
        refreshSemiAutomaticBuildPlan(hoverState.key);
      }
    }
    lastActionTime.paint = now;
  } else if (hoverState.type === 'groundErase' && hoverState.key) {
    const cellState = groundCellStates.get(hoverState.key);
    if (cellState) {
      const changed = setGroundCellPaintState(cellState, false);
      if (changed) {
        refreshSemiAutomaticBuildPlan(hoverState.key);
      }
    }
    lastActionTime.paint = now;
  }
}

renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

renderer.domElement.addEventListener('pointerdown', (event) => {
  if (uiActive) return;
  if (event.button === 0) {
    if (semiAutomaticMode && semiAutoBuildState.active) {
      pointerState.down = false;
      pointerState.mode = null;
      updatePointer(event);
      updateHoverTarget();
      return;
    }
    pointerState.down = true;
    if (semiAutomaticMode) {
      pointerState.mode = event.ctrlKey ? 'groundErase' : 'groundPaint';
    } else if (event.altKey) {
      pointerState.mode = 'paint';
    } else if (event.ctrlKey) {
      pointerState.mode = 'remove';
    } else {
      pointerState.mode = 'add';
    }
    if (pointerState.mode === 'groundPaint' || pointerState.mode === 'groundErase') {
      lastActionTime.paint = -Infinity; // allow immediate first action
      strokeActive = false;
      actionDirty = false;
    } else {
      lastActionTime[pointerState.mode] = -Infinity; // allow immediate first action
      strokeActive = true;
      actionDirty = false;
    }
    renderer.domElement.setPointerCapture(event.pointerId);
    updatePointer(event);
    updateHoverTarget();
    handlePaint();
  }
});

renderer.domElement.addEventListener('pointermove', (event) => {
  updatePointer(event);
  if (hoverDirty) updateHoverTarget();
  handlePaint();
});

renderer.domElement.addEventListener('pointerup', (event) => {
  if (event.button === 0) {
    pointerState.down = false;
    pointerState.mode = null;
    renderer.domElement.releasePointerCapture(event.pointerId);
    finalizeStrokeHistory();
    updateHoverTarget();
  }
});
renderer.domElement.addEventListener('pointerleave', () => {
  setPreview(null, null);
});

// UI slider
const gridSlider = document.getElementById('grid-size');
const gridValue = document.getElementById('grid-size-value');
const gapSlider = document.getElementById('block-gap');
const gapValue = document.getElementById('block-gap-value');
const buildSlider = document.getElementById('build-speed');
const buildValue = document.getElementById('build-speed-value');
const stackSlider = document.getElementById('add-stack');
const stackValue = document.getElementById('add-stack-value');
const colorInput = document.getElementById('block-color');
const colorValue = document.getElementById('block-color-value');
const colorChip = document.getElementById('block-color-chip');
const colorPopover = document.getElementById('color-popover');
const colorPreview = document.getElementById('color-preview');
const colorHexInput = document.getElementById('color-hex-input');
const hueSlider = document.getElementById('hue-slider');
const satSlider = document.getElementById('sat-slider');
const lightSlider = document.getElementById('light-slider');
const hueValue = document.getElementById('hue-value');
const satValue = document.getElementById('sat-value');
const lightValue = document.getElementById('light-value');
const swatches = Array.from(document.querySelectorAll('#color-swatches button'));
const semiAutomaticButton = document.getElementById('semi-automatic-button');
const fullAutomaticButton = document.getElementById('full-automatic-button');
const semiAutomaticControls = document.getElementById('semi-automatic-controls');
const fullAutomaticControls = document.getElementById('full-automatic-controls');
const semiBuildSpeedSlider = document.getElementById('semi-build-speed');
const semiBuildSpeedValue = document.getElementById('semi-build-speed-value');
const semiBuildStackSlider = document.getElementById('semi-build-stack');
const semiBuildStackValue = document.getElementById('semi-build-stack-value');
const fullBuildSpeedSlider = document.getElementById('full-build-speed');
const fullBuildSpeedValue = document.getElementById('full-build-speed-value');
const fullOutlineCountSlider = document.getElementById('full-outline-count');
const fullOutlineCountValue = document.getElementById('full-outline-count-value');
const fullOutlineSeedSlider = document.getElementById('full-outline-seed');
const fullOutlineSeedValue = document.getElementById('full-outline-seed-value');
const wireframeToggle = document.getElementById('wireframe-toggle');
const gridToggle = document.getElementById('grid-toggle');
const rainToggle = document.getElementById('rain-toggle');
const undoButton = document.getElementById('undo-button');
const redoButton = document.getElementById('redo-button');
const resetButton = document.getElementById('reset-button');
const exportButton = document.getElementById('export-button');
const instructionsButton = document.getElementById('instructions-button');
const instructionsPopover = document.getElementById('instructions-popover');
const blockTypeButtons = Array.from(document.querySelectorAll('.block-type-button'));
const hslState = { h: 20 / 360, s: 1, l: 0.5 };
let colorPopoverOpen = false;
let instructionsPopoverOpen = false;
let lastHueInput = 0;
let recentColors = swatches.map((_, idx) => (idx === 0 ? '#ff9c00' : '#ffffff'));
let lastSavedColor = '#ffffff';
let wireframeVisible = Boolean(wireframeToggle && wireframeToggle.checked);
let gridVisible = Boolean(gridToggle && gridToggle.checked);
let semiBuildRate = 10;
let semiBuildStack = 1;
let fullAutomaticMode = false;
let fullBuildRate = 10;
let fullOutlineCount = 3;
let fullOutlineSeed = 1;
const rangeInputs = Array.from(document.querySelectorAll('input[type="range"]'));

function updateRangeFill(el) {
  if (!el) return;
  const min = parseFloat(el.min ?? 0);
  const max = parseFloat(el.max ?? 100);
  const val = parseFloat(el.value ?? min);
  const ratio = max === min ? 0 : Math.min(1, Math.max(0, (val - min) / (max - min)));
  const style = getComputedStyle(el);
  const thumbSize = parseFloat(style.getPropertyValue('--range-thumb-size')) || 16;
  const trackWidth = el.clientWidth || el.getBoundingClientRect().width;
  if (!trackWidth) {
    el.style.setProperty('--range-progress', `${ratio * 100}%`);
    return;
  }
  const usableWidth = Math.max(0, trackWidth - thumbSize);
  const fillToCenter = thumbSize * 0.5 + ratio * usableWidth;
  el.style.setProperty('--range-progress', `${fillToCenter}px`);
}

function refreshRangeFills() {
  rangeInputs.forEach((el) => updateRangeFill(el));
}
rangeInputs.forEach((el) => {
  updateRangeFill(el);
  el.addEventListener('input', () => updateRangeFill(el));
});

function setGridSize(value) {
  gridSize = value;
  rebuildGridMeshes();
  setGridVisible(gridVisible);
  gridValue.textContent = gridSize.toFixed(1);
  setBlockGap(blockGap); // re-clamp to new grid size and resnap
  hoverDirty = true;
  if (!pointerState.down) {
    updateHoverTarget();
  }
  updateSunShadowFrustum();
}
gridSlider.addEventListener('input', (event) => {
  setGridSize(parseFloat(event.target.value));
});
function setBlockGap(value) {
  const maxGap = gridSize * 0.5;
  blockGap = Math.max(0, Math.min(value, maxGap));
  gapValue.textContent = blockGap.toFixed(2);
  if (gapSlider) {
    gapSlider.value = blockGap.toFixed(2);
    updateRangeFill(gapSlider);
  }
  resnapBlocks();
}
gapSlider.addEventListener('input', (event) => {
  setBlockGap(parseFloat(event.target.value));
});
function setBuildRate(value) {
  buildRate = value;
  buildInterval = 1000 / buildRate;
  buildValue.textContent = `${buildRate.toFixed(1)}`;
  updateRangeFill(buildSlider);
}
function setAddStack(value) {
  const clamped = Math.max(1, Math.min(20, Math.round(value)));
  addStack = clamped;
  if (stackValue) {
    stackValue.textContent = `${clamped}`;
  }
  if (stackSlider) {
    stackSlider.value = `${clamped}`;
    updateRangeFill(stackSlider);
  }
}
function setSemiBuildRate(value) {
  semiBuildRate = Math.max(1, Math.min(100, value));
  if (semiBuildSpeedValue) {
    semiBuildSpeedValue.textContent = `${semiBuildRate.toFixed(1)}`;
  }
  if (semiBuildSpeedSlider) {
    semiBuildSpeedSlider.value = `${semiBuildRate}`;
    updateRangeFill(semiBuildSpeedSlider);
  }
}
function setSemiBuildStack(value) {
  const clamped = Math.max(1, Math.min(20, Math.round(value)));
  semiBuildStack = clamped;
  if (semiBuildStackValue) {
    semiBuildStackValue.textContent = `${semiBuildStack}`;
  }
  if (semiBuildStackSlider) {
    semiBuildStackSlider.value = `${semiBuildStack}`;
    updateRangeFill(semiBuildStackSlider);
  }
}
function setFullBuildRate(value) {
  fullBuildRate = Math.max(1, Math.min(100, value));
  if (fullBuildSpeedValue) {
    fullBuildSpeedValue.textContent = `${fullBuildRate.toFixed(1)}`;
  }
  if (fullBuildSpeedSlider) {
    fullBuildSpeedSlider.value = `${fullBuildRate}`;
    updateRangeFill(fullBuildSpeedSlider);
  }
}
function setFullOutlineCount(value) {
  fullOutlineCount = Math.max(1, Math.min(6, Math.round(value)));
  if (fullOutlineCountValue) {
    fullOutlineCountValue.textContent = `${fullOutlineCount}`;
  }
  if (fullOutlineCountSlider) {
    fullOutlineCountSlider.value = `${fullOutlineCount}`;
    updateRangeFill(fullOutlineCountSlider);
  }
  if (fullAutomaticMode) {
    runFullAutoGeneration();
  }
}
function setFullOutlineSeed(value) {
  fullOutlineSeed = Math.max(1, Math.min(1000, Math.round(value)));
  if (fullOutlineSeedValue) {
    fullOutlineSeedValue.textContent = `${fullOutlineSeed}`;
  }
  if (fullOutlineSeedSlider) {
    fullOutlineSeedSlider.value = `${fullOutlineSeed}`;
    updateRangeFill(fullOutlineSeedSlider);
  }
  if (fullAutomaticMode) {
    runFullAutoGeneration();
  }
}
const tempHSLColor = new THREE.Color();
function updateSliderGradients() {
  if (hueSlider) {
    hueSlider.style.background = 'linear-gradient(90deg, #2f2f2f, #cfcfcf)';
  }
  if (satSlider) {
    satSlider.style.background = 'linear-gradient(90deg, #4f4f4f, #efefef)';
  }
  if (lightSlider) {
    lightSlider.style.background = 'linear-gradient(90deg, #000000, #ffffff)';
  }
}
function currentHex() {
  return `#${currentColor.getHexString()}`;
}

function renderRecentColors() {
  swatches.forEach((btn, idx) => {
    const col = recentColors[idx] || '#ffffff';
    btn.style.background = col;
    btn.setAttribute('data-color', col);
  });
}

function addRecentColor(hex) {
  if (!hex) return;
  recentColors = [hex, ...recentColors].slice(0, swatches.length);
  renderRecentColors();
}

function syncColorControls(forcedHsl) {
  const normalized = `#${currentColor.getHexString()}`;
  if (colorValue) colorValue.textContent = normalized;
  if (colorInput && colorInput !== document.activeElement) colorInput.value = normalized;
  if (colorHexInput && colorHexInput !== document.activeElement) colorHexInput.value = normalized;
  if (colorChip) {
    colorChip.style.setProperty('--chip-fill', normalized);
    colorChip.style.background = normalized;
  }
  if (colorPreview) {
    colorPreview.style.setProperty('--chip-fill', normalized);
    colorPreview.style.background = normalized;
  }
  if (forcedHsl) {
    hslState.h = forcedHsl.h;
    hslState.s = forcedHsl.s;
    hslState.l = forcedHsl.l;
  } else {
    currentColor.getHSL(hslState);
  }
  if (hueSlider && hueValue) {
    const hueDisplay = Math.max(0, Math.min(360, Math.round(lastHueInput)));
    hueSlider.value = hueDisplay;
    hueValue.textContent = `${hueDisplay}`;
    updateRangeFill(hueSlider);
  }
  if (satSlider && satValue) {
    satSlider.value = Math.round(hslState.s * 100);
    satValue.textContent = `${satSlider.value}`;
    updateRangeFill(satSlider);
  }
  if (lightSlider && lightValue) {
    lightSlider.value = Math.round(hslState.l * 100);
    lightValue.textContent = `${lightSlider.value}`;
    updateRangeFill(lightSlider);
  }
  updateSliderGradients();
}
function setBlockColor(hex, rawHueDeg) {
  currentColor.set(hex);
  currentColor.getHSL(hslState);
  if (typeof rawHueDeg === 'number') {
    lastHueInput = Math.max(0, Math.min(360, rawHueDeg));
  } else {
    lastHueInput = Math.max(0, Math.min(360, Math.round(hslState.h * 360)));
  }
  syncColorControls();
}
if (colorInput) {
  colorInput.addEventListener('input', (event) => {
    setBlockColor(event.target.value);
  });
}

function setActiveBlockType(buttonEl) {
  if (!buttonEl) return;
  blockTypeButtons.forEach((btn) => btn.classList.toggle('active', btn === buttonEl));
  const targetColor = buttonEl.getAttribute('data-color');
  if (targetColor) {
    setBlockColor(targetColor);
  }
}
if (blockTypeButtons.length > 0) {
  blockTypeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      setActiveBlockType(btn);
    });
  });
}

function setSemiAutomaticMode(on) {
  const wasActive = semiAutomaticMode;
  semiAutomaticMode = on;
  if (semiAutomaticMode && fullAutomaticMode) {
    setFullAutomaticMode(false);
  }
  if (uiPanel) {
    uiPanel.classList.toggle('auto-controls-open', semiAutomaticMode || fullAutomaticMode);
  }
  if (semiAutomaticButton) {
    semiAutomaticButton.classList.toggle('is-active', semiAutomaticMode);
    semiAutomaticButton.setAttribute('aria-pressed', semiAutomaticMode ? 'true' : 'false');
  }
  if (semiAutomaticControls) {
    semiAutomaticControls.classList.toggle('is-hidden', !semiAutomaticMode);
    if (semiAutomaticMode) {
      refreshRangeFills();
    }
  }
  if (!semiAutomaticMode) {
    pointerState.mode = null;
    pointerState.down = false;
    if (wasActive) {
      resetSemiAutomaticGroundPaint();
    } else {
      stopSemiAutomaticBuild({ clearCompleted: true });
    }
  } else {
    refreshSemiAutomaticBuildPlan();
  }
  setPreview(null, null);
  hoverDirty = true;
  if (!pointerState.down) {
    updateHoverTarget();
  }
}
function setFullAutomaticMode(on) {
  fullAutomaticMode = on;
  if (fullAutomaticMode && semiAutomaticMode) {
    setSemiAutomaticMode(false);
  }
  if (uiPanel) {
    uiPanel.classList.toggle('auto-controls-open', semiAutomaticMode || fullAutomaticMode);
  }
  if (fullAutomaticButton) {
    fullAutomaticButton.classList.toggle('is-active', fullAutomaticMode);
    fullAutomaticButton.setAttribute('aria-pressed', fullAutomaticMode ? 'true' : 'false');
  }
  if (fullAutomaticControls) {
    fullAutomaticControls.classList.toggle('is-hidden', !fullAutomaticMode);
    if (fullAutomaticMode) {
      refreshRangeFills();
    }
  }
  if (fullAutomaticMode) {
    runFullAutoGeneration();
  }
}
if (semiAutomaticButton) {
  semiAutomaticButton.addEventListener('click', () => {
    setSemiAutomaticMode(!semiAutomaticMode);
  });
}
if (fullAutomaticButton) {
  fullAutomaticButton.addEventListener('click', () => {
    setFullAutomaticMode(!fullAutomaticMode);
  });
}
if (semiBuildSpeedSlider) {
  semiBuildSpeedSlider.addEventListener('input', (event) => {
    setSemiBuildRate(parseFloat(event.target.value));
  });
}
if (semiBuildStackSlider) {
  semiBuildStackSlider.addEventListener('input', (event) => {
    setSemiBuildStack(parseFloat(event.target.value));
  });
}
if (fullBuildSpeedSlider) {
  fullBuildSpeedSlider.addEventListener('input', (event) => {
    setFullBuildRate(parseFloat(event.target.value));
  });
}
if (fullOutlineCountSlider) {
  fullOutlineCountSlider.addEventListener('input', (event) => {
    setFullOutlineCount(parseFloat(event.target.value));
  });
}
if (fullOutlineSeedSlider) {
  fullOutlineSeedSlider.addEventListener('input', (event) => {
    setFullOutlineSeed(parseFloat(event.target.value));
  });
}

function setGroundEdgeVisible(on) {
  if (gridBorderGroup) {
    gridBorderGroup.traverse((obj) => {
      if (!(obj && obj.isLineSegments)) return;
      obj.visible = on;
      if (obj.material && typeof obj.material.opacity === 'number') {
        obj.material.opacity = on ? 0.45 : 0;
      }
    });
  }
  if (gridLines) {
    gridLines.visible = on;
    const mats = Array.isArray(gridLines.material) ? gridLines.material : [gridLines.material];
    mats.forEach((mat) => {
      mat.opacity = on ? 0.95 : 0;
    });
  }
}

function setWireframeVisible(on) {
  wireframeVisible = on;
  wireframeMaterial.opacity = wireframeVisible ? 0.35 : 0;
  blocks.forEach((state) => {
    if (state.wire) {
      state.wire.visible = wireframeVisible;
    }
  });
  setGroundEdgeVisible(wireframeVisible && gridVisible);
}
if (wireframeToggle) {
  wireframeToggle.addEventListener('change', (e) => {
    setWireframeVisible(Boolean(e.target.checked));
  });
}
function setGridVisible(on) {
  gridVisible = on;
  if (gridFillMesh) {
    gridFillMesh.visible = gridVisible;
  }
  if (groundCellGroup) {
    groundCellGroup.visible = gridVisible;
  }
  if (gridBorderGroup) {
    gridBorderGroup.visible = gridVisible;
  }
  setGroundEdgeVisible(wireframeVisible && gridVisible);
}
if (gridToggle) {
  gridToggle.addEventListener('change', (e) => {
    setGridVisible(Boolean(e.target.checked));
  });
}
function setRainVisible(on) {
  rainVisible = on;
  if (rainOverlay) {
    rainOverlay.style.display = rainVisible ? '' : 'none';
  }
}
if (rainToggle) {
  rainToggle.addEventListener('change', (e) => {
    setRainVisible(Boolean(e.target.checked));
  });
}
if (undoButton) {
  undoButton.addEventListener('click', () => {
    finalizeStrokeHistory();
    undoLast();
  });
}
if (redoButton) {
  redoButton.addEventListener('click', () => {
    finalizeStrokeHistory();
    redoLast();
  });
}
if (resetButton) {
  resetButton.addEventListener('click', () => {
    finalizeStrokeHistory();
    resetBlocks();
  });
}
if (exportButton) {
  exportButton.addEventListener('click', () => {
    finalizeStrokeHistory();
    exportBlocksToOBJ();
  });
}

function toggleColorPopover(forceState) {
  const next = typeof forceState === 'boolean' ? forceState : !colorPopoverOpen;
  const wasOpen = colorPopoverOpen;
  colorPopoverOpen = next;
  if (colorPopover) {
    colorPopover.classList.toggle('hidden', !next);
    colorPopover.classList.toggle('open', next);
    if (next) {
      syncColorControls();
    } else if (wasOpen) {
      const hex = currentHex();
      if (hex !== lastSavedColor) {
        addRecentColor(hex);
        lastSavedColor = hex;
      }
    }
  }
}
if (colorChip) {
  colorChip.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleColorPopover();
  });
}
function toggleInstructionsPopover(forceState) {
  const next = typeof forceState === 'boolean' ? forceState : !instructionsPopoverOpen;
  instructionsPopoverOpen = next;
  if (instructionsPopover) {
    instructionsPopover.classList.toggle('hidden', !next);
    instructionsPopover.classList.toggle('open', next);
  }
}
if (instructionsButton) {
  instructionsButton.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleInstructionsPopover();
  });
}
if (hueSlider && satSlider && lightSlider) {
  const onHslChange = () => {
    let rawHue = parseFloat(hueSlider.value);
    if (Number.isNaN(rawHue)) rawHue = lastHueInput || 0;
    rawHue = Math.min(Math.max(rawHue, 0), 360);
    lastHueInput = rawHue;
    let h = rawHue >= 360 ? 1 : rawHue / 360;
    let sRaw = Math.round(parseFloat(satSlider.value));
    if (Number.isNaN(sRaw)) sRaw = Math.round(hslState.s * 100);
    sRaw = Math.min(Math.max(sRaw, 0), 100);
    satSlider.value = sRaw;
    let s = sRaw / 100;

    let l = parseFloat(lightSlider.value) / 100;
    if (Number.isNaN(h)) h = hslState.h;
    if (Number.isNaN(s)) s = hslState.s;
    if (Number.isNaN(l)) l = hslState.l;
    // allow full desaturation (0) and full light range
    s = Math.max(0, s);
    l = Math.min(1, Math.max(0, l));
    const hslColor = tempHSLColor.setHSL(h, s, l);
    currentColor.copy(hslColor);
    syncColorControls({ h, s, l });
  };
  hueSlider.addEventListener('input', onHslChange);
  satSlider.addEventListener('input', onHslChange);
  lightSlider.addEventListener('input', onHslChange);
}
if (colorHexInput) {
  colorHexInput.addEventListener('input', (event) => {
    const val = event.target.value;
    if (/^#?[0-9a-fA-F]{6}$/.test(val)) {
      const normalized = val.startsWith('#') ? val : `#${val}`;
      setBlockColor(normalized);
    }
  });
}
if (swatches.length > 0) {
  swatches.forEach((btn, idx) => {
    btn.addEventListener('click', () => {
      const swatchColor = recentColors[idx] || btn.getAttribute('data-color') || '#ffffff';
      setBlockColor(swatchColor);
    });
  });
}
window.addEventListener('click', (event) => {
  if (colorPopoverOpen) {
    if (
      colorPopover &&
      !colorPopover.contains(event.target) &&
      colorChip &&
      !colorChip.contains(event.target)
    ) {
      toggleColorPopover(false);
    }
  }
  if (instructionsPopoverOpen) {
    if (
      instructionsPopover &&
      !instructionsPopover.contains(event.target) &&
      instructionsButton &&
      !instructionsButton.contains(event.target)
    ) {
      toggleInstructionsPopover(false);
    }
  }
});
window.addEventListener('keydown', (event) => {
  const targetEl = event.target;
  const tag = targetEl && targetEl.tagName ? targetEl.tagName.toLowerCase() : '';
  const inputType = targetEl && targetEl.type ? targetEl.type.toLowerCase() : '';
  const isTextInput =
    tag === 'textarea' ||
    (tag === 'input' &&
      !['range', 'checkbox', 'button', 'submit', 'color', 'hidden'].includes(inputType));
  const isEditableTarget = Boolean(targetEl && (targetEl.isContentEditable || isTextInput));
  const withCommand = event.ctrlKey || event.metaKey;
  const key = event.key.toLowerCase();
  const isUndoShortcut = withCommand && !event.shiftKey && !event.altKey && key === 'z';
  const isRedoShortcut = withCommand && !event.shiftKey && !event.altKey && key === 'y';

  if (!isEditableTarget && isUndoShortcut) {
    event.preventDefault();
    finalizeStrokeHistory();
    undoLast();
    return;
  }
  if (!isEditableTarget && isRedoShortcut) {
    event.preventDefault();
    finalizeStrokeHistory();
    redoLast();
    return;
  }

  if (event.key === 'Escape') {
    if (semiAutomaticMode) {
      setSemiAutomaticMode(false);
    }
    if (fullAutomaticMode) {
      setFullAutomaticMode(false);
    }
    if (colorPopoverOpen) toggleColorPopover(false);
    if (instructionsPopoverOpen) toggleInstructionsPopover(false);
  }
});
buildSlider.addEventListener('input', (event) => {
  setBuildRate(parseFloat(event.target.value));
});
if (stackSlider) {
  stackSlider.addEventListener('input', (event) => {
    setAddStack(parseFloat(event.target.value));
  });
}

// Panel dragging
const handles = [
  document.getElementById('ui-handle'),
  document.getElementById('ui-handle-bottom')
].filter(Boolean);
let dragActive = false;
const dragOffset = new THREE.Vector2();
function onHandleDown(event) {
  dragActive = true;
  uiActive = true;
  dragOffset.set(event.clientX - uiPanel.offsetLeft, event.clientY - uiPanel.offsetTop);
  event.currentTarget.setPointerCapture(event.pointerId);
  event.currentTarget.style.cursor = 'grabbing';
}
function onHandleMove(event) {
  if (!dragActive) return;
  const left = event.clientX - dragOffset.x;
  const top = event.clientY - dragOffset.y;
  uiPanel.style.left = `${left}px`;
  uiPanel.style.top = `${top}px`;
}
function onHandleUp(event) {
  dragActive = false;
  uiActive = false;
  event.currentTarget.releasePointerCapture(event.pointerId);
  event.currentTarget.style.cursor = 'grab';
}
handles.forEach((handleEl) => {
  handleEl.addEventListener('pointerdown', onHandleDown);
  handleEl.addEventListener('pointermove', onHandleMove);
  handleEl.addEventListener('pointerup', onHandleUp);
});

// Resize handling
window.addEventListener('resize', () => {
  const { innerWidth, innerHeight } = window;
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  resizeRainOverlay();
  refreshRangeFills();
});

// Animation loop
let lastTime = performance.now();
function updateAnimations(delta) {
  const damping = getAnimDamping(); // higher = snappier, tied to buildRate
  let matrixDirty = false;
  let colorDirty = false;
  for (let i = 0; i < blockStates.length; ) {
    const state = blockStates[i];
    const targetScale = state.removing ? 0 : state.desiredScale ?? getBlockScale();
    const next = THREE.MathUtils.damp(state.scale, targetScale, damping, delta);
    state.scale = Math.max(next, minScaleValue);

    if (state.removing && next <= 0.02) {
      removeBlockStateBySlot(i);
      matrixDirty = true;
      colorDirty = true;
      continue;
    }
    if (!state.removing && Math.abs(next - targetScale) < 0.0005) {
      state.scale = targetScale;
    }

    if (state.colorAnim) {
      const lerpRate = Math.max(1.2, buildRate * 0.6); // faster paint transition
      state.colorAnim.t = Math.min(1, state.colorAnim.t + delta * lerpRate);
      state.color.lerpColors(state.colorAnim.from, state.colorAnim.to, state.colorAnim.t);
      writeBlockStateColor(state);
      colorDirty = true;
      if (state.colorAnim.t >= 1 - 1e-4) {
        state.color.copy(state.colorAnim.to);
        state.colorAnim = null;
      }
    }

    writeBlockStateTransform(state);
    matrixDirty = true;
    i += 1;
  }
  if (matrixDirty) {
    blockMesh.instanceMatrix.needsUpdate = true;
  }
  if (colorDirty && blockMesh.instanceColor) {
    blockMesh.instanceColor.needsUpdate = true;
  }
  groundCellStates.forEach((cellState) => {
    if (!cellState || !cellState.material || !cellState.colorAnim) return;
    const lerpRate = Math.max(1.2, buildRate * 0.6); // same paint feel as block painting
    cellState.colorAnim.t = Math.min(1, cellState.colorAnim.t + delta * lerpRate);
    cellState.color.lerpColors(cellState.colorAnim.from, cellState.colorAnim.to, cellState.colorAnim.t);
    cellState.material.color.copy(cellState.color);
    if (cellState.colorAnim.t >= 1 - 1e-4) {
      cellState.color.copy(cellState.colorAnim.to);
      cellState.colorAnim = null;
    }
  });
  if (resetPending && blockStates.length === 0) {
    pushHistoryState(snapshotState(), true);
    strokeActive = false;
    actionDirty = false;
    resetPending = false;
    updateHistoryButtons();
  }
}

function tick() {
  const now = performance.now();
  const delta = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  updateSemiAutomaticBuild(now);
  updateAnimations(delta);
  updateRainOverlay(delta, now * 0.001);
  if (hoverDirty && !pointerState.down) {
    updateHoverTarget();
  }
  controls.update();
  renderer.render(scene, camera);
}
renderer.setAnimationLoop(tick);

// Initialize UI value and history
setGridSize(parseFloat(gridSlider.value));
setBlockGap(parseFloat(gapSlider.value) || 0.01);
setBuildRate(parseFloat(buildSlider.value));
setAddStack(parseFloat(stackSlider ? stackSlider.value : 1));
setSemiBuildRate(parseFloat(semiBuildSpeedSlider ? semiBuildSpeedSlider.value : 10));
setSemiBuildStack(parseFloat(semiBuildStackSlider ? semiBuildStackSlider.value : 1));
setFullBuildRate(parseFloat(fullBuildSpeedSlider ? fullBuildSpeedSlider.value : 10));
setFullOutlineCount(parseFloat(fullOutlineCountSlider ? fullOutlineCountSlider.value : 3));
setFullOutlineSeed(parseFloat(fullOutlineSeedSlider ? fullOutlineSeedSlider.value : 1));
// Initialize color from HSL defaults or input value
const activeBlockType =
  blockTypeButtons.find((btn) => btn.classList.contains('active')) || blockTypeButtons[0] || null;
if (activeBlockType) {
  setActiveBlockType(activeBlockType);
} else {
  const initialHex = colorInput && colorInput.value ? colorInput.value : '#67B4A8';
  setBlockColor(initialHex);
}
lastSavedColor = currentHex();
renderRecentColors();
setWireframeVisible(Boolean(wireframeToggle && wireframeToggle.checked));
setGridVisible(Boolean(gridToggle && gridToggle.checked));
setRainVisible(Boolean(rainToggle && rainToggle.checked));
setSemiAutomaticMode(false);
setFullAutomaticMode(false);
pushHistoryState(snapshotState());
