import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MapControls } from "three/addons/controls/MapControls.js";

const HOUSE_ASSET_BASE = "../assets/models/kenney-town";
const HOUSE_ASSETS = [
  "wall-wood-door.glb",
  "wall-wood-window-small.glb",
  "wall-wood.glb",
  "roof-high.glb",
  "roof-high-window.glb",
  "chimney.glb",
  "lantern.glb"
];

function hashString(value) {
  let hash = 2166136261;
  for (const char of String(value || "")) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function toColor(value, fallback = "#ffffff") {
  return new THREE.Color(typeof value === "string" ? value : fallback);
}

function normalizePrototype(object3d) {
  const root = object3d.clone(true);
  root.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(root);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;

  root.position.x -= center.x;
  root.position.y -= box.min.y;
  root.position.z -= center.z;
  root.scale.multiplyScalar(1 / maxDim);

  root.traverse((child) => {
    if (!child.isMesh) {
      return;
    }
    child.castShadow = false;
    child.receiveShadow = false;
    child.frustumCulled = true;

    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      if (!material) {
        continue;
      }
      material.flatShading = true;
      if ("metalness" in material) {
        material.metalness = 0;
      }
      if ("roughness" in material) {
        material.roughness = 1;
      }
      material.needsUpdate = true;
    }
  });

  return root;
}

function irregularPoint(index, seed, baseRadius) {
  const goldenAngle = 2.399963229728653;
  const radialNoise = (((seed >> 4) % 1000) / 1000) - 0.5;
  const angleNoise = (((seed >> 12) % 1000) / 1000) - 0.5;
  const laneBias = index % 3 === 0 ? 1.2 : index % 3 === 1 ? -0.8 : 0.35;
  const angle = (index + 1) * goldenAngle + angleNoise * 0.42;
  const radius = baseRadius + Math.sqrt(index + 1) * 5.8 + radialNoise * 4.4;
  const x = Math.cos(angle) * (radius * 1.2) + Math.sin(angle * 0.48) * 5.2 + laneBias * 1.8;
  const z = Math.sin(angle) * (radius * 0.82) + Math.cos(angle * 0.72) * 4.7;
  return new THREE.Vector3(x, 0, z);
}

function separatePoint(candidate, existingPoints, minimumDistance) {
  const adjusted = candidate.clone();
  for (let iteration = 0; iteration < 8; iteration += 1) {
    let moved = false;
    for (const existing of existingPoints) {
      const delta = adjusted.clone().sub(existing);
      const distance = delta.length();
      if (distance > 0.001 && distance < minimumDistance) {
        delta.normalize().multiplyScalar((minimumDistance - distance) * 0.7);
        adjusted.add(delta);
        moved = true;
      }
    }
    if (!moved) {
      break;
    }
  }
  return adjusted;
}

function drawRoundedRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function createNameTagSprite(text, accent) {
  const canvas = document.createElement("canvas");
  canvas.width = 384;
  canvas.height = 96;
  const context = canvas.getContext("2d");
  const accentColor = typeof accent === "string" ? accent : "#76f0ff";

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "rgba(10, 18, 38, 0.78)";
  context.strokeStyle = "rgba(255, 255, 255, 0.22)";
  context.lineWidth = 2;
  drawRoundedRect(context, 10, 14, 364, 68, 30);
  context.fill();
  context.stroke();

  context.fillStyle = accentColor;
  context.beginPath();
  context.arc(42, 48, 10, 0, Math.PI * 2);
  context.fill();

  context.font = '600 28px "Geist", "Segoe UI", sans-serif';
  context.textBaseline = "middle";
  context.fillStyle = "#eef5ff";
  context.fillText(String(text || "Agent"), 66, 48);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    depthTest: false
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(4.8, 1.2, 1);
  sprite.renderOrder = 10;
  return sprite;
}

function buildLots(agentIds) {
  const lots = new Map();
  const others = agentIds.filter((id) => id !== "main").sort((left, right) => left.localeCompare(right));
  const occupied = [];
  const districts = [
    new THREE.Vector3(-22, 0, -8),
    new THREE.Vector3(21, 0, -11),
    new THREE.Vector3(-30, 0, 13),
    new THREE.Vector3(26, 0, 16),
    new THREE.Vector3(-9, 0, 28),
    new THREE.Vector3(10, 0, 32)
  ];

  lots.set("main", {
    house: new THREE.Vector3(-1.2, 0, 5.8),
    idle: new THREE.Vector3(-1.2, 0, 10.3),
    work: new THREE.Vector3(-1.2, 0, 7.7),
    quest: new THREE.Vector3(-0.4, 0, 2.6),
    heading: Math.PI
  });
  occupied.push(new THREE.Vector3(-1.2, 0, 5.8));

  for (let index = 0; index < others.length; index += 1) {
    const agentId = others[index];
    const seed = hashString(agentId);
    const district = districts[(index + (seed % districts.length)) % districts.length];
    const orbit = irregularPoint(index, seed, 4.8);
    const laneOffsetX = ((((seed >> 8) % 1000) / 1000) - 0.5) * 10;
    const laneOffsetZ = ((((seed >> 18) % 1000) / 1000) - 0.5) * 7.6;
    let candidate = district.clone().add(new THREE.Vector3(orbit.x * 0.36 + laneOffsetX, 0, orbit.z * 0.28 + laneOffsetZ));

    if (candidate.length() < 16) {
      candidate.setLength(16 + (((seed >> 5) % 1000) / 1000) * 6);
    }

    candidate = separatePoint(candidate, occupied, 9.8);
    occupied.push(candidate.clone());

    const inward = new THREE.Vector3().sub(candidate).normalize();
    const tangent = new THREE.Vector3(-inward.z, 0, inward.x);
    const side = ((seed >> 7) & 1) ? 1 : -1;
    const porchDistance = 2.8 + (((seed >> 9) % 1000) / 1000) * 1.2;
    const questLift = 0.32 + (((seed >> 14) % 1000) / 1000) * 0.12;

    lots.set(agentId, {
      house: candidate,
      idle: candidate.clone().addScaledVector(inward, porchDistance),
      work: candidate.clone().addScaledVector(inward, 1.55).addScaledVector(tangent, side * 0.58),
      quest: candidate.clone().multiplyScalar(questLift).addScaledVector(tangent, side * 0.7),
      heading: Math.atan2(-inward.x, -inward.z)
    });
  }

  return lots;
}

export class JarvisWorldScene {
  constructor(container, options = {}) {
    this.container = container;
    this.onAgentSelect = typeof options.onAgentSelect === "function" ? options.onAgentSelect : null;
    this.manifest = null;
    this.state = null;
    this.isAdmin = false;
    this.selectedAgentId = null;
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.controls = null;
    this.clock = new THREE.Clock();
    this.assetLoader = new GLTFLoader();
    this.assetLibrary = new Map();
    this.geometryCache = new Map();
    this.materialCache = new Map();
    this.agentActors = new Map();
    this.homeGroups = new Map();
    this.pathGroup = null;
    this.taskOrbs = [];
    this.pickTargets = [];
    this.lotMap = new Map();
    this.villageSignature = "";
    this.worldRadius = 58;
    this.pointerState = {
      active: false,
      pointerId: null,
      button: 0,
      startX: 0,
      startY: 0,
      moved: false
    };
    this.gestureState = {
      active: false,
      lastScale: 1,
      lastRotation: 0
    };
    this.cameraDefaults = {
      azimuth: 0.48,
      elevation: 0.62,
      distance: 47,
      target: new THREE.Vector3(0, 3.4, 4)
    };
    this.cameraBounds = {
      minX: -38,
      maxX: 38,
      minZ: -34,
      maxZ: 46,
      targetY: 3.4
    };
    this.centerWorkTarget = new THREE.Vector3(0, 0, -7.4);
    this.scratch = {
      vectorA: new THREE.Vector3(),
      vectorB: new THREE.Vector3(),
      vectorC: new THREE.Vector3(),
      pointer: new THREE.Vector2(),
      matrix: new THREE.Matrix4(),
      quaternion: new THREE.Quaternion(),
      euler: new THREE.Euler(),
      scale: new THREE.Vector3()
    };
    this.raycaster = new THREE.Raycaster();

    this.handleResize = this.handleResize.bind(this);
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
    this.handleWheel = this.handleWheel.bind(this);
    this.handleGestureStart = this.handleGestureStart.bind(this);
    this.handleGestureChange = this.handleGestureChange.bind(this);
    this.handleGestureEnd = this.handleGestureEnd.bind(this);
    this.preventContextMenu = this.preventContextMenu.bind(this);
  }

  getDesiredPixelRatio() {
    const ratio = window.devicePixelRatio || 1;
    if (ratio >= 2.5) {
      return 1.15;
    }
    if (ratio >= 1.7) {
      return 1.25;
    }
    return Math.min(ratio, 1.4);
  }

  async init(manifest) {
    this.manifest = manifest;

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance"
    });
    this.renderer.setPixelRatio(this.getDesiredPixelRatio());
    this.renderer.setSize(this.container.clientWidth || window.innerWidth, this.container.clientHeight || window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = false;
    this.renderer.setClearAlpha(0);
    this.container.innerHTML = "";
    this.container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.touchAction = "none";

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog("#6f8fb0", 38, 132);

    this.camera = new THREE.PerspectiveCamera(
      40,
      (this.container.clientWidth || window.innerWidth) / (this.container.clientHeight || window.innerHeight),
      0.1,
      220
    );
    this.setInitialCameraPose();

    this.addLights();
    this.addStaticEnvironment();
    await this.preloadAssets();
    this.attachControls();
    this.handleResize();
    this.animate();
  }

  getGeometry(key, factory) {
    if (!this.geometryCache.has(key)) {
      this.geometryCache.set(key, factory());
    }
    return this.geometryCache.get(key);
  }

  getMaterial(key, factory) {
    if (!this.materialCache.has(key)) {
      this.materialCache.set(key, factory());
    }
    return this.materialCache.get(key);
  }

  makeStandardMaterial(color) {
    const hex = toColor(color).getHexString();
    return this.getMaterial(`std:${hex}`, () => new THREE.MeshStandardMaterial({
      color: `#${hex}`,
      roughness: 1,
      metalness: 0,
      flatShading: true
    }));
  }

  makeBasicMaterial(color, opacity = 1) {
    const key = `basic:${toColor(color).getHexString()}:${opacity}`;
    return this.getMaterial(key, () => new THREE.MeshBasicMaterial({
      color,
      transparent: opacity < 1,
      opacity
    }));
  }

  addLights() {
    const hemi = new THREE.HemisphereLight("#d8f3ff", "#58704c", 1.75);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight("#ffe7ba", 2.2);
    sun.position.set(24, 28, 18);
    this.scene.add(sun);

    const fill = new THREE.DirectionalLight("#76d5ff", 0.7);
    fill.position.set(-18, 14, -16);
    this.scene.add(fill);
  }

  addStaticEnvironment() {
    const island = new THREE.Group();

    const base = new THREE.Mesh(
      this.getGeometry("island-base", () => new THREE.CylinderGeometry(48, 60, 9.4, 14)),
      this.makeStandardMaterial("#3f5b4b")
    );
    base.position.y = -4.8;
    island.add(base);

    const shelf = new THREE.Mesh(
      this.getGeometry("island-shelf", () => new THREE.CylinderGeometry(51, 54, 2.1, 14)),
      this.makeStandardMaterial("#5e7a5e")
    );
    shelf.position.y = -1.05;
    island.add(shelf);

    const lawn = new THREE.Mesh(
      this.getGeometry("island-lawn", () => new THREE.CylinderGeometry(43.5, 46, 1.2, 14)),
      this.makeStandardMaterial("#7ebc69")
    );
    lawn.position.y = 0.6;
    island.add(lawn);

    const plaza = new THREE.Mesh(
      this.getGeometry("plaza-outer", () => new THREE.CylinderGeometry(6.8, 7.2, 0.3, 24)),
      this.makeStandardMaterial("#d8dce3")
    );
    plaza.position.y = 1.02;
    island.add(plaza);

    const innerPlaza = new THREE.Mesh(
      this.getGeometry("plaza-inner", () => new THREE.CylinderGeometry(3.6, 3.8, 0.18, 24)),
      this.makeStandardMaterial("#f5f8fd")
    );
    innerPlaza.position.y = 1.16;
    island.add(innerPlaza);

    const ring = new THREE.Mesh(
      this.getGeometry("plaza-ring", () => new THREE.TorusGeometry(17.2, 0.18, 10, 80)),
      this.makeStandardMaterial("#d8c39a")
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.98;
    island.add(ring);

    const innerRing = new THREE.Mesh(
      this.getGeometry("inner-ring", () => new THREE.TorusGeometry(11.2, 0.14, 10, 72)),
      this.makeStandardMaterial("#e6d8b9")
    );
    innerRing.rotation.x = Math.PI / 2;
    innerRing.position.y = 1.01;
    island.add(innerRing);

    const centralHub = new THREE.Group();
    const hubBase = new THREE.Mesh(
      this.getGeometry("hub-base", () => new THREE.CylinderGeometry(2.2, 2.7, 1.05, 8)),
      this.makeStandardMaterial("#889ecc")
    );
    hubBase.position.y = 1.62;
    centralHub.add(hubBase);

    const hubGlass = new THREE.Mesh(
      this.getGeometry("hub-glass", () => new THREE.SphereGeometry(1.68, 20, 20)),
      this.getMaterial("hub-glass-material", () => new THREE.MeshPhysicalMaterial({
        color: "#b7efff",
        transparent: true,
        opacity: 0.54,
        roughness: 0.12,
        transmission: 0.38
      }))
    );
    hubGlass.position.y = 3.34;
    centralHub.add(hubGlass);

    const hubRing = new THREE.Mesh(
      this.getGeometry("hub-ring", () => new THREE.TorusGeometry(2.18, 0.14, 8, 24)),
      this.makeStandardMaterial("#80f2ff")
    );
    hubRing.rotation.x = Math.PI / 2;
    hubRing.position.y = 2.18;
    centralHub.add(hubRing);
    island.add(centralHub);

    island.updateMatrixWorld(true);
    island.traverse((child) => {
      if (child !== hubGlass && child !== hubRing) {
        child.matrixAutoUpdate = false;
        child.updateMatrix();
      }
    });

    this.scene.add(island);
    this.addRoadNetwork();
    this.addDecor();
    this.addQuestConsole();
  }

  addRoadNetwork() {
    const roadGroup = new THREE.Group();
    const segments = [
      { x: 0, z: -12.6, width: 6.4, depth: 21.2, rotation: 0 },
      { x: -15.8, z: -5.4, width: 4.8, depth: 22.8, rotation: 0.3 },
      { x: 18.4, z: -5.2, width: 4.8, depth: 21.6, rotation: -0.38 },
      { x: -24.2, z: 15.6, width: 4.9, depth: 19.8, rotation: -0.16 },
      { x: 23.8, z: 17.2, width: 5.2, depth: 21.4, rotation: 0.2 },
      { x: -3.4, z: 28.8, width: 5.1, depth: 16.8, rotation: 0.14 },
      { x: 12.6, z: 30.4, width: 4.7, depth: 15.8, rotation: -0.2 }
    ];

    for (const segment of segments) {
      const road = new THREE.Mesh(
        this.getGeometry(`road:${segment.width}:${segment.depth}`, () => new THREE.BoxGeometry(segment.width, 0.12, segment.depth)),
        this.makeStandardMaterial("#cdb188")
      );
      road.position.set(segment.x, 1.0, segment.z);
      road.rotation.y = segment.rotation;
      roadGroup.add(road);
    }

    roadGroup.traverse((child) => {
      child.matrixAutoUpdate = false;
      child.updateMatrix();
    });
    this.scene.add(roadGroup);
  }

  addDecor() {
    const trunkGeometry = this.getGeometry("tree-trunk", () => new THREE.CylinderGeometry(0.14, 0.18, 1.2, 5));
    const crownGeometry = this.getGeometry("tree-crown", () => new THREE.ConeGeometry(0.92, 1.8, 6));
    const rockGeometry = this.getGeometry("rock", () => new THREE.IcosahedronGeometry(0.55, 0));

    const treeCount = 46;
    const trunkMesh = new THREE.InstancedMesh(trunkGeometry, this.makeStandardMaterial("#71533a"), treeCount);
    const crownMesh = new THREE.InstancedMesh(crownGeometry, this.makeStandardMaterial("#70b36f"), treeCount);
    const crownMeshAlt = new THREE.InstancedMesh(crownGeometry, this.makeStandardMaterial("#5f9962"), treeCount);
    trunkMesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    crownMesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    crownMeshAlt.instanceMatrix.setUsage(THREE.StaticDrawUsage);

    const matrix = this.scratch.matrix;
    const quaternion = this.scratch.quaternion;
    const scale = this.scratch.scale;
    let normalIndex = 0;
    let altIndex = 0;

    for (let index = 0; index < treeCount; index += 1) {
      const angle = (index / treeCount) * Math.PI * 2 + (index % 2 === 0 ? 0.05 : -0.08);
      const radius = 33 + (index % 7) * 2.4;
      const x = Math.cos(angle) * (radius * 1.15) + Math.sin(angle * 1.8) * 1.8;
      const z = Math.sin(angle) * (radius * 0.9) + Math.cos(angle * 1.4) * 2.2;

      quaternion.setFromEuler(this.scratch.euler.set(0, angle, 0));
      scale.set(1, 1, 1);
      matrix.compose(new THREE.Vector3(x, 1.15, z), quaternion, scale);
      trunkMesh.setMatrixAt(index, matrix);

      scale.setScalar(1 + (index % 3) * 0.15);
      matrix.compose(new THREE.Vector3(x, 2.25, z), quaternion, scale);
      if (index % 4 === 0) {
        crownMeshAlt.setMatrixAt(altIndex, matrix);
        altIndex += 1;
      } else {
        crownMesh.setMatrixAt(normalIndex, matrix);
        normalIndex += 1;
      }
    }
    trunkMesh.instanceMatrix.needsUpdate = true;
    crownMesh.instanceMatrix.needsUpdate = true;
    crownMeshAlt.instanceMatrix.needsUpdate = true;
    crownMesh.count = normalIndex;
    crownMeshAlt.count = altIndex;

    const rockCount = 28;
    const rockMesh = new THREE.InstancedMesh(rockGeometry, this.makeStandardMaterial("#7f857f"), rockCount);
    rockMesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    for (let index = 0; index < rockCount; index += 1) {
      const angle = (index / rockCount) * Math.PI * 2 + 0.24;
      const radius = 38 + (index % 4) * 2.2;
      const x = Math.cos(angle) * (radius * 1.08);
      const z = Math.sin(angle) * (radius * 0.88);
      quaternion.setFromEuler(this.scratch.euler.set(index * 0.37, index * 0.61, index * 0.19));
      scale.setScalar(0.7 + (index % 4) * 0.15);
      matrix.compose(new THREE.Vector3(x, 1.22, z), quaternion, scale);
      rockMesh.setMatrixAt(index, matrix);
    }
    rockMesh.instanceMatrix.needsUpdate = true;

    this.scene.add(trunkMesh);
    this.scene.add(crownMesh);
    this.scene.add(crownMeshAlt);
    this.scene.add(rockMesh);
  }

  addQuestConsole() {
    const consoleGroup = new THREE.Group();
    consoleGroup.position.set(0, 1.1, -7.1);

    const base = new THREE.Mesh(
      this.getGeometry("quest-base", () => new THREE.CylinderGeometry(1.45, 1.74, 0.56, 6)),
      this.makeStandardMaterial("#7588b3")
    );
    base.position.y = 0.38;
    consoleGroup.add(base);

    const prism = new THREE.Mesh(
      this.getGeometry("quest-prism", () => new THREE.OctahedronGeometry(0.82, 0)),
      this.makeStandardMaterial("#7cf5ff")
    );
    prism.position.y = 1.52;
    consoleGroup.add(prism);

    this.questConsole = consoleGroup;
    this.scene.add(consoleGroup);
  }

  async preloadAssets() {
    const entries = await Promise.all(HOUSE_ASSETS.map(async (name) => {
      try {
        const model = await this.loadModel(`${HOUSE_ASSET_BASE}/${name}`);
        return [name, normalizePrototype(model.scene)];
      } catch {
        return null;
      }
    }));

    for (const entry of entries) {
      if (entry) {
        this.assetLibrary.set(entry[0], entry[1]);
      }
    }
  }

  loadModel(url) {
    return new Promise((resolve, reject) => {
      this.assetLoader.load(url, resolve, undefined, reject);
    });
  }

  cloneAsset(name, targetSize, extra = {}) {
    const source = this.assetLibrary.get(name);
    if (!source) {
      return null;
    }
    const clone = source.clone(true);
    clone.scale.multiplyScalar(targetSize);
    if (extra.rotation) {
      clone.rotation.set(extra.rotation.x || 0, extra.rotation.y || 0, extra.rotation.z || 0);
    }
    if (extra.position) {
      clone.position.copy(extra.position);
    }
    clone.traverse((child) => {
      if (child.isMesh) {
        child.frustumCulled = true;
      }
    });
    return clone;
  }

  rebuildVillage(agentList) {
    for (const actor of this.agentActors.values()) {
      this.scene.remove(actor.group);
      this.scene.remove(actor.shadow);
      if (actor.activity) {
        this.scene.remove(actor.activity);
      }
      if (actor.label) {
        this.scene.remove(actor.label);
        actor.label.material.map?.dispose();
        actor.label.material.dispose();
      }
      if (actor.selection) {
        this.scene.remove(actor.selection);
        actor.selection.material.dispose();
      }
    }
    this.agentActors.clear();
    this.pickTargets = [];

    for (const home of this.homeGroups.values()) {
      this.scene.remove(home);
    }
    this.homeGroups.clear();

    this.lotMap = buildLots(agentList.map((agent) => agent.id));
    if (this.pathGroup) {
      this.scene.remove(this.pathGroup);
    }
    this.pathGroup = new THREE.Group();
    this.pathGroup.name = "agent-paths";
    this.scene.add(this.pathGroup);

    for (const agent of agentList) {
      const lot = this.lotMap.get(agent.id);
      const homeGroup = this.createHome(agent, lot);
      this.homeGroups.set(agent.id, homeGroup);
      this.scene.add(homeGroup);

      const actor = this.createGnome(agent, lot);
      this.agentActors.set(agent.id, actor);
      this.scene.add(actor.shadow);
      this.scene.add(actor.group);
      this.scene.add(actor.activity);
      this.scene.add(actor.label);
      this.scene.add(actor.selection);
      this.pickTargets.push(...actor.pickTargets);
    }

    for (const [agentId, lot] of this.lotMap.entries()) {
      if (agentId === "main") {
        continue;
      }
      this.addPathSegment(this.pathGroup, new THREE.Vector3(0, 1.03, -6.8), new THREE.Vector3(lot.quest.x, 1.03, lot.quest.z), 0.82);
      this.addPathSegment(this.pathGroup, new THREE.Vector3(lot.quest.x, 1.03, lot.quest.z), new THREE.Vector3(lot.idle.x, 1.03, lot.idle.z), 0.68);
    }

    this.setSelectedAgent(this.selectedAgentId);
  }

  addPathSegment(group, start, end, width) {
    const delta = this.scratch.vectorC.copy(end).sub(start);
    const length = Math.max(delta.length(), 0.1);
    const segment = new THREE.Mesh(
      this.getGeometry(`path:${width}:${Math.round(length * 10) / 10}`, () => new THREE.BoxGeometry(width, 0.08, length)),
      this.makeStandardMaterial("#d3bc93")
    );
    segment.position.copy(start).add(end).multiplyScalar(0.5);
    segment.rotation.y = Math.atan2(delta.x, delta.z);
    segment.matrixAutoUpdate = false;
    segment.updateMatrix();
    group.add(segment);
  }

  createHome(agent, lot) {
    const manifestEntry = this.manifest?.agents?.[agent.id];
    const seed = hashString(agent.id);
    const house = new THREE.Group();
    house.position.copy(lot.house);
    house.rotation.y = lot.heading;

    const padRadius = agent.id === "main" ? 3.8 : 3.0;
    const pad = new THREE.Mesh(
      this.getGeometry(`pad:${padRadius}`, () => new THREE.CylinderGeometry(padRadius, padRadius * 1.08, 0.42, 8)),
      this.makeStandardMaterial("#ceb68c")
    );
    pad.position.y = 0.2;
    house.add(pad);

    const wallColor = seed % 2 === 0 ? "#f1ede2" : "#ddd7cb";
    const trimColor = seed % 3 === 0 ? "#8f5b3b" : "#6f4e3a";
    const roofColor = seed % 4 === 0 ? "#8f5d50" : seed % 4 === 1 ? "#6d5b9e" : seed % 4 === 2 ? "#8b6f46" : "#587b97";
    const width = agent.id === "main" ? 5.6 : 4.4;
    const height = agent.id === "main" ? 3.5 : 2.8;
    const depth = agent.id === "main" ? 5.1 : 3.9;

    const body = new THREE.Mesh(
      this.getGeometry(`body:${width}:${height}:${depth}`, () => new THREE.BoxGeometry(width, height, depth)),
      this.makeStandardMaterial(wallColor)
    );
    body.position.y = height / 2 + 0.65;
    house.add(body);

    const trim = new THREE.Mesh(
      this.getGeometry(`trim:${width}:${depth}`, () => new THREE.BoxGeometry(width + 0.26, 0.26, depth + 0.24)),
      this.makeStandardMaterial(trimColor)
    );
    trim.position.y = body.position.y - height / 2 - 0.12;
    house.add(trim);

    const roofBase = new THREE.Mesh(
      this.getGeometry(`roof-cone:${agent.id === "main" ? "main" : "small"}`, () => new THREE.ConeGeometry(agent.id === "main" ? 4.4 : 3.4, agent.id === "main" ? 2.7 : 2.1, 4)),
      this.makeStandardMaterial(roofColor)
    );
    roofBase.rotation.y = Math.PI / 4;
    roofBase.position.y = body.position.y + height / 2 + 0.96;
    house.add(roofBase);

    const roofModel = this.cloneAsset(seed % 3 === 0 ? "roof-high-window.glb" : "roof-high.glb", agent.id === "main" ? 5.0 : 3.9, {
      position: new THREE.Vector3(0, roofBase.position.y - 0.2, 0)
    });
    if (roofModel) {
      roofModel.rotation.y = Math.PI;
      house.add(roofModel);
    }

    const doorModel = this.cloneAsset("wall-wood-door.glb", agent.id === "main" ? 1.72 : 1.36, {
      position: new THREE.Vector3(0, 1.02, depth / 2 + 0.04)
    });
    if (doorModel) {
      house.add(doorModel);
    }

    const windowScale = agent.id === "main" ? 1.18 : 1;
    const windowY = body.position.y + 0.18;
    const leftWindow = this.cloneAsset("wall-wood-window-small.glb", windowScale, {
      position: new THREE.Vector3(-width / 2 - 0.03, windowY, 0),
      rotation: new THREE.Euler(0, Math.PI / 2, 0)
    });
    const rightWindow = this.cloneAsset("wall-wood-window-small.glb", windowScale, {
      position: new THREE.Vector3(width / 2 + 0.03, windowY, 0),
      rotation: new THREE.Euler(0, -Math.PI / 2, 0)
    });
    if (leftWindow) {
      house.add(leftWindow);
    }
    if (rightWindow) {
      house.add(rightWindow);
    }

    const chimney = this.cloneAsset("chimney.glb", agent.id === "main" ? 0.96 : 0.7, {
      position: new THREE.Vector3(0.92, roofBase.position.y + 0.46, -0.28)
    });
    if (chimney) {
      house.add(chimney);
    }

    const lantern = this.cloneAsset("lantern.glb", 0.82, {
      position: new THREE.Vector3(-1.42, 1.62, depth / 2 + 0.18)
    });
    if (lantern) {
      house.add(lantern);
    }

    const glow = new THREE.Mesh(
      this.getGeometry(`glow:${agent.id === "main" ? "main" : "small"}`, () => new THREE.SphereGeometry(agent.id === "main" ? 0.44 : 0.3, 12, 12)),
      new THREE.MeshBasicMaterial({
        color: manifestEntry?.palette?.[1] || roofColor,
        transparent: true,
        opacity: 0.28
      })
    );
    glow.position.set(0, roofBase.position.y + 0.5, 0);
    house.add(glow);
    house.userData.glow = glow;

    house.updateMatrixWorld(true);
    house.traverse((child) => {
      if (child !== glow) {
        child.matrixAutoUpdate = false;
        child.updateMatrix();
      }
    });

    return house;
  }

  createGnome(agent, lot) {
    const manifestEntry = this.manifest?.agents?.[agent.id];
    const seed = hashString(agent.id);
    const hatColor = Array.isArray(manifestEntry?.palette) ? manifestEntry.palette[1] : ["#dbb066", "#6aa7df", "#d76fae", "#77c783", "#7d69d8"][seed % 5];
    const coatColor = Array.isArray(manifestEntry?.palette) ? manifestEntry.palette[0] : ["#fff3dd", "#f0f4ff", "#e7fff5", "#fff1f6", "#f7ffe6"][seed % 5];
    const displayName = manifestEntry?.displayName || agent.name || agent.id;

    const group = new THREE.Group();
    group.position.copy(lot.idle);

    const hat = new THREE.Mesh(
      this.getGeometry("gnome-hat", () => new THREE.ConeGeometry(0.42, 0.92, 7)),
      this.makeStandardMaterial(hatColor)
    );
    hat.position.y = 1.62;
    group.add(hat);

    const head = new THREE.Mesh(
      this.getGeometry("gnome-head", () => new THREE.SphereGeometry(0.32, 10, 10)),
      this.makeStandardMaterial("#f6d8bc")
    );
    head.position.y = 1.18;
    group.add(head);

    const beard = new THREE.Mesh(
      this.getGeometry("gnome-beard", () => new THREE.ConeGeometry(0.28, 0.58, 6)),
      this.makeStandardMaterial("#f4e9d7")
    );
    beard.position.set(0, 0.88, 0.08);
    beard.rotation.x = Math.PI;
    group.add(beard);

    const body = new THREE.Mesh(
      this.getGeometry("gnome-body", () => new THREE.CapsuleGeometry(0.34, 0.76, 4, 8)),
      this.makeStandardMaterial(coatColor)
    );
    body.position.y = 0.64;
    group.add(body);

    const nose = new THREE.Mesh(
      this.getGeometry("gnome-nose", () => new THREE.SphereGeometry(0.08, 8, 8)),
      this.makeStandardMaterial("#f0c4a5")
    );
    nose.position.set(0, 1.08, 0.28);
    group.add(nose);

    const shadow = new THREE.Mesh(
      this.getGeometry("gnome-shadow", () => new THREE.CircleGeometry(0.46, 16)),
      this.makeBasicMaterial("#0a1020", 0.18)
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(lot.idle.x, 1.02, lot.idle.z);

    const activity = new THREE.Mesh(
      this.getGeometry("gnome-activity", () => new THREE.TorusGeometry(0.54, 0.04, 8, 20)),
      new THREE.MeshBasicMaterial({
        color: hatColor,
        transparent: true,
        opacity: 0.88
      })
    );
    activity.rotation.x = Math.PI / 2;
    activity.position.set(lot.idle.x, 2.48, lot.idle.z);
    activity.visible = false;

    const label = createNameTagSprite(displayName, hatColor);
    label.position.set(lot.idle.x, 4.1, lot.idle.z);

    const selection = new THREE.Mesh(
      this.getGeometry("gnome-selection", () => new THREE.TorusGeometry(0.7, 0.04, 8, 28)),
      new THREE.MeshBasicMaterial({
        color: hatColor,
        transparent: true,
        opacity: 0.95
      })
    );
    selection.rotation.x = Math.PI / 2;
    selection.position.set(lot.idle.x, 1.08, lot.idle.z);
    selection.visible = false;

    const pickTargets = [];
    group.traverse((child) => {
      if (!child.isMesh) {
        return;
      }
      child.userData.agentId = agent.id;
      pickTargets.push(child);
    });

    return {
      id: agent.id,
      group,
      shadow,
      activity,
      label,
      selection,
      pickTargets,
      phase: (seed % 1000) / 1000,
      target: lot.idle.clone()
    };
  }

  updateTaskOrbs(tasks) {
    while (this.taskOrbs.length < 5) {
      const orb = new THREE.Mesh(
        this.getGeometry("task-orb", () => new THREE.IcosahedronGeometry(0.2, 0)),
        this.makeBasicMaterial("#8ff5ff", 0.85)
      );
      this.taskOrbs.push(orb);
      this.scene.add(orb);
    }

    const activeTasks = (tasks || []).filter((task) => task.status === "running").slice(0, 5);
    this.taskOrbs.forEach((orb, index) => {
      orb.visible = index < activeTasks.length;
      if (!orb.visible) {
        return;
      }
      const angle = (index / Math.max(activeTasks.length, 1)) * Math.PI * 2;
      orb.position.set(Math.cos(angle) * 1.8, 2.85 + index * 0.14, -7.1 + Math.sin(angle) * 1.3);
    });
  }

  setState(state, isAdmin) {
    this.state = state;
    this.isAdmin = isAdmin;

    const agents = [...(state.agents || [])].sort((left, right) => {
      if (left.id === "main") {
        return -1;
      }
      if (right.id === "main") {
        return 1;
      }
      return left.id.localeCompare(right.id);
    });

    const signature = agents.map((agent) => agent.id).join("|");
    if (signature !== this.villageSignature) {
      this.villageSignature = signature;
      this.rebuildVillage(agents);
    }

    for (const agent of agents) {
      const actor = this.agentActors.get(agent.id);
      const lot = this.lotMap.get(agent.id);
      const home = this.homeGroups.get(agent.id);
      if (!actor || !lot || !home) {
        continue;
      }

      let target = lot.idle.clone();

      if (agent.id === "main") {
        if (agent.status === "moving" && agent.targetAgentId && this.lotMap.has(agent.targetAgentId)) {
          target = this.lotMap.get(agent.targetAgentId).quest.clone();
        } else if (agent.status === "working") {
          target = lot.work.clone();
        }
      } else if (agent.status === "working" && agent.motionTargetId === "quest-board") {
        target = this.centerWorkTarget.clone();
      } else if (agent.status === "working") {
        target = lot.work.clone();
      } else if (agent.status === "moving") {
        target = lot.quest.clone();
      }

      actor.target.copy(target);
      actor.activity.visible = agent.status === "working";
      actor.activity.material.opacity = agent.status === "offline" ? 0.12 : 0.88;
      actor.label.material.opacity = agent.status === "offline" ? 0.46 : 0.98;

      const glow = home.userData.glow;
      if (glow) {
        glow.material.opacity = agent.status === "working" ? 0.44 : agent.status === "moving" ? 0.3 : 0.16;
      }
      home.position.copy(lot.house);
      home.rotation.y = lot.heading;
    }

    this.updateTaskOrbs(state.tasks || []);
    this.setSelectedAgent(this.selectedAgentId);
  }

  setSelectedAgent(agentId) {
    this.selectedAgentId = agentId || null;
    for (const [id, actor] of this.agentActors.entries()) {
      const isSelected = this.isAdmin && id === this.selectedAgentId;
      if (actor.selection) {
        actor.selection.visible = isSelected;
      }
      if (actor.label) {
        actor.label.scale.set(isSelected ? 5.4 : 4.8, isSelected ? 1.34 : 1.2, 1);
      }
    }
  }

  attachControls() {
    const dom = this.renderer.domElement;
    this.controls = new MapControls(this.camera, dom);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.085;
    this.controls.enableRotate = true;
    this.controls.enablePan = true;
    this.controls.enableZoom = true;
    this.controls.screenSpacePanning = false;
    this.controls.zoomToCursor = true;
    this.controls.rotateSpeed = 0.72;
    this.controls.panSpeed = 1.08;
    this.controls.zoomSpeed = 0.82;
    this.controls.minDistance = 24;
    this.controls.maxDistance = 76;
    this.controls.minPolarAngle = 0.35;
    this.controls.maxPolarAngle = 1.15;
    this.controls.maxTargetRadius = 58;
    this.controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
    this.controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;
    this.controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
    this.controls.touches.ONE = THREE.TOUCH.PAN;
    this.controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;
    this.controls.keyPanSpeed = 20;
    this.controls.listenToKeyEvents(window);
    this.controls.target.copy(this.cameraDefaults.target);
    this.controls.update();

    dom.addEventListener("pointerdown", this.handlePointerDown);
    dom.addEventListener("pointermove", this.handlePointerMove);
    dom.addEventListener("pointerup", this.handlePointerUp);
    dom.addEventListener("pointercancel", this.handlePointerUp);
    dom.addEventListener("wheel", this.handleWheel, { passive: false, capture: true });
    dom.addEventListener("gesturestart", this.handleGestureStart, { passive: false });
    dom.addEventListener("gesturechange", this.handleGestureChange, { passive: false });
    dom.addEventListener("gestureend", this.handleGestureEnd, { passive: false });
    dom.addEventListener("contextmenu", this.preventContextMenu);
    window.addEventListener("resize", this.handleResize);
  }

  preventContextMenu(event) {
    event.preventDefault();
  }

  handlePointerDown(event) {
    if (event.button > 2 && event.pointerType !== "touch") {
      return;
    }
    this.pointerState.active = true;
    this.pointerState.pointerId = event.pointerId;
    this.pointerState.button = event.button;
    this.pointerState.startX = event.clientX;
    this.pointerState.startY = event.clientY;
    this.pointerState.moved = false;
  }

  handlePointerMove(event) {
    if (!this.pointerState.active || event.pointerId !== this.pointerState.pointerId) {
      return;
    }
    const distance = Math.abs(event.clientX - this.pointerState.startX) + Math.abs(event.clientY - this.pointerState.startY);
    if (distance > 6) {
      this.pointerState.moved = true;
    }
  }

  handlePointerUp(event) {
    if (event.pointerId !== this.pointerState.pointerId) {
      return;
    }
    const shouldPick = !this.pointerState.moved && (event.pointerType === "touch" || this.pointerState.button === 0);
    this.pointerState.active = false;
    this.pointerState.pointerId = null;
    this.pointerState.button = 0;
    if (shouldPick) {
      this.pickAgentAt(event.clientX, event.clientY);
    }
  }

  getViewPlaneBasis() {
    const right = this.scratch.vectorA.set(1, 0, 0).applyQuaternion(this.camera.quaternion);
    right.y = 0;
    if (right.lengthSq() < 0.0001) {
      right.set(1, 0, 0);
    } else {
      right.normalize();
    }

    const forward = this.scratch.vectorB.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
    forward.y = 0;
    if (forward.lengthSq() < 0.0001) {
      forward.set(0, 0, -1);
    } else {
      forward.normalize();
    }

    return { right, forward };
  }

  moveCameraAndTarget(deltaRight, deltaForward) {
    if (!this.controls) {
      return;
    }

    const { right, forward } = this.getViewPlaneBasis();
    const delta = this.scratch.vectorC.copy(right).multiplyScalar(deltaRight).addScaledVector(forward, deltaForward);
    this.controls.target.add(delta);
    this.camera.position.add(delta);
    this.constrainControls();
  }

  dollyByScale(scaleFactor) {
    if (!this.controls || !Number.isFinite(scaleFactor) || scaleFactor <= 0) {
      return;
    }

    const offset = this.scratch.vectorC.copy(this.camera.position).sub(this.controls.target);
    const currentDistance = offset.length();
    if (currentDistance <= 0.0001) {
      return;
    }

    const nextDistance = clamp(currentDistance * scaleFactor, this.controls.minDistance, this.controls.maxDistance);
    offset.setLength(nextDistance);
    this.camera.position.copy(this.controls.target).add(offset);
    this.camera.updateMatrixWorld();
  }

  rotateAroundTarget(deltaAzimuth) {
    if (!this.controls || !Number.isFinite(deltaAzimuth) || deltaAzimuth === 0) {
      return;
    }

    const offset = this.scratch.vectorC.copy(this.camera.position).sub(this.controls.target);
    offset.applyAxisAngle(THREE.Object3D.DEFAULT_UP, deltaAzimuth);
    this.camera.position.copy(this.controls.target).add(offset);
    this.camera.lookAt(this.controls.target);
    this.camera.updateMatrixWorld();
  }

  handleWheel(event) {
    if (!this.controls) {
      return;
    }

    const absX = Math.abs(event.deltaX);
    const absY = Math.abs(event.deltaY);
    const looksLikeTrackpad = event.ctrlKey || absX > 0 || absY < 20;

    if (!looksLikeTrackpad) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    if (event.ctrlKey) {
      const zoomFactor = Math.exp(event.deltaY * 0.0016);
      this.dollyByScale(zoomFactor);
      return;
    }

    if (event.shiftKey || event.altKey) {
      const rotationDelta = (event.deltaX || event.deltaY) * 0.0035;
      this.rotateAroundTarget(rotationDelta);
      return;
    }

    const panScale = Math.max(0.012, this.camera.position.distanceTo(this.controls.target) * 0.00125);
    this.moveCameraAndTarget(event.deltaX * panScale, event.deltaY * panScale);
  }

  handleGestureStart(event) {
    this.gestureState.active = true;
    this.gestureState.lastScale = Number(event.scale || 1);
    this.gestureState.lastRotation = Number(event.rotation || 0);
    event.preventDefault();
  }

  handleGestureChange(event) {
    if (!this.controls) {
      return;
    }

    event.preventDefault();

    const currentScale = Number(event.scale || 1);
    const currentRotation = Number(event.rotation || 0);
    const scaleRatio = currentScale / (this.gestureState.lastScale || 1);
    const rotationDelta = THREE.MathUtils.degToRad(currentRotation - this.gestureState.lastRotation);

    if (Number.isFinite(scaleRatio) && Math.abs(scaleRatio - 1) > 0.001) {
      this.dollyByScale(1 / scaleRatio);
    }
    if (Number.isFinite(rotationDelta) && Math.abs(rotationDelta) > 0.0005) {
      this.rotateAroundTarget(-rotationDelta * 0.9);
    }

    this.gestureState.lastScale = currentScale;
    this.gestureState.lastRotation = currentRotation;
  }

  handleGestureEnd(event) {
    this.gestureState.active = false;
    this.gestureState.lastScale = 1;
    this.gestureState.lastRotation = 0;
    event.preventDefault();
  }

  pickAgentAt(clientX, clientY) {
    if (!this.isAdmin || !this.onAgentSelect || !this.renderer || !this.camera || this.pickTargets.length === 0) {
      return;
    }

    const rect = this.renderer.domElement.getBoundingClientRect();
    const pointer = this.scratch.pointer;
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -(((clientY - rect.top) / rect.height) * 2 - 1);

    this.raycaster.setFromCamera(pointer, this.camera);
    const hit = this.raycaster.intersectObjects(this.pickTargets, false)[0];
    const agentId = hit?.object?.userData?.agentId;
    if (agentId) {
      this.onAgentSelect(agentId);
    }
  }

  setInitialCameraPose() {
    const { azimuth, elevation, distance, target } = this.cameraDefaults;
    const horizontal = Math.cos(elevation) * distance;
    const vertical = Math.sin(elevation) * distance;
    this.camera.position.set(
      target.x + Math.sin(azimuth) * horizontal,
      target.y + vertical,
      target.z + Math.cos(azimuth) * horizontal
    );
    this.camera.lookAt(target);
  }

  constrainControls() {
    if (!this.controls) {
      return;
    }

    const target = this.controls.target;
    const nextX = clamp(target.x, this.cameraBounds.minX, this.cameraBounds.maxX);
    const nextZ = clamp(target.z, this.cameraBounds.minZ, this.cameraBounds.maxZ);
    const nextY = this.cameraBounds.targetY;

    if (nextX === target.x && nextY === target.y && nextZ === target.z) {
      return;
    }

    const delta = this.scratch.vectorC.set(nextX - target.x, nextY - target.y, nextZ - target.z);
    target.set(nextX, nextY, nextZ);
    this.camera.position.add(delta);
    this.camera.updateMatrixWorld();
  }

  animate() {
    this.raf = requestAnimationFrame(() => this.animate());
    const delta = clamp(this.clock.getDelta(), 0.001, 0.033);
    const elapsed = this.clock.elapsedTime;

    for (const actor of this.agentActors.values()) {
      actor.group.position.lerp(actor.target, clamp(delta * 2.6, 0.04, 0.13));
      actor.shadow.position.x = actor.group.position.x;
      actor.shadow.position.z = actor.group.position.z;
      actor.activity.position.x = actor.group.position.x;
      actor.activity.position.z = actor.group.position.z;
      actor.label.position.x = actor.group.position.x;
      actor.label.position.z = actor.group.position.z;
      actor.selection.position.x = actor.group.position.x;
      actor.selection.position.z = actor.group.position.z;

      const bob = Math.sin(elapsed * 2.6 + actor.phase * Math.PI * 2) * 0.08;
      actor.group.position.y = 1.04 + bob;
      actor.activity.position.y = 2.5 + Math.sin(elapsed * 2 + actor.phase * 5) * 0.08;
      actor.label.position.y = 4.1 + bob * 0.35;
      actor.selection.position.y = 1.08 + bob * 0.15;
      actor.activity.rotation.z += delta * 1.6;
      actor.selection.rotation.z -= delta * 0.8;

      if (actor.target.distanceToSquared(actor.group.position) > 0.3) {
        const look = this.scratch.vectorA.copy(actor.target);
        look.y = actor.group.position.y;
        actor.group.lookAt(look);
      }
    }

    if (this.questConsole) {
      this.questConsole.rotation.y += delta * 0.18;
      this.questConsole.position.y = 1.1 + Math.sin(elapsed * 1.5) * 0.06;
    }

    for (let index = 0; index < this.taskOrbs.length; index += 1) {
      const orb = this.taskOrbs[index];
      if (!orb.visible) {
        continue;
      }
      orb.rotation.x += delta * 1.2;
      orb.rotation.y += delta * 1.8;
      orb.position.y += Math.sin(elapsed * 2 + index) * 0.002;
    }

    if (this.controls) {
      this.controls.update();
      this.constrainControls();
    }
    this.renderer.render(this.scene, this.camera);
  }

  handleResize() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    if (!this.renderer || !this.camera) {
      return;
    }
    this.renderer.setPixelRatio(this.getDesiredPixelRatio());
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}
