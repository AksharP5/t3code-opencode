import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createOpenCodeSession,
  fetchOpenCodeHealth,
  getOpenCodeDiff,
  forkOpenCodeSession,
  listOpenCodeQuestions,
  getOpenCodeTodo,
  getOpenCodeVcs,
  replyOpenCodePermission,
  replyOpenCodeQuestion,
  sendOpenCodeMessage,
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
      json: async () => [
        { content: "Ship integration", status: "in_progress", priority: "high" },
      ],
    } as Response);

    await expect(
      getOpenCodeTodo(
        {
          ...config,
          sessionId: "session-1",
        },
        config,
      ),
    ).resolves.toEqual([
      { content: "Ship integration", status: "in_progress", priority: "high" },
    ]);

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
