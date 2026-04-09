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

export function bindUiElements() {
  return {
    guestPill: document.getElementById("guest-pill"),
    adminPill: document.getElementById("admin-pill"),
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

export function renderBridgeStatus(ui, message, isHealthy) {
  ui.bridgeStatus.textContent = message;
  ui.systemLine.textContent = isHealthy ? message : `Offline fallback. ${message}`;
}

export function renderState(ui, state, isAdmin) {
  ui.hudTitle.textContent = isAdmin ? "Admin world view" : "Guest world view";
  ui.hudSubtitle.textContent = `Updated ${formatTime(state.generatedAt)} · ${state.system.activeAgents} active agents`;
  ui.systemLine.textContent = state.system.healthy
    ? `Gateway ${state.system.gatewayStatus}. ${state.system.agentCount} agents, ${state.system.taskCount} tracked tasks.`
    : "Bridge or gateway offline. Showing the safest available state.";

  ui.agentCards.innerHTML = "";
  for (const agent of state.agents) {
    const card = document.createElement("article");
    card.className = "card";
    const actionLabel = isAdmin ? agent.currentAction.adminLabel : agent.currentAction.publicLabel;
    card.innerHTML = `
      <div class="card-header">
        <div>
          <h3>${agent.name}</h3>
          <small>${agent.role}</small>
        </div>
        <div class="pill">
          <span class="status-dot status-${agent.status}"></span>
          <span>${statusLabel(agent.status)}</span>
        </div>
      </div>
      <p>${actionLabel || "Standing by"}</p>
      <small>${agent.stationId} · updated ${formatTime(agent.lastUpdatedAt)}</small>
    `;
    ui.agentCards.appendChild(card);
  }

  ui.taskList.innerHTML = "";
  for (const task of state.tasks || []) {
    const item = document.createElement("article");
    item.className = "task-item";
    const label = isAdmin ? task.adminLabel : task.publicLabel;
    item.innerHTML = `
      <div class="task-header">
        <strong>${label || "Scheduled work"}</strong>
        <small>${statusLabel(task.status)}</small>
      </div>
      <p class="task-subtext">Owner: ${task.ownerAgentId}${task.targetAgentId ? ` → ${task.targetAgentId}` : ""}</p>
      <small>${task.nextRunAt ? `Next ${formatTime(task.nextRunAt)}` : `Updated ${formatTime(task.updatedAt)}`}</small>
    `;
    ui.taskList.appendChild(item);
  }

  ui.eventList.innerHTML = "";
  for (const event of state.events || []) {
    const item = document.createElement("article");
    item.className = "event-item";
    item.innerHTML = `
      <div class="event-header">
        <strong>${isAdmin ? event.adminText : event.publicText}</strong>
      </div>
      <small class="event-time">${formatTime(event.timestamp)}</small>
    `;
    ui.eventList.appendChild(item);
  }
}

export function showDispatchResult(ui, text, isError = false) {
  ui.dispatchResult.classList.remove("hidden");
  ui.dispatchResult.textContent = text;
  ui.dispatchResult.style.borderColor = isError ? "rgba(255, 123, 123, 0.55)" : "rgba(124, 196, 255, 0.28)";
}
