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

function formatTarget(value) {
  if (!value) {
    return "None";
  }
  return String(value).replaceAll("-", " ");
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
    selectedAgentSection: document.getElementById("selected-agent-section"),
    selectedAgentCard: document.getElementById("selected-agent-card"),
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
    ui.selectedAgentSection.classList.remove("hidden");
  } else {
    ui.modeLabel.textContent = hasEntered ? "Guest world" : "Access gate";
    ui.commandTitle.textContent = hasEntered ? "Guest observatory" : "Access gate";
    ui.commandStatus.textContent = hasEntered ? "Observe-only" : "Choose a lane";
    ui.guestCommand.classList.remove("hidden");
    ui.dispatchForm.classList.add("hidden");
    ui.deckAdminRow.classList.add("hidden");
    ui.selectedAgentSection.classList.add("hidden");
  }

  ui.commandShell.classList.toggle("hidden", !hasEntered);
}

export function renderBridgeStatus(ui, message, isHealthy, state) {
  ui.bridgeStatusPill.textContent = isHealthy ? "Bridge live" : "Bridge offline";
  ui.activityPill.textContent = state
    ? `${state.system.activeAgents} active | ${state.system.taskCount} tracked`
    : "No live activity yet";
  ui.systemSummary.textContent = message;
}

export function renderState(ui, state, isAdmin, options = {}) {
  const selectedAgentId = options.selectedAgentId || null;
  const manifest = options.manifest || {};
  ui.agentCountLabel.textContent = `${state.agents.length} tracked`;

  ui.agentCards.innerHTML = (state.agents || [])
    .map((agent) => {
      const label = isAdmin ? agent.currentAction.adminLabel : agent.currentAction.publicLabel;
      const selectedClass = agent.id === selectedAgentId ? " is-selected" : "";
      return `
        <article class="list-card${selectedClass}" data-agent-id="${escapeHtml(agent.id)}">
          <div class="card-topline">
            <h4>${escapeHtml(`${agent.name} - ${statusLabel(agent.status)}`)}</h4>
            <span class="badge">${escapeHtml(agent.role)}</span>
          </div>
          <p>${escapeHtml(label || agent.role)}</p>
          <small>${escapeHtml(`Updated ${formatTime(agent.lastUpdatedAt)}`)}</small>
        </article>
      `;
    })
    .join("");

  ui.taskList.innerHTML = (state.tasks || [])
    .map((task) => {
      const label = isAdmin ? task.adminLabel : task.publicLabel;
      const timing = task.nextRunAt ? `Next ${formatTime(task.nextRunAt)}` : `Updated ${formatTime(task.updatedAt)}`;
      return cardMarkup(
        label || "Scheduled work",
        `Owner ${task.ownerAgentId}${task.targetAgentId ? ` -> ${task.targetAgentId}` : ""}`,
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

  if (!isAdmin) {
    ui.selectedAgentCard.innerHTML = '<p class="agent-focus-empty">Unlock admin mode to inspect individual gnomes.</p>';
    return;
  }

  const selectedAgent = (state.agents || []).find((agent) => agent.id === selectedAgentId);
  if (!selectedAgent) {
    ui.selectedAgentCard.innerHTML = '<p class="agent-focus-empty">Click a gnome to inspect what that agent is doing.</p>';
    return;
  }

  const relatedTasks = (state.tasks || [])
    .filter((task) => task.ownerAgentId === selectedAgent.id || task.targetAgentId === selectedAgent.id)
    .slice(0, 3)
    .map((task) => task.adminLabel || task.publicLabel || task.kind);
  const stationId = manifest?.agents?.[selectedAgent.id]?.stationId || "generated-home";
  const stationLabel = manifest?.stations?.[stationId]?.label || stationId;

  ui.selectedAgentCard.innerHTML = `
    <article class="agent-focus-card">
      <div class="agent-focus-topline">
        <div>
          <h4>${escapeHtml(selectedAgent.name)}</h4>
          <p>${escapeHtml(selectedAgent.role)}</p>
        </div>
        <span class="badge">${escapeHtml(statusLabel(selectedAgent.status))}</span>
      </div>
      <dl class="agent-focus-grid">
        <div class="agent-focus-row">
          <dt>Working on</dt>
          <dd>${escapeHtml(selectedAgent.currentAction.adminLabel || selectedAgent.currentAction.publicLabel || selectedAgent.role)}</dd>
        </div>
        <div class="agent-focus-row">
          <dt>Station</dt>
          <dd>${escapeHtml(formatTarget(stationLabel))}</dd>
        </div>
        <div class="agent-focus-row">
          <dt>Target</dt>
          <dd>${escapeHtml(formatTarget(selectedAgent.targetAgentId || selectedAgent.motionTargetId))}</dd>
        </div>
        <div class="agent-focus-row">
          <dt>Updated</dt>
          <dd>${escapeHtml(formatTime(selectedAgent.lastUpdatedAt))}</dd>
        </div>
        <div class="agent-focus-row">
          <dt>Related tasks</dt>
          <dd>${escapeHtml(relatedTasks.length ? relatedTasks.join(" | ") : "No active linked tasks")}</dd>
        </div>
      </dl>
    </article>
  `;
}

export function showDispatchResult(ui, text, isError = false) {
  ui.dispatchResult.classList.remove("hidden");
  ui.dispatchResult.textContent = text;
  ui.dispatchResult.style.borderColor = isError ? "rgba(255, 154, 143, 0.38)" : "rgba(118, 240, 255, 0.3)";
}
