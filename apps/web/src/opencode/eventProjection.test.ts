import type {
  OpenCodeEvent,
  OpenCodeMessage,
  OpenCodePermissionRequest,
  OpenCodeRuntimeStatus,
  OpenCodeSession,
} from "@t3tools/contracts";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { applyOpenCodeEventToQueryCache } from "./eventProjection";
import { opencodeQueryKeys } from "./reactQuery";

const config = {
  baseUrl: "http://127.0.0.1:4096",
  autoStart: true,
} as const;

function makeEvent(input: Partial<OpenCodeEvent>): OpenCodeEvent {
  return {
    directory: "/tmp/project-a",
    payload: {
      type: "server.connected",
      properties: {},
    },
    ...input,
  };
}

function makeMessage(): OpenCodeMessage {
  return {
    info: {
      id: "message-1",
      sessionID: "session-1",
      role: "assistant",
      time: { created: 1 },
    },
    parts: [
      {
        id: "part-1",
        sessionID: "session-1",
        messageID: "message-1",
        type: "text",
        text: "Hel",
      },
    ],
  };
}

function makeSession(overrides: Partial<OpenCodeSession> = {}): OpenCodeSession {
  return {
    id: "session-1",
    directory: "/tmp/project-a/worktree-a",
    title: "Build feature",
    time: {
      created: 1,
      updated: 2,
    },
    ...overrides,
  } as OpenCodeSession;
}

describe("applyOpenCodeEventToQueryCache", () => {
  it("patches message delta events in place", async () => {
    const queryClient = new QueryClient();
    const queryKey = opencodeQueryKeys.messages({ ...config, sessionId: "session-1" });
    queryClient.setQueryData(queryKey, [makeMessage()]);

    await applyOpenCodeEventToQueryCache(
      queryClient,
      makeEvent({
        payload: {
          type: "message.part.delta",
          properties: {
            sessionID: "session-1",
            messageID: "message-1",
            partID: "part-1",
            field: "text",
            delta: "lo",
          },
        },
      }),
    );

    expect(queryClient.getQueryData<OpenCodeMessage[]>(queryKey)?.[0]?.parts[0]?.text).toBe(
      "Hello",
    );
  });

  it("tracks permission asks and replies without a refetch", async () => {
    const queryClient = new QueryClient();
    const queryKey = opencodeQueryKeys.permissions(config);
    queryClient.setQueryData(queryKey, [] as OpenCodePermissionRequest[]);

    await applyOpenCodeEventToQueryCache(
      queryClient,
      makeEvent({
        payload: {
          type: "permission.asked",
          properties: {
            id: "permission-1",
            sessionID: "session-1",
            permission: "edit",
            patterns: ["src/app.ts"],
            metadata: {},
            always: ["src/app.ts"],
          },
        },
      }),
    );

    expect(queryClient.getQueryData<OpenCodePermissionRequest[]>(queryKey)).toHaveLength(1);

    await applyOpenCodeEventToQueryCache(
      queryClient,
      makeEvent({
        payload: {
          type: "permission.replied",
          properties: {
            sessionID: "session-1",
            requestID: "permission-1",
            reply: "once",
          },
        },
      }),
    );

    expect(queryClient.getQueryData<OpenCodePermissionRequest[]>(queryKey)).toEqual([]);
  });

  it("updates cached todos from todo events", async () => {
    const queryClient = new QueryClient();
    const queryKey = opencodeQueryKeys.todo({ ...config, sessionId: "session-1" });
    queryClient.setQueryData(queryKey, []);

    await applyOpenCodeEventToQueryCache(
      queryClient,
      makeEvent({
        payload: {
          type: "todo.updated",
          properties: {
            sessionID: "session-1",
            todos: [{ content: "Ship integration", status: "in_progress", priority: "high" }],
          },
        },
      }),
    );

    expect(queryClient.getQueryData(queryKey)).toEqual([
      { content: "Ship integration", status: "in_progress", priority: "high" },
    ]);
  });

  it("tracks question asks and replies without a refetch", async () => {
    const queryClient = new QueryClient();
    const queryKey = opencodeQueryKeys.questions(config);
    queryClient.setQueryData(queryKey, []);

    await applyOpenCodeEventToQueryCache(
      queryClient,
      makeEvent({
        payload: {
          type: "question.asked",
          properties: {
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
        },
      }),
    );

    expect(queryClient.getQueryData(queryKey)).toHaveLength(1);

    await applyOpenCodeEventToQueryCache(
      queryClient,
      makeEvent({
        payload: {
          type: "question.replied",
          properties: {
            sessionID: "session-1",
            requestID: "question-1",
          },
        },
      }),
    );

    expect(queryClient.getQueryData(queryKey)).toEqual([]);
  });

  it("updates cached diffs from session diff events", async () => {
    const queryClient = new QueryClient();
    const queryKey = opencodeQueryKeys.diff({ ...config, sessionId: "session-1" });
    queryClient.setQueryData(queryKey, []);

    await applyOpenCodeEventToQueryCache(
      queryClient,
      makeEvent({
        payload: {
          type: "session.diff",
          properties: {
            sessionID: "session-1",
            diff: [
              {
                file: "src/app.ts",
                before: "old",
                after: "new",
                additions: 3,
                deletions: 1,
                status: "modified",
              },
            ],
          },
        },
      }),
    );

    expect(queryClient.getQueryData(queryKey)).toEqual([
      {
        file: "src/app.ts",
        before: "old",
        after: "new",
        additions: 3,
        deletions: 1,
        status: "modified",
      },
    ]);
  });

  it("updates status, session details, and vcs branch for the active directory", async () => {
    const queryClient = new QueryClient();
    const statusesKey = opencodeQueryKeys.statuses(config);
    const sessionKey = opencodeQueryKeys.session({ ...config, sessionId: "session-1" });
    const sessionsKey = opencodeQueryKeys.sessions({ ...config, roots: true, limit: 200 });
    const vcsKey = opencodeQueryKeys.vcs({ ...config, directory: "/tmp/project-a/worktree-a" });
    queryClient.setQueryData(statusesKey, {} as Record<string, OpenCodeRuntimeStatus>);
    queryClient.setQueryData(sessionKey, makeSession());
    queryClient.setQueryData(sessionsKey, [makeSession()]);
    queryClient.setQueryData(vcsKey, { branch: "main" });

    await applyOpenCodeEventToQueryCache(
      queryClient,
      makeEvent({
        payload: {
          type: "session.status",
          properties: {
            sessionID: "session-1",
            status: { type: "busy" },
          },
        },
      }),
    );

    await applyOpenCodeEventToQueryCache(
      queryClient,
      makeEvent({
        payload: {
          type: "session.updated",
          properties: {
            info: makeSession({ title: "Updated title", time: { created: 1, updated: 3 } }),
          },
        },
      }),
    );

    await applyOpenCodeEventToQueryCache(
      queryClient,
      makeEvent({
        directory: "/tmp/project-a/worktree-a",
        payload: {
          type: "vcs.branch.updated",
          properties: {
            branch: "feature/opencode",
          },
        },
      }),
    );

    expect(
      queryClient.getQueryData<Record<string, OpenCodeRuntimeStatus>>(statusesKey)?.["session-1"],
    ).toEqual({
      type: "busy",
    });
    expect(queryClient.getQueryData<OpenCodeSession>(sessionKey)?.title).toBe("Updated title");
    expect(queryClient.getQueryData<OpenCodeSession[]>(sessionsKey)?.[0]?.title).toBe(
      "Updated title",
    );
    expect(queryClient.getQueryData<{ branch: string | null }>(vcsKey)).toEqual({
      branch: "feature/opencode",
    });
  });
});
