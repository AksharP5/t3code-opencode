import {
  ApprovalRequestId,
  EventId,
  type OpenCodeEvent,
  type UserInputQuestion,
  ThreadId,
  type OrchestrationThreadActivity,
} from "@t3tools/contracts";
import { create } from "zustand";

const MAX_ACTIVITIES_PER_THREAD = 50;

interface OpenCodeEventActivityState {
  activitiesByThreadId: Record<ThreadId, OrchestrationThreadActivity[]>;
  ingestEvent: (event: OpenCodeEvent) => void;
  clearThread: (threadId: ThreadId) => void;
}

export const useOpenCodeEventActivityStore = create<OpenCodeEventActivityState>()((set) => ({
  activitiesByThreadId: {},
  ingestEvent: (event) => {
    if (event.payload.type === "session.deleted") {
      const sessionId = getSessionId(asRecord(event.payload.properties));
      if (!sessionId) {
        return;
      }
      const threadId = ThreadId.makeUnsafe(sessionId);
      set((state) => {
        if (!(threadId in state.activitiesByThreadId)) {
          return state;
        }
        const next = { ...state.activitiesByThreadId };
        delete next[threadId];
        return { activitiesByThreadId: next };
      });
      return;
    }
    const activity = projectActivity(event);
    if (!activity) {
      return;
    }
    set((state) => ({
      activitiesByThreadId: {
        ...state.activitiesByThreadId,
        [activity.threadId]: [
          ...(state.activitiesByThreadId[activity.threadId] ?? []),
          activity.entry,
        ].slice(-MAX_ACTIVITIES_PER_THREAD),
      },
    }));
  },
  clearThread: (threadId) => {
    set((state) => {
      if (!(threadId in state.activitiesByThreadId)) {
        return state;
      }
      const next = { ...state.activitiesByThreadId };
      delete next[threadId];
      return { activitiesByThreadId: next };
    });
  },
}));

function projectActivity(event: OpenCodeEvent): {
  threadId: ThreadId;
  entry: OrchestrationThreadActivity;
} | null {
  const properties = asRecord(event.payload.properties);
  const sessionId = getSessionId(properties);
  if (!sessionId) {
    return null;
  }

  if (event.payload.type === "session.status") {
    const status = asRecord(properties?.status);
    const type = asString(status?.type);
    if (type === "busy") {
      return buildActivity(sessionId, {
        tone: "info",
        kind: "session.status.updated",
        summary: "OpenCode is working",
        payload: { status: type },
      });
    }
    if (type === "idle") {
      return buildActivity(sessionId, {
        tone: "info",
        kind: "session.status.updated",
        summary: "OpenCode finished working",
        payload: { status: type },
      });
    }
    if (type === "retry") {
      return buildActivity(sessionId, {
        tone: "error",
        kind: "session.status.updated",
        summary: asString(status?.message) ?? "OpenCode is retrying",
        payload: { status: type, attempt: status?.attempt },
      });
    }
  }

  if (event.payload.type === "permission.asked") {
    const requestId = asString(properties?.id);
    const permission = asString(properties?.permission);
    if (!requestId || !permission) {
      return null;
    }
    const pattern =
      firstString(properties?.patterns) ?? firstString(properties?.always) ?? "this action";
    return buildActivity(sessionId, {
      tone: "approval",
      kind: "approval.requested",
      summary: "Approval requested",
      payload: {
        requestId: ApprovalRequestId.makeUnsafe(requestId),
        requestKind: permissionToRequestKind(permission),
        detail: `${permission} requires approval for ${pattern}`,
      },
    });
  }

  if (event.payload.type === "permission.replied") {
    const requestId = asString(properties?.requestID);
    if (!requestId) {
      return null;
    }
    return buildActivity(sessionId, {
      tone: "approval",
      kind: "approval.resolved",
      summary: "Approval resolved",
      payload: {
        requestId: ApprovalRequestId.makeUnsafe(requestId),
      },
    });
  }

  if (event.payload.type === "question.asked") {
    const requestId = asString(properties?.id);
    const rawQuestions = Array.isArray(properties?.questions) ? properties.questions : null;
    const questions = rawQuestions ? toUserInputQuestions(requestId, rawQuestions) : null;
    if (!requestId || !questions || questions.length === 0) {
      return null;
    }
    return buildActivity(sessionId, {
      tone: "info",
      kind: "user-input.requested",
      summary: "Question requires response",
      payload: {
        requestId: ApprovalRequestId.makeUnsafe(requestId),
        questions,
      },
    });
  }

  if (event.payload.type === "question.replied" || event.payload.type === "question.rejected") {
    const requestId = asString(properties?.requestID);
    if (!requestId) {
      return null;
    }
    return buildActivity(sessionId, {
      tone: "info",
      kind: "user-input.resolved",
      summary: "Question resolved",
      payload: {
        requestId: ApprovalRequestId.makeUnsafe(requestId),
      },
    });
  }

  if (event.payload.type === "session.error") {
    const error = asRecord(properties?.error);
    const detail =
      asString(error?.message) ??
      asString(error?.name) ??
      "OpenCode reported an error for this session.";
    return buildActivity(sessionId, {
      tone: "error",
      kind: "session.error",
      summary: detail,
      payload: { detail },
    });
  }

  return null;
}

function buildActivity(
  sessionId: string,
  input: Pick<OrchestrationThreadActivity, "tone" | "kind" | "summary" | "payload">,
): {
  threadId: ThreadId;
  entry: OrchestrationThreadActivity;
} {
  const createdAt = new Date().toISOString();
  return {
    threadId: ThreadId.makeUnsafe(sessionId),
    entry: {
      id: EventId.makeUnsafe(`opencode-${sessionId}-${createdAt}-${input.kind}`),
      tone: input.tone,
      kind: input.kind,
      summary: input.summary,
      payload: input.payload,
      turnId: null,
      createdAt,
    },
  };
}

function getSessionId(properties: Record<string, unknown> | null): string | null {
  const direct = asString(properties?.sessionID);
  if (direct) {
    return direct;
  }
  const info = asRecord(properties?.info);
  return asString(info?.sessionID);
}

function permissionToRequestKind(permission: string): "command" | "file-read" | "file-change" {
  if (permission === "read") {
    return "file-read";
  }
  if (["edit", "write", "patch", "multiedit"].includes(permission)) {
    return "file-change";
  }
  return "command";
}

function firstString(value: unknown): string | null {
  if (!Array.isArray(value)) {
    return null;
  }
  for (const item of value) {
    const candidate = asString(item);
    if (candidate) {
      return candidate;
    }
  }
  return null;
}

function toUserInputQuestions(
  requestId: string | null,
  questions: unknown[],
): UserInputQuestion[] | null {
  if (!requestId) {
    return null;
  }
  const mapped = questions.flatMap((question, index) => {
    const record = asRecord(question);
    const header = asString(record?.header);
    const prompt = asString(record?.question);
    const options = Array.isArray(record?.options)
      ? record.options.flatMap((option) => {
          const optionRecord = asRecord(option);
          const label = asString(optionRecord?.label);
          const description = asString(optionRecord?.description);
          if (!label || !description) {
            return [];
          }
          return [{ label, description }];
        })
      : [];
    if (!header || !prompt || options.length === 0) {
      return [];
    }
    return [
      {
        id: `${requestId}:${index}`,
        header,
        question: prompt,
        options,
      },
    ];
  });
  return mapped.length > 0 ? mapped : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}
