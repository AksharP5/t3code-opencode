import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createOpenCodeSession,
  authorizeOpenCodeProvider,
  listOpenCodeCommands,
  completeOpenCodeProviderAuth,
  connectOpenCodeMcp,
  fetchOpenCodeHealth,
  getOpenCodeDiff,
  forkOpenCodeSession,
  listOpenCodeQuestions,
  getOpenCodeTodo,
  getOpenCodeVcs,
  listOpenCodeProviderAuthMethods,
  listOpenCodeMcpServers,
  listOpenCodeResources,
  removeOpenCodeProviderAuth,
  removeOpenCodeMcpAuth,
  replyOpenCodePermission,
  replyOpenCodeQuestion,
  revertOpenCodeSession,
  runOpenCodeCommand,
  sendOpenCodeMessage,
  setOpenCodeProviderApiKey,
  shareOpenCodeSession,
  startOpenCodeMcpAuth,
  summarizeOpenCodeSession,
  completeOpenCodeMcpAuth,
  authenticateOpenCodeMcp,
  disconnectOpenCodeMcp,
  unshareOpenCodeSession,
  unrevertOpenCodeSession,
  updateOpenCodeSession,
} from "./client";

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

  it("forwards structured parts and model selection", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      text: async () => "",
    } as Response);

    await sendOpenCodeMessage(
      {
        ...config,
        sessionId: "session-1",
        parts: [
          { type: "text", text: "See attached" },
          {
            type: "file",
            mime: "image/png",
            filename: "diagram.png",
            url: "data:image/png;base64,abc",
          },
        ],
        model: {
          providerID: "anthropic",
          modelID: "claude-3-7-sonnet",
        },
      },
      config,
    );

    const call = fetchMock.mock.calls[0];
    expect(call?.[1]?.body).toBe(
      JSON.stringify({
        model: {
          providerID: "anthropic",
          modelID: "claude-3-7-sonnet",
        },
        parts: [
          { type: "text", text: "See attached" },
          {
            type: "file",
            mime: "image/png",
            filename: "diagram.png",
            url: "data:image/png;base64,abc",
          },
        ],
      }),
    );
  });

  it("updates canonical OpenCode session permissions", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "session-1",
        directory: "/tmp/project-a",
        title: "New session",
        permission: [{ permission: "*", pattern: "*", action: "allow" }],
        time: { created: 1, updated: 1 },
      }),
    } as Response);

    await updateOpenCodeSession(
      {
        ...config,
        sessionId: "session-1",
        permission: [{ permission: "*", pattern: "*", action: "allow" }],
      },
      config,
    );

    const call = fetchMock.mock.calls[0];
    expect(call?.[1]?.body).toBe(
      JSON.stringify({ permission: [{ permission: "*", pattern: "*", action: "allow" }] }),
    );
  });

  it("forks sessions into a requested directory", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "session-2",
        directory: "/tmp/project-a/.branches/feature-opencode",
        title: "Forked session",
        time: { created: 1, updated: 1 },
      }),
    } as Response);

    await forkOpenCodeSession(
      {
        ...config,
        sessionId: "session-1",
        directory: "/tmp/project-a/.branches/feature-opencode",
        permission: [{ permission: "*", pattern: "*", action: "allow" }],
      },
      config,
    );

    const call = fetchMock.mock.calls[0];
    expect(call?.[0]).toBe("http://127.0.0.1:4096/session/session-1/fork");
    expect(call?.[1]?.body).toBe(
      JSON.stringify({
        directory: "/tmp/project-a/.branches/feature-opencode",
        permission: [{ permission: "*", pattern: "*", action: "allow" }],
      }),
    );
  });

  it("loads session todos", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => [{ content: "Ship integration", status: "in_progress", priority: "high" }],
    } as Response);

    await expect(
      getOpenCodeTodo(
        {
          ...config,
          sessionId: "session-1",
        },
        config,
      ),
    ).resolves.toEqual([{ content: "Ship integration", status: "in_progress", priority: "high" }]);

    const call = fetchMock.mock.calls[0];
    expect(call?.[0]).toBe("http://127.0.0.1:4096/session/session-1/todo");
  });

  it("loads session diffs", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => [
        {
          file: "src/app.ts",
          before: "old",
          after: "new",
          additions: 3,
          deletions: 1,
          status: "modified",
        },
      ],
    } as Response);

    await expect(
      getOpenCodeDiff(
        {
          ...config,
          sessionId: "session-1",
        },
        config,
      ),
    ).resolves.toEqual([
      {
        file: "src/app.ts",
        before: "old",
        after: "new",
        additions: 3,
        deletions: 1,
        status: "modified",
      },
    ]);

    const call = fetchMock.mock.calls[0];
    expect(call?.[0]).toBe("http://127.0.0.1:4096/session/session-1/diff");
  });

  it("loads pending question requests", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: "question-1",
          sessionID: "session-1",
          questions: [
            {
              question: "Continue?",
              header: "Continue",
              options: [{ label: "Yes", description: "Continue the task" }],
            },
          ],
        },
      ],
    } as Response);

    await expect(listOpenCodeQuestions(config)).resolves.toEqual([
      {
        id: "question-1",
        sessionID: "session-1",
        questions: [
          {
            question: "Continue?",
            header: "Continue",
            options: [{ label: "Yes", description: "Continue the task" }],
          },
        ],
      },
    ]);

    const call = fetchMock.mock.calls[0];
    expect(call?.[0]).toBe("http://127.0.0.1:4096/question");
  });

  it("loads provider auth methods", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        openai: [{ type: "api", label: "API key" }],
      }),
    } as Response);

    await expect(listOpenCodeProviderAuthMethods(config)).resolves.toEqual({
      openai: [{ type: "api", label: "API key" }],
    });

    const call = fetchMock.mock.calls[0];
    expect(call?.[0]).toBe("http://127.0.0.1:4096/provider/auth");
  });

  it("stores provider api keys", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => true,
    } as Response);

    await expect(
      setOpenCodeProviderApiKey({ ...config, providerId: "openai", apiKey: "sk-test" }, config),
    ).resolves.toBe(true);

    const call = fetchMock.mock.calls[0];
    expect(call?.[0]).toBe("http://127.0.0.1:4096/provider/openai/api");
    expect(call?.[1]?.body).toBe(JSON.stringify({ key: "sk-test" }));
  });

  it("starts provider oauth flows", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        url: "https://provider.example/auth",
        method: "auto",
        instructions: "Sign in",
      }),
    } as Response);

    await expect(
      authorizeOpenCodeProvider({ ...config, providerId: "openai", method: 0 }, config),
    ).resolves.toEqual({
      url: "https://provider.example/auth",
      method: "auto",
      instructions: "Sign in",
    });

    const call = fetchMock.mock.calls[0];
    expect(call?.[0]).toBe("http://127.0.0.1:4096/provider/openai/oauth/authorize");
  });

  it("completes provider oauth flows", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => true,
    } as Response);

    await expect(
      completeOpenCodeProviderAuth(
        { ...config, providerId: "openai", method: 0, code: "oauth-code" },
        config,
      ),
    ).resolves.toBe(true);

    const call = fetchMock.mock.calls[0];
    expect(call?.[0]).toBe("http://127.0.0.1:4096/provider/openai/oauth/callback");
    expect(call?.[1]?.body).toBe(JSON.stringify({ method: 0, code: "oauth-code" }));
  });

  it("removes provider auth", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => true,
    } as Response);

    await expect(
      removeOpenCodeProviderAuth({ ...config, providerId: "openai" }, config),
    ).resolves.toBe(true);

    const call = fetchMock.mock.calls[0];
    expect(call?.[0]).toBe("http://127.0.0.1:4096/provider/openai/auth");
    expect(call?.[1]?.method).toBe("DELETE");
  });

  it("loads MCP server statuses", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ github: { status: "needs_auth" } }),
    } as Response);

    await expect(listOpenCodeMcpServers(config)).resolves.toEqual({
      github: { status: "needs_auth" },
    });

    const call = fetchMock.mock.calls[0];
    expect(call?.[0]).toBe("http://127.0.0.1:4096/mcp");
  });

  it("loads OpenCode commands and resources", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { name: "review", description: "Review changes", template: "review", hints: [] },
        ],
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          resourceA: { name: "resourceA", uri: "mcp://resourceA", client: "github" },
        }),
      } as Response);

    await expect(listOpenCodeCommands(config)).resolves.toHaveLength(1);
    await expect(listOpenCodeResources(config)).resolves.toEqual({
      resourceA: { name: "resourceA", uri: "mcp://resourceA", client: "github" },
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://127.0.0.1:4096/command");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("http://127.0.0.1:4096/experimental/resource");
  });

  it("starts MCP oauth", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ authorizationUrl: "https://mcp.example/auth" }),
    } as Response);

    await expect(
      startOpenCodeMcpAuth({ ...config, serverName: "github" }, config),
    ).resolves.toEqual({
      authorizationUrl: "https://mcp.example/auth",
    });

    const call = fetchMock.mock.calls[0];
    expect(call?.[0]).toBe("http://127.0.0.1:4096/mcp/github/auth");
  });

  it("completes MCP oauth", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ status: "connected" }),
    } as Response);

    await expect(
      completeOpenCodeMcpAuth({ ...config, serverName: "github", code: "oauth-code" }, config),
    ).resolves.toEqual({ status: "connected" });

    const call = fetchMock.mock.calls[0];
    expect(call?.[0]).toBe("http://127.0.0.1:4096/mcp/github/auth/callback");
    expect(call?.[1]?.body).toBe(JSON.stringify({ code: "oauth-code" }));
  });

  it("authenticates MCP servers", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ status: "connected" }),
    } as Response);

    await expect(
      authenticateOpenCodeMcp({ ...config, serverName: "github" }, config),
    ).resolves.toEqual({
      status: "connected",
    });

    const call = fetchMock.mock.calls[0];
    expect(call?.[0]).toBe("http://127.0.0.1:4096/mcp/github/auth/authenticate");
  });

  it("removes MCP auth", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    await expect(removeOpenCodeMcpAuth({ ...config, serverName: "github" }, config)).resolves.toBe(
      true,
    );

    const call = fetchMock.mock.calls[0];
    expect(call?.[0]).toBe("http://127.0.0.1:4096/mcp/github/auth");
    expect(call?.[1]?.method).toBe("DELETE");
  });

  it("connects and disconnects MCP servers", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({ ok: true, json: async () => true } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => true } as Response);

    await expect(connectOpenCodeMcp({ ...config, serverName: "github" }, config)).resolves.toBe(
      true,
    );
    await expect(disconnectOpenCodeMcp({ ...config, serverName: "github" }, config)).resolves.toBe(
      true,
    );

    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://127.0.0.1:4096/mcp/github/connect");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("http://127.0.0.1:4096/mcp/github/disconnect");
  });

  it("runs commands and summarizes sessions", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          info: {
            id: "message-1",
            sessionID: "session-1",
            role: "assistant",
            time: { created: 1 },
          },
          parts: [],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => true,
      } as Response);

    await expect(
      runOpenCodeCommand(
        { ...config, sessionId: "session-1", command: "review", arguments: "--staged" },
        config,
      ),
    ).resolves.toMatchObject({ info: { id: "message-1" } });

    await expect(
      summarizeOpenCodeSession(
        {
          ...config,
          sessionId: "session-1",
          providerID: "anthropic",
          modelID: "claude-3-7-sonnet",
        },
        config,
      ),
    ).resolves.toBe(true);

    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://127.0.0.1:4096/session/session-1/command");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("http://127.0.0.1:4096/session/session-1/summarize");
  });

  it("replies to OpenCode permission prompts", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => true,
    } as Response);

    await expect(
      replyOpenCodePermission(
        {
          ...config,
          requestId: "permission-1",
          reply: "once",
        },
        config,
      ),
    ).resolves.toBe(true);

    const call = fetchMock.mock.calls[0];
    expect(call?.[0]).toBe("http://127.0.0.1:4096/permission/permission-1/reply");
    expect(call?.[1]?.body).toBe(JSON.stringify({ reply: "once" }));
  });

  it("replies to OpenCode question prompts", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => true,
    } as Response);

    await expect(
      replyOpenCodeQuestion(
        {
          ...config,
          requestId: "question-1",
          answers: [["Yes"]],
        },
        config,
      ),
    ).resolves.toBe(true);

    const call = fetchMock.mock.calls[0];
    expect(call?.[0]).toBe("http://127.0.0.1:4096/question/question-1/reply");
    expect(call?.[1]?.body).toBe(JSON.stringify({ answers: [["Yes"]] }));
  });

  it("reverts OpenCode sessions to a message", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "session-1",
        directory: "/tmp/project-a",
        title: "Build feature",
        time: { created: 1, updated: 2 },
      }),
    } as Response);

    await revertOpenCodeSession(
      {
        ...config,
        sessionId: "session-1",
        messageId: "message-1",
      },
      config,
    );

    const call = fetchMock.mock.calls[0];
    expect(call?.[0]).toBe("http://127.0.0.1:4096/session/session-1/revert");
    expect(call?.[1]?.body).toBe(JSON.stringify({ messageID: "message-1" }));
  });

  it("shares OpenCode sessions", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "session-1",
        directory: "/tmp/project-a",
        title: "Build feature",
        share: { url: "https://share.example/session-1" },
        time: { created: 1, updated: 2 },
      }),
    } as Response);

    await shareOpenCodeSession({ ...config, sessionId: "session-1" }, config);

    const call = fetchMock.mock.calls[0];
    expect(call?.[0]).toBe("http://127.0.0.1:4096/session/session-1/share");
    expect(call?.[1]?.method).toBe("POST");
  });

  it("unshares OpenCode sessions", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "session-1",
        directory: "/tmp/project-a",
        title: "Build feature",
        time: { created: 1, updated: 2 },
      }),
    } as Response);

    await unshareOpenCodeSession({ ...config, sessionId: "session-1" }, config);

    const call = fetchMock.mock.calls[0];
    expect(call?.[0]).toBe("http://127.0.0.1:4096/session/session-1/share");
    expect(call?.[1]?.method).toBe("DELETE");
  });

  it("restores reverted OpenCode sessions", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "session-1",
        directory: "/tmp/project-a",
        title: "Build feature",
        time: { created: 1, updated: 2 },
      }),
    } as Response);

    await unrevertOpenCodeSession({ ...config, sessionId: "session-1" }, config);

    const call = fetchMock.mock.calls[0];
    expect(call?.[0]).toBe("http://127.0.0.1:4096/session/session-1/unrevert");
    expect(call?.[1]?.method).toBe("POST");
  });

  it("loads VCS info for the requested directory", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ branch: "feature/opencode" }),
    } as Response);

    await expect(
      getOpenCodeVcs(
        {
          ...config,
          directory: "/tmp/project-a",
        },
        config,
      ),
    ).resolves.toEqual({ branch: "feature/opencode" });

    const call = fetchMock.mock.calls[0];
    const headers = call?.[1]?.headers as Headers;
    expect(call?.[0]).toBe("http://127.0.0.1:4096/vcs");
    expect(headers.get("x-opencode-directory")).toBe("/tmp/project-a");
  });
});
