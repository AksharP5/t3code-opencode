import {
  type OpenCodeAgent,
  type OpenCodeMessage,
  type OpenCodeProviderCatalog,
  type OpenCodeSession,
  type OpenCodeSessionSummary,
} from "@t3tools/contracts";
import { describe, expect, it } from "vitest";
import {
  buildOpenCodeAgentCatalog,
  mapOpenCodeMessage,
  mapOpenCodeProjects,
  mapOpenCodeThreadDetail,
  mapOpenCodeThreadSummary,
} from "./mappers";

function makeSessionSummary(
  overrides: Partial<OpenCodeSessionSummary> = {},
): OpenCodeSessionSummary {
  return {
    id: "session-1",
    directory: "/tmp/project-a",
    title: "Build feature",
    time: {
      created: 1,
      updated: 2,
    },
    ...overrides,
  } as OpenCodeSessionSummary;
}

function makeMessage(overrides: Partial<OpenCodeMessage> = {}): OpenCodeMessage {
  return {
    info: {
      id: "message-1",
      sessionID: "session-1",
      role: "assistant",
      time: {
        created: 1,
      },
    },
    parts: [],
    ...overrides,
  } as OpenCodeMessage;
}

function makeProviderCatalog(): OpenCodeProviderCatalog {
  return {
    all: [
      {
        id: "anthropic",
        name: "Anthropic",
        source: "api",
        env: [],
        options: {},
        models: {
          "claude-3-7-sonnet": {
            id: "claude-3-7-sonnet",
            providerID: "anthropic",
            name: "Claude 3.7 Sonnet",
            capabilities: {
              temperature: true,
              reasoning: true,
              attachment: true,
              toolcall: true,
              input: {
                text: true,
                audio: false,
                image: true,
                video: false,
                pdf: true,
              },
              output: {
                text: true,
                audio: false,
                image: false,
                video: false,
                pdf: false,
              },
              interleaved: false,
            },
            cost: {
              input: 1,
              output: 1,
              cache: {
                read: 0,
                write: 0,
              },
            },
            limit: {
              context: 200000,
              output: 8192,
            },
            status: "active",
            options: {},
            headers: {},
            release_date: "2025-01-01",
          },
        },
      },
    ],
    default: {
      anthropic: "claude-3-7-sonnet",
    },
    connected: ["anthropic"],
  };
}

function makeAgents(): OpenCodeAgent[] {
  return [
    {
      name: "build",
      mode: "primary",
      permission: [],
      options: {},
    },
    {
      name: "plan",
      mode: "primary",
      permission: [],
      options: {},
    },
  ];
}

describe("OpenCode mappers", () => {
  it("creates fallback projects for sessions not present in the project list", () => {
    const projects = mapOpenCodeProjects({
      projects: [],
      sessions: [
        makeSessionSummary({
          id: "session-2",
          directory: "/tmp/project-b",
          project: {
            id: "missing-project",
            worktree: "/tmp/project-b",
          },
        }),
      ],
    });

    expect(projects).toEqual([
      expect.objectContaining({
        id: "opencode:/tmp/project-b",
        cwd: "/tmp/project-b",
        name: "project-b",
        source: "opencode",
      }),
    ]);
  });

  it("maps OpenCode threads with provider-derived capabilities", () => {
    const thread = mapOpenCodeThreadSummary({
      session: makeSessionSummary({
        project: {
          id: "project-1",
          worktree: "/tmp/project-a",
        },
      }),
      projectId: "project-1",
      status: { type: "idle" },
      providerCatalog: makeProviderCatalog(),
      agentCatalog: buildOpenCodeAgentCatalog(makeAgents()),
    });

    expect(thread.source).toBe("opencode");
    expect(thread.session?.provider).toBe("anthropic");
    expect(thread.model).toBe("claude-3-7-sonnet");
    expect(thread.runtimeMode).toBe("approval-required");
    expect(thread.worktreePath).toBe("/tmp/project-a");
    expect(thread.capabilities).toMatchObject({
      branchSelection: true,
      composerImages: true,
      diff: true,
      interrupt: true,
      planMode: true,
      projectScripts: true,
      runtimeMode: true,
    });
  });

  it("maps allow-all OpenCode permissions to full access runtime mode", () => {
    const thread = mapOpenCodeThreadSummary({
      session: makeSessionSummary({
        permission: [{ permission: "*", pattern: "*", action: "allow" }],
      }),
      projectId: "project-1",
      status: { type: "idle" },
      providerCatalog: makeProviderCatalog(),
      agentCatalog: buildOpenCodeAgentCatalog(makeAgents()),
    });

    expect(thread.runtimeMode).toBe("full-access");
  });

  it("prefers summary provider and model metadata when available", () => {
    const thread = mapOpenCodeThreadSummary({
      session: makeSessionSummary({
        providerID: "anthropic",
        modelID: "claude-3-7-sonnet",
      }),
      projectId: "project-1",
      status: { type: "idle" },
      providerCatalog: makeProviderCatalog(),
      agentCatalog: buildOpenCodeAgentCatalog(makeAgents()),
    });

    expect(thread.session?.provider).toBe("anthropic");
    expect(thread.model).toBe("claude-3-7-sonnet");
  });

  it("derives plan mode from the latest OpenCode agent turn", () => {
    const thread = mapOpenCodeThreadDetail({
      session: makeSessionSummary({ directory: "/tmp/project-a/worktree-a" }) as OpenCodeSession,
      messages: [
        makeMessage({
          info: {
            id: "message-1",
            sessionID: "session-1",
            role: "user",
            agent: "plan",
            time: {
              created: 1,
            },
          },
        }),
        makeMessage({
          info: {
            id: "message-2",
            sessionID: "session-1",
            role: "assistant",
            agent: "plan",
            parentID: "message-1",
            time: {
              created: 2,
              completed: 3,
            },
          },
          parts: [{ type: "text", text: "Outline the rollout" }],
        }),
      ],
      projectId: "project-1",
      status: { type: "idle" },
      providerCatalog: makeProviderCatalog(),
      agentCatalog: buildOpenCodeAgentCatalog(makeAgents()),
    });

    expect(thread.interactionMode).toBe("plan");
    expect(thread.capabilities.planMode).toBe(true);
    expect(thread.worktreePath).toBe("/tmp/project-a/worktree-a");
    expect(thread.proposedPlans).toHaveLength(1);
    expect(thread.proposedPlans[0]?.planMarkdown).toContain("Outline the rollout");
  });

  it("synthesizes latest turn state from OpenCode messages", () => {
    const thread = mapOpenCodeThreadDetail({
      session: makeSessionSummary({ directory: "/tmp/project-a/worktree-a" }) as OpenCodeSession,
      messages: [
        makeMessage({
          info: {
            id: "message-user",
            sessionID: "session-1",
            role: "user",
            summary: {
              diffs: [
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
            time: { created: 1 },
          },
        }),
        makeMessage({
          info: {
            id: "message-assistant",
            sessionID: "session-1",
            role: "assistant",
            time: { created: 2, start: 2, completed: 3 },
          },
        }),
      ],
      projectId: "project-1",
      status: { type: "idle" },
      providerCatalog: makeProviderCatalog(),
      agentCatalog: buildOpenCodeAgentCatalog(makeAgents()),
    });

    expect(thread.latestTurn).toMatchObject({
      state: "completed",
      assistantMessageId: "message-assistant",
    });
    expect(thread.turnDiffSummaries).toEqual([
      {
        turnId: "opencode-turn-message-user",
        completedAt: new Date(3).toISOString(),
        assistantMessageId: "message-assistant",
        files: [
          {
            path: "src/app.ts",
            kind: "modified",
            additions: 3,
            deletions: 1,
          },
        ],
      },
    ]);
  });

  it("renders assistant tool-only messages into readable fallback text", () => {
    const message = mapOpenCodeMessage(
      makeMessage({
        parts: [
          {
            type: "tool",
            tool: "bash",
            state: { output: "git status\nclean" },
          },
        ],
      }),
    );

    expect(message.text).toBe("Working...");
    expect(message.structuredParts).toHaveLength(1);
    expect(message.structuredParts?.[0]?.type).toBe("tool");
    expect(message.streaming).toBe(true);
  });
});
