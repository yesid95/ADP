import { describe, expect, it, vi } from "vitest";
import { ApiError, createApiClient } from "./api.js";

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

describe("API client", () => {
  it("keeps access tokens in memory and refresh tokens in session storage", async () => {
    const storage = new Map();
    const storageAdapter = {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key)
    };
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      jsonResponse(200, { accessToken: "access", refreshToken: "refresh" })
    );
    const client = createApiClient({ baseUrl: "http://api.test", fetchImpl, storage: storageAdapter });
    await client.login({ email: "buyer@example.test", password: "password" });
    expect(client.getAccessToken()).toBe("access");
    expect([...storage.values()]).toEqual(["refresh"]);
  });

  it("rotates once and retries a request after 401", async () => {
    const storage = {
      value: "old-refresh",
      getItem() { return this.value; },
      setItem(_key, value) { this.value = value; },
      removeItem() { this.value = null; }
    };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { error: { code: "TOKEN_EXPIRED" } }))
      .mockResolvedValueOnce(
        jsonResponse(200, { accessToken: "new-access", refreshToken: "new-refresh" })
      )
      .mockResolvedValueOnce(jsonResponse(200, { data: { id: "user-1" } }));
    const client = createApiClient({ baseUrl: "http://api.test", fetchImpl, storage });
    await expect(client.request("/me")).resolves.toEqual({ data: { id: "user-1" } });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(storage.value).toBe("new-refresh");
  });

  it("maps structured backend failures", async () => {
    const client = createApiClient({
      baseUrl: "http://api.test",
      fetchImpl: vi.fn().mockResolvedValue(
        jsonResponse(403, {
          error: { code: "ROLE_FORBIDDEN", message: "No autorizado", requestId: "request-1" }
        })
      ),
      storage: null
    });
    await expect(client.request("/farms")).rejects.toEqual(
      expect.objectContaining({
        name: "ApiError",
        status: 403,
        code: "ROLE_FORBIDDEN",
        requestId: "request-1"
      })
    );
    await expect(Promise.reject(new ApiError(400, "TEST", "error"))).rejects.toBeInstanceOf(
      ApiError
    );
  });
});
