function formatTime(timestamp) {
  if (!timestamp) {
    return "just now";
  }

  return new Date(timestamp).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function statusLabel(status) {
  return status ? status[0].toUpperCase() + status.slice(1) : "Unknown";
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function stationLabel(manifest, stationId) {
  return manifest?.stations?.[stationId]?.label || String(stationId || "Unknown").replaceAll("-", " ");
}

function kindLabel(kind) {
  if (!kind) {
    return "Task";
  }
  return kind[0].toUpperCase() + kind.slice(1);
}

function initialMark(value) {
  return String(value || "?").trim().slice(0, 1).toUpperCase() || "?";
}

export function bindUiElements() {
  return {
    guestPill: document.getElementById("guest-pill"),
    adminPill: document.getElementById("admin-pill"),
    bridgePanel: document.getElementById("bridge-panel"),
    agentCards: document.getElementById("agent-cards"),
    taskList: document.getElementById("task-list"),
    eventList: document.getElementById("event-list"),
    bridgeStatus: document.getElementById("bridge-status"),
    authStatus: document.getElementById("auth-status"),
    systemLine: document.getElementById("system-line"),
    hudTitle: document.getElementById("hud-title"),
    hudSubtitle: document.getElementById("hud-subtitle"),
    apiBaseInput: document.getElementById("api-base-input"),
    saveApiBaseButton: document.getElementById("save-api-base"),
    refreshButton: document.getElementById("refresh-state"),
    loginForm: document.getElementById("login-form"),
    passwordInput: document.getElementById("password-input"),
    loginButton: document.getElementById("login-button"),
    logoutButton: document.getElementById("logout-button"),
    dispatchPanel: document.getElementById("dispatch-panel"),
    dispatchForm: document.getElementById("dispatch-form"),
    dispatchInput: document.getElementById("dispatch-input"),
    dispatchButton: document.getElementById("dispatch-button"),
    dispatchResult: document.getElementById("dispatch-result")
  };
}

export function renderMode(ui, isAdmin) {
  ui.guestPill.classList.toggle("hidden", isAdmin);
  ui.adminPill.classList.toggle("hidden", !isAdmin);
  ui.logoutButton.classList.toggle("hidden", !isAdmin);
  ui.dispatchPanel.classList.toggle("hidden", !isAdmin);
  ui.authStatus.textContent = isAdmin ? "Admin mode unlocked." : "Guest mode active.";
}

export function renderBridgePanel(ui, isVisible) {
  ui.bridgePanel.classList.toggle("hidden", !isVisible);
}

export function renderBridgeStatus(ui, message, isHealthy) {
  ui.bridgeStatus.textContent = message;
  ui.systemLine.textContent = isHealthy ? message : `Offline fallback. ${message}`;
}

export function renderState(ui, state, isAdmin, manifest) {
  ui.hudTitle.textContent = isAdmin ? "Admin observatory" : "Guest observatory";
  ui.hudSubtitle.textContent = `Updated ${formatTime(state.generatedAt)} - ${state.system.activeAgents} agents in motion`;
  ui.systemLine.textContent = state.system.healthy
    ? `Gateway ${state.system.gatewayStatus}. ${state.system.agentCount} agents and ${state.system.taskCount} live task tracks.`
    : "Bridge or gateway offline. The town is showing the safest available state.";

  ui.agentCards.innerHTML = "";
  for (const agent of state.agents) {
    const card = document.createElement("article");
    card.className = `card agent-card status-${escapeHtml(agent.status)}`;
    const actionLabel = isAdmin ? agent.currentAction.adminLabel : agent.currentAction.publicLabel;
    card.innerHTML = `
      <div class="card-header">
        <div class="identity-row">
          <span class="agent-mark">${escapeHtml(initialMark(agent.name))}</span>
          <div>
            <h3>${escapeHtml(agent.name)}</h3>
            <small class="role-line">${escapeHtml(agent.role)}</small>
          </div>
        </div>
        <div class="status-badge">
          <span class="status-dot status-${escapeHtml(agent.status)}"></span>
          <span>${escapeHtml(statusLabel(agent.status))}</span>
        </div>
      </div>
      <p class="agent-action">${escapeHtml(actionLabel || "Standing by")}</p>
      <div class="meta-row">
        <span class="station-chip">${escapeHtml(stationLabel(manifest, agent.stationId))}</span>
        <small>Updated ${escapeHtml(formatTime(agent.lastUpdatedAt))}</small>
      </div>
    `;
    ui.agentCards.appendChild(card);
  }

  ui.taskList.innerHTML = "";
  for (const task of state.tasks || []) {
    const item = document.createElement("article");
    item.className = "task-item";
    const label = isAdmin ? task.adminLabel : task.publicLabel;
    const timing = task.nextRunAt ? `Next ${formatTime(task.nextRunAt)}` : `Updated ${formatTime(task.updatedAt)}`;
    const owner = stationLabel(manifest, state.agents?.find((agent) => agent.id === task.ownerAgentId)?.stationId);
    item.innerHTML = `
      <div class="task-header">
        <span class="task-kind">${escapeHtml(kindLabel(task.kind))}</span>
        <small>${escapeHtml(statusLabel(task.status))}</small>
      </div>
      <strong>${escapeHtml(label || "Scheduled work")}</strong>
      <p class="task-subtext">Owner ${escapeHtml(task.ownerAgentId)}${task.targetAgentId ? ` -> ${escapeHtml(task.targetAgentId)}` : ""}</p>
      <div class="meta-row">
        <span class="station-chip">${escapeHtml(owner)}</span>
        <small>${escapeHtml(timing)}</small>
      </div>
    `;
    ui.taskList.appendChild(item);
  }

  ui.eventList.innerHTML = "";
  for (const event of state.events || []) {
    const item = document.createElement("article");
    item.className = "event-item";
    const message = isAdmin ? event.adminText : event.publicText;
    item.innerHTML = `
      <div class="event-stripe"></div>
      <div class="event-copy">
        <strong>${escapeHtml(message)}</strong>
        <small class="event-time">${escapeHtml(formatTime(event.timestamp))}</small>
      </div>
    `;
    ui.eventList.appendChild(item);
  }
}

export function showDispatchResult(ui, text, isError = false) {
  ui.dispatchResult.classList.remove("hidden");
  ui.dispatchResult.textContent = text;
  ui.dispatchResult.style.borderColor = isError ? "rgba(173, 72, 42, 0.45)" : "rgba(26, 108, 116, 0.26)";
}
