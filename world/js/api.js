function manualOverrideAllowed() {
  return Boolean(
    window.JARVIS_WORLD_CONFIG.allowManualBridgeOverride
    || window.JARVIS_WORLD_CONFIG.bridgeConfig?.allowManualBridgeOverride
  );
}

const ADMIN_TOKEN_KEY = "jarvis-world-admin-token";

function getConfiguredApiBase() {
  return String(
    window.JARVIS_WORLD_CONFIG.bridgeConfig?.apiBaseUrl
    || window.JARVIS_WORLD_CONFIG.defaultApiBaseUrl
    || ""
  ).trim().replace(/\/$/, "");
}

function getStoredApiBase() {
  const configured = getConfiguredApiBase();
  const stored = String(localStorage.getItem("jarvis-world-api-base") || "").trim().replace(/\/$/, "");

  if (!manualOverrideAllowed()) {
    if (stored && configured && stored !== configured) {
      localStorage.removeItem("jarvis-world-api-base");
    }
    return configured || stored || "";
  }

  return stored || configured || "";
}

export function setStoredApiBase(value) {
  const trimmed = String(value || "").trim().replace(/\/$/, "");
  if (manualOverrideAllowed()) {
    localStorage.setItem("jarvis-world-api-base", trimmed);
  }
  return trimmed;
}

export function clearStoredApiBase() {
  localStorage.removeItem("jarvis-world-api-base");
}

function getAdminToken() {
  return String(localStorage.getItem(ADMIN_TOKEN_KEY) || "").trim();
}

function setAdminToken(token) {
  const normalized = String(token || "").trim();
  if (normalized) {
    localStorage.setItem(ADMIN_TOKEN_KEY, normalized);
  } else {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
  }
  return normalized;
}

export function clearAdminToken() {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
}

export function getApiBase() {
  return getStoredApiBase();
}

function buildUrl(pathname) {
  const base = getStoredApiBase();
  return `${base}${pathname}`;
}

async function request(pathname, options = {}) {
  let response;
  const adminToken = getAdminToken();
  try {
    response = await fetch(buildUrl(pathname), {
      cache: "no-store",
      credentials: options.credentials || "omit",
      ...options,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
        ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
        ...(options.headers || {})
      }
    });
  } catch (error) {
    throw new Error("Bridge unreachable from this browser. It usually means the public site has the wrong bridge URL, the bridge is not public HTTPS, or CORS is not allowing this site.");
  }

  const data = await response.json().catch(() => ({
    ok: false,
    error: "Invalid JSON response. The bridge may be returning HTML instead of JSON."
  }));
  if (!response.ok) {
    const message = data?.error || `Request failed with ${response.status}`;
    throw new Error(message);
  }
  return data;
}

export async function fetchPublicState() {
  return request("/world-api/public/state", {
    credentials: "omit"
  });
}

export async function fetchAdminState() {
  return request("/world-api/admin/state", {
    credentials: "include"
  });
}

export async function login(password) {
  const payload = await request("/world-api/admin/login", {
    method: "POST",
    credentials: "include",
    body: JSON.stringify({ password })
  });
  setAdminToken(payload.token || "");
  return payload;
}

export async function logout() {
  const payload = await request("/world-api/admin/logout", {
    method: "POST",
    credentials: "include",
    body: JSON.stringify({})
  });
  clearAdminToken();
  return payload;
}

export async function dispatch(message) {
  return request("/world-api/admin/dispatch", {
    method: "POST",
    credentials: "include",
    body: JSON.stringify({ message })
  });
}
