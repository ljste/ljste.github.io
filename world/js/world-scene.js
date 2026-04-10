import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

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

function makePalette(agent, manifestEntry) {
  if (Array.isArray(manifestEntry?.palette) && manifestEntry.palette.length >= 2) {
    return {
      hat: manifestEntry.palette[1],
      coat: manifestEntry.palette[0],
      beard: "#f4e9d7"
    };
  }

  const seed = hashString(agent.id);
  const hues = [0.02, 0.08, 0.14, 0.33, 0.56, 0.72];
  const hue = hues[seed % hues.length];
  return {
    hat: new THREE.Color().setHSL(hue, 0.72, 0.46),
    coat: new THREE.Color().setHSL((hue + 0.08) % 1, 0.54, 0.76),
    beard: new THREE.Color("#f7edd6")
  };
}

function toColor(value, fallback = "#ffffff") {
  return new THREE.Color(typeof value === "string" ? value : fallback);
}

function normalizePrototype(object3d) {
  const root = object3d.clone(true);
  root.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;

  root.position.x -= center.x;
  root.position.y -= box.min.y;
  root.position.z -= center.z;
  root.scale.multiplyScalar(1 / maxDim);
  root.userData.normalizedSize = size.divideScalar(maxDim);

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

function createRoundedPad(color, radius = 2.3) {
  const geometry = new THREE.CylinderGeometry(radius, radius * 1.08, 0.42, 8);
  const material = new THREE.MeshStandardMaterial({
    color: toColor(color),
    roughness: 1,
    metalness: 0,
    flatShading: true
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = 0.2;
  return mesh;
}

function ellipsePoint(radiusX, radiusZ, angle) {
  return new THREE.Vector3(Math.cos(angle) * radiusX, 0, Math.sin(angle) * radiusZ);
}

function buildLots(agentIds) {
  const lots = new Map();
  const others = agentIds.filter((id) => id !== "main").sort((left, right) => left.localeCompare(right));
  const centerLot = {
    house: new THREE.Vector3(0, 0, 2),
    idle: new THREE.Vector3(0, 0, 5.4),
    work: new THREE.Vector3(0, 0, 3.2),
    quest: new THREE.Vector3(0, 0, 1.4),
    heading: Math.PI
  };
  lots.set("main", centerLot);

  const ringPattern = [5, 7, 10, 14];
  let cursor = 0;

  for (let ringIndex = 0; cursor < others.length; ringIndex += 1) {
    const ringCount = ringPattern[ringIndex] || (ringPattern.at(-1) + ringIndex * 4);
    const radiusX = 10 + ringIndex * 5.4;
    const radiusZ = 7.8 + ringIndex * 4.4;
    const offset = ringIndex % 2 === 0 ? -Math.PI / 2 : -Math.PI / 2 + Math.PI / ringCount;

    for (let slotIndex = 0; slotIndex < ringCount && cursor < others.length; slotIndex += 1, cursor += 1) {
      const agentId = others[cursor];
      const angle = offset + (slotIndex / ringCount) * Math.PI * 2;
      const home = ellipsePoint(radiusX, radiusZ, angle);
      const inward = new THREE.Vector3().sub(home).normalize();
      const tangent = new THREE.Vector3(-inward.z, 0, inward.x);
      lots.set(agentId, {
        house: home,
        idle: home.clone().addScaledVector(inward, 2.6),
        work: home.clone().addScaledVector(inward, 1.25).addScaledVector(tangent, 0.35),
        quest: home.clone().lerp(new THREE.Vector3(0, 0, 0), 0.5),
        heading: Math.atan2(-inward.x, -inward.z)
      });
    }
  }

  return lots;
}

function makeMaterial(color) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 1,
    metalness: 0,
    flatShading: true
  });
}

export class JarvisWorldScene {
  constructor(container) {
    this.container = container;
    this.manifest = null;
    this.state = null;
    this.isAdmin = false;
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.clock = new THREE.Clock();
    this.assetLoader = new GLTFLoader();
    this.assetLibrary = new Map();
    this.assetFailures = false;
    this.agentActors = new Map();
    this.homeGroups = new Map();
    this.taskOrbs = [];
    this.lotMap = new Map();
    this.pointer = new THREE.Vector2();
    this.baseCameraPosition = new THREE.Vector3(0, 19, 28);
    this.raf = 0;
    this.handleResize = this.handleResize.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
  }

  async init(manifest) {
    this.manifest = manifest;

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance"
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(this.container.clientWidth || window.innerWidth, this.container.clientHeight || window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.container.innerHTML = "";
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog("#6f8fb0", 18, 65);

    this.camera = new THREE.PerspectiveCamera(40, (this.container.clientWidth || window.innerWidth) / (this.container.clientHeight || window.innerHeight), 0.1, 200);
    this.camera.position.copy(this.baseCameraPosition);
    this.camera.lookAt(0, 2.5, 0);

    this.addLights();
    this.addStaticEnvironment();
    await this.preloadAssets();

    window.addEventListener("resize", this.handleResize);
    window.addEventListener("pointermove", this.handlePointerMove, { passive: true });
    this.handleResize();
    this.animate();
  }

  addLights() {
    const hemi = new THREE.HemisphereLight("#d8f3ff", "#58704c", 1.8);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight("#ffe7ba", 2.2);
    sun.position.set(18, 24, 12);
    this.scene.add(sun);

    const fill = new THREE.DirectionalLight("#76d5ff", 0.72);
    fill.position.set(-14, 10, -12);
    this.scene.add(fill);
  }

  addStaticEnvironment() {
    const island = new THREE.Group();

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(19.2, 24.5, 5.8, 10),
      makeMaterial("#3f5b4b")
    );
    base.position.y = -2.7;
    island.add(base);

    const shelf = new THREE.Mesh(
      new THREE.CylinderGeometry(20.8, 21.8, 1.4, 10),
      makeMaterial("#5e7a5e")
    );
    shelf.position.y = -0.4;
    island.add(shelf);

    const lawn = new THREE.Mesh(
      new THREE.CylinderGeometry(18.4, 19.6, 0.9, 10),
      makeMaterial("#7ebc69")
    );
    lawn.position.y = 0.5;
    island.add(lawn);

    const plaza = new THREE.Mesh(
      new THREE.CylinderGeometry(4.6, 4.8, 0.24, 24),
      makeMaterial("#d8dce3")
    );
    plaza.position.y = 0.98;
    island.add(plaza);

    const innerPlaza = new THREE.Mesh(
      new THREE.CylinderGeometry(2.6, 2.7, 0.16, 24),
      makeMaterial("#f5f8fd")
    );
    innerPlaza.position.y = 1.1;
    island.add(innerPlaza);

    const centralHub = new THREE.Group();
    const hubBase = new THREE.Mesh(
      new THREE.CylinderGeometry(1.9, 2.3, 0.9, 7),
      makeMaterial("#889ecc")
    );
    hubBase.position.y = 1.52;
    centralHub.add(hubBase);

    const hubGlass = new THREE.Mesh(
      new THREE.SphereGeometry(1.4, 20, 20),
      new THREE.MeshPhysicalMaterial({
        color: "#b7efff",
        transparent: true,
        opacity: 0.54,
        roughness: 0.1,
        transmission: 0.35
      })
    );
    hubGlass.position.y = 3.0;
    centralHub.add(hubGlass);

    const hubRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.9, 0.12, 8, 24),
      makeMaterial("#80f2ff")
    );
    hubRing.rotation.x = Math.PI / 2;
    hubRing.position.y = 2.05;
    centralHub.add(hubRing);
    island.add(centralHub);

    const ringGeometry = new THREE.TorusGeometry(9.8, 0.16, 10, 64);
    const ring = new THREE.Mesh(ringGeometry, makeMaterial("#d8c39a"));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.94;
    island.add(ring);

    this.scene.add(island);
    this.addDecor();
    this.addQuestConsole();
  }

  addDecor() {
    const decor = new THREE.Group();

    for (let index = 0; index < 18; index += 1) {
      const angle = (index / 18) * Math.PI * 2 + (index % 2 === 0 ? 0.08 : -0.08);
      const radius = 13.5 + (index % 3) * 2.2;
      const point = ellipsePoint(radius, radius * 0.74, angle);

      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.18, 1.1, 5),
        makeMaterial("#71533a")
      );
      trunk.position.set(point.x, 1.05, point.z);
      decor.add(trunk);

      const crown = new THREE.Mesh(
        new THREE.ConeGeometry(0.82 + (index % 2) * 0.14, 1.7, 6),
        makeMaterial(index % 4 === 0 ? "#5f9962" : "#70b36f")
      );
      crown.position.set(point.x, 2.1, point.z);
      decor.add(crown);
    }

    for (let index = 0; index < 12; index += 1) {
      const angle = (index / 12) * Math.PI * 2 + 0.2;
      const radius = 16.5 + (index % 2) * 1.6;
      const point = ellipsePoint(radius, radius * 0.78, angle);
      const rock = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.4 + (index % 3) * 0.12, 0),
        makeMaterial(index % 2 === 0 ? "#8e918d" : "#737873")
      );
      rock.position.set(point.x, 1.1, point.z);
      rock.rotation.set(index * 0.4, index * 0.7, index * 0.2);
      decor.add(rock);
    }

    this.scene.add(decor);
  }

  addQuestConsole() {
    const consoleGroup = new THREE.Group();
    consoleGroup.position.set(0, 1.08, -5.4);

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 1.45, 0.5, 6),
      makeMaterial("#7588b3")
    );
    base.position.y = 0.35;
    consoleGroup.add(base);

    const prism = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.72, 0),
      makeMaterial("#7cf5ff")
    );
    prism.position.y = 1.35;
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
        this.assetFailures = true;
        return null;
      }
    }));

    for (const entry of entries) {
      if (!entry) {
        continue;
      }
      this.assetLibrary.set(entry[0], entry[1]);
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
    return clone;
  }

  rebuildVillage(agentList) {
    for (const actor of this.agentActors.values()) {
      this.scene.remove(actor.group);
      this.scene.remove(actor.shadow);
      if (actor.activity) {
        this.scene.remove(actor.activity);
      }
    }
    this.agentActors.clear();

    for (const home of this.homeGroups.values()) {
      this.scene.remove(home);
    }
    this.homeGroups.clear();

    this.lotMap = buildLots(agentList.map((agent) => agent.id));

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
    }
  }

  createHome(agent, lot) {
    const manifestEntry = this.manifest?.agents?.[agent.id];
    const seed = hashString(agent.id);
    const house = new THREE.Group();
    house.position.copy(lot.house);
    house.rotation.y = lot.heading;

    const pad = createRoundedPad("#ceb68c", agent.id === "main" ? 3.4 : 2.7);
    house.add(pad);

    const wallColor = seed % 2 === 0 ? "#f1ede2" : "#ddd7cb";
    const trimColor = seed % 3 === 0 ? "#8f5b3b" : "#6f4e3a";
    const roofColor = seed % 4 === 0 ? "#8f5d50" : seed % 4 === 1 ? "#6d5b9e" : seed % 4 === 2 ? "#8b6f46" : "#587b97";

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(agent.id === "main" ? 4.8 : 3.8, agent.id === "main" ? 3.2 : 2.6, agent.id === "main" ? 4.3 : 3.3),
      makeMaterial(wallColor)
    );
    body.position.y = agent.id === "main" ? 2.35 : 1.95;
    house.add(body);

    const trim = new THREE.Mesh(
      new THREE.BoxGeometry(agent.id === "main" ? 5.05 : 4.02, 0.24, agent.id === "main" ? 4.48 : 3.46),
      makeMaterial(trimColor)
    );
    trim.position.y = body.position.y - (agent.id === "main" ? 0.52 : 0.44);
    house.add(trim);

    const roofBase = new THREE.Mesh(
      new THREE.ConeGeometry(agent.id === "main" ? 3.8 : 3.0, agent.id === "main" ? 2.4 : 1.9, 4),
      makeMaterial(roofColor)
    );
    roofBase.rotation.y = Math.PI / 4;
    roofBase.position.y = agent.id === "main" ? 4.45 : 3.62;
    house.add(roofBase);

    const roofModel = this.cloneAsset(seed % 3 === 0 ? "roof-high-window.glb" : "roof-high.glb", agent.id === "main" ? 4.5 : 3.4, {
      position: new THREE.Vector3(0, roofBase.position.y - 0.2, 0)
    });
    if (roofModel) {
      roofModel.rotation.y = Math.PI;
      house.add(roofModel);
    }

    const doorModel = this.cloneAsset("wall-wood-door.glb", agent.id === "main" ? 1.55 : 1.25, {
      position: new THREE.Vector3(0, 0.98, body.geometry.parameters.depth / 2 + 0.04)
    });
    if (doorModel) {
      house.add(doorModel);
    }

    const leftWindow = this.cloneAsset("wall-wood-window-small.glb", 0.96, {
      position: new THREE.Vector3(-body.geometry.parameters.width / 2 - 0.02, 1.55, 0),
      rotation: new THREE.Euler(0, Math.PI / 2, 0)
    });
    const rightWindow = this.cloneAsset("wall-wood-window-small.glb", 0.96, {
      position: new THREE.Vector3(body.geometry.parameters.width / 2 + 0.02, 1.55, 0),
      rotation: new THREE.Euler(0, -Math.PI / 2, 0)
    });
    if (leftWindow) {
      house.add(leftWindow);
    }
    if (rightWindow) {
      house.add(rightWindow);
    }

    const chimney = this.cloneAsset("chimney.glb", agent.id === "main" ? 0.85 : 0.62, {
      position: new THREE.Vector3(0.85, roofBase.position.y + 0.4, -0.2)
    });
    if (chimney) {
      house.add(chimney);
    }

    const lantern = this.cloneAsset("lantern.glb", 0.75, {
      position: new THREE.Vector3(-1.25, 1.5, body.geometry.parameters.depth / 2 + 0.18)
    });
    if (lantern) {
      house.add(lantern);
    }

    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(agent.id === "main" ? 0.4 : 0.26, 12, 12),
      new THREE.MeshBasicMaterial({
        color: manifestEntry?.palette?.[1] || roofColor,
        transparent: true,
        opacity: 0.28
      })
    );
    glow.position.set(0, agent.id === "main" ? 4.8 : 3.95, 0);
    house.add(glow);
    house.userData.glow = glow;

    return house;
  }

  createGnome(agent, lot) {
    const manifestEntry = this.manifest?.agents?.[agent.id];
    const palette = makePalette(agent, manifestEntry);
    const hatColor = typeof palette.hat === "string" ? palette.hat : `#${palette.hat.getHexString()}`;
    const coatColor = typeof palette.coat === "string" ? palette.coat : `#${palette.coat.getHexString()}`;
    const beardColor = typeof palette.beard === "string" ? palette.beard : `#${palette.beard.getHexString()}`;

    const group = new THREE.Group();
    group.position.copy(lot.idle);

    const hat = new THREE.Mesh(
      new THREE.ConeGeometry(0.42, 0.92, 7),
      makeMaterial(hatColor)
    );
    hat.position.y = 1.62;
    group.add(hat);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 10, 10),
      makeMaterial("#f6d8bc")
    );
    head.position.y = 1.18;
    group.add(head);

    const beard = new THREE.Mesh(
      new THREE.ConeGeometry(0.28, 0.58, 6),
      makeMaterial(beardColor)
    );
    beard.position.set(0, 0.88, 0.08);
    beard.rotation.x = Math.PI;
    group.add(beard);

    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.34, 0.76, 4, 8),
      makeMaterial(coatColor)
    );
    body.position.y = 0.64;
    group.add(body);

    const nose = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 8, 8),
      makeMaterial("#f0c4a5")
    );
    nose.position.set(0, 1.08, 0.28);
    group.add(nose);

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.46, 16),
      new THREE.MeshBasicMaterial({
        color: "#0a1020",
        transparent: true,
        opacity: 0.18
      })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(lot.idle.x, 1.02, lot.idle.z);

    const activity = new THREE.Mesh(
      new THREE.TorusGeometry(0.54, 0.04, 8, 20),
      makeMaterial(manifestEntry?.palette?.[1] || hatColor)
    );
    activity.rotation.x = Math.PI / 2;
    activity.position.set(lot.idle.x, 2.48, lot.idle.z);
    activity.visible = false;

    return {
      id: agent.id,
      group,
      shadow,
      activity,
      homeLot: lot,
      phase: (hashString(agent.id) % 1000) / 1000,
      velocity: new THREE.Vector3(),
      target: lot.idle.clone()
    };
  }

  updateTaskOrbs(tasks) {
    while (this.taskOrbs.length < 4) {
      const orb = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.18, 0),
        new THREE.MeshBasicMaterial({
          color: "#8ff5ff",
          transparent: true,
          opacity: 0.85
        })
      );
      this.taskOrbs.push(orb);
      this.scene.add(orb);
    }

    const activeTasks = (tasks || []).filter((task) => task.status === "running").slice(0, 4);
    this.taskOrbs.forEach((orb, index) => {
      orb.visible = index < activeTasks.length;
      if (orb.visible) {
        const angle = (index / Math.max(activeTasks.length, 1)) * Math.PI * 2;
        orb.position.set(Math.cos(angle) * 1.4, 2.7 + index * 0.12, -5.4 + Math.sin(angle) * 1.1);
      }
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

    const centerWork = new THREE.Vector3(0, 0, -3.2);

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
        target = centerWork.clone();
      } else if (agent.status === "working") {
        target = lot.work.clone();
      } else if (agent.status === "moving") {
        target = lot.quest.clone();
      }

      actor.target.copy(target);
      actor.activity.visible = agent.status === "working";
      actor.activity.material.opacity = agent.status === "offline" ? 0.12 : 0.88;
      actor.group.visible = true;
      actor.group.traverse((child) => {
        if (child.material?.opacity !== undefined && !child.material.transparent) {
          child.material.transparent = false;
        }
      });

      const glow = home.userData.glow;
      if (glow) {
        glow.material.opacity = agent.status === "working" ? 0.44 : agent.status === "moving" ? 0.3 : 0.16;
      }
      home.position.copy(lot.house);
      home.rotation.y = lot.heading;
    }

    this.updateTaskOrbs(state.tasks || []);
  }

  animate() {
    this.raf = requestAnimationFrame(() => this.animate());
    const delta = clamp(this.clock.getDelta(), 0.001, 0.033);
    const elapsed = this.clock.elapsedTime;

    for (const actor of this.agentActors.values()) {
      actor.group.position.lerp(actor.target, clamp(delta * 2.8, 0.04, 0.14));
      actor.shadow.position.x = actor.group.position.x;
      actor.shadow.position.z = actor.group.position.z;
      actor.activity.position.x = actor.group.position.x;
      actor.activity.position.z = actor.group.position.z;

      const bob = Math.sin(elapsed * 2.6 + actor.phase * Math.PI * 2) * 0.08;
      actor.group.position.y = 1.02 + bob;
      actor.activity.position.y = 2.46 + Math.sin(elapsed * 2 + actor.phase * 5) * 0.08;
      actor.activity.rotation.z += delta * 1.6;

      if (actor.target.distanceToSquared(actor.group.position) > 0.3) {
        const look = actor.target.clone();
        look.y = actor.group.position.y;
        actor.group.lookAt(look);
      }
    }

    if (this.questConsole) {
      this.questConsole.rotation.y += delta * 0.2;
      this.questConsole.position.y = 1.08 + Math.sin(elapsed * 1.6) * 0.06;
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

    this.camera.position.x = this.baseCameraPosition.x + this.pointer.x * 1.4;
    this.camera.position.y = this.baseCameraPosition.y + this.pointer.y * 0.7 + Math.sin(elapsed * 0.35) * 0.25;
    this.camera.lookAt(0, 2.35, 0);

    this.renderer.render(this.scene, this.camera);
  }

  handlePointerMove(event) {
    const x = (event.clientX / window.innerWidth) * 2 - 1;
    const y = (event.clientY / window.innerHeight) * 2 - 1;
    this.pointer.set(clamp(x, -1, 1), clamp(-y, -1, 1));
  }

  handleResize() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    if (!this.renderer || !this.camera) {
      return;
    }
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}
