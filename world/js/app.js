import { fetchAdminState, fetchPublicState, login, logout, dispatch, getApiBase, setStoredApiBase } from "./api.js";
import { createDemoState } from "./demo-state.js";
import { bindUiElements, renderBridgeStatus, renderMode, renderState, showDispatchResult } from "./ui.js";
import { JarvisWorldScene } from "./world-scene.js";

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
    renderBridgeStatus(ui, "Add a bridge URL to connect live data.", false);
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
    renderBridgeStatus(ui, `${error.message}. Falling back to demo town.`, false);
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
  appState.scene = createGame(appState.manifest);
  wireUi();
  renderMode(ui, false);
  await refreshState();
  startPolling();
}

main().catch((error) => {
  renderBridgeStatus(ui, `Startup failed: ${error.message}`, false);
});
