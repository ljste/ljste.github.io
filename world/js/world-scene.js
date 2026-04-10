function lighten(hex, amount = 28) {
  const value = Number.parseInt(hex.replace("#", ""), 16);
  const red = Math.min(255, ((value >> 16) & 255) + amount);
  const green = Math.min(255, ((value >> 8) & 255) + amount);
  const blue = Math.min(255, (value & 255) + amount);
  return `#${(red << 16 | green << 8 | blue).toString(16).padStart(6, "0")}`;
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

export class JarvisWorldScene extends Phaser.Scene {
  constructor() {
    super("JarvisWorldScene");
    this.manifest = null;
    this.currentState = null;
    this.agentSprites = new Map();
    this.agentLabels = new Map();
    this.stationNodes = new Map();
  }

  setManifest(manifest) {
    this.manifest = manifest;
  }

  create() {
    this.cameras.main.setBackgroundColor("#8bd0ff");
    this.drawStaticWorld();
  }

  createAgentTexture(spriteKey, primary, secondary) {
    const graphics = this.make.graphics({ x: 0, y: 0, add: false });
    graphics.fillStyle(Phaser.Display.Color.HexStringToColor("#13202f").color, 1);
    graphics.fillRect(4, 18, 4, 4);
    graphics.fillRect(10, 18, 4, 4);
    graphics.fillStyle(Phaser.Display.Color.HexStringToColor(primary).color, 1);
    graphics.fillRect(3, 4, 12, 12);
    graphics.fillStyle(Phaser.Display.Color.HexStringToColor(secondary).color, 1);
    graphics.fillRect(5, 6, 8, 4);
    graphics.fillStyle(Phaser.Display.Color.HexStringToColor("#0b1321").color, 1);
    graphics.fillRect(5, 10, 2, 2);
    graphics.fillRect(11, 10, 2, 2);
    graphics.fillRect(6, 14, 6, 1);
    graphics.generateTexture(spriteKey, 18, 24);
    graphics.destroy();
  }

  drawStaticWorld() {
    if (!this.manifest) {
      return;
    }

    const { width, height, tileSize } = this.manifest.layout;
    const background = this.add.graphics();
    background.fillGradientStyle(0x87d37c, 0x87d37c, 0x6db66a, 0x6db66a, 1);
    background.fillRect(0, 0, width, height);

    for (let x = 0; x < width; x += tileSize) {
      for (let y = 0; y < height; y += tileSize) {
        background.fillStyle((x + y) % (tileSize * 2) === 0 ? 0x79c46c : 0x73bb68, 0.22);
        background.fillRect(x, y, tileSize, tileSize);
      }
    }

    const pathGraphics = this.add.graphics();
    pathGraphics.lineStyle(18, 0xb59d7b, 1);
    pathGraphics.beginPath();
    pathGraphics.moveTo(480, 110);
    pathGraphics.lineTo(480, 282);
    pathGraphics.lineTo(220, 282);
    pathGraphics.moveTo(480, 282);
    pathGraphics.lineTo(742, 282);
    pathGraphics.moveTo(480, 282);
    pathGraphics.lineTo(480, 530);
    pathGraphics.moveTo(220, 282);
    pathGraphics.lineTo(220, 492);
    pathGraphics.moveTo(742, 282);
    pathGraphics.lineTo(742, 488);
    pathGraphics.strokePath();

    Object.entries(this.manifest.stations || {}).forEach(([stationId, station]) => {
      this.stationNodes.set(stationId, station);
      const building = this.add.graphics();
      const baseColor = {
        hall: "#24497e",
        workshop: "#91511d",
        library: "#29695a",
        archive: "#804267",
        tower: "#5b49aa",
        garden: "#5d8b2d",
        board: "#7b5637",
        guesthouse: "#426279"
      }[station.kind] || "#516c82";

      building.fillStyle(Phaser.Display.Color.HexStringToColor(baseColor).color, 0.95);
      building.fillRoundedRect(
        station.x - station.width / 2,
        station.y - station.height / 2,
        station.width,
        station.height,
        station.kind === "board" ? 18 : 22
      );

      building.fillStyle(Phaser.Display.Color.HexStringToColor(lighten(baseColor)).color, 0.9);
      building.fillRoundedRect(
        station.x - station.width / 2 + 12,
        station.y - station.height / 2 + 12,
        Math.max(24, station.width - 24),
        Math.max(18, station.height - 30),
        14
      );

      const label = this.add.text(station.x, station.y + station.height / 2 + 16, station.label, {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "14px",
        color: "#0d1924",
        backgroundColor: "#f4ead0",
        padding: { x: 8, y: 4 }
      }).setOrigin(0.5);
      label.setDepth(20);
    });

    const title = this.add.text(480, 28, "Jarvis World", {
      fontFamily: "Trebuchet MS, sans-serif",
      fontSize: "24px",
      color: "#0b1522",
      backgroundColor: "#fdf6df",
      padding: { x: 14, y: 7 }
    }).setOrigin(0.5);
    title.setDepth(20);
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
    const sprite = this.add.sprite(start.x, start.y, spriteKey).setScale(2).setDepth(30);
    const label = this.add.text(start.x, start.y - 28, agent.name, {
      fontFamily: "Trebuchet MS, sans-serif",
      fontSize: "12px",
      color: "#102233",
      backgroundColor: "rgba(248, 244, 226, 0.92)",
      padding: { x: 6, y: 3 }
    }).setOrigin(0.5).setDepth(32);

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
      const label = this.agentLabels.get(agent.id);
      const target = this.resolveTarget(agent, index);

      this.tweens.add({
        targets: sprite,
        x: target.x,
        y: target.y,
        duration: 1400,
        ease: "Sine.easeInOut"
      });

      const actionText = isAdmin
        ? (agent.currentAction?.adminLabel || agent.name)
        : (agent.currentAction?.publicLabel || agent.name);

      label.setText(`${agent.name}\n${truncateLabel(actionText, 36)}`);
      this.tweens.add({
        targets: label,
        x: target.x,
        y: target.y - 28,
        duration: 1400,
        ease: "Sine.easeInOut"
      });
    });
  }
}
