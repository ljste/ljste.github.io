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
  if (!status) {
    return "Unknown";
  }
  const normalized = String(status).replaceAll("_", " ");
  return normalized[0].toUpperCase() + normalized.slice(1);
}

function stageLabel(stage, fallbackStatus = "") {
  const value = String(stage || "").toLowerCase();
  if (value === "idle_patrol") {
    return "Patrolling";
  }
  if (value === "commuting") {
    return "Commuting";
  }
  if (value === "working") {
    return "Working";
  }
  if (value === "returning") {
    return "Returning";
  }
  if (value === "offline") {
    return "Offline";
  }
  return statusLabel(fallbackStatus);
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

function timelineMarkup(items = [], isAdmin = false) {
  if (!items.length) {
    return '<p class="agent-focus-empty">No recent work history yet.</p>';
  }

  return `
    <ol class="timeline-list">
      ${items.map((item) => `
        <li class="timeline-item">
          <div class="timeline-meta">
            <span>${escapeHtml(formatTime(item.timestamp))}</span>
            <span>${escapeHtml(stageLabel(item.status, item.status))}</span>
          </div>
          <div class="timeline-body">
            <strong>${escapeHtml(isAdmin ? (item.adminLabel || item.publicLabel) : item.publicLabel)}</strong>
            ${isAdmin && item.partnerAgentId ? `<small>Partner ${escapeHtml(item.partnerAgentId)}</small>` : ""}
          </div>
        </li>
      `).join("")}
    </ol>
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
    selectedAgentHint: document.getElementById("selected-agent-hint"),
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
    ui.selectedAgentSection.classList.toggle("hidden", !hasEntered);
    ui.selectedAgentHint.textContent = "Click any gnome for the full internal timeline.";
  } else {
    ui.modeLabel.textContent = hasEntered ? "Guest world" : "Access gate";
    ui.commandTitle.textContent = hasEntered ? "Guest observatory" : "Access gate";
    ui.commandStatus.textContent = hasEntered ? "Observe-only" : "Choose a lane";
    ui.guestCommand.classList.remove("hidden");
    ui.dispatchForm.classList.add("hidden");
    ui.deckAdminRow.classList.add("hidden");
    ui.selectedAgentSection.classList.toggle("hidden", !hasEntered);
    ui.selectedAgentHint.textContent = "Click any gnome for a public-safe recent timeline.";
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
      const label = isAdmin
        ? (agent.currentAction.adminLabel || agent.currentAction.publicLabel)
        : agent.currentAction.publicLabel;
      const selectedClass = agent.id === selectedAgentId ? " is-selected" : "";
      return `
        <article class="list-card${selectedClass}" data-agent-id="${escapeHtml(agent.id)}">
          <div class="card-topline">
            <h4>${escapeHtml(agent.name)}</h4>
            <span class="badge">${escapeHtml(stageLabel(agent.activityStage, agent.status))}</span>
          </div>
          <p>${escapeHtml(label || agent.role)}</p>
          <small>${escapeHtml(`${agent.role} | Updated ${formatTime(agent.lastUpdatedAt)}`)}</small>
        </article>
      `;
    })
    .join("");

  ui.taskList.innerHTML = (state.tasks || [])
    .map((task) => {
      const label = isAdmin ? (task.adminLabel || task.publicLabel) : task.publicLabel;
      const timing = task.nextRunAt
        ? `Next ${formatTime(task.nextRunAt)}`
        : `Updated ${formatTime(task.updatedAt)}`;
      return cardMarkup(
        label || "Tracked work",
        `Owner ${task.ownerAgentId}${task.targetAgentId ? ` -> ${task.targetAgentId}` : ""}`,
        timing,
        task.kind || "task"
      );
    })
    .join("");

  ui.eventList.innerHTML = (state.events || [])
    .map((event) => {
      const text = isAdmin ? (event.adminText || event.publicText) : event.publicText;
      return cardMarkup(text || "Village activity", "", formatTime(event.timestamp));
    })
    .join("");

  const selectedAgent = (state.agents || []).find((agent) => agent.id === selectedAgentId);
  if (!selectedAgent) {
    ui.selectedAgentCard.innerHTML = '<p class="agent-focus-empty">Click a gnome to inspect its recent activity.</p>';
    return;
  }

  const stationId = manifest?.agents?.[selectedAgent.id]?.stationId || selectedAgent.stationId || "generated-home";
  const stationLabel = manifest?.stations?.[stationId]?.label || stationId;
  const currentLabel = isAdmin
    ? (selectedAgent.currentAction.adminLabel || selectedAgent.currentAction.publicLabel || selectedAgent.role)
    : (selectedAgent.currentAction.publicLabel || selectedAgent.role);
  const nextDuty = selectedAgent.nextDuty
    ? `${isAdmin ? (selectedAgent.nextDuty.adminLabel || selectedAgent.nextDuty.publicLabel) : selectedAgent.nextDuty.publicLabel} (${formatTime(selectedAgent.nextDuty.nextRunAt)})`
    : "None scheduled";
  const snippet = isAdmin && selectedAgent.latestSnippet ? selectedAgent.latestSnippet : "";
  const history = selectedAgent.history || [];

  ui.selectedAgentCard.innerHTML = `
    <article class="agent-focus-card">
      <div class="agent-focus-topline">
        <div>
          <h4>${escapeHtml(selectedAgent.name)}</h4>
          <p>${escapeHtml(selectedAgent.role)}</p>
        </div>
        <span class="badge">${escapeHtml(stageLabel(selectedAgent.activityStage, selectedAgent.status))}</span>
      </div>

      <div class="agent-focus-stack">
        <div class="agent-callout">
          <span class="eyebrow">Current</span>
          <strong>${escapeHtml(currentLabel)}</strong>
        </div>

        <dl class="agent-focus-grid">
          <div class="agent-focus-row">
            <dt>Stage</dt>
            <dd>${escapeHtml(stageLabel(selectedAgent.activityStage, selectedAgent.status))}</dd>
          </div>
          <div class="agent-focus-row">
            <dt>Station</dt>
            <dd>${escapeHtml(formatTarget(stationLabel))}</dd>
          </div>
          <div class="agent-focus-row">
            <dt>Partner</dt>
            <dd>${escapeHtml(formatTarget(selectedAgent.partnerAgentId))}</dd>
          </div>
          <div class="agent-focus-row">
            <dt>Next duty</dt>
            <dd>${escapeHtml(nextDuty)}</dd>
          </div>
          <div class="agent-focus-row">
            <dt>Updated</dt>
            <dd>${escapeHtml(formatTime(selectedAgent.lastUpdatedAt))}</dd>
          </div>
          ${snippet ? `
            <div class="agent-focus-row">
              <dt>Snippet</dt>
              <dd>${escapeHtml(snippet)}</dd>
            </div>
          ` : ""}
        </dl>

        <div class="timeline-block">
          <div class="section-row">
            <h3>Recent timeline</h3>
            <small>${escapeHtml(isAdmin ? "Internal recent work log" : "Public-safe recent work log")}</small>
          </div>
          ${timelineMarkup(history, isAdmin)}
        </div>
      </div>
    </article>
  `;
}

export function showDispatchResult(ui, text, isError = false) {
  ui.dispatchResult.classList.remove("hidden");
  ui.dispatchResult.textContent = text;
  ui.dispatchResult.style.borderColor = isError ? "rgba(255, 154, 143, 0.38)" : "rgba(118, 240, 255, 0.3)";
}
