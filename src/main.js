import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import './style.css';

const container = document.getElementById('app');
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
const gridFillColor = new THREE.Color('#d2b48c');
const gridInnerBorderColor = new THREE.Color('#8d8d8d');
const gridOuterBorderColor = new THREE.Color('#4f4f4f');
let gridSize = 1.0;
let gridLines = null;
let gridFillMesh = null;
let gridBorderGroup = null;
let gridMesh = null;

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
const blockGroup = new THREE.Group();
scene.add(blockGroup);
const blockGeometry = new THREE.BoxGeometry(1, 1, 1);
const blockEdgesGeometry = new THREE.EdgesGeometry(blockGeometry);
const wireframeMaterial = new THREE.LineBasicMaterial({
  color: '#2b2b2b',
  transparent: true,
  opacity: 0.35,
  depthWrite: false
});
const baseBlockMaterialParams = {
  roughness: 0.35,
  metalness: 0.05
};
function makeBlockMaterial(color) {
  return new THREE.MeshStandardMaterial({
    color,
    ...baseBlockMaterialParams
  });
}
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
function snapshotState() {
  const entries = [];
  blocks.forEach((mesh) => {
    if (mesh.userData?.anim?.removing) return;
    entries.push({
      index: { ...mesh.userData.index },
      color: mesh.material.color.getHex()
    });
  });
  return { blocks: entries };
}
function applySnapshot(state) {
  if (!state) {
    blocks.forEach((mesh) => {
      const anim = mesh.userData.anim || {};
      anim.removing = true;
      mesh.userData.anim = anim;
    });
    return;
  }
  const target = new Map();
  state.blocks.forEach((entry) => {
    target.set(indexKey(entry.index), entry);
  });

  // Remove or update existing blocks
  blocks.forEach((mesh, key) => {
    const targetEntry = target.get(key);
    if (!targetEntry) {
      const anim = mesh.userData.anim || {};
      anim.removing = true;
      mesh.userData.anim = anim;
      return;
    }
    const anim = mesh.userData.anim || {};
    anim.removing = false;
    anim.desiredScale = getBlockScale();
    mesh.userData.anim = anim;
    const targetColor = new THREE.Color(targetEntry.color);
    if (!mesh.material.color.equals(targetColor)) {
      scheduleColorLerp(mesh, targetColor);
    }
    target.delete(key);
  });

  // Add new blocks that are in target but not currently present
  target.forEach((entry) => {
    const key = indexKey(entry.index);
    const material = makeBlockMaterial(new THREE.Color(entry.color));
    const mesh = new THREE.Mesh(blockGeometry, material);
    const wire = new THREE.LineSegments(blockEdgesGeometry, wireframeMaterial);
    wire.name = 'wireframe';
    wire.visible = wireframeVisible;
    mesh.add(wire);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.index = { ...entry.index };
    mesh.userData.key = key;
    mesh.userData.anim = { removing: false, desiredScale: getBlockScale() };
    mesh.scale.setScalar(minScaleValue);
    setPositionFromIndex(mesh.position, entry.index);
    blocks.set(key, mesh);
    blockGroup.add(mesh);
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
  if (!blocks.size) return;
  strokeActive = true;
  actionDirty = true;
  resetPending = true;
  blocks.forEach((mesh) => {
    const anim = mesh.userData.anim || {};
    anim.removing = true;
    mesh.userData.anim = anim;
  });
}
function exportBlocksToOBJ() {
  const basePos = blockGeometry.attributes.position?.array;
  const baseNorm = blockGeometry.attributes.normal?.array;
  const baseIndex = blockGeometry.index ? blockGeometry.index.array : null;
  if (!basePos || !baseNorm) return;
  const lines = ['# 260223_BuildingBlocks export'];
  let vertexOffset = 0;
  blocks.forEach((mesh) => {
    tempMatrix.compose(mesh.position, mesh.quaternion, mesh.scale);
    tempNormalMatrix.getNormalMatrix(tempMatrix);
    const { r, g, b } = mesh.material.color;
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
const addBlockColor = new THREE.Color('#ffffff');
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

function scheduleColorLerp(mesh, targetColor) {
  if (!mesh) return;
  if (!mesh.userData.colorAnim) {
    mesh.userData.colorAnim = {
      from: mesh.material.color.clone(),
      to: targetColor.clone(),
      t: 0
    };
  } else {
    mesh.userData.colorAnim.from.copy(mesh.material.color);
    mesh.userData.colorAnim.to.copy(targetColor);
    mesh.userData.colorAnim.t = 0;
  }
}

function addBlockAt(index) {
  const key = indexKey(index);
  if (blocks.has(key)) return;
  const material = makeBlockMaterial(addBlockColor.clone());
  const mesh = new THREE.Mesh(blockGeometry, material);
  const wire = new THREE.LineSegments(blockEdgesGeometry, wireframeMaterial);
  wire.name = 'wireframe';
  wire.visible = wireframeVisible;
  mesh.add(wire);
  mesh.scale.setScalar(minScaleValue);
  setPositionFromIndex(mesh.position, index);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.index = { ...index };
  mesh.userData.key = key;
  mesh.userData.anim = { removing: false, desiredScale: getBlockScale() };
  blocks.set(key, mesh);
  blockGroup.add(mesh);
  markHistoryChange();
}

function removeBlockAt(key) {
  const mesh = blocks.get(key);
  if (!mesh) return;
  const anim = mesh.userData.anim || {};
  anim.removing = true;
  mesh.userData.anim = anim;
  markHistoryChange();
}

function resnapBlocks() {
  blocks.forEach((mesh) => {
    const idx = mesh.userData.index;
    const anim = mesh.userData.anim || {};
    anim.desiredScale = getBlockScale();
    mesh.userData.anim = anim;
    setPositionFromIndex(mesh.position, idx);
    const wire = mesh.getObjectByName('wireframe');
    if (wire) {
      wire.visible = wireframeVisible;
      wire.material.opacity = wireframeVisible ? 0.35 : 0;
    }
  });
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

  if (isAltDown && pointerState.mode !== 'remove' && pointerState.mode !== 'paint') {
    setPreview(null, null);
    hoverDirty = false;
    return;
  }

  raycaster.setFromCamera(pointer, camera);
  hitBlocks.length = 0;
  hitPlane.length = 0;
  raycaster.intersectObjects(blockGroup.children, false, hitBlocks);
  raycaster.intersectObject(gridMesh, false, hitPlane);

  if (pointerState.mode === 'remove') {
    if (hitBlocks.length > 0) {
      const hit = hitBlocks[0];
      setPreview('remove', { ...hit.object.userData.index }, hit.object.userData.key);
    } else {
      setPreview(null, null);
    }
    hoverDirty = false;
    return;
  }

  if (pointerState.mode === 'paint') {
    if (hitBlocks.length > 0) {
      const hit = hitBlocks[0];
      hoverState.type = 'paint';
      hoverState.index = { ...hit.object.userData.index };
      hoverState.key = hit.object.userData.key;
      hoverState.addDirection = null;
      previewMesh.visible = false;
    } else {
      setPreview(null, null);
    }
    hoverDirty = false;
    return;
  }

  const sideAddOnly = isShiftDown;

  if (hitBlocks.length > 0) {
    const hit = hitBlocks[0];
    const baseIndex = hit.object.userData.index;
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
      const mesh = blocks.get(hoverState.key);
      if (mesh) {
        scheduleColorLerp(mesh, currentColor);
        markHistoryChange();
      }
      lastActionTime.paint = now;
    }
  }
}

renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

renderer.domElement.addEventListener('pointerdown', (event) => {
  if (uiActive) return;
  if (event.button === 0) {
    pointerState.down = true;
    if (event.altKey) {
      pointerState.mode = 'paint';
    } else if (event.ctrlKey) {
      pointerState.mode = 'remove';
    } else {
      pointerState.mode = 'add';
    }
    lastActionTime[pointerState.mode] = -Infinity; // allow immediate first action
    strokeActive = true;
    actionDirty = false;
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
const wireframeToggle = document.getElementById('wireframe-toggle');
const gridToggle = document.getElementById('grid-toggle');
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
const rangeInputs = Array.from(document.querySelectorAll('input[type="range"]'));

function updateRangeFill(el) {
  if (!el) return;
  const min = parseFloat(el.min ?? 0);
  const max = parseFloat(el.max ?? 100);
  const val = parseFloat(el.value ?? min);
  const pct = max === min ? 0 : ((val - min) / (max - min)) * 100;
  el.style.setProperty('--range-progress', `${pct}%`);
}
rangeInputs.forEach((el) => {
  updateRangeFill(el);
  el.addEventListener('input', () => updateRangeFill(el));
});

function setGridSize(value) {
  gridSize = value;
  rebuildGridMeshes();
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

function setWireframeVisible(on) {
  wireframeVisible = on;
  blocks.forEach((mesh) => {
    const wire = mesh.getObjectByName('wireframe');
    if (wire) {
      wire.visible = wireframeVisible;
      wire.material.opacity = wireframeVisible ? 0.35 : 0;
    }
  });
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
  if (gridBorderGroup) {
    gridBorderGroup.visible = gridVisible;
  }
  if (gridLines) {
    gridLines.visible = gridVisible;
  }
}
if (gridToggle) {
  gridToggle.addEventListener('change', (e) => {
    setGridVisible(Boolean(e.target.checked));
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
  if (event.key === 'Escape') {
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
});

// Animation loop
let lastTime = performance.now();
function updateAnimations(delta) {
  const damping = getAnimDamping(); // higher = snappier, tied to buildRate
  blockGroup.children.forEach((mesh) => {
    const anim = mesh.userData.anim;
    const colorAnim = mesh.userData.colorAnim;
    const targetScale = anim
      ? anim.removing
        ? 0
        : anim.desiredScale ?? getBlockScale()
      : getBlockScale();
    const next = THREE.MathUtils.damp(mesh.scale.x, targetScale, damping, delta);
    mesh.scale.setScalar(Math.max(next, minScaleValue));

    if (anim?.removing && next <= 0.02) {
      blockGroup.remove(mesh);
      blocks.delete(mesh.userData.key);
    } else if (anim && !anim.removing && Math.abs(next - targetScale) < 0.0005) {
      mesh.scale.setScalar(targetScale);
    }

    if (colorAnim) {
      const lerpRate = Math.max(1.2, buildRate * 0.6); // faster paint transition
      colorAnim.t = Math.min(1, colorAnim.t + delta * lerpRate);
      mesh.material.color.lerpColors(colorAnim.from, colorAnim.to, colorAnim.t);
      if (colorAnim.t >= 1 - 1e-4) {
        mesh.material.color.copy(colorAnim.to);
        delete mesh.userData.colorAnim;
      }
    }
  });
  if (resetPending && blockGroup.children.length === 0) {
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
  updateAnimations(delta);
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
pushHistoryState(snapshotState());
