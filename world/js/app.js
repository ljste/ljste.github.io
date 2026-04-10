import { fetchAdminState, fetchPublicState, login, logout, dispatch, getApiBase, setStoredApiBase } from "./api.js?v=20260410g";
import { createDemoState } from "./demo-state.js?v=20260410g";
import {
  bindUiElements,
  setGateVisible,
  setGateMessage,
  setDeckOpen,
  renderMode,
  renderBridgeStatus,
  renderState,
  showDispatchResult
} from "./ui.js?v=20260410g";
import { JarvisWorldScene } from "./world-scene.js?v=20260410g";

const ui = bindUiElements();
const appState = {
  manifest: null,
  bridgeConfig: {},
  world: null,
  isAdmin: false,
  enteredMode: null,
  pollTimer: null,
  lastWorldState: null,
  deckOpen: false,
  selectedAgentId: null
};

async function loadManifest() {
  const response = await fetch("./data/world-manifest.json", { cache: "no-store" });
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

function addCandidate(list, value) {
  const normalized = String(value || "").trim().replace(/\/$/, "");
  if (normalized && !list.includes(normalized)) {
    list.push(normalized);
  }
}

function getBridgeCandidates(bridgeConfig) {
  const candidates = [];
  addCandidate(candidates, localStorage.getItem("jarvis-world-api-base"));
  addCandidate(candidates, bridgeConfig.apiBaseUrl);
  addCandidate(candidates, window.JARVIS_WORLD_CONFIG.defaultApiBaseUrl);
  for (const candidate of window.JARVIS_WORLD_CONFIG.bridgeCandidates || []) {
    addCandidate(candidates, candidate);
  }
  for (const candidate of bridgeConfig.bridgeCandidates || []) {
    addCandidate(candidates, candidate);
  }
  if (window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost") {
    addCandidate(candidates, `${window.location.protocol}//${window.location.hostname}:4318`);
  }
  return candidates;
}

async function probeBridge(candidate) {
  if (!candidate) {
    return false;
  }
  try {
    const response = await fetch(`${candidate}/world-api/health`, {
      method: "GET",
      mode: "cors",
      cache: "no-store",
      credentials: "omit"
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function resolveWorkingBridge() {
  for (const candidate of getBridgeCandidates(appState.bridgeConfig)) {
    if (await probeBridge(candidate)) {
      setStoredApiBase(candidate);
      return candidate;
    }
  }
  return "";
}

function currentMode() {
  return appState.isAdmin ? "admin" : "guest";
}

function setEnteredMode(mode) {
  appState.enteredMode = mode;
  appState.isAdmin = mode === "admin";
  if (!appState.isAdmin) {
    appState.selectedAgentId = null;
    appState.world?.setSelectedAgent(null);
  }
  renderMode(ui, currentMode(), Boolean(appState.enteredMode));
}

function renderWorldState(state) {
  const availableAgentIds = new Set((state.agents || []).map((agent) => agent.id));
  if (appState.selectedAgentId && !availableAgentIds.has(appState.selectedAgentId)) {
    appState.selectedAgentId = null;
  }
  renderState(ui, state, appState.isAdmin, {
    selectedAgentId: appState.selectedAgentId,
    manifest: appState.manifest
  });
  appState.world?.setState(state, appState.isAdmin);
  appState.world?.setSelectedAgent(appState.isAdmin ? appState.selectedAgentId : null);
}

function focusAgent(agentId) {
  if (!appState.isAdmin || !appState.lastWorldState) {
    return;
  }
  appState.selectedAgentId = agentId;
  appState.deckOpen = true;
  setDeckOpen(ui, true);
  renderWorldState(appState.lastWorldState);
}

function startPolling() {
  if (appState.pollTimer) {
    clearInterval(appState.pollTimer);
  }
  appState.pollTimer = setInterval(() => {
    refreshState();
  }, window.JARVIS_WORLD_CONFIG.pollMs || 5000);
}

async function refreshState() {
  const apiBase = getApiBase();
  if (!apiBase) {
    const demo = createDemoState(appState.manifest, currentMode());
    appState.lastWorldState = demo;
    renderBridgeStatus(ui, "No public bridge was reachable. The village is running in safe demo mode.", false, demo);
    renderWorldState(demo);
    return;
  }

  try {
    const payload = appState.isAdmin ? await fetchAdminState() : await fetchPublicState();
    appState.lastWorldState = payload.state;
    renderBridgeStatus(
      ui,
      `Bridge online at ${apiBase}. Gateway ${payload.state.system.gatewayStatus}.`,
      Boolean(payload.state.system.healthy),
      payload.state
    );
    renderWorldState(payload.state);
  } catch (error) {
    if (appState.isAdmin && error.message.includes("Admin login required")) {
      setEnteredMode(null);
      setGateVisible(ui, true, "Your admin session expired. Unlock admin mode again or continue as guest.");
      try {
        const payload = await fetchPublicState();
        appState.lastWorldState = payload.state;
        renderBridgeStatus(
          ui,
          `Bridge online at ${getApiBase()}. Guest-safe view restored.`,
          Boolean(payload.state.system.healthy),
          payload.state
        );
        renderWorldState(payload.state);
        return;
      } catch {
        // Fall through to demo state if even guest mode fails.
      }
    }

    const recovered = await resolveWorkingBridge();
    if (recovered && recovered !== apiBase) {
      try {
        const payload = appState.isAdmin ? await fetchAdminState() : await fetchPublicState();
        appState.lastWorldState = payload.state;
        renderBridgeStatus(
          ui,
          `Bridge online at ${recovered}. Gateway ${payload.state.system.gatewayStatus}.`,
          Boolean(payload.state.system.healthy),
          payload.state
        );
        renderWorldState(payload.state);
        return;
      } catch {
        // Fall through to demo state.
      }
    }

    const demo = createDemoState(appState.manifest, currentMode());
    appState.lastWorldState = demo;
    renderBridgeStatus(ui, `${error.message}. Falling back to guest-safe demo mode.`, false, demo);
    renderWorldState(demo);
  }
}

async function attemptAdminRestore() {
  try {
    const payload = await fetchAdminState();
    setEnteredMode("admin");
    setGateVisible(ui, false);
    renderBridgeStatus(
      ui,
      `Admin session restored. Bridge online at ${getApiBase()}.`,
      Boolean(payload.state.system.healthy),
      payload.state
    );
    appState.lastWorldState = payload.state;
    renderWorldState(payload.state);
    return true;
  } catch {
    return false;
  }
}

function wireUi() {
  ui.deckToggle.addEventListener("click", () => {
    appState.deckOpen = !appState.deckOpen;
    setDeckOpen(ui, appState.deckOpen);
  });

  ui.deckClose.addEventListener("click", () => {
    appState.deckOpen = false;
    setDeckOpen(ui, false);
  });

  ui.agentCards.addEventListener("click", (event) => {
    if (!appState.isAdmin) {
      return;
    }
    const card = event.target.closest("[data-agent-id]");
    if (!card) {
      return;
    }
    focusAgent(card.dataset.agentId);
  });

  ui.modeChip.addEventListener("click", () => {
    if (appState.isAdmin) {
      return;
    }
    setGateVisible(ui, true, "Choose guest mode or unlock admin mode.");
  });

  ui.guestEnterButton.addEventListener("click", async () => {
    setEnteredMode("guest");
    setGateVisible(ui, false);
    await refreshState();
  });

  ui.loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    ui.loginButton.disabled = true;
    setGateMessage(ui, "Unlocking admin world...");
    try {
      await login(ui.passwordInput.value);
      ui.passwordInput.value = "";
      setEnteredMode("admin");
      setGateVisible(ui, false);
      await refreshState();
    } catch (error) {
      setGateMessage(ui, error.message);
    } finally {
      ui.loginButton.disabled = false;
    }
  });

  ui.logoutButton.addEventListener("click", async () => {
    await logout().catch(() => null);
    setEnteredMode(null);
    appState.isAdmin = false;
    setGateVisible(ui, true, "You logged out. Choose guest mode or unlock admin again.");
    await refreshState();
  });

  ui.dispatchForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = String(ui.dispatchInput.value || "").trim();
    if (!message) {
      return;
    }

    ui.dispatchButton.disabled = true;
    try {
      const response = await dispatch(message);
      showDispatchResult(ui, response.replyText || "Jarvis accepted the dispatch.");
      ui.dispatchInput.value = "";
      await refreshState();
    } catch (error) {
      showDispatchResult(ui, error.message, true);
    } finally {
      ui.dispatchButton.disabled = false;
    }
  });
}

async function bootstrap() {
  appState.manifest = await loadManifest();
  appState.bridgeConfig = await loadBridgeConfig();
  await resolveWorkingBridge();

  appState.world = new JarvisWorldScene(document.getElementById("world-stage"), {
    onAgentSelect: focusAgent
  });
  await appState.world.init(appState.manifest);

  wireUi();
  renderMode(ui, "guest", false);
  setDeckOpen(ui, false);
  setGateVisible(ui, true, "Checking for a saved admin session...");

  await refreshState();
  startPolling();

  const restored = await attemptAdminRestore();
  if (!restored) {
    setEnteredMode(null);
    setGateVisible(ui, true, "Choose guest mode or unlock admin mode.");
  }
}

bootstrap().catch((error) => {
  setGateVisible(ui, true, `Startup failed: ${error.message}`);
});
