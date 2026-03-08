import { afterEach, describe, expect, it, vi } from "vitest";
import { createOpenCodeSession, fetchOpenCodeHealth, sendOpenCodeMessage } from "./client";

const config = {
  baseUrl: "http://127.0.0.1:4096",
  autoStart: true,
  password: "secret",
} as const;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("opencode client", () => {
  it("loads health state from the server", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ healthy: true, version: "1.2.3" }),
    } as Response);

    await expect(fetchOpenCodeHealth(config)).resolves.toEqual({
      state: "ready",
      serverUrl: "http://127.0.0.1:4096",
      healthy: true,
      autoStart: true,
      version: "1.2.3",
    });

    const call = fetchMock.mock.calls[0];
    const headers = call?.[1]?.headers as Headers;
    expect(call?.[0]).toBe("http://127.0.0.1:4096/global/health");
    expect(headers.get("Authorization")).toBe("Basic b3BlbmNvZGU6c2VjcmV0");
  });

  it("creates sessions in the requested directory", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "session-1",
        directory: "/tmp/project-a",
        title: "New session",
        time: { created: 1, updated: 1 },
      }),
    } as Response);

    await createOpenCodeSession(
      {
        ...config,
        directory: "/tmp/project-a",
        title: "New session",
      },
      config,
    );

    const call = fetchMock.mock.calls[0];
    const headers = call?.[1]?.headers as Headers;
    expect(call?.[0]).toBe("http://127.0.0.1:4096/session");
    expect(headers.get("x-opencode-directory")).toBe("/tmp/project-a");
    expect(call?.[1]?.body).toBe(JSON.stringify({ title: "New session" }));
  });

  it("sends text parts to continue a session", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          info: {
            id: "message-1",
            sessionID: "session-1",
            role: "assistant",
            time: { created: 1 },
          },
          parts: [{ type: "text", text: "Done" }],
        }),
    } as Response);

    await expect(
      sendOpenCodeMessage(
        {
          ...config,
          sessionId: "session-1",
          text: "Continue",
        },
        config,
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        info: expect.objectContaining({ id: "message-1" }),
      }),
    );

    const call = fetchMock.mock.calls[0];
    expect(call?.[0]).toBe("http://127.0.0.1:4096/session/session-1/message");
    expect(call?.[1]?.body).toBe(JSON.stringify({ parts: [{ type: "text", text: "Continue" }] }));
  });
});
