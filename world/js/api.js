function getStoredApiBase() {
  return localStorage.getItem("jarvis-world-api-base") || window.JARVIS_WORLD_CONFIG.defaultApiBaseUrl || "";
}

export function setStoredApiBase(value) {
  const trimmed = String(value || "").trim().replace(/\/$/, "");
  localStorage.setItem("jarvis-world-api-base", trimmed);
  return trimmed;
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
  try {
    response = await fetch(buildUrl(pathname), {
      credentials: "include",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    });
  } catch (error) {
    throw new Error("Bridge unreachable from this browser. It usually means the public site has the wrong bridge URL, the bridge is not public HTTPS, or CORS is not allowing this site.");
  }

  const data = await response.json().catch(() => ({ ok: false, error: "Invalid JSON response." }));
  if (!response.ok) {
    const message = data?.error || `Request failed with ${response.status}`;
    throw new Error(message);
  }
  return data;
}

export async function fetchPublicState() {
  return request("/world-api/public/state");
}

export async function fetchAdminState() {
  return request("/world-api/admin/state");
}

export async function login(password) {
  return request("/world-api/admin/login", {
    method: "POST",
    body: JSON.stringify({ password })
  });
}

export async function logout() {
  return request("/world-api/admin/logout", {
    method: "POST",
    body: JSON.stringify({})
  });
}

export async function dispatch(message) {
  return request("/world-api/admin/dispatch", {
    method: "POST",
    body: JSON.stringify({ message })
  });
}
