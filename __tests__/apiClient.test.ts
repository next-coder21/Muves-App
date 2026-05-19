/**
 * Unit tests for utils/apiClient.ts
 *
 * Covers: 200 success, 401/403 auth-error hook, 500 error, network failure,
 * 204 No Content, timeout abort, and skipAuthErrorHook flag.
 */

import {
  apiRequest,
  ApiError,
  setAuthErrorHandler,
} from "../utils/apiClient";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeResponse(
  status: number,
  body: string | null = null,
  ok?: boolean
): Response {
  const resolvedOk = ok !== undefined ? ok : status >= 200 && status < 300;
  return {
    ok: resolvedOk,
    status,
    text: jest.fn().mockResolvedValue(body ?? ""),
  } as unknown as Response;
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

const originalFetch = global.fetch;

beforeEach(() => {
  // Reset the global auth-error handler before every test
  setAuthErrorHandler(null);
  jest.clearAllMocks();
});

afterAll(() => {
  global.fetch = originalFetch;
});

// ---------------------------------------------------------------------------
// 200 — successful response
// ---------------------------------------------------------------------------

describe("200 success", () => {
  it("returns parsed JSON on a successful response", async () => {
    const payload = { id: 1, title: "Hello" };
    global.fetch = jest.fn().mockResolvedValue(
      makeResponse(200, JSON.stringify(payload))
    );

    const result = await apiRequest<typeof payload>("https://api.example.com/songs");
    expect(result).toEqual(payload);
  });

  it("returns raw text when body is non-JSON", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      makeResponse(200, "plain text body")
    );

    const result = await apiRequest<string>("https://api.example.com/text");
    expect(result).toBe("plain text body");
  });

  it("returns undefined when body is empty on a 200", async () => {
    global.fetch = jest.fn().mockResolvedValue(makeResponse(200, ""));

    const result = await apiRequest("https://api.example.com/empty");
    expect(result).toBeUndefined();
  });

  it("sends Authorization header when token is supplied", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      makeResponse(200, JSON.stringify({}))
    );

    await apiRequest("https://api.example.com/protected", { token: "my-token" });

    const callArgs = (global.fetch as jest.Mock).mock.calls[0];
    expect(callArgs[1].headers.Authorization).toBe("Bearer my-token");
  });

  it("sends Content-Type: application/json when a body is provided", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      makeResponse(200, JSON.stringify({}))
    );

    await apiRequest("https://api.example.com/post", {
      method: "POST",
      body: { name: "test" },
    });

    const callArgs = (global.fetch as jest.Mock).mock.calls[0];
    expect(callArgs[1].headers["Content-Type"]).toBe("application/json");
    expect(callArgs[1].body).toBe(JSON.stringify({ name: "test" }));
  });
});

// ---------------------------------------------------------------------------
// 204 No Content
// ---------------------------------------------------------------------------

describe("204 No Content", () => {
  it("returns undefined for a 204 response", async () => {
    global.fetch = jest.fn().mockResolvedValue(makeResponse(204, null));

    const result = await apiRequest("https://api.example.com/delete");
    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 401 — triggers onAuthErrorHandler
// ---------------------------------------------------------------------------

describe("401 Unauthorized", () => {
  it("calls the registered auth-error handler with status 401", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      makeResponse(401, JSON.stringify({ error: "Unauthorized" }), false)
    );

    const handler = jest.fn();
    setAuthErrorHandler(handler);

    await expect(
      apiRequest("https://api.example.com/protected")
    ).rejects.toThrow(ApiError);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(401);
  });

  it("does NOT call the auth-error handler when skipAuthErrorHook is true", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      makeResponse(401, JSON.stringify({ error: "Unauthorized" }), false)
    );

    const handler = jest.fn();
    setAuthErrorHandler(handler);

    await expect(
      apiRequest("https://api.example.com/protected", { skipAuthErrorHook: true })
    ).rejects.toThrow(ApiError);

    expect(handler).not.toHaveBeenCalled();
  });

  it("does NOT crash when no auth-error handler is registered", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      makeResponse(401, JSON.stringify({ error: "Unauthorized" }), false)
    );
    // handler is null (reset in beforeEach)
    await expect(
      apiRequest("https://api.example.com/protected")
    ).rejects.toThrow(ApiError);
  });
});

// ---------------------------------------------------------------------------
// 403 — triggers onAuthErrorHandler
// ---------------------------------------------------------------------------

describe("403 Forbidden", () => {
  it("calls the registered auth-error handler with status 403", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      makeResponse(403, JSON.stringify({ error: "Forbidden" }), false)
    );

    const handler = jest.fn();
    setAuthErrorHandler(handler);

    await expect(
      apiRequest("https://api.example.com/admin")
    ).rejects.toThrow(ApiError);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(403);
  });
});

// ---------------------------------------------------------------------------
// 500 — server error
// ---------------------------------------------------------------------------

describe("500 Server Error", () => {
  it("throws ApiError with status 500 for a JSON error body", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      makeResponse(500, JSON.stringify({ error: "Internal Server Error" }), false)
    );

    let thrown: ApiError | null = null;
    try {
      await apiRequest("https://api.example.com/crash");
    } catch (e) {
      thrown = e as ApiError;
    }

    expect(thrown).toBeInstanceOf(ApiError);
    expect(thrown!.status).toBe(500);
    expect(thrown!.message).toBe("Internal Server Error");
    expect(thrown!.isNetwork).toBe(false);
    expect(thrown!.isTimeout).toBe(false);
  });

  it("throws ApiError with status 500 for a plain-text error body", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      makeResponse(500, "Something went wrong", false)
    );

    let thrown: ApiError | null = null;
    try {
      await apiRequest("https://api.example.com/crash");
    } catch (e) {
      thrown = e as ApiError;
    }

    expect(thrown).toBeInstanceOf(ApiError);
    expect(thrown!.status).toBe(500);
    expect(thrown!.message).toContain("Something went wrong");
  });

  it("throws ApiError with fallback message when 500 body is empty", async () => {
    global.fetch = jest.fn().mockResolvedValue(makeResponse(500, "", false));

    let thrown: ApiError | null = null;
    try {
      await apiRequest("https://api.example.com/crash");
    } catch (e) {
      thrown = e as ApiError;
    }

    expect(thrown).toBeInstanceOf(ApiError);
    expect(thrown!.status).toBe(500);
    expect(thrown!.message).toBe("Request failed (500)");
  });
});

// ---------------------------------------------------------------------------
// Network error — fetch itself throws
// ---------------------------------------------------------------------------

describe("Network error", () => {
  it("throws ApiError with isNetwork=true when fetch rejects", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("Network request failed"));

    let thrown: ApiError | null = null;
    try {
      await apiRequest("https://api.example.com/songs");
    } catch (e) {
      thrown = e as ApiError;
    }

    expect(thrown).toBeInstanceOf(ApiError);
    expect(thrown!.isNetwork).toBe(true);
    expect(thrown!.isTimeout).toBe(false);
    expect(thrown!.message).toBe("Network request failed");
  });
});

// ---------------------------------------------------------------------------
// Timeout
// ---------------------------------------------------------------------------

describe("Timeout", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("throws ApiError with isTimeout=true when request exceeds timeoutMs", async () => {
    global.fetch = jest.fn().mockImplementation(
      (_url: string, opts: RequestInit) =>
        new Promise((_resolve, reject) => {
          // Simulate the signal aborting after the timeout fires
          opts.signal?.addEventListener("abort", () =>
            reject(new DOMException("The operation was aborted.", "AbortError"))
          );
        })
    );

    const requestPromise = apiRequest("https://api.example.com/slow", {
      timeoutMs: 1000,
    });

    // Advance timers past the timeout
    jest.advanceTimersByTime(1001);

    let thrown: ApiError | null = null;
    try {
      await requestPromise;
    } catch (e) {
      thrown = e as ApiError;
    }

    expect(thrown).toBeInstanceOf(ApiError);
    expect(thrown!.isTimeout).toBe(true);
    expect(thrown!.message).toBe("Request timed out");
  });
});
