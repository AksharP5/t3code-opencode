import { type OpenCodeMessage, type OpenCodeSessionSummary } from "@t3tools/contracts";
import { describe, expect, it } from "vitest";
import { mapOpenCodeMessage, mapOpenCodeProjects, mapOpenCodeThreadSummary } from "./mappers";

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

  it("maps OpenCode threads with restricted capabilities", () => {
    const thread = mapOpenCodeThreadSummary({
      session: makeSessionSummary(),
      projectId: "project-1",
      status: { type: "idle" },
    });

    expect(thread.source).toBe("opencode");
    expect(thread.capabilities).toMatchObject({
      branchSelection: false,
      composerImages: false,
      diff: false,
      interrupt: true,
      planMode: false,
      projectScripts: false,
      runtimeMode: false,
    });
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

    expect(message.text).toContain("Used tool `bash`.");
    expect(message.text).toContain("git status");
    expect(message.streaming).toBe(true);
  });
});
