const REFRESH_STORAGE_KEY = "adp.refreshToken";

export class ApiError extends Error {
  constructor(status, code, message, requestId) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

function normalizeBaseUrl(value) {
  return String(value || "http://127.0.0.1:3000/api/v1").replace(/\/$/, "");
}

export function createApiClient({
  baseUrl = import.meta.env.VITE_API_URL,
  fetchImpl = globalThis.fetch,
  storage = globalThis.sessionStorage
} = {}) {
  const apiBaseUrl = normalizeBaseUrl(baseUrl);
  let accessToken = null;
  let refreshPromise = null;

  function saveTokens(tokens) {
    accessToken = tokens?.accessToken ?? null;
    if (tokens?.refreshToken) {
      storage?.setItem(REFRESH_STORAGE_KEY, tokens.refreshToken);
    }
    return tokens;
  }

  function clearSession() {
    accessToken = null;
    storage?.removeItem(REFRESH_STORAGE_KEY);
  }

  async function parseResponse(response) {
    if (response.status === 204) return null;
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      if (!response.ok) {
        throw new ApiError(response.status, "HTTP_ERROR", "La operación no pudo completarse");
      }
      return response.blob();
    }
    const payload = await response.json();
    if (!response.ok) {
      const error = payload?.error ?? {};
      throw new ApiError(
        response.status,
        error.code || "API_ERROR",
        error.message || "La operación no pudo completarse",
        error.requestId
      );
    }
    return payload;
  }

  async function refresh() {
    const refreshToken = storage?.getItem(REFRESH_STORAGE_KEY);
    if (!refreshToken) return null;
    if (!refreshPromise) {
      refreshPromise = fetchImpl(`${apiBaseUrl}/auth/refresh`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refreshToken })
      })
        .then(parseResponse)
        .then(saveTokens)
        .catch((error) => {
          clearSession();
          throw error;
        })
        .finally(() => {
          refreshPromise = null;
        });
    }
    return refreshPromise;
  }

  async function request(path, options = {}, retry = true) {
    const headers = new Headers(options.headers || {});
    const bodyIsRaw =
      options.body instanceof Blob ||
      options.body instanceof ArrayBuffer ||
      ArrayBuffer.isView(options.body);
    let body = options.body;
    if (body !== undefined && body !== null && !bodyIsRaw && typeof body !== "string") {
      headers.set("content-type", "application/json");
      body = JSON.stringify(body);
    }
    if (accessToken) headers.set("authorization", `Bearer ${accessToken}`);

    const response = await fetchImpl(`${apiBaseUrl}${path}`, {
      ...options,
      headers,
      body
    });
    if (response.status === 401 && retry && storage?.getItem(REFRESH_STORAGE_KEY)) {
      await refresh();
      return request(path, options, false);
    }
    return parseResponse(response);
  }

  async function login(credentials) {
    const tokens = await request("/auth/login", { method: "POST", body: credentials }, false);
    return saveTokens(tokens);
  }

  async function logout() {
    const refreshToken = storage?.getItem(REFRESH_STORAGE_KEY);
    try {
      if (refreshToken) {
        await request("/auth/logout", { method: "POST", body: { refreshToken } }, false);
      }
    } finally {
      clearSession();
    }
  }

  return {
    request,
    login,
    logout,
    refresh,
    bootstrap: refresh,
    clearSession,
    saveTokens,
    hasStoredSession: () => Boolean(storage?.getItem(REFRESH_STORAGE_KEY)),
    getAccessToken: () => accessToken
  };
}

export const apiClient = createApiClient();

export function idempotencyKey(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}
