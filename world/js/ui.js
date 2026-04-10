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

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function statusLabel(status) {
  return status ? status[0].toUpperCase() + status.slice(1) : "Unknown";
}

function cardMarkup(title, body, meta = "", badge = "") {
  return `
    <article class="list-card">
      <div class="card-topline">
        <h4>${escapeHtml(title)}</h4>
        ${badge ? `<span class="badge">${escapeHtml(badge)}</span>` : ""}
      </div>
      ${body ? `<p>${escapeHtml(body)}</p>` : ""}
      ${meta ? `<small>${escapeHtml(meta)}</small>` : ""}
    </article>
  `;
}

export function bindUiElements() {
  return {
    gateOverlay: document.getElementById("gate-overlay"),
    gateStatus: document.getElementById("gate-status"),
    guestEnterButton: document.getElementById("guest-enter"),
    loginForm: document.getElementById("login-form"),
    passwordInput: document.getElementById("password-input"),
    loginButton: document.getElementById("login-button"),
    modeChip: document.getElementById("mode-chip"),
    modeLabel: document.getElementById("mode-label"),
    deckToggle: document.getElementById("deck-toggle"),
    deckClose: document.getElementById("deck-close"),
    controlDeck: document.getElementById("control-deck"),
    bridgeStatusPill: document.getElementById("bridge-status-pill"),
    activityPill: document.getElementById("activity-pill"),
    systemSummary: document.getElementById("system-summary"),
    agentCountLabel: document.getElementById("agent-count-label"),
    agentCards: document.getElementById("agent-cards"),
    taskList: document.getElementById("task-list"),
    eventList: document.getElementById("event-list"),
    deckAdminRow: document.getElementById("deck-admin-row"),
    logoutButton: document.getElementById("logout-button"),
    commandShell: document.getElementById("command-shell"),
    commandTitle: document.getElementById("command-title"),
    commandStatus: document.getElementById("command-status"),
    guestCommand: document.getElementById("guest-command"),
    dispatchForm: document.getElementById("dispatch-form"),
    dispatchInput: document.getElementById("dispatch-input"),
    dispatchButton: document.getElementById("dispatch-button"),
    dispatchResult: document.getElementById("dispatch-result")
  };
}

export function setGateVisible(ui, visible, message = "") {
  ui.gateOverlay.classList.toggle("hidden", !visible);
  if (message) {
    ui.gateStatus.textContent = message;
  }
}

export function setGateMessage(ui, message) {
  ui.gateStatus.textContent = message;
}

export function setDeckOpen(ui, isOpen) {
  ui.controlDeck.classList.toggle("hidden", !isOpen);
}

export function renderMode(ui, mode, hasEntered) {
  if (mode === "admin") {
    ui.modeLabel.textContent = "Admin world";
    ui.commandTitle.textContent = "Jarvis command lane";
    ui.commandStatus.textContent = "Admin dispatch ready";
    ui.guestCommand.classList.add("hidden");
    ui.dispatchForm.classList.remove("hidden");
    ui.deckAdminRow.classList.remove("hidden");
  } else {
    ui.modeLabel.textContent = hasEntered ? "Guest world" : "Access gate";
    ui.commandTitle.textContent = hasEntered ? "Guest observatory" : "Access gate";
    ui.commandStatus.textContent = hasEntered ? "Observe-only" : "Choose a lane";
    ui.guestCommand.classList.remove("hidden");
    ui.dispatchForm.classList.add("hidden");
    ui.deckAdminRow.classList.add("hidden");
  }

  ui.commandShell.classList.toggle("hidden", !hasEntered);
}

export function renderBridgeStatus(ui, message, isHealthy, state) {
  ui.bridgeStatusPill.textContent = isHealthy ? "Bridge live" : "Bridge offline";
  ui.activityPill.textContent = state
    ? `${state.system.activeAgents} active • ${state.system.taskCount} tracked`
    : "No live activity yet";
  ui.systemSummary.textContent = message;
}

export function renderState(ui, state, isAdmin) {
  ui.agentCountLabel.textContent = `${state.agents.length} tracked`;

  ui.agentCards.innerHTML = (state.agents || [])
    .map((agent) => {
      const label = isAdmin ? agent.currentAction.adminLabel : agent.currentAction.publicLabel;
      return cardMarkup(
        `${agent.name} • ${statusLabel(agent.status)}`,
        label || agent.role,
        `Updated ${formatTime(agent.lastUpdatedAt)}`,
        agent.role
      );
    })
    .join("");

  ui.taskList.innerHTML = (state.tasks || [])
    .map((task) => {
      const label = isAdmin ? task.adminLabel : task.publicLabel;
      const timing = task.nextRunAt ? `Next ${formatTime(task.nextRunAt)}` : `Updated ${formatTime(task.updatedAt)}`;
      return cardMarkup(
        label || "Scheduled work",
        `Owner ${task.ownerAgentId}${task.targetAgentId ? ` → ${task.targetAgentId}` : ""}`,
        timing,
        task.kind || "task"
      );
    })
    .join("");

  ui.eventList.innerHTML = (state.events || [])
    .map((event) => {
      const text = isAdmin ? event.adminText : event.publicText;
      return cardMarkup(text || "Village activity", "", formatTime(event.timestamp));
    })
    .join("");
}

export function showDispatchResult(ui, text, isError = false) {
  ui.dispatchResult.classList.remove("hidden");
  ui.dispatchResult.textContent = text;
  ui.dispatchResult.style.borderColor = isError ? "rgba(255, 154, 143, 0.38)" : "rgba(118, 240, 255, 0.3)";
}
