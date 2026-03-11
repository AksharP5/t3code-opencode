import type {
  OpenCodeEvent,
  OpenCodeFileDiff,
  OpenCodeMessage,
  OpenCodeMessageInfo,
  OpenCodeMessagePart,
  OpenCodePermissionRequest,
  OpenCodeQuestionRequest,
  OpenCodeRuntimeStatus,
  OpenCodeSession,
  OpenCodeSessionSummary,
  OpenCodeTodo,
} from "@t3tools/contracts";
import type { QueryClient } from "@tanstack/react-query";
import { opencodeQueryKeys } from "./reactQuery";

type QueryKey = readonly unknown[];

export function applyOpenCodeEventToQueryCache(
  queryClient: QueryClient,
  event: OpenCodeEvent,
): Promise<void> {
  const type = event.payload.type;
  if (type === "server.connected" || type === "server.heartbeat") {
    return Promise.resolve();
  }

  if (type === "message.updated") {
    const info = getMessageInfo(event);
    if (info) {
      updateMessageQueries(queryClient, info.sessionID, (messages) =>
        upsertMessageInfo(messages, info),
      );
      return Promise.resolve();
    }
  }

  if (type === "message.removed") {
    const properties = asRecord(event.payload.properties);
    const sessionId = asString(properties?.sessionID);
    const messageId = asString(properties?.messageID);
    if (sessionId && messageId) {
      updateMessageQueries(queryClient, sessionId, (messages) =>
        messages.filter((message) => message.info.id !== messageId),
      );
      return Promise.resolve();
    }
  }

  if (type === "message.part.updated") {
    const part = getMessagePart(event);
    if (part?.sessionID && part.messageID) {
      updateMessageQueries(queryClient, part.sessionID, (messages) =>
        upsertMessagePart(messages, part),
      );
      return Promise.resolve();
    }
  }

  if (type === "message.part.delta") {
    const properties = asRecord(event.payload.properties);
    const sessionId = asString(properties?.sessionID);
    const messageId = asString(properties?.messageID);
    const partId = asString(properties?.partID);
    const field = asString(properties?.field);
    const delta = asString(properties?.delta);
    if (sessionId && messageId && partId && field && delta) {
      updateMessageQueries(queryClient, sessionId, (messages) =>
        applyMessagePartDelta(messages, { messageId, partId, field, delta }),
      );
      return Promise.resolve();
    }
  }

  if (type === "message.part.removed") {
    const properties = asRecord(event.payload.properties);
    const sessionId = asString(properties?.sessionID);
    const messageId = asString(properties?.messageID);
    const partId = asString(properties?.partID);
    if (sessionId && messageId && partId) {
      updateMessageQueries(queryClient, sessionId, (messages) =>
        removeMessagePart(messages, { messageId, partId }),
      );
      return Promise.resolve();
    }
  }

  if (type === "session.status") {
    const properties = asRecord(event.payload.properties);
    const sessionId = asString(properties?.sessionID);
    const status = asStatus(properties?.status);
    if (sessionId && status) {
      updateStatusesQueries(queryClient, sessionId, status);
      return Promise.resolve();
    }
  }

  if (type === "session.diff") {
    const properties = asRecord(event.payload.properties);
    const sessionId = asString(properties?.sessionID);
    const diff = Array.isArray(properties?.diff) ? (properties.diff as OpenCodeFileDiff[]) : null;
    if (sessionId && diff) {
      updateDiffQueries(queryClient, sessionId, diff);
      return Promise.resolve();
    }
  }

  if (type === "session.created" || type === "session.updated") {
    const info = getSessionInfo(event);
    if (info) {
      updateSessionListQueries(queryClient, info);
      updateSessionDetailQueries(queryClient, info);
      return Promise.resolve();
    }
  }

  if (type === "session.deleted") {
    const info = getSessionInfo(event);
    if (info) {
      removeSessionQueries(queryClient, info.id);
      return Promise.resolve();
    }
  }

  if (type === "permission.asked") {
    const request = asPermissionRequest(event.payload.properties);
    if (request) {
      updatePermissionsQueries(queryClient, (requests) =>
        upsertPermissionRequest(requests, request),
      );
      return Promise.resolve();
    }
  }

  if (type === "permission.replied") {
    const properties = asRecord(event.payload.properties);
    const requestId = asString(properties?.requestID);
    if (requestId) {
      updatePermissionsQueries(queryClient, (requests) =>
        requests.filter((request) => request.id !== requestId),
      );
      return Promise.resolve();
    }
  }

  if (type === "question.asked") {
    const request = asQuestionRequest(event.payload.properties);
    if (request) {
      updateQuestionQueries(queryClient, (requests) => upsertQuestionRequest(requests, request));
      return Promise.resolve();
    }
  }

  if (type === "question.replied" || type === "question.rejected") {
    const properties = asRecord(event.payload.properties);
    const requestId = asString(properties?.requestID);
    if (requestId) {
      updateQuestionQueries(queryClient, (requests) =>
        requests.filter((request) => request.id !== requestId),
      );
      return Promise.resolve();
    }
  }

  if (type === "todo.updated") {
    const properties = asRecord(event.payload.properties);
    const sessionId = asString(properties?.sessionID);
    const todos = Array.isArray(properties?.todos) ? (properties.todos as OpenCodeTodo[]) : null;
    if (sessionId && todos) {
      updateTodoQueries(queryClient, sessionId, todos);
      return Promise.resolve();
    }
  }

  if (type === "vcs.branch.updated") {
    const properties = asRecord(event.payload.properties);
    const branch = asString(properties?.branch);
    updateVcsQueries(queryClient, event.directory, branch);
    return Promise.resolve();
  }

  return invalidateOpenCodeQueriesForEvent(queryClient, event);
}

function invalidateOpenCodeQueriesForEvent(
  queryClient: QueryClient,
  event: OpenCodeEvent,
): Promise<void> {
  const type = event.payload.type;
  const tasks: Promise<unknown>[] = [];
  const sessionId = getOpenCodeEventSessionId(event);
  if (sessionId) {
    tasks.push(invalidateOpenCodeSessionQueries(queryClient, sessionId));
  }

  if (type.startsWith("message.")) {
    tasks.push(queryClient.invalidateQueries({ queryKey: ["opencode", "messages"] }));
    tasks.push(queryClient.invalidateQueries({ queryKey: ["opencode", "statuses"] }));
  }

  if (type.startsWith("session.")) {
    tasks.push(queryClient.invalidateQueries({ queryKey: ["opencode", "sessions"] }));
    tasks.push(queryClient.invalidateQueries({ queryKey: ["opencode", "statuses"] }));
  }

  if (type.startsWith("permission.")) {
    tasks.push(queryClient.invalidateQueries({ queryKey: ["opencode", "permissions"] }));
    tasks.push(queryClient.invalidateQueries({ queryKey: ["opencode", "session"] }));
  }

  if (type.startsWith("question.")) {
    tasks.push(queryClient.invalidateQueries({ queryKey: ["opencode", "questions"] }));
  }

  if (type.startsWith("todo.")) {
    tasks.push(queryClient.invalidateQueries({ queryKey: ["opencode", "todo"] }));
  }

  if (type.startsWith("vcs.")) {
    tasks.push(queryClient.invalidateQueries({ queryKey: ["opencode", "vcs"] }));
  }

  if (type.startsWith("worktree.") || type.startsWith("project.")) {
    tasks.push(queryClient.invalidateQueries({ queryKey: ["opencode", "projects"] }));
    tasks.push(queryClient.invalidateQueries({ queryKey: ["opencode", "sessions"] }));
    tasks.push(queryClient.invalidateQueries({ queryKey: ["opencode", "vcs"] }));
  }

  if (tasks.length === 0) {
    tasks.push(queryClient.invalidateQueries({ queryKey: opencodeQueryKeys.all }));
  }

  return Promise.all(tasks).then(() => undefined);
}

function getOpenCodeEventSessionId(event: OpenCodeEvent): string | null {
  const properties = asRecord(event.payload.properties);
  if (properties?.sessionID && typeof properties.sessionID === "string") {
    return properties.sessionID;
  }
  const info = asRecord(properties?.info);
  if (info?.sessionID && typeof info.sessionID === "string") {
    return info.sessionID;
  }
  const part = asRecord(properties?.part);
  if (part?.sessionID && typeof part.sessionID === "string") {
    return part.sessionID;
  }
  return null;
}

function invalidateOpenCodeSessionQueries(
  queryClient: QueryClient,
  sessionId: string,
): Promise<void> {
  return Promise.all([
    queryClient.invalidateQueries({
      queryKey: ["opencode", "session"],
      predicate: (query) => sessionIdMatchesQueryInput(query.queryKey, sessionId),
    }),
    queryClient.invalidateQueries({
      queryKey: ["opencode", "messages"],
      predicate: (query) => sessionIdMatchesQueryInput(query.queryKey, sessionId),
    }),
  ]).then(() => undefined);
}

function updateMessageQueries(
  queryClient: QueryClient,
  sessionId: string,
  update: (messages: OpenCodeMessage[]) => OpenCodeMessage[],
) {
  for (const [queryKey, data] of queryClient.getQueriesData<OpenCodeMessage[]>({
    queryKey: ["opencode", "messages"],
  })) {
    if (!sessionIdMatchesQueryInput(queryKey, sessionId)) {
      continue;
    }
    queryClient.setQueryData(queryKey, update(data ?? []));
  }
}

function updateSessionListQueries(queryClient: QueryClient, session: OpenCodeSessionSummary) {
  for (const [queryKey, data] of queryClient.getQueriesData<OpenCodeSessionSummary[]>({
    queryKey: ["opencode", "sessions"],
  })) {
    queryClient.setQueryData(queryKey, upsertSessionSummary(data ?? [], session));
  }
}

function updateSessionDetailQueries(queryClient: QueryClient, session: OpenCodeSession) {
  for (const [queryKey] of queryClient.getQueriesData<OpenCodeSession>({
    queryKey: ["opencode", "session"],
  })) {
    if (!sessionIdMatchesQueryInput(queryKey, session.id)) {
      continue;
    }
    queryClient.setQueryData(queryKey, (current: OpenCodeSession | undefined) => ({
      ...(current ?? session),
      ...session,
    }));
  }
}

function removeSessionQueries(queryClient: QueryClient, sessionId: string) {
  for (const [queryKey, data] of queryClient.getQueriesData<OpenCodeSessionSummary[]>({
    queryKey: ["opencode", "sessions"],
  })) {
    queryClient.setQueryData(
      queryKey,
      (data ?? []).filter((session) => session.id !== sessionId),
    );
  }

  for (const [queryKey] of queryClient.getQueriesData<OpenCodeSession>({
    queryKey: ["opencode", "session"],
  })) {
    if (!sessionIdMatchesQueryInput(queryKey, sessionId)) {
      continue;
    }
    queryClient.removeQueries({ queryKey, exact: true });
  }

  for (const [queryKey] of queryClient.getQueriesData<OpenCodeMessage[]>({
    queryKey: ["opencode", "messages"],
  })) {
    if (!sessionIdMatchesQueryInput(queryKey, sessionId)) {
      continue;
    }
    queryClient.removeQueries({ queryKey, exact: true });
  }
}

function updateStatusesQueries(
  queryClient: QueryClient,
  sessionId: string,
  status: OpenCodeRuntimeStatus,
) {
  for (const [queryKey, data] of queryClient.getQueriesData<Record<string, OpenCodeRuntimeStatus>>({
    queryKey: ["opencode", "statuses"],
  })) {
    queryClient.setQueryData(queryKey, {
      ...data,
      [sessionId]: status,
    });
  }
}

function updatePermissionsQueries(
  queryClient: QueryClient,
  update: (requests: OpenCodePermissionRequest[]) => OpenCodePermissionRequest[],
) {
  for (const [queryKey, data] of queryClient.getQueriesData<OpenCodePermissionRequest[]>({
    queryKey: ["opencode", "permissions"],
  })) {
    queryClient.setQueryData(queryKey, update(data ?? []));
  }
}

function updateQuestionQueries(
  queryClient: QueryClient,
  update: (requests: OpenCodeQuestionRequest[]) => OpenCodeQuestionRequest[],
) {
  for (const [queryKey, data] of queryClient.getQueriesData<OpenCodeQuestionRequest[]>({
    queryKey: ["opencode", "questions"],
  })) {
    queryClient.setQueryData(queryKey, update(data ?? []));
  }
}

function updateVcsQueries(queryClient: QueryClient, directory: string, branch: string | null) {
  for (const [queryKey] of queryClient.getQueriesData<{ branch: string | null }>({
    queryKey: ["opencode", "vcs"],
  })) {
    const input = getQueryInput(queryKey);
    if (input?.directory !== directory) {
      continue;
    }
    queryClient.setQueryData(queryKey, { branch });
  }
}

function updateTodoQueries(queryClient: QueryClient, sessionId: string, todos: OpenCodeTodo[]) {
  for (const [queryKey] of queryClient.getQueriesData<OpenCodeTodo[]>({
    queryKey: ["opencode", "todo"],
  })) {
    if (!sessionIdMatchesQueryInput(queryKey, sessionId)) {
      continue;
    }
    queryClient.setQueryData(queryKey, todos);
  }
}

function updateDiffQueries(queryClient: QueryClient, sessionId: string, diff: OpenCodeFileDiff[]) {
  for (const [queryKey] of queryClient.getQueriesData<OpenCodeFileDiff[]>({
    queryKey: ["opencode", "diff"],
  })) {
    if (!sessionIdMatchesQueryInput(queryKey, sessionId)) {
      continue;
    }
    queryClient.setQueryData(queryKey, diff);
  }
}

function upsertSessionSummary(
  sessions: OpenCodeSessionSummary[],
  session: OpenCodeSessionSummary,
): OpenCodeSessionSummary[] {
  const existingIndex = sessions.findIndex((entry) => entry.id === session.id);
  if (existingIndex === -1) {
    return [...sessions, session].toSorted((left, right) => right.time.updated - left.time.updated);
  }
  const next = [...sessions];
  next[existingIndex] = {
    ...next[existingIndex],
    ...session,
  };
  return next;
}

function upsertMessageInfo(
  messages: OpenCodeMessage[],
  info: OpenCodeMessageInfo,
): OpenCodeMessage[] {
  const existingIndex = messages.findIndex((message) => message.info.id === info.id);
  if (existingIndex === -1) {
    return [...messages, { info, parts: [] }].toSorted(sortMessages);
  }
  const next = [...messages];
  const existing = next[existingIndex];
  if (!existing) {
    return messages;
  }
  next[existingIndex] = {
    ...existing,
    info: {
      ...existing.info,
      ...info,
    },
  };
  return next;
}

function upsertMessagePart(
  messages: OpenCodeMessage[],
  part: OpenCodeMessagePart,
): OpenCodeMessage[] {
  return messages.map((message) => {
    if (message.info.id !== part.messageID) {
      return message;
    }
    const existingIndex = message.parts.findIndex((entry) => entry.id === part.id);
    if (existingIndex === -1) {
      return {
        ...message,
        parts: [...message.parts, part],
      };
    }
    const parts = [...message.parts];
    parts[existingIndex] = {
      ...parts[existingIndex],
      ...part,
    };
    return {
      ...message,
      parts,
    };
  });
}

function applyMessagePartDelta(
  messages: OpenCodeMessage[],
  input: { messageId: string; partId: string; field: string; delta: string },
): OpenCodeMessage[] {
  return messages.map((message) => {
    if (message.info.id !== input.messageId) {
      return message;
    }
    return {
      ...message,
      parts: message.parts.map((part) => {
        if (part.id !== input.partId) {
          return part;
        }
        const currentValue = part[input.field as keyof OpenCodeMessagePart];
        const nextValue = `${typeof currentValue === "string" ? currentValue : ""}${input.delta}`;
        return {
          ...part,
          [input.field]: nextValue,
        };
      }),
    };
  });
}

function removeMessagePart(
  messages: OpenCodeMessage[],
  input: { messageId: string; partId: string },
): OpenCodeMessage[] {
  return messages.map((message) => {
    if (message.info.id !== input.messageId) {
      return message;
    }
    return {
      ...message,
      parts: message.parts.filter((part) => part.id !== input.partId),
    };
  });
}

function upsertPermissionRequest(
  requests: OpenCodePermissionRequest[],
  request: OpenCodePermissionRequest,
): OpenCodePermissionRequest[] {
  const existingIndex = requests.findIndex((entry) => entry.id === request.id);
  if (existingIndex === -1) {
    return [...requests, request];
  }
  const next = [...requests];
  next[existingIndex] = request;
  return next;
}

function upsertQuestionRequest(
  requests: OpenCodeQuestionRequest[],
  request: OpenCodeQuestionRequest,
): OpenCodeQuestionRequest[] {
  const existingIndex = requests.findIndex((entry) => entry.id === request.id);
  if (existingIndex === -1) {
    return [...requests, request];
  }
  const next = [...requests];
  next[existingIndex] = request;
  return next;
}

function sortMessages(left: OpenCodeMessage, right: OpenCodeMessage): number {
  return left.info.time.created - right.info.time.created;
}

function getQueryInput(queryKey: QueryKey): Record<string, unknown> | null {
  const input = queryKey[2];
  return input && typeof input === "object" ? (input as Record<string, unknown>) : null;
}

function sessionIdMatchesQueryInput(queryKey: QueryKey, sessionId: string): boolean {
  return getQueryInput(queryKey)?.sessionId === sessionId;
}

function getSessionInfo(event: OpenCodeEvent): OpenCodeSession | null {
  const properties = asRecord(event.payload.properties);
  const info = asRecord(properties?.info);
  if (!info) {
    return null;
  }
  return info as OpenCodeSession;
}

function getMessageInfo(event: OpenCodeEvent): OpenCodeMessageInfo | null {
  const properties = asRecord(event.payload.properties);
  const info = asRecord(properties?.info);
  if (!info) {
    return null;
  }
  return info as OpenCodeMessageInfo;
}

function getMessagePart(event: OpenCodeEvent): OpenCodeMessagePart | null {
  const properties = asRecord(event.payload.properties);
  const part = asRecord(properties?.part);
  if (!part) {
    return null;
  }
  return part as OpenCodeMessagePart;
}

function asPermissionRequest(value: unknown): OpenCodePermissionRequest | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }
  if (!asString(record.id) || !asString(record.sessionID) || !asString(record.permission)) {
    return null;
  }
  return record as OpenCodePermissionRequest;
}

function asQuestionRequest(value: unknown): OpenCodeQuestionRequest | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }
  if (!asString(record.id) || !asString(record.sessionID) || !Array.isArray(record.questions)) {
    return null;
  }
  return record as OpenCodeQuestionRequest;
}

function asStatus(value: unknown): OpenCodeRuntimeStatus | null {
  const record = asRecord(value);
  const type = asString(record?.type);
  if (!type) {
    return null;
  }
  if (type === "idle" || type === "busy") {
    return { type };
  }
  if (type === "retry") {
    const attempt = typeof record?.attempt === "number" ? record.attempt : null;
    const message = asString(record?.message);
    const next = typeof record?.next === "number" ? record.next : null;
    if (attempt !== null && message && next !== null) {
      return { type, attempt, message, next };
    }
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}
