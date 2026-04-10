function toColor(hex) {
  return Phaser.Display.Color.HexStringToColor(hex).color;
}

function shiftColor(hex, amount = 24) {
  const value = Number.parseInt(String(hex || "#000000").replace("#", ""), 16);
  const red = Phaser.Math.Clamp(((value >> 16) & 255) + amount, 0, 255);
  const green = Phaser.Math.Clamp(((value >> 8) & 255) + amount, 0, 255);
  const blue = Phaser.Math.Clamp((value & 255) + amount, 0, 255);
  return `#${((red << 16) | (green << 8) | blue).toString(16).padStart(6, "0")}`;
}

function truncateLabel(value, maxLength = 36) {
  const text = String(value || "").trim();
  if (text.length <= maxLength) {
    return text;
  }
  if (maxLength <= 3) {
    return text.slice(0, maxLength);
  }
  return `${text.slice(0, maxLength - 3).trimEnd()}...`;
}

function diamondPoints(x, y, width, height) {
  return [
    { x, y: y - height / 2 },
    { x: x + width / 2, y },
    { x, y: y + height / 2 },
    { x: x - width / 2, y }
  ];
}

function drawPolygon(graphics, points, fill, alpha = 1, stroke = null, strokeAlpha = 0.22, strokeWidth = 2) {
  graphics.fillStyle(toColor(fill), alpha);
  graphics.beginPath();
  graphics.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) {
    graphics.lineTo(points[index].x, points[index].y);
  }
  graphics.closePath();
  graphics.fillPath();

  if (stroke) {
    graphics.lineStyle(strokeWidth, toColor(stroke), strokeAlpha);
    graphics.beginPath();
    graphics.moveTo(points[0].x, points[0].y);
    for (let index = 1; index < points.length; index += 1) {
      graphics.lineTo(points[index].x, points[index].y);
    }
    graphics.closePath();
    graphics.strokePath();
  }
}

function drawDiamond(graphics, x, y, width, height, fill, alpha = 1, stroke = null) {
  drawPolygon(graphics, diamondPoints(x, y, width, height), fill, alpha, stroke || shiftColor(fill, -40));
}

function drawPrism(graphics, x, y, width, height, depth, topFill, leftFill, rightFill, stroke = "#1e2632") {
  const top = diamondPoints(x, y, width, height);
  const bottom = top.map((point) => ({ x: point.x, y: point.y + depth }));

  drawPolygon(graphics, [top[3], top[2], bottom[2], bottom[3]], leftFill, 1, stroke);
  drawPolygon(graphics, [top[1], top[2], bottom[2], bottom[1]], rightFill, 1, stroke);
  drawPolygon(graphics, top, topFill, 1, stroke, 0.3);
}

function drawRoadTile(graphics, x, y, width = 28, height = 14) {
  drawDiamond(graphics, x, y, width, height, "#c7a87a", 0.95, "#8e6847");
  drawDiamond(graphics, x, y, width - 8, height - 5, "#d9c19a", 0.85, "#af8c62");
}

function drawRoad(graphics, start, end) {
  const distance = Phaser.Math.Distance.Between(start.x, start.y, end.x, end.y);
  const steps = Math.max(2, Math.ceil(distance / 28));
  for (let index = 0; index <= steps; index += 1) {
    const progress = index / steps;
    const eased = Phaser.Math.Easing.Sine.InOut(progress);
    const x = Phaser.Math.Linear(start.x, end.x, eased);
    const y = Phaser.Math.Linear(start.y, end.y, eased);
    drawRoadTile(graphics, x, y);
  }
}

function drawMountain(graphics, points, fill) {
  drawPolygon(graphics, points, fill, 0.85, shiftColor(fill, -35), 0.18, 1);
}

function stationPalette(kind) {
  const table = {
    hall: {
      roof: "#9dc4ff",
      left: "#3e5a96",
      right: "#2f4578",
      base: "#4668a6",
      accent: "#f4d48d"
    },
    workshop: {
      roof: "#ffc47f",
      left: "#b3662a",
      right: "#8e4d22",
      base: "#cf7a38",
      accent: "#ffe4ba"
    },
    library: {
      roof: "#8be0c0",
      left: "#2a7e66",
      right: "#225f53",
      base: "#2f9070",
      accent: "#dffded"
    },
    archive: {
      roof: "#f3a8c6",
      left: "#8d4477",
      right: "#6f335d",
      base: "#b45791",
      accent: "#ffe0f0"
    },
    tower: {
      roof: "#b9a7ff",
      left: "#5f45b5",
      right: "#4d3895",
      base: "#7054d9",
      accent: "#efe7ff"
    },
    garden: {
      roof: "#b7e98a",
      left: "#5a8c31",
      right: "#476f28",
      base: "#71a83a",
      accent: "#edfcd9"
    },
    board: {
      roof: "#edc28f",
      left: "#8d6138",
      right: "#734f31",
      base: "#ab7547",
      accent: "#fff0d8"
    },
    guesthouse: {
      roof: "#c7d5df",
      left: "#5f7689",
      right: "#4a6072",
      base: "#6e8799",
      accent: "#eef6fc"
    }
  };

  return table[kind] || table.guesthouse;
}

export class JarvisWorldScene extends Phaser.Scene {
  constructor() {
    super("JarvisWorldScene");
    this.manifest = null;
    this.currentState = null;
    this.agentSprites = new Map();
    this.agentLabels = new Map();
    this.agentShadows = new Map();
    this.stationNodes = new Map();
  }

  setManifest(manifest) {
    this.manifest = manifest;
  }

  create() {
    this.cameras.main.setBackgroundColor("#d8eef5");
    this.drawStaticWorld();
  }

  createAgentTexture(spriteKey, primary, secondary) {
    const graphics = this.make.graphics({ x: 0, y: 0, add: false });

    drawDiamond(graphics, 14, 24, 18, 8, "#2d3441", 0.95, "#1b2028");
    graphics.fillStyle(toColor(primary), 1);
    graphics.fillEllipse(14, 13, 12, 13);
    graphics.fillStyle(toColor(secondary), 1);
    graphics.fillEllipse(14, 17, 16, 11);
    graphics.fillStyle(toColor("#fff6ea"), 0.95);
    graphics.fillEllipse(14, 8, 9, 9);
    graphics.fillStyle(toColor("#18202a"), 1);
    graphics.fillCircle(11.5, 8, 1.1);
    graphics.fillCircle(16.5, 8, 1.1);
    graphics.fillRect(11, 11, 6, 1);
    graphics.fillStyle(toColor(shiftColor(primary, 38)), 0.75);
    graphics.fillEllipse(11.5, 6.5, 3.5, 2.5);
    graphics.generateTexture(spriteKey, 28, 30);
    graphics.destroy();
  }

  drawBackdrop(width, height) {
    const sky = this.add.graphics();
    sky.fillGradientStyle(0xf9c886, 0xf6d9a5, 0x9cc9db, 0x6e96ad, 1);
    sky.fillRect(0, 0, width, height);

    const glow = this.add.graphics();
    glow.fillStyle(0xffefcb, 0.9);
    glow.fillCircle(width - 170, 110, 64);
    glow.fillStyle(0xffffff, 0.25);
    glow.fillCircle(width - 150, 96, 44);

    const haze = this.add.graphics();
    drawMountain(haze, [
      { x: -60, y: 300 },
      { x: 100, y: 180 },
      { x: 220, y: 300 }
    ], "#b9ced6");
    drawMountain(haze, [
      { x: 120, y: 300 },
      { x: 320, y: 150 },
      { x: 500, y: 300 }
    ], "#9bb7c5");
    drawMountain(haze, [
      { x: 440, y: 300 },
      { x: 690, y: 138 },
      { x: 900, y: 300 }
    ], "#88a8b8");
    drawMountain(haze, [
      { x: 760, y: 300 },
      { x: 1020, y: 166 },
      { x: width + 80, y: 300 }
    ], "#7b9eb0");

    const cloud = this.add.graphics();
    cloud.fillStyle(0xffffff, 0.55);
    cloud.fillEllipse(182, 118, 110, 30);
    cloud.fillEllipse(235, 110, 84, 28);
    cloud.fillEllipse(280, 120, 100, 32);
    cloud.fillEllipse(810, 86, 94, 28);
    cloud.fillEllipse(858, 78, 70, 24);
    cloud.fillEllipse(904, 88, 88, 26);
  }

  drawIsland(width, height) {
    const island = this.add.graphics();
    const centerX = width / 2;
    const centerY = height / 2 + 36;

    drawPrism(island, centerX, centerY, 820, 360, 120, "#89c873", "#4f8d4d", "#3f7541", "#305034");
    drawDiamond(island, centerX, centerY - 28, 720, 292, "#9bda82", 1, "#5e9956");
    drawDiamond(island, centerX, centerY + 14, 604, 214, "#b4df8f", 0.75, "#73a25d");

    const innerRing = this.add.graphics();
    drawDiamond(innerRing, centerX, centerY - 6, 650, 244, "#d5bc8b", 0.18, "#9a7f51");
    drawDiamond(innerRing, centerX, centerY + 6, 560, 194, "#f6efe0", 0.18, "#b7a07b");

    const pond = this.add.graphics();
    drawDiamond(pond, centerX + 220, centerY + 34, 170, 74, "#71c0d7", 0.7, "#41879a");
    drawDiamond(pond, centerX + 222, centerY + 28, 140, 54, "#b6eefb", 0.5, "#4f96a8");
  }

  drawRoads() {
    const road = this.add.graphics();
    const quest = this.getStationPosition("quest-board");
    const hall = this.getStationPosition("dispatch-hall");
    const coder = this.getStationPosition("coder-forge");
    const researcher = this.getStationPosition("researcher-library");
    const curator = this.getStationPosition("curator-archive");
    const slacker = this.getStationPosition("slacker-tower");
    const philosopher = this.getStationPosition("philosopher-garden");

    drawRoad(road, { x: hall.x, y: hall.y - 76 }, { x: quest.x, y: quest.y + 12 });
    drawRoad(road, { x: hall.x - 64, y: hall.y - 8 }, { x: coder.x + 62, y: coder.y + 10 });
    drawRoad(road, { x: hall.x + 72, y: hall.y - 10 }, { x: researcher.x - 64, y: researcher.y + 8 });
    drawRoad(road, { x: hall.x - 88, y: hall.y + 74 }, { x: curator.x + 66, y: curator.y - 4 });
    drawRoad(road, { x: hall.x + 94, y: hall.y + 74 }, { x: slacker.x - 66, y: slacker.y - 4 });
    drawRoad(road, { x: hall.x, y: hall.y + 88 }, { x: philosopher.x, y: philosopher.y - 34 });
  }

  drawStation(stationId, station) {
    const layer = this.add.graphics();
    const palette = stationPalette(station.kind);
    const baseY = station.y + 18;

    drawDiamond(layer, station.x, baseY + 40, station.width + 36, 36, "#000000", 0.08, "#000000");
    drawDiamond(layer, station.x, baseY + 16, station.width + 8, 32, "#f3dfb1", 0.95, "#b48f5b");
    drawDiamond(layer, station.x, baseY + 10, station.width - 10, 24, "#fff8e7", 0.82, "#c5a473");

    if (station.kind === "board") {
      drawPrism(layer, station.x, station.y + 2, 72, 34, 38, "#f7deb7", "#815735", "#6f482d");
      layer.fillStyle(toColor("#6d4627"), 1);
      layer.fillRect(station.x - 34, station.y - 18, 8, 58);
      layer.fillRect(station.x + 26, station.y - 18, 8, 58);
      layer.fillStyle(toColor("#fff5d8"), 1);
      layer.fillRoundedRect(station.x - 38, station.y - 54, 76, 46, 10);
      layer.lineStyle(3, toColor("#ab7a43"), 1);
      layer.strokeRoundedRect(station.x - 38, station.y - 54, 76, 46, 10);
      layer.fillStyle(toColor("#e2af6e"), 1);
      layer.fillRect(station.x - 28, station.y - 42, 56, 8);
      layer.fillRect(station.x - 28, station.y - 26, 42, 6);
    } else if (station.kind === "hall") {
      drawPrism(layer, station.x, station.y - 8, 178, 92, 72, palette.roof, palette.left, palette.right);
      drawPrism(layer, station.x, station.y - 52, 118, 56, 34, shiftColor(palette.roof, 18), shiftColor(palette.left, 8), shiftColor(palette.right, 8));
      layer.fillStyle(toColor(palette.accent), 0.95);
      layer.fillEllipse(station.x, station.y + 22, 32, 48);
      layer.fillStyle(toColor("#35548c"), 1);
      layer.fillEllipse(station.x, station.y + 18, 18, 32);
      layer.fillStyle(toColor("#fef7e2"), 0.9);
      layer.fillCircle(station.x, station.y - 78, 12);
      layer.fillStyle(toColor("#f0c468"), 0.7);
      layer.fillCircle(station.x, station.y - 78, 18);
    } else if (station.kind === "workshop") {
      drawPrism(layer, station.x, station.y - 2, 144, 78, 58, palette.roof, palette.left, palette.right);
      drawPrism(layer, station.x - 34, station.y - 34, 66, 34, 28, shiftColor(palette.roof, 10), shiftColor(palette.left, 12), shiftColor(palette.right, 12));
      layer.fillStyle(toColor("#4f3a2b"), 1);
      layer.fillRect(station.x + 42, station.y - 80, 20, 54);
      layer.fillStyle(toColor("#ffd08a"), 0.85);
      layer.fillRect(station.x - 12, station.y + 8, 24, 18);
      layer.fillStyle(toColor("#fff3cd"), 0.75);
      layer.fillRect(station.x - 8, station.y + 12, 16, 10);
    } else if (station.kind === "library") {
      drawPrism(layer, station.x, station.y - 4, 152, 84, 64, palette.roof, palette.left, palette.right);
      drawPrism(layer, station.x, station.y - 46, 92, 44, 26, shiftColor(palette.roof, 14), shiftColor(palette.left, 10), shiftColor(palette.right, 10));
      layer.fillStyle(toColor("#f5fff9"), 0.92);
      layer.fillEllipse(station.x, station.y - 64, 44, 26);
      layer.fillStyle(toColor("#cfeee3"), 0.88);
      layer.fillEllipse(station.x, station.y - 70, 28, 18);
      layer.fillStyle(toColor(palette.accent), 0.95);
      layer.fillRect(station.x - 10, station.y + 4, 20, 24);
    } else if (station.kind === "archive") {
      drawPrism(layer, station.x, station.y - 2, 142, 74, 56, palette.roof, palette.left, palette.right);
      drawPrism(layer, station.x + 18, station.y - 40, 70, 36, 22, shiftColor(palette.roof, 12), shiftColor(palette.left, 10), shiftColor(palette.right, 10));
      layer.fillStyle(toColor(palette.accent), 0.95);
      layer.fillRect(station.x - 34, station.y - 2, 18, 28);
      layer.fillRect(station.x - 10, station.y - 8, 18, 34);
      layer.fillRect(station.x + 14, station.y + 2, 18, 24);
    } else if (station.kind === "tower") {
      drawPrism(layer, station.x, station.y - 8, 106, 54, 104, palette.roof, palette.left, palette.right);
      drawPrism(layer, station.x, station.y - 86, 60, 28, 24, shiftColor(palette.roof, 16), shiftColor(palette.left, 8), shiftColor(palette.right, 8));
      layer.fillStyle(toColor("#fff4d3"), 0.95);
      layer.fillCircle(station.x, station.y - 122, 10);
      layer.fillStyle(toColor("#f0d9ff"), 0.55);
      layer.fillCircle(station.x, station.y - 122, 18);
    } else if (station.kind === "garden") {
      drawPrism(layer, station.x, station.y + 6, 126, 56, 28, palette.roof, palette.left, palette.right);
      drawPrism(layer, station.x, station.y - 28, 86, 36, 24, shiftColor(palette.roof, 18), shiftColor(palette.left, 8), shiftColor(palette.right, 8));
      layer.fillStyle(toColor("#f7f1d7"), 0.95);
      layer.fillEllipse(station.x, station.y - 40, 26, 28);
      layer.fillStyle(toColor("#74b84d"), 0.95);
      layer.fillCircle(station.x - 48, station.y - 18, 15);
      layer.fillCircle(station.x + 48, station.y - 16, 15);
      layer.fillStyle(toColor("#8dc15c"), 0.95);
      layer.fillCircle(station.x - 42, station.y - 26, 12);
      layer.fillCircle(station.x + 54, station.y - 26, 12);
    } else {
      drawPrism(layer, station.x, station.y, 112, 62, 46, palette.roof, palette.left, palette.right);
      drawPrism(layer, station.x, station.y - 30, 80, 40, 20, shiftColor(palette.roof, 12), shiftColor(palette.left, 8), shiftColor(palette.right, 8));
      layer.fillStyle(toColor("#f9f8f0"), 0.88);
      layer.fillRect(station.x - 10, station.y + 6, 20, 20);
    }

    const plaque = this.add.text(station.x, station.y + station.height / 2 + 38, station.label, {
      fontFamily: "Sora, Trebuchet MS, sans-serif",
      fontSize: "14px",
      color: "#112033",
      backgroundColor: "#fff7e7",
      padding: { x: 10, y: 5 }
    }).setOrigin(0.5);
    plaque.setDepth(20);
  }

  drawStaticWorld() {
    if (!this.manifest) {
      return;
    }

    const { width, height } = this.manifest.layout;
    this.drawBackdrop(width, height);
    this.drawIsland(width, height);

    Object.entries(this.manifest.stations || {}).forEach(([stationId, station]) => {
      this.stationNodes.set(stationId, station);
    });

    this.drawRoads();

    Object.entries(this.manifest.stations || {}).forEach(([stationId, station]) => {
      this.drawStation(stationId, station);
    });

    const title = this.add.text(width / 2, 32, "Jarvis World", {
      fontFamily: "Sora, Trebuchet MS, sans-serif",
      fontSize: "26px",
      color: "#102137",
      backgroundColor: "#fff7e5",
      padding: { x: 16, y: 8 }
    }).setOrigin(0.5);
    title.setDepth(24);
  }

  getStationPosition(stationId) {
    const station = this.stationNodes.get(stationId) || this.stationNodes.get("dispatch-hall");
    return { x: station.x, y: station.y + station.height / 2 - 8 };
  }

  getQuestSlot(index) {
    const board = this.stationNodes.get("quest-board");
    if (!board || !Array.isArray(board.workSlots) || board.workSlots.length === 0) {
      return this.getStationPosition("quest-board");
    }
    return board.workSlots[index % board.workSlots.length];
  }

  resolveTarget(agent, index) {
    if (agent.status === "working" && agent.motionTargetId === "quest-board") {
      return this.getQuestSlot(index);
    }
    if (agent.status === "moving" && agent.motionTargetId && this.stationNodes.has(agent.motionTargetId)) {
      return this.getStationPosition(agent.motionTargetId);
    }
    return this.getStationPosition(agent.stationId);
  }

  ensureAgent(agent) {
    if (this.agentSprites.has(agent.id)) {
      return;
    }

    const manifestAgent = this.manifest.agents?.[agent.id];
    const [lightColor, darkColor] = manifestAgent?.palette || ["#f5f5f5", "#5c7aea"];
    const spriteKey = `jarvis-world:${agent.spriteKey}:${lightColor}:${darkColor}`;
    if (!this.textures.exists(spriteKey)) {
      this.createAgentTexture(spriteKey, lightColor, darkColor);
    }

    const start = this.getStationPosition(agent.stationId);
    const shadow = this.add.ellipse(start.x, start.y + 18, 26, 10, 0x1a1820, 0.18).setDepth(28);
    const sprite = this.add.sprite(start.x, start.y, spriteKey).setScale(1.9).setDepth(30);
    const label = this.add.text(start.x, start.y - 34, agent.name, {
      fontFamily: "IBM Plex Sans, Trebuchet MS, sans-serif",
      fontSize: "12px",
      color: "#102233",
      backgroundColor: "#fff7e7",
      padding: { x: 7, y: 4 }
    }).setOrigin(0.5).setDepth(32);

    this.agentShadows.set(agent.id, shadow);
    this.agentSprites.set(agent.id, sprite);
    this.agentLabels.set(agent.id, label);
  }

  setState(state, isAdmin) {
    this.currentState = state;
    if (!this.manifest) {
      return;
    }

    (state.agents || []).forEach((agent, index) => {
      this.ensureAgent(agent);
      const sprite = this.agentSprites.get(agent.id);
      const shadow = this.agentShadows.get(agent.id);
      const label = this.agentLabels.get(agent.id);
      const target = this.resolveTarget(agent, index);

      const scale = agent.status === "working" ? 2.02 : 1.9;
      const alpha = agent.status === "offline" ? 0.45 : 1;

      this.tweens.add({
        targets: sprite,
        x: target.x,
        y: target.y,
        scale,
        alpha,
        duration: 1400,
        ease: "Sine.easeInOut"
      });

      this.tweens.add({
        targets: shadow,
        x: target.x,
        y: target.y + 18,
        alpha: agent.status === "offline" ? 0.08 : 0.18,
        width: agent.status === "moving" ? 22 : 26,
        duration: 1400,
        ease: "Sine.easeInOut"
      });

      const actionText = isAdmin
        ? (agent.currentAction?.adminLabel || agent.name)
        : (agent.currentAction?.publicLabel || agent.name);

      label.setText(`${agent.name}\n${truncateLabel(actionText, 34)}`);
      label.setAlpha(agent.status === "offline" ? 0.7 : 1);
      this.tweens.add({
        targets: label,
        x: target.x,
        y: target.y - 36,
        duration: 1400,
        ease: "Sine.easeInOut"
      });
    });
  }
}
