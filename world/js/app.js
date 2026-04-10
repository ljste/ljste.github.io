import { fetchAdminState, fetchPublicState, login, logout, dispatch, getApiBase, setStoredApiBase } from "./api.js?v=20260410a";
import { createDemoState } from "./demo-state.js?v=20260410a";
import { bindUiElements, renderBridgePanel, renderBridgeStatus, renderMode, renderState, showDispatchResult } from "./ui.js?v=20260410a";
import { JarvisWorldScene } from "./world-scene.js?v=20260410a";

const ui = bindUiElements();
const appState = {
  manifest: null,
  lastWorldState: null,
  isAdmin: false,
  pollTimer: null,
  scene: null
};

async function loadManifest() {
  const response = await fetch("./data/world-manifest.json");
  return response.json();
}

async function loadBridgeConfig() {
  const path = window.JARVIS_WORLD_CONFIG.bridgeConfigPath || "./data/bridge-config.json";
  try {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) {
      return {};
    }
    return response.json();
  } catch {
    return {};
  }
}

function getBridgeCandidates(bridgeConfig) {
  const configured = [];
  const runtimeConfig = window.JARVIS_WORLD_CONFIG || {};

  const add = (value) => {
    const normalized = String(value || "").trim().replace(/\/$/, "");
    if (normalized && !configured.includes(normalized)) {
      configured.push(normalized);
    }
  };

  add(localStorage.getItem("jarvis-world-api-base"));
  add(bridgeConfig.apiBaseUrl);
  add(runtimeConfig.defaultApiBaseUrl);

  const candidates = []
    .concat(runtimeConfig.bridgeCandidates || [])
    .concat(bridgeConfig.bridgeCandidates || []);

  for (const candidate of candidates) {
    add(candidate);
  }

  if (window.location.protocol.startsWith("http")) {
    add(`${window.location.origin}`);

    const host = window.location.hostname;
    const protocol = window.location.protocol;
    if (host && !host.startsWith("127.") && host !== "localhost") {
      const parts = host.split(".");
      if (parts.length >= 2) {
        const rootDomain = parts.slice(-2).join(".");
        add(`${protocol}//bridge.${rootDomain}`);
        add(`${protocol}//api.${rootDomain}`);
      }
    }

    if (host === "127.0.0.1" || host === "localhost") {
      add(`${protocol}//${host}:4318`);
    }
  }

  return configured;
}

async function chooseWorkingBridge(candidates) {
  for (const candidate of candidates) {
    try {
      const response = await fetch(`${candidate}/world-api/health`, {
        credentials: "omit",
        mode: "cors",
        cache: "no-store"
      });
      if (response.ok) {
        return candidate;
      }
    } catch {
      // Keep trying candidates.
    }
  }

  return "";
}

function createGame(manifest) {
  const scene = new JarvisWorldScene();
  scene.setManifest(manifest);
  new Phaser.Game({
    type: Phaser.AUTO,
    width: manifest.layout.width,
    height: manifest.layout.height,
    parent: "world-game",
    backgroundColor: "#87d37c",
    pixelArt: true,
    scene: [scene]
  });
  return scene;
}

async function refreshState() {
  const apiBase = getApiBase();
  if (!apiBase) {
    const demo = createDemoState(appState.manifest, appState.isAdmin ? "admin" : "guest");
    appState.lastWorldState = demo;
    renderBridgeStatus(ui, "No live bridge configured yet. The town is showing safe demo mode.", false);
    renderState(ui, demo, appState.isAdmin);
    appState.scene.setState(demo, appState.isAdmin);
    return;
  }

  try {
    const payload = appState.isAdmin ? await fetchAdminState() : await fetchPublicState();
    appState.lastWorldState = payload.state;
    renderBridgeStatus(ui, `Bridge online at ${apiBase}`, Boolean(payload.state.system.healthy));
    renderState(ui, payload.state, appState.isAdmin);
    appState.scene.setState(payload.state, appState.isAdmin);
  } catch (error) {
    const demo = createDemoState(appState.manifest, appState.isAdmin ? "admin" : "guest");
    appState.lastWorldState = demo;
    renderBridgeStatus(ui, `${error.message}. Check your public bridge URL and bridge CORS/cookie settings.`, false);
    renderState(ui, demo, appState.isAdmin);
    appState.scene.setState(demo, appState.isAdmin);
  }
}

function startPolling() {
  if (appState.pollTimer) {
    clearInterval(appState.pollTimer);
  }
  appState.pollTimer = setInterval(refreshState, window.JARVIS_WORLD_CONFIG.pollMs || 5000);
}

function wireUi() {
  ui.apiBaseInput.value = getApiBase();
  renderBridgePanel(ui, Boolean(window.JARVIS_WORLD_CONFIG.showBridgeControls));

  ui.saveApiBaseButton.addEventListener("click", () => {
    const value = setStoredApiBase(ui.apiBaseInput.value);
    ui.apiBaseInput.value = value;
    refreshState();
  });

  ui.refreshButton.addEventListener("click", () => {
    refreshState();
  });

  ui.loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    ui.loginButton.disabled = true;
    try {
      await login(ui.passwordInput.value);
      appState.isAdmin = true;
      renderMode(ui, true);
      ui.passwordInput.value = "";
      await refreshState();
    } catch (error) {
      ui.authStatus.textContent = error.message;
    } finally {
      ui.loginButton.disabled = false;
    }
  });

  ui.logoutButton.addEventListener("click", async () => {
    await logout().catch(() => null);
    appState.isAdmin = false;
    renderMode(ui, false);
    await refreshState();
  });

  ui.dispatchForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = ui.dispatchInput.value.trim();
    if (!message) {
      return;
    }

    ui.dispatchButton.disabled = true;
    try {
      const response = await dispatch(message);
      const reply = response.replyText || "Jarvis accepted the dispatch, but there was no text reply.";
      showDispatchResult(ui, reply, !response.ok);
      ui.dispatchInput.value = "";
      await refreshState();
    } catch (error) {
      showDispatchResult(ui, error.message, true);
    } finally {
      ui.dispatchButton.disabled = false;
    }
  });
}

async function main() {
  appState.manifest = await loadManifest();
  const bridgeConfig = await loadBridgeConfig();
  if (!getApiBase()) {
    const chosen = await chooseWorkingBridge(getBridgeCandidates(bridgeConfig));
    if (chosen) {
      setStoredApiBase(chosen);
    }
  }
  window.JARVIS_WORLD_CONFIG.showBridgeControls = Boolean(
    bridgeConfig.showBridgeControls ?? window.JARVIS_WORLD_CONFIG.showBridgeControls
  );
  if (bridgeConfig.allowManualBridgeOverride === false) {
    window.JARVIS_WORLD_CONFIG.showBridgeControls = false;
  }
  appState.scene = createGame(appState.manifest);
  wireUi();
  renderMode(ui, false);
  await refreshState();
  startPolling();
}

main().catch((error) => {
  renderBridgeStatus(ui, `Startup failed: ${error.message}`, false);
});
