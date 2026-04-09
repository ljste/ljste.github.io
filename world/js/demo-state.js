export function createDemoState(manifest, mode = "guest") {
  const now = Date.now();
  const agents = Object.entries(manifest.agents || {}).map(([agentId, details]) => ({
    id: agentId,
    name: details.displayName || agentId,
    role: details.publicRoleLabel || "helping around town",
    stationId: details.stationId,
    spriteKey: details.spriteKey || "npc",
    status: agentId === "main" ? "moving" : "idle",
    currentAction: {
      publicLabel: agentId === "main" ? "coordinating the team" : (details.publicRoleLabel || "standing by"),
      adminLabel: agentId === "main" ? "Bridge offline demo mode" : `${details.displayName || agentId} is waiting for live data`
    },
    motionTargetId: agentId === "main" ? "quest-board" : details.stationId,
    targetAgentId: agentId === "main" ? "coder" : null,
    lastUpdatedAt: now - 60000
  }));

  return {
    generatedAt: now,
    mode,
    system: {
      healthy: false,
      rpcOk: false,
      gatewayStatus: "offline",
      generatedAt: now,
      agentCount: agents.length,
      taskCount: 2,
      activeAgents: 1
    },
    agents,
    tasks: [
      {
        id: "demo:cron",
        kind: "cron",
        ownerAgentId: "slacker",
        status: "scheduled",
        publicLabel: "scheduled digest duty",
        adminLabel: "Demo scheduled report",
        updatedAt: now - 1800000,
        nextRunAt: now + 1800000,
        motionTargetId: "quest-board"
      },
      {
        id: "demo:delegation",
        kind: "delegation",
        ownerAgentId: "main",
        targetAgentId: "coder",
        status: "running",
        publicLabel: "writing code",
        adminLabel: "Demo delegation from Jarvis to Coder",
        updatedAt: now - 120000,
        motionTargetId: "station:coder"
      }
    ],
    events: [
      {
        id: "demo:event:1",
        timestamp: now - 90000,
        agentId: "main",
        targetAgentId: "coder",
        publicText: "Jarvis delegated new work to Coder.",
        adminText: "Bridge offline demo mode: no live system connected yet."
      }
    ]
  };
}
